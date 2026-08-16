# Direct Ratchet Live-State Durability — 02: Existing Sealed-Secret Primitives, Domain Separation, and Recommendation

Companion to `01_CURRENT_LIVE_STATE_MODEL.md`. Same repo/branch/HEAD as
that file (`3b78add15642fd38af601647c7ca332b1027e658`).

## 1. `FedosSealedDirectRatchetSecretPersistence` + `AppendOnlyFedosSealedDirectRatchetSecretPersistence` — genuinely insert-only

Record shape: `src/os/messenger/conversations/ratchet/fedos_sealed_direct_ratchet_secret_record.ts:51-65`
(`FedosSealedDirectRatchetSecretRecordV1`) — `sessionId`, `secretKind`
(`"root-key" | "sending-chain-key" | "receiving-chain-key" |
"local-ratchet-private-key" | "skipped-message-key"`, `:33-38`),
`generation`, `chainCounter` (required only for `"skipped-message-key"`,
forbidden otherwise — `:100-108`), `sealingSuite`, `suite`, `sealedBlob`
(opaque hex), `createdAt`, `integrityContext` (non-authoritative structural
label, `:80-87`).

Lookup key, used both as the record's own logical primary key and by the
durable backend's conflict check:
```ts
// :138-145
export function fedosSealedDirectRatchetSecretRecordKey(input: {
  readonly sessionId: string; readonly secretKind: string;
  readonly generation: number; readonly chainCounter: number | null;
}): string {
  return buildIntegrityContext(input);
}
```
i.e. `sessionId|secretKind|generation|chainCounter-or-"none"`.

Durable backend: `persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.ts`.
**Confirmed genuinely insert-only, not "latest wins":**
```ts
// :78-90
putSealedSecret(record: FedosSealedDirectRatchetSecretRecordV1): FedosSealedDirectRatchetSecretPersistenceWriteResult {
  const key = fedosSealedDirectRatchetSecretRecordKey(record);
  const existing = this.getSealedSecret(key);
  if (existing !== null) {
    return recordsAreIdenticalByValue(existing, record) ? "already-present" : "conflict";
  }
  try { appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8"); } catch { return "failed"; }
  return "written";
}
```
A second write under the *same* key with *different* content is
`"conflict"`, never a silent overwrite — and `replayLog()` (`:43-69`)
**throws** on a genuine conflicting duplicate found in the log
(`:62-66`), matching the file's own header claim
("insert-only... a conflicting duplicate key THROWS on replay", `:1-11`).

**Why the four fixed-kind secrets cannot reuse this store as-is**: for
`"root-key"`/`"sending-chain-key"`/`"receiving-chain-key"`/
`"local-ratchet-private-key"`, `chainCounter` is forced `null`
(`fedos_sealed_direct_ratchet_secret_record.ts:104-108`), so the lookup key
degenerates to `sessionId|secretKind|generation|none` — fixed for the
*entire generation*. Since the real Rust ratchet core's `encrypt()`/
`decrypt()` genuinely advances the sending/receiving chain key on **every
message within the same generation** (confirmed against the Rust boundary:
`FedosDirectRatchetSession::restore()` takes given chain-key bytes literally,
never re-derives/fast-forwards them from the counter — this is stated
explicitly in `fedos_direct_ratchet_live_state_snapshot_persistence.ts:20-26`
and is consistent with `direct_ratchet_session.rs`'s `restore()`, which
takes `sending_chain_key`/`receiving_chain_key` as direct
`Option<SecretHandle>` inputs, `:514-566`, with no counter-driven
re-derivation step anywhere in that function), a second seal of a *changed*
chain key under the *same* key would hit `"conflict"` on this store — this
store is structurally the wrong shape for a value that mutates within a
fixed `(sessionId, generation)` scope. This is exactly why the codebase
already introduced a **second, separate, small, current-value port**
(`FedosDirectRatchetLiveStateSnapshotPersistence`) instead of forcing this
one to serve double duty.

`"skipped-message-key"` entries, by contrast, are a **genuine correct fit**
for this store: `chainCounter` is required and unique per entry
(`:104-105`), so `(sessionId, secretKind="skipped-message-key", generation,
chainCounter)` is a real one-shot key that is written exactly once and
never re-written — matching the store's own insert-only contract precisely.
This confirms the checkpoint file's routing decision
(`fedos_direct_ratchet_secret_checkpoint.ts:93-106`) is correct, not
incidental.

## 2. Second precedent: `FedosPeerDeviceAnnouncementObservationV1` — append-only, current-derived-at-read-time

`src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_observation.ts:1-15`:
> "Append-only; 'current vs superseded' is NEVER a stored flag, always
> derived at read time from the full fact set for a `(localDeviceRef,
> peerAccountRef, deviceId)` key — mirrors
> `identity_transition`'s `isFedosIdentityTransitionFactSuperseded()`
> pattern."

This is a **third, distinct shape** from both #1 above and the
current-value port: every fact is inserted (never conflict-checked away),
and "what's current" is a pure function computed by the *reader*, scanning
the full fact history each time. It's the right shape when superseding is
itself meaningful application state (you may want to know a device was
*previously* announced with different capabilities). The codebase's own
comments (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:28-35`)
explicitly chose **not** to reuse this shape for the four-fixed-kind
secrets, instead building a dedicated `put`/`get` port modeled on
`FedosDirectRatchetRemotePublicKeyPersistence`. That's a defensible
narrower-surface choice (2 methods vs. a `list()`-and-derive contract), but
note that the *actual* `File*` implementation of that dedicated port
(`fedos_direct_ratchet_live_state_snapshot_persistence.ts:76-121`) still
physically implements it as an append-only NDJSON file with
"last-line-for-this-key-wins" derivation on read (`:87-120`) — i.e. it
re-derives the same "current-vs-superseded, derived at read time" idea
internally, just without exposing a `list()`/history API. So the two
precedents converge on the same physical mechanism; the interface is just
narrower. This matters for §6's recommendation: it means adding
compaction/rewrite to the live-state file does not require inventing a
fourth pattern — the `FileFedosSealedMasterSeedEnvelopePersistence`
single-file precedent (§3 below) already demonstrates the alternative
"rewrite in place" shape this codebase also already uses.

## 3. Third precedent: `FedosSealedMasterSeedEnvelopePersistence` — single-file, write-once, no update

`src/os/core/vault/wasm/fedos_sealed_master_seed_envelope_persistence.ts`.
Interface (`:74-81`): `read()` / `writeIfAbsent()` / `delete()` — **no
overwrite method at all**. `writeIfAbsent()` refuses if the file already
exists (`:105-113`, `"already-exists"`), and the file's own header
(`:17-23`) states this is a deliberate policy: "never silently replace a
corrupt/unreadable seed." This is the right shape for a secret that is
sealed exactly once per profile and essentially never needs an in-place
mutation during normal operation (a real seed rotation would go through an
explicit, guarded `delete()` + re-seal, not a silent overwrite).

**Summary of the three existing "durably persist encrypted secret
material" conventions in this codebase:**

| Pattern | Example | Update semantics | Fits the 4 fixed-kind ratchet secrets? |
|---|---|---|---|
| Insert-only event log, conflict-checked | `AppendOnlyFedosSealedDirectRatchetSecretPersistence` | Never overwrite; same key + different value = `"conflict"` | No — chain keys mutate within a fixed `(sessionId, generation)` |
| Append-only log, "latest wins" derived at read | `FedosPeerDeviceAnnouncementObservationV1` (interface-level); `FileFedosDirectRatchetLiveStateSnapshotPersistence` / `FileFedosDirectRatchetRemotePublicKeyPersistence` (implementation-level, already built) | Every write appended; reader derives current value | Yes, functionally — but see §6 forward-secrecy caveat for the snapshot case specifically |
| Single-file, write-once, explicit guarded delete | `FileFedosSealedMasterSeedEnvelopePersistence` | No in-place update; delete-then-recreate only | Plausible alternative for the snapshot store — see §6 |

None of these needed to be invented for this task — the codebase already
has all three, and the current-value port used for the four fixed-kind
secrets is a correct, precedented choice of shape #2.

## 4. `sealState()` / `restore()` trace

`FedosDirectRatchetCryptographicSession.sealState()` —
`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.ts:509-559`:
calls, in order, `attemptDevOnlyDirectRatchetSealRootKeyCall` (required —
`null` short-circuits the whole method, `:522`),
`...SealSendingChainKeyCall`, `...SealReceivingChainKeyCall` (both allowed
to come back `null`, i.e. "not yet present," and are passed through as-is),
`...SealLocalRatchetPrivateKeyCall` (required, `:541`), and
`...SealAllSkippedKeysCall` (best-effort list, parsed via
`parseSealedSkippedKeyEntry`, `:548-550`). Every one of these ultimately
reaches the Rust boundary's `seal_root_key`/`seal_sending_chain_key`/
`seal_receiving_chain_key`/`seal_local_ratchet_private_key`/
`seal_all_skipped_keys` (`packages/fedos-core-rust/src/lib.rs:13241-13344`),
each of which is a thin wrapper that pulls the specific 32-byte field via
`*_bytes_for_sealing()` and calls the **one shared**
`FedosMasterSeedAuthority::seal_direct_ratchet_secret()`
(`lib.rs:12741-12785`, called at `:13249`, `:13268`, `:13287`, `:13306`,
`:13332`) — confirmed: **the sealing mechanism is identical across every
field and across both destination stores.** There is no structural
difference in how a root key vs. a skipped-message-key is sealed; the only
difference is which persistence port the checkpoint file routes the
resulting ciphertext string to.

`.restore()` (`fedos_direct_ratchet_cryptographic_session.ts:430-468`) is
symmetric: it hands all four fixed-kind sealed blobs plus the flattened
skipped-key strings into one `attemptDevOnlyDirectRatchetRestoreCall`,
which on the production path reaches `FedosDirectRatchetSession::restore()`
(Rust, `lib.rs:13354-13480`), which itself calls the shared
`restore_32()` helper (`:13372-13396`) — a thin wrapper around
`FedosMasterSeedAuthority::restore_direct_ratchet_secret()`
(`lib.rs:12797-12840`) — once per fixed field and once per skipped-key
entry (`:13398-13445`). Same conclusion: one restore mechanism, reused
uniformly.

`.createAsReceiver()` / `.createAsSender()`
(`fedos_direct_ratchet_cryptographic_session.ts:380-427`) never touch
sealing at all — they call `initialize_as_receiver`/`initialize_as_sender`
directly and produce a session with no sealed state yet; the very first
`checkpointFedosDirectRatchetSecretsV1()` call after creation is what
produces the first snapshot (confirmed by the checkpoint file's own header,
`fedos_direct_ratchet_secret_checkpoint.ts:20-23`: "This Arc's own
outbound/inbound integrations always checkpoint immediately after
creation").

**Confirmed: the hypothesis that "the sealing/unsealing mechanism is the
same for both destinations" is correct.** `checkpointFedosDirectRatchetSecretsV1()`
performs zero sealing itself (its own header says so explicitly,
`fedos_direct_ratchet_secret_checkpoint.ts:10-11`: "This file performs NO
sealing/unsealing of its own") — it only routes already-sealed strings
`sealState()` produced to one of two persistence ports based on
`secretKind`.

## 5. Domain separation

Two layers of domain separation both confirmed distinct from every other
sealing use in the crate:

**HKDF domain** — `HkdfDomain::DirectRatchetSealing`
(`packages/fedos-core-rust/src/lib.rs:3508-3535` enum; used at
`:12968-12971`, inside `fedos_derive_direct_ratchet_session_sealing_key_internal`,
the shared two-stage key derivation both `seal_direct_ratchet_secret` and
`restore_direct_ratchet_secret` call, `:12938-12997`). Sibling variants in
the same enum: `RootKey`, `Identity`, `Storage`, `Conversation`,
`Application`, `Nostr`, `Session`, etc. (`:3508-3533`) — `DirectRatchetSealing`
is its own, never a reuse of any of these.

**AEAD AAD domain** — `AeadAadDomain::DirectRatchetSealing`
(`packages/fedos-core-rust/src/crypto/aead_internal.rs:76-98`; used at
`seal_internal`/`open_internal` call sites,
`lib.rs:12772-12778` / `:12829-12835`). The enum's own doc comment states
the rationale explicitly (`:90-98`): "mirroring `MasterSeedSealing`'s own
reasoning exactly: binds a sealed ratchet-secret ciphertext to exactly this
purpose, so it can never be confused with a Master-Seed or Conversation
ciphertext... Deliberately its own domain, never a reuse of
`Storage`/`Conversation`." Sibling domains confirmed distinct: `RootKey`,
`Identity`, `Storage`, `Conversation`, `MasterSeedSealing`, and (per the
same enum, continuing past line 98) a Commerce/Product-Media domain.

**Confirmed**: if the four fixed-kind secrets reuse `seal_direct_ratchet_secret`/
`restore_direct_ratchet_secret` (which they already do, per §4), domain
separation from every other secret class in the crate is already fully
handled — no new domain-separation work is needed for a durability fix.

**One residual observation, not a blocker but worth flagging explicitly**:
the session-key derivation context inside
`fedos_derive_direct_ratchet_session_sealing_key_internal`
(`lib.rs:12952-12997`) is built from `(local_device_ref, remote_device_ref,
conversation_id, generation)` only — **it does not include `secretKind`**.
So `seal_root_key`, `seal_sending_chain_key`, `seal_receiving_chain_key`,
`seal_local_ratchet_private_key`, and every `seal_all_skipped_keys` entry
for the *same* `(sessionId, generation)` binding tuple all derive the
*identical* 32-byte session key (`lib.rs:13241-13344`, each passing the
same four arguments through to `seal_direct_ratchet_secret`) — they differ
only in the freshly-random AEAD nonce per call and in the plaintext bytes
sealed. This is cryptographically sound (same-key/random-nonce AEAD is
standard), and the codebase's own comment at `lib.rs:13232-13240`
acknowledges "no new sealed format is invented" is deliberate. But it does
mean secret-kind separation is enforced **only** by the TypeScript-side
bookkeeping (which field a given `sealedBlob` string is written into/read
from), not by the cryptography itself — a `sealedRootKey` ciphertext would
decrypt successfully if it were (by a TypeScript bug) fed into the
`sealedSendingChainKey` slot of the same session/generation, since the
underlying key and AAD domain are identical. This is a pre-existing
property of the already-shipped `seal_root_key`/etc. wrappers, not
something a durability fix introduces or needs to fix — but it's relevant
context for reviewing any new wiring code that touches these four fields:
field-to-slot correctness is a TypeScript-level invariant, not a
cryptographically-enforced one.

## 6. Recommendation: smallest safe design

**Hypothesis from the task background — "reuse the existing sealing
mechanism, just add durable persistence" — is CONFIRMED**, and even more
strongly than stated: durable persistence for both missing ports already
exists in code (`FileFedosDirectRatchetLiveStateSnapshotPersistence`,
`FileFedosDirectRatchetRemotePublicKeyPersistence`) and is already proven
correct end-to-end by a real restart-simulating test
(`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts:335-603`).
No new Rust code, no new sealing primitive, and no new TypeScript
persistence *class* needs to be designed. **This is fundamentally a wiring
gap in the desktop composition root**, not a missing-design gap.

### 6a. The trivial part: wire the two existing `File*` classes

1. Add two config fields to `fedos_desktop_runtime_config.ts` next to
   `directRatchetSealedSecretLogPath` (`:568-571`):
   `directRatchetRemotePublicKeyLogPath?: string` and
   `directRatchetLiveStateSnapshotLogPath?: string`.
2. In `fedos_desktop_runtime.ts`'s `conversationDirectRatchetDeps` object
   literal (`:1231-1259`), add two lines mirroring the existing
   `sealedSecretPersistence` line (`:1237`) exactly:
   ```ts
   remotePublicKeyPersistence: config.directRatchetRemotePublicKeyLogPath !== undefined ? new FileFedosDirectRatchetRemotePublicKeyPersistence(config.directRatchetRemotePublicKeyLogPath) : undefined,
   snapshotPersistence: config.directRatchetLiveStateSnapshotLogPath !== undefined ? new FileFedosDirectRatchetLiveStateSnapshotPersistence(config.directRatchetLiveStateSnapshotLogPath) : undefined,
   ```
   plus the two matching imports.
3. Correct the now-stale disclosure comment at
   `fedos_desktop_runtime_config.ts:557-566` (file 01 §4) — it currently
   claims no backend exists at all, which is no longer true.
4. Wire the two new config values through the same call site that already
   sets `directRatchetSealedSecretLogPath` (wherever the desktop app's
   startup composes `FedosDesktopRuntimeConfig` — outside this
   investigation's scope to locate, since it's a call-site, not a
   definition, but the pattern to follow is identical to the existing
   `*LogPath` fields).

For `remotePublicKeyPersistence` specifically, step 6a is genuinely
sufficient as-is: the value stored is a public DH key, append-forever NDJSON
has no confidentiality implication, and `FileFedosDirectRatchetRemotePublicKeyPersistence`
needs no changes.

### 6b. The part that needs real attention: forward secrecy of the durable snapshot file

**Do not wire `FileFedosDirectRatchetLiveStateSnapshotPersistence` in
unmodified without addressing this.** Its `putSnapshot()`
(`fedos_direct_ratchet_live_state_snapshot_persistence.ts:83-85`) is a pure
`appendFileSync` — it **never deletes or truncates** prior lines. Every
message that advances the sending or receiving chain key produces a fresh
`checkpointFedosDirectRatchetSecretsV1()` call (file 01 §1), which appends a
brand-new line containing a freshly-sealed **root key + sending chain key +
receiving chain key + local ratchet private key**, on top of every prior
line, forever.

This directly undermines the property Forward Secrecy exists to provide.
The in-memory Double Ratchet already correctly discards each chain key the
moment it's advanced past (that's what makes it forward-secret in RAM). But
an ever-growing on-disk log of *every* historical sealed chain-key value
means: **anyone who obtains both this log file and the Master Seed (the
same secret material `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`
already require to unseal anything) can decrypt every historical root/chain
key this session ever held**, not just the current one — because
`restore_direct_ratchet_secret` (file 02 §4) authenticates by binding
tuple + Master Seed only, and every historical line was sealed under the
exact same `(local_device_ref, remote_device_ref, conversation_id,
generation)` tuple (generation doesn't change within a session's normal
lifetime — only a session reset bumps it). Given the Master Seed, an
attacker can restore every past sealed blob independently, walk the
recovered chain keys forward, and decrypt every message ever sent in that
generation — retroactively defeating forward secrecy for the entire
on-disk history, not just leaking the current state. This is qualitatively
different from (and worse than) the current-value/"last-line-wins" ports
for public data (`remotePublicKeyPersistence`) or for genuinely one-shot
events (`skipped-message-key`, where each entry being individually
recoverable is expected and accepted, since a skipped key is deleted from
memory after use but this codebase already accepts that its *sealed* form
persists for legitimate late-delivery — that is a deliberate, narrower,
already-reviewed tradeoff, not the same shape as a *chain key* that
represents the entire forward ratchet state).

**Recommended fix, staying within the smallest-safe-change goal**: change
the snapshot store's durability shape from "append-forever NDJSON" to
"rewrite-in-place," following the *third* existing precedent in this
codebase — `FileFedosSealedMasterSeedEnvelopePersistence`'s single-file
model (§3) — rather than the append-only-log model. Concretely:

- `putSnapshot()` should atomically **replace** the file's content for that
  `sessionId` (e.g. write-to-temp-file-then-rename, the standard atomic
  overwrite idiom, or one file per `sessionId` if multiple sessions must
  coexist under one directory) instead of appending a new line — so that
  once a chain key is superseded, its sealed ciphertext is no longer
  retrievable from disk, matching the in-memory forward-secrecy guarantee
  the rest of this system already provides.
- This is a small, mechanical change to the *existing* `File*` class (or a
  new sibling class with the same interface) — it does not touch
  `checkpointFedosDirectRatchetSecretsV1()`, `sealState()`/`restore()`, or
  any Rust code. The interface (`putSnapshot`/`getSnapshot`, file 01 §2)
  does not need to change at all; only the file-level storage strategy
  inside the implementation does.
- No change is needed to `remotePublicKeyPersistence` or to the
  `skipped-message-key` append-only store — both are already the right
  shape for what they hold (public data, and genuinely one-shot secrets,
  respectively).

### 6c. Summary of the smallest safe design

1. Wire `FileFedosDirectRatchetRemotePublicKeyPersistence` into the
   composition root as-is (§6a) — no code changes to the class itself.
2. Replace (or add a sibling to) `FileFedosDirectRatchetLiveStateSnapshotPersistence`
   with an atomic-overwrite-in-place storage strategy instead of
   append-forever NDJSON, then wire that in (§6b) — this is the one place
   genuinely new (small) code is needed, and it is a storage-layer change
   only, reusing the identical interface, identical sealing mechanism, and
   identical domain separation already in place.
3. Correct the stale "no backend exists" comment in
   `fedos_desktop_runtime_config.ts:557-566`.
4. No Rust changes. No new sealing primitive. No new domain-separation
   value. No change to `checkpointFedosDirectRatchetSecretsV1()`/
   `restoreFedosDirectRatchetSealedStateV1()`. No change to
   `sealState()`/`restore()`. The existing restart-simulating test
   (`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`)
   already demonstrates the wiring pattern works when given file-backed
   ports directly (bypassing the composition root) — this design brings
   that same already-proven pattern into the desktop composition root's
   `directRatchetEnabled` auto-construction path, with the one storage-shape
   correction in 6b applied for forward-secrecy safety.

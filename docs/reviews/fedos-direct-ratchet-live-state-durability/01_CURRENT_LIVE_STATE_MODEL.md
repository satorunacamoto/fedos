# Direct Ratchet Live-State Durability — 01: Current Live-State Model

Agent S, read-only investigation. Repo `C:/wt/fedos-installed-startup-root-cause`,
branch `arc/fedos-installed-startup-root-cause`, HEAD
`3b78add15642fd38af601647c7ca332b1027e658` (verified via `git rev-parse HEAD`).

## 0. Headline finding (read this first)

The background brief's premise — "no durable backend exists anywhere in this
codebase for `FedosDirectRatchetLiveStateSnapshotPersistence`" — is **stale**.
A fully-implemented, restart-safe, file-backed durable variant already exists
for *both* of the ports the config comment names:

- `FileFedosDirectRatchetLiveStateSnapshotPersistence` —
  `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts:76-121`
- `FileFedosDirectRatchetRemotePublicKeyPersistence` —
  `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_remote_public_key_persistence.ts:51-85`

Both are even exercised in a real, passing end-to-end test that explicitly
simulates a restart and proves post-restart decryption works:
`test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts:73-74` (imports),
`:401` / `:443` (construction with real file paths), `:335` (`"full slice: ...
restart-continuation..."`), `:590-603` (`"after restart, still ratchet"`
plaintext assertion).

**The actual gap is narrower than "design new durability": the desktop
composition root's `directRatchetEnabled` auto-construction path
(`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1231-1259`) never
sets `remotePublicKeyPersistence`/`snapshotPersistence` on the dependency
object it builds — those two fields are simply absent from the object
literal — so `fedos_conversation_runtime.ts:759-762` always falls through to
`new InMemoryFedosDirectRatchetRemotePublicKeyPersistence()` /
`new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence()` in every real
desktop run.** This is a pure wiring/config gap, not a missing primitive —
see `02_EXISTING_SEALED_SECRET_PRIMITIVES.md` §6 for the recommended fix and
one important caveat (forward-secrecy-safe durability semantics) that the
existing `File*` class does **not** yet handle correctly.

## 1. `checkpointFedosDirectRatchetSecretsV1()` — what it does

File: `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_secret_checkpoint.ts`

```ts
// :77-107
export function checkpointFedosDirectRatchetSecretsV1(
  sealedSecretPersistence: FedosSealedDirectRatchetSecretPersistence,
  snapshotPersistence: FedosDirectRatchetLiveStateSnapshotPersistence,
  sessionId: FedosDirectRatchetSessionId,
  suite: FedosDirectRatchetSuite,
  generation: number,
  sealedState: FedosDirectRatchetSealedState,
  createdAt: number,
): void {
  snapshotPersistence.putSnapshot(sessionId as unknown as string, {
    sealedRootKey: sealedState.sealedRootKey,
    sealedSendingChainKey: sealedState.sealedSendingChainKey,
    sealedReceivingChainKey: sealedState.sealedReceivingChainKey,
    sealedLocalRatchetPrivateKey: sealedState.sealedLocalRatchetPrivateKey,
  });

  for (const entry of sealedState.sealedSkippedKeys) {
    const record = createFedosSealedDirectRatchetSecretRecordV1({
      sessionId, secretKind: "skipped-message-key", generation,
      chainCounter: entry.counter, sealingSuite: "direct-ratchet-sealing-v1",
      suite, sealedBlob: composeSkippedKeyBlob(entry), createdAt,
    });
    if (record === null) continue;
    sealedSecretPersistence.putSealedSecret(record);
  }
}
```

**The four fixed-kind secrets, confirmed by name** (each an already-sealed
hex string, `nonce || ciphertext‖tag` per the Rust boundary — see file 02):

1. `sealedRootKey` — the ratchet root key
2. `sealedSendingChainKey` — sending chain key (nullable: absent until this
   session has sent at least once, since a fresh receiver has no sending
   chain yet)
3. `sealedReceivingChainKey` — receiving chain key (nullable, symmetric
   reason)
4. `sealedLocalRatchetPrivateKey` — the local Device's own ratchet DH
   private key (never nullable — always present)

**Storage key**: `sessionId` alone (`putSnapshot(sessionId as unknown as
string, snapshot)`) — **not** `sessionId+kind`, and not `+generation`. All
four fields are written together, atomically, in one `putSnapshot()` call,
every time `checkpointFedosDirectRatchetSecretsV1()` runs (i.e. after
session creation and after every encrypt/decrypt — confirmed by its own
header comment, `:69-76`, and by its two real callers,
`fedos_direct_ratchet_outbound_integration.ts` and
`fedos_direct_ratchet_inbound_integration.ts`, both importing it). Because
`FedosDirectRatchetCryptographicSession.sealState()` re-seals **all four**
fields fresh on every call (file 02 §1), each snapshot record is
self-consistent — there is no risk of a "torn" partial-field update across
calls.

The `restoreFedosDirectRatchetSealedStateV1()` counterpart (same file,
`:118-141`) does the reverse: reads the one current snapshot for
`sessionId`, then separately scans every `"skipped-message-key"` record in
`sealedSecretPersistence` filtered to the same `(sessionId, generation)`,
and reassembles a full `FedosDirectRatchetSealedState`. `null` only if no
snapshot was ever checkpointed (`:125`) — this is exactly the `null` that
propagates up through `#restoreLiveSession()` and breaks restart when the
snapshot store is in-memory.

## 2. `FedosDirectRatchetLiveStateSnapshotPersistence` — interface and implementations

File: `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts`

Interface (`:52-55`):
```ts
export interface FedosDirectRatchetLiveStateSnapshotPersistence {
  putSnapshot(sessionId: string, snapshot: FedosDirectRatchetLiveStateSnapshotV1): void;
  getSnapshot(sessionId: string): FedosDirectRatchetLiveStateSnapshotV1 | null;
}
```
Two methods only: `put`/`get`, no `list`, no `delete`. Current-value
semantics by design — the file's own header (`:1-43`) explains *why*: the
Foundation Arc's `FedosSealedDirectRatchetSecretPersistence` is insert-only,
one fixed key per `(sessionId, secretKind, generation)`, and would
`"conflict"` on the very next message's re-seal of a chain key that
genuinely changes within the same generation (confirmed against the real
Rust boundary — `FedosDirectRatchetSession::restore()` takes chain-key bytes
literally, never fast-forwards them from a counter, `:20-26`). So this port
was deliberately added as a **separate, small, additive, last-write-wins
port**, explicitly modeled on `FedosDirectRatchetRemotePublicKeyPersistence`'s
own precedent (`:28-34`) — **not** on the append-only
"current-vs-superseded-derived-at-read-time" pattern
`fedos_peer_device_announcement_observation.ts` uses (see file 02 §2 for why
that distinction matters, and why it's actually the right call here).

Implementations, both in the same file:

- `InMemoryFedosDirectRatchetLiveStateSnapshotPersistence` (`:57-67`) — a
  bare `Map<string, Snapshot>`. This is the ONLY variant the desktop
  composition root ever actually constructs (see §4).
- `FileFedosDirectRatchetLiveStateSnapshotPersistence` (`:76-121`) — **already
  implemented, restart-safe.** NDJSON, `appendFileSync` on every
  `putSnapshot()` (`:83-85`), and `getSnapshot()` re-reads the whole file and
  keeps scanning for the *last* line matching `sessionId` (`:87-120`,
  "last line per `sessionId` wins on replay" per its own doc comment,
  `:75`). This is genuinely a durable, current-value, last-write-wins cache
  — but see file 02 §6 for why its append-forever storage shape is a real
  forward-secrecy concern that a "smallest safe design" must address, not
  just wire through unmodified.

No `list()` exists on this port (unlike the sealed-secret port) — it cannot
be queried across sessions, matching its narrow purpose.

## 3. `FedosSealedDirectRatchetSecretPersistence` — durable backend semantics

Covered in full, with the append-only-vs-overwrite question answered
explicitly (genuinely insert-only, NOT overwrite; conflict-detects on any
value change for the same key), in `02_EXISTING_SEALED_SECRET_PRIMITIVES.md`
§1, together with the `FedosPeerDeviceAnnouncementObservationV1`
"current-vs-superseded-derived-at-read-time" second precedent and how it
differs from what this domain actually needed.

## 4. Composition-root wiring gap — exact citations

`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1231-1259`
(`conversationDirectRatchetDeps`, the object built when `directRatchetEnabled`
is true and no manual `config.conversationDirectRatchet` override is
supplied):

```ts
// :1231-1243 (elided fields shown)
const conversationDirectRatchetDeps: FedosConversationDirectRatchetIntegrationDependencies | undefined =
  config.conversationDirectRatchet ??
  (config.directRatchetEnabled && directRatchetSealingAuthority !== null
    ? {
        deviceRegistry: deviceRegistryPersistence!,
        sessionPersistence: config.directRatchetSessionLogPath !== undefined ? new AppendOnlyFedosDirectRatchetSessionPersistence(config.directRatchetSessionLogPath) : undefined,
        sealedSecretPersistence: config.directRatchetSealedSecretLogPath !== undefined ? new AppendOnlyFedosSealedDirectRatchetSecretPersistence(config.directRatchetSealedSecretLogPath) : undefined,
        resetRecordPersistence: config.directRatchetResetRecordLogPath !== undefined ? new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(config.directRatchetResetRecordLogPath) : undefined,
        importRecordPersistence: config.directRatchetImportRecordLogPath !== undefined ? new AppendOnlyFedosPrivateNostrImportRecordPersistence(config.directRatchetImportRecordLogPath) : undefined,
        sealingAuthority: directRatchetSealingAuthority,
        masterSeedAuthority: directRatchetSealingAuthority,
        localDeviceRef: conversationPeerDeviceAnnouncementDeps!.localAnnouncedDeviceId,
        sendMailboxNip17Control,
        messageDelivery: /* ... */,
      }
```

Notice: `sessionPersistence`, `sealedSecretPersistence`,
`resetRecordPersistence`, `importRecordPersistence` each have a matching
`config.directRatchet*LogPath` field and a durable `AppendOnly*` constructor.
**`remotePublicKeyPersistence` and `snapshotPersistence` are absent from
this object literal entirely** — there is no `config.directRatchetRemote
PublicKeyLogPath` / `config.directRatchetLiveStateSnapshotLogPath` field
anywhere in `fedos_desktop_runtime_config.ts`, and no corresponding
`new File...()` construction in this block.

Downstream, `fedos_conversation_runtime.ts:759-762`:
```ts
remotePublicKeyPersistence:
  deps.directRatchet.remotePublicKeyPersistence ?? new InMemoryFedosDirectRatchetRemotePublicKeyPersistence(),
snapshotPersistence:
  deps.directRatchet.snapshotPersistence ?? new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence(),
```
Since `conversationDirectRatchetDeps` never sets those two fields, they are
always `undefined` on the object handed in as `deps.directRatchet`, so this
`??` always falls through to `InMemory*` in the real desktop app — **every
single real run**, regardless of `directRatchetEnabled`.

The stale disclosure comment that (correctly, at the time it was written,
but no longer today) documents this as a deliberate boundary:
`fedos_desktop_runtime_config.ts:557-566`:
```ts
/**
 * OPTIONAL. Auto-constructs `FedosConversationDirectRatchetIntegrationDependencies`
 * when `conversationDirectRatchet` was not manually supplied. NOTE: no
 * append-only backend exists anywhere in this codebase for
 * `FedosDirectRatchetRemotePublicKeyPersistence`/
 * `FedosDirectRatchetLiveStateSnapshotPersistence` — this Arc does not
 * fabricate durability for either; both remain in-memory-only even when
 * this subsystem is enabled (a genuine, disclosed, narrower boundary —
 * see the completion declaration).
 */
readonly directRatchetEnabled?: boolean;
readonly directRatchetSessionLogPath?: string;
readonly directRatchetSealedSecretLogPath?: string;
```
This comment is **now factually wrong** — both `File*` backends exist
(§2 above, and the remote-public-key file cited in §5) and are proven in a
real vertical-slice test. It was accurate about "no wiring path exists in
this config," which remains true, but its literal claim ("no append-only
backend exists anywhere in this codebase") is false as of this HEAD. Whoever
picks up the wiring fix should also correct this comment.

## 5. `#restoreLiveSession()` trace — confirms the live-repro root cause

`src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts:401-428`:
```ts
async #restoreLiveSession(
  sessionId: FedosDirectRatchetSessionId,
  remoteDeviceRef: string,
  conversationId: FedosConversationId,
  sessionMetadata: ReturnType<FedosDirectRatchetStateRuntime["getSessionMetadata"]> & {},
): Promise<FedosDirectRatchetCryptographicSession | null> {
  const sealedState = restoreFedosDirectRatchetSealedStateV1(
    this.#deps.sealedSecretPersistence,
    this.#deps.snapshotPersistence,
    sessionId,
    sessionMetadata.binding.generation,
  );
  if (sealedState === null) return null;
  const remoteRatchetPublicKeyHex = this.#deps.remotePublicKeyPersistence.getRemoteRatchetPublicKeyHex(sessionId as unknown as string);
  return FedosDirectRatchetCryptographicSession.restore(/* ...sessionMetadata.counters..., remoteRatchetPublicKeyHex, sealedState */);
}
```
(`fedos_direct_ratchet_inbound_integration.ts:561` has the symmetric
receiver-side version, same shape.)

With `snapshotPersistence` in-memory, a process restart clears the `Map`;
`restoreFedosDirectRatchetSealedStateV1()`'s `snapshotPersistence.getSnapshot(sessionId)`
(`fedos_direct_ratchet_secret_checkpoint.ts:124`) returns `null`, so
`restoreFedosDirectRatchetSealedStateV1()` short-circuits to `null`
(`:125`), and `#restoreLiveSession()` returns `null` before ever calling
`FedosDirectRatchetCryptographicSession.restore()` — this matches exactly
the live behavior confirmed in the two-process installed-binary test
described in the task background. `remotePublicKeyPersistence` being
in-memory is a secondary contributor (the restored session would get a
`null` `remoteRatchetPublicKeyHex`, which `restore()`'s Rust boundary
accepts as `Option<String>` for the *receiver* case but degrades DH-ratchet
continuity for later steps) — but the snapshot gap alone is sufficient to
fully block restore today.

## 6. Secret inventory

State needed for `FedosDirectRatchetCryptographicSession.restore()` to
succeed and produce a session functionally identical to the pre-restart
one. Rust struct fields per
`packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs:64-77`
(`DirectRatchetSessionState`) and skipped-key fields per `:47-52`
(`DirectRatchetSkippedEntry`) / `:59-62` (`StoredSkippedKey`).

| Field | Secret | Derived-from-other-state | Durable today | Required after restart | Can-be-recomputed | Must-be-sealed | Rollback-sensitive | Zeroization-needed |
|---|---|---|---|---|---|---|---|---|
| `sessionId` | No | No | Yes (`FedosDirectRatchetSessionRecordV1`, `fedos_direct_ratchet_session_record.ts:20-32`, append-only, `AppendOnlyFedosDirectRatchetSessionPersistence`) | Yes | No — it's an identifier, not computed | No | No | No |
| `localDeviceRef` / binding (`localAccountRef`, `remoteAccountRef`, `remoteDeviceRef`, `conversationId`, `suite`, `generation`) | No | No | Yes (same session record; `binding` field frozen across revisions per `:22`) | Yes | No | No | No | No |
| Lifecycle state, counters (`sendCounter`/`receiveCounter`/`previousChainCounter`), `skippedKeyReferences`, `sealedSecretRecordIds` | No (counters are explicitly `[public]`, `fedos_direct_ratchet_counters.ts:1-6`) | Counters derive from message flow, not stored secrets | Yes (same append-only session record) | Yes | No — genuinely one-way accumulated state | No | **Yes** — see note below | No |
| **`root_key`** (`sealedRootKey`) | **Yes** | Yes — a DH-ratchet KDF output of the *previous* root key + DH output (`direct_ratchet_root_kdf_internal`, not re-derivable without the prior root key itself) | **No** (in-memory `InMemoryFedosDirectRatchetLiveStateSnapshotPersistence` in production; durable `File*` variant exists but unwired, §4) | Yes | **No** — the entire point of a KDF ratchet is that it is NOT recomputable without the immediately-prior secret state; there is no alternate derivation path | Yes (already is, via `seal_root_key`, file 02 §1) | **Yes — critical.** Restoring a stale root key is safe for authenticity (`restore()` re-derives deterministically forward, fails closed via AEAD if wrong) but a rollback to an OLDER root key value combined with re-sending/re-receiving at previously-used counters risks re-deriving message keys that were already used and should have been forward-secret-erased | Yes — Rust holds it as `SecretHandle` (`root_key: SecretHandle`, `direct_ratchet_session.rs:68`), kind `DirectRatchetRootKeyMaterial` |
| **`sending_chain_key`** (`sealedSendingChainKey`, nullable) | **Yes** | Yes — chain-KDF output, advances every `encrypt()` call (`direct_ratchet_chain_kdf_internal`) | **No** (same as above) | Yes, if session has ever sent | **No** — same reasoning as root key | Yes | **Yes — critical, this is the one the file header (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:16-26`) explicitly calls out**: restoring a stale sending chain key lets the SAME message key be re-derived for a NEW plaintext at the same counter — a direct forward-secrecy break if the true post-restart send counter has moved forward from a stale snapshot | Yes — `Option<SecretHandle>`, kind `DirectRatchetChainKeyMaterial` |
| **`receiving_chain_key`** (`sealedReceivingChainKey`, nullable) | **Yes** | Same reasoning as sending chain key, receive direction | **No** | Yes, if session has ever received | **No** | Yes | **Yes** — symmetric to sending chain key | Yes — same kind, receive direction distinguished by which struct field holds it, not a separate kind label (`SecretHandleKind::DirectRatchetChainKeyMaterial`'s own doc, `lib.rs:1823-1829`) |
| **`local_keypair` (local ratchet DH private key)** (`sealedLocalRatchetPrivateKey`) | **Yes** | No — freshly random per DH ratchet step (`generate_direct_ratchet_keypair_internal`), never derived from Master Seed | **No** | Yes | **No** — it's the one piece of state that is genuinely random and would need to be a NEW keypair if lost, breaking DH ratchet continuity with the peer | Yes | **Yes** — reusing an old local ratchet private key after the peer has already advanced past it isn't itself a secrecy break by itself, but combined with a stale remote public key (below) it can desynchronize the DH ratchet, forcing a session reset | Yes — kind `DirectRatchetPrivateKeyMaterial` (`lib.rs:1830-1834`, "discarded, never reused, once superseded") |
| `remote_ratchet_public` (remote DH public key) | **No — public** | No | **No** in production (`InMemoryFedosDirectRatchetRemotePublicKeyPersistence` default); durable `File*` variant exists but unwired, §4 | Yes | N/A (public, received from peer) | N/A (never sealed — plain hex, `fedos_direct_ratchet_remote_public_key_persistence.ts:18-21`) | Not secrecy-sensitive, but a STALE value can desync the DH ratchet step (availability/correctness risk, not confidentiality) | No — not a secret |
| **`skipped_keys`** (message keys for out-of-order messages not yet consumed) | **Yes** | Derived from a chain key at time of skip, then that chain position is abandoned — the ONLY copy of that specific message key | Yes — genuinely durable today, via `AppendOnlyFedosSealedDirectRatchetSecretPersistence` and `"skipped-message-key"` records (file 02 §1) | Yes, if any are outstanding | **No** — a skipped key is a one-shot value; if lost, the corresponding out-of-order message becomes permanently undecryptable (expected/accepted behavior for skipped keys generally, but losing durability here is a data-loss bug, not a secrecy bug) | Yes (already is) | **Yes** — reusing an already-consumed-and-deleted skipped key would let an old message key decrypt something it shouldn't, but the existing insert-only/conflict-checked append-only store is the right shape for genuinely one-shot events and already handles this correctly | Yes — `StoredSkippedKey.message_key: SecretHandle` (`direct_ratchet_session.rs:60`) |

Note on counters: `previousChainCounter`/`sendCounter`/`receiveCounter` are
public-safe to persist (no secret bytes), but they are still
rollback-sensitive in combination with the chain-key rollback risk above —
a stale counter paired with a stale chain key is exactly the
"replay/reuse-a-past-message-key" scenario. The existing session-record
store is append-only/event-sourced (never overwrite) specifically to avoid
silently regressing a counter (`fedos_direct_ratchet_session_record.ts:22`).
The live-state snapshot store, by contrast, is deliberately last-write-wins
— so the counters and the sealed chain-key snapshot must always be read
**together, from a state no older than the latest checkpoint**, or the
combination becomes unsafe. See file 02 §6 for why this makes the *storage
shape* of the durable fix matter, not just "wire in the already-written
class."

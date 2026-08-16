# Direct Ratchet Live-State Durability — Restart Failure Model

Agent M. Read-only investigation. Repo `C:/wt/fedos-installed-startup-root-cause`,
branch `arc/fedos-installed-startup-root-cause`, HEAD
`3b78add15642fd38af601647c7ca332b1027e658` (verified via `git rev-parse HEAD`).

Scope: this document covers the RESTORE LIFECYCLE, startup ordering, crash-
consistency windows, and snapshot update policy for durable Direct Ratchet
live-state persistence. It assumes Agent S's persistence mechanism (reusing
`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`) is the storage
layer; this document does not redesign that mechanism. Companion document:
`04_MIGRATION_VERSIONING.md` (legacy sessions, no-invented-secrets proof,
reset-path routing, snapshot generation/version design).

## 0. What already exists today (read first — corrects a stale assumption)

The task brief states "no durable backend today" for live crypto state. That
is correct for what actually **runs**, but the codebase already contains an
unused durable implementation that has apparently sat un-wired since an
earlier arc (`b8e9e062`, well before the current HEAD):

- `FedosDirectRatchetLiveStateSnapshotPersistence` (port) —
  `src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_live_state_snapshot_persistence.ts:52-55`
- `InMemoryFedosDirectRatchetLiveStateSnapshotPersistence` — same file,
  `:57-67` — the one actually wired into production.
- `FileFedosDirectRatchetLiveStateSnapshotPersistence` — same file,
  `:76-121` — an NDJSON, append-then-replay-last-line-wins implementation
  that IS restart-safe, but is **never constructed anywhere** outside this
  file (confirmed: `grep -rn "FileFedosDirectRatchetLiveStateSnapshotPersistence"`
  across `src/` only matches its own declaration).

Confirmed live wiring, `src/os/messenger/conversations/runtime/fedos_conversation_runtime.ts:531-535` and `:761-762`:

```
/** Optional — default in-memory. See `fedos_direct_ratchet_secret_checkpoint.ts`'s own header for why this is a SEPARATE, current-value port from `sealedSecretPersistence` above. */
readonly snapshotPersistence?: FedosDirectRatchetLiveStateSnapshotPersistence;
...
snapshotPersistence:
  deps.directRatchet.snapshotPersistence ?? new InMemoryFedosDirectRatchetLiveStateSnapshotPersistence(),
```

And the Desktop Runtime's own real construction site,
`src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts:1236-1240`, wires
real `AppendOnlyFedos...` backends for `sessionPersistence`,
`sealedSecretPersistence`, `resetRecordPersistence`, `importRecordPersistence`
— but never passes `snapshotPersistence` or `remotePublicKeyPersistence`, so
both fall back to the in-memory default at `fedos_conversation_runtime.ts:761-762`
inside every real Desktop process. This is the exact, confirmed root cause
matching the task's live-testing observation: session **metadata** (via
`AppendOnlyFedosDirectRatchetSessionPersistence`) survives restart; live
crypto state (root/chain/private keys, via the in-memory snapshot port) does
not.

Whatever Agent S builds, the natural, minimum-surface fix is a
`FedosDirectRatchetLiveStateSnapshotPersistence` implementation that is
actually durable AND actually wired at `fedos_desktop_runtime.ts:1236-1240`
alongside the other four ports (a `directRatchetLiveStateSnapshotLogPath`
config field, same "AppendOnly when a log path is supplied, else InMemory"
discipline every other backend in that function already follows). The
existing `FileFedosDirectRatchetLiveStateSnapshotPersistence` is unfit as-is
for that role without the sequencing fix in §6 of `04_MIGRATION_VERSIONING.md`
— it currently has no write-ordering guard at all (plain last-line-wins).

## 1. The restore path today, traced exactly

Two call sites, structurally identical, one per direction:

- Outbound: `FedosDirectRatchetOutboundIntegration.#restoreLiveSession()` —
  `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_outbound_integration.ts:401-428`
- Inbound: `FedosDirectRatchetInboundIntegration.#restoreLiveSession()` —
  `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_inbound_integration.ts:561-586`

Both do the same three things:

1. `restoreFedosDirectRatchetSealedStateV1(sealedSecretPersistence, snapshotPersistence, sessionId, generation)` —
   `src/os/messenger/conversations/ratchet/fedos_direct_ratchet_secret_checkpoint.ts:118-141`.
   Returns `null` if `snapshotPersistence.getSnapshot(sessionId)` returns
   `null` (line 124-125) — i.e. today, on every real restart, because the
   wired backend is `InMemoryFedosDirectRatchetLiveStateSnapshotPersistence`.
2. `remotePublicKeyPersistence.getRemoteRatchetPublicKeyHex(sessionId)`.
3. `FedosDirectRatchetCryptographicSession.restore(...)` —
   `fedos_direct_ratchet_cryptographic_session.ts:430-468` — which calls into
   the Rust boundary's `restore()` with the sealed state, counters, and
   remote public key.

### Eager or lazy? Confirmed: LAZY, on first use only.

Neither integration calls `#restoreLiveSession()` outside of a live
send/receive:

- Outbound `sendMessage()` — `fedos_direct_ratchet_outbound_integration.ts:323-329`:
  ```
  let session = this.#deps.liveSessionCache.get(sessionId);
  if (session === null) {
    const restored = await this.#restoreLiveSession(sessionId, remoteDeviceRef, conversationId, sessionMetadata);
    ...
  }
  ```
- Inbound `#receiveMessage()` — `fedos_direct_ratchet_inbound_integration.ts:455-461`, identical shape.

`FedosDirectRatchetLiveSessionCache` (`fedos_direct_ratchet_live_session_cache.ts`)
is a bare in-process `Map`, constructed empty by
`FedosDirectRatchetConversationRuntime`'s constructor (`fedos_direct_ratchet_conversation_runtime.ts:147`)
every time the Runtime is constructed (i.e., every process start) — nothing
pre-populates it. `FedosDirectRatchetStateRuntime.restart()`
(`fedos_direct_ratchet_state_runtime.ts:117-127`) IS called at startup-ish
points, but it only rebuilds the skipped-key index from session **metadata**
— it does not touch `liveSessionCache` or call `#restoreLiveSession()` for
anything.

Grepped `startFedosDesktopRuntime()` end-to-end (`fedos_desktop_runtime.ts`)
for any loop over `sessionPersistence.listSessions()` that would eagerly
restore live ratchet sessions: none exists. The only comparable eager loop
in that function is the Direct Conversation **activation** re-hydration
(§2 below), which is a different subsystem (Activation persistence, not
Ratchet live state).

`getDirectRatchetStatus()` (`fedos_direct_ratchet_conversation_runtime.ts:251-280`)
also never touches the live session cache or attempts a restore — it reads
only `sessionPersistence`/`stateRuntime.getSessionMetadata()` and maps
`lifecycleState` to a safe status string. This matters for §3 of
`04_MIGRATION_VERSIONING.md`: status is metadata-only today, so it cannot
currently distinguish "durable snapshot exists" from "durable snapshot never
existed."

## 2. Startup ordering, traced in `fedos_desktop_runtime.ts` (current state, this session's own file)

Confirmed real ordering inside `startFedosDesktopRuntime()`:

1. Config validation (guards for every `*Enabled` flag, lines ~613-800).
2. Master Seed / crypto graph resolution — `directRatchetSealingAuthority`
   resolved at `fedos_desktop_runtime.ts:1139-1143`, gated on
   `isFedosDirectRatchetSealingAuthority()` (structural capability check,
   `fedos_direct_ratchet_cryptographic_session.ts:161-169` mirrors the same
   pattern one layer down). This happens BEFORE the Conversation Runtime is
   constructed.
3. `conversationDirectRatchetDeps` assembled — `:1231-1252` — this is where
   `sessionPersistence`/`sealedSecretPersistence`/`resetRecordPersistence`/
   `importRecordPersistence` get their real `AppendOnlyFedos...` backends (or
   stay `undefined` → in-memory default one layer down). **`snapshotPersistence`
   is not set here today** — see §0.
4. `conversationRuntimeInstance = new FedosConversationRuntime({...})` —
   constructed around `:1440-1468`, which is where
   `FedosDirectRatchetConversationRuntime` (and inside it, the state runtime,
   live session cache, outbound/inbound integrations) actually gets built —
   this is the point at which `snapshotPersistence`/`sealedSecretPersistence`/
   `masterSeedAuthority` are all wired together and become queryable.
5. **Eager Direct Conversation activation re-hydration** — `:1509-1512`:
   ```
   for (const draft of conversationArchiveDraftPersistence.listDrafts()) {
     if (draft.mode !== "direct") continue;
     await conversationRuntimeInstance.activateDirectConversation(draft.id);
   }
   ```
   This is this session's own prior fix (Direct Ratchet Identity-Space
   Unification arc, comment block `:1481-1508`), closing a real race: Activation
   state has no durable log of its own — it exists only as in-memory facts,
   otherwise populated solely by a LATER, UI-triggered
   `fedos-app:conversation-activate` call. Without this eager loop, an inbound
   payload arriving right after `privateTransportInstance.start()` opens
   would be rejected `"unknown-conversation"` even for a durably-known Direct
   Conversation, because nothing had told this process's in-memory Activation
   state about it yet.
6. Device Trust Runtime construction (`:1543` onward), Sync eligibility
   re-hydration from durable Device Trust facts (`:1609-1614`).
7. (Not shown in the excerpt read, but structurally later, per the file's own
   ordering discipline of "construct everything, then start transports last")
   — `privateTransportInstance.start()` opens the live/historical relay
   subscription, which is the FIRST point any inbound Gift Wrap can reach
   `FedosDirectRatchetInboundIntegration.receiveRumor()`.
8. Runtime returned to caller; UI/Shell layer (`fedos_desktop_application_shell.ts`)
   can now issue `initializeDirectRatchetSession()`/`sendDirectRatchetMessage()`/
   `getDirectRatchetStatus()` calls.

### Where would "load durable live-state snapshot" insert, and should it be eager or lazy?

**Recommendation: stay LAZY (on first use), do NOT add an eager
warm-the-cache loop analogous to step 5 above.** This is a deliberate
departure from the pattern of this session's own prior Activation fix, and
the reason is structural, not a judgment call:

The Activation race existed because Activation state is a genuinely separate,
otherwise-late-populated piece of **process-local mutable state** that the
inbound dispatch path depends on being already-populated by the time a
message arrives — i.e., there was a real window where the dependency
(`activationPersistence`'s in-memory facts) was knowably absent between
"Runtime constructed" and "later UI call," and the relay subscription could
race into that window.

The live-state restore path has no equivalent window. `#restoreLiveSession()`
does not read from a pre-warmed cache that some other call populates later —
it reads DIRECTLY, on demand, from `sealedSecretPersistence`/
`snapshotPersistence`/`remotePublicKeyPersistence`, all three of which are
already fully constructed and holding their real durable backends BEFORE
`conversationRuntimeInstance` itself is constructed (step 3, before step 4),
which is in turn BEFORE the relay subscription opens (step 7). There is no
point between "Runtime is capable of restoring a session" and "Runtime can
receive a message for that session" where the former is false and the latter
is true — unlike Activation, restore readiness and transport readiness are
not staggered. Concretely: by the time `receiveRumor()` → `#receiveMessage()`
→ `#restoreLiveSession()` can ever run, `masterSeedAuthority`,
`sealedSecretPersistence`, and (once wired) a durable `snapshotPersistence`
are already live objects backed by already-open files/backends — the read
just works, first time, every time, with no warm-up dependency.

Tradeoffs, argued explicitly per the task's framing:

- **Eager (loop `sessionPersistence.listSessions()` at startup, restore
  every `active`/`initialized` session into `liveSessionCache` before
  returning from `startFedosDesktopRuntime()`)**: cost is O(session count)
  Rust/WASM `restore()` calls (each a real X25519/HKDF construction plus a
  sealing-authority unseal round trip) on EVERY process start, for
  potentially many dormant conversations that may never send/receive again
  this session. It eliminates zero races (see above) and duplicates work
  `#restoreLiveSession()` already does correctly, lazily, per the exact
  session that turns out to need it. It also does not fit this codebase's
  own stated discipline for this subsystem — `fedos_direct_ratchet_conversation_runtime.ts:15-17`'s
  own header: "this class performs no automatic migration, no automatic
  session creation, no silent route change" — an eager blanket-restore loop
  is exactly the kind of proactive, non-per-use action that header disclaims.
- **Lazy (current shape, unchanged)**: cost is a small first-use latency
  (one restore call) charged to whichever send/receive happens to be first
  for a given session after a restart — paid once per session per process
  lifetime (the live cache then holds it), and paid only for sessions
  actually used. No race exists to reintroduce, per the analysis above.

**Verdict: lazy restore-on-first-use is correct and should remain the
design for live-state snapshot loading.** The only concrete change needed is
wiring a genuinely durable `snapshotPersistence` backend at
`fedos_desktop_runtime.ts:1236-1240` (Agent S's mechanism) — no new startup
step, no new eager loop.

## 3. Crash-consistency windows

Enumerated in ratchet-step order, matching where `checkpointFedosDirectRatchetSecretsV1()`
is actually called today (all three sites: session establishment, outbound
encrypt, inbound decrypt):

### (a) Session establishment (`establishSession()`, `outbound_integration.ts:192-245`; `#receiveSessionInit()`, `inbound_integration.ts:359-417`)

Sequence: create `FedosDirectRatchetCryptographicSession` (in-memory, real
crypto) → `stateRuntime.createSession()` + `markActive()` (durable metadata,
`lifecycleState: "active"`) → `resetCoordinator.applyConsequences()` (durable
reset audit record) → `liveSessionCache.set()` (in-memory only) →
`session.sealState()` + `checkpointFedosDirectRatchetSecretsV1()` (durable
snapshot, once wired) → publish/reply the session-init NIP-17 control payload.

- **Crash before `stateRuntime.createSession()` commits**: nothing durable
  changed. Recoverable truth = session never existed. Safe — a retry (user
  re-initiates, or the peer's session-init is reprocessed) creates it fresh.
- **Crash after `createSession()`/`markActive()` commit, before
  `checkpointFedosDirectRatchetSecretsV1()` runs or completes**: this is
  exactly today's live bug reproduced by this session's own live testing —
  metadata says `"active"`, no durable snapshot exists. Recoverable truth
  MUST be: this session has no restorable live state. `getDirectRatchetStatus()`
  must not report plain `"active"` for this case post-restart (see
  `04_MIGRATION_VERSIONING.md` §1 for the exact distinction). The ONLY safe
  recovery is re-establishment (§5 of that document) — never inventing state.
- **Crash during the snapshot write itself** (mid-`putSnapshot()`): for the
  NDJSON append shape (`FileFedosDirectRatchetLiveStateSnapshotPersistence.putSnapshot()`,
  `appendFileSync`), a torn write produces either (i) no new line (if the
  crash preceded `appendFileSync` returning) or (ii) a malformed trailing
  line, which the existing reader already handles safely — `getSnapshot()`'s
  own parse loop (`:96-118`) wraps `JSON.parse` in try/catch and simply skips
  an unparseable line, falling back to the last valid one (or `null` if none
  exists yet). This is already rollback-safe in the "torn write" sense: a
  torn line can never be silently accepted as valid newer state, because a
  torn JSON line fails to parse.
- **Crash after the snapshot write durably lands, before the outbound
  session-init payload is queued/sent**: fully recoverable — the local
  Runtime has consistent (metadata + live-state) durable state; on restart,
  lazy restore succeeds; the peer never received anything, so nothing to
  reconcile.

### (b) Outbound encrypt (`sendMessage()`, `outbound_integration.ts:287-398`)

Sequence per this file's own header (lines 6-34): resolve route → restore-if-needed
→ `session.encrypt(plaintext)` (chain key ALREADY advances in-memory, in Rust,
inside this single call — `direct_ratchet_session.rs:242-263`'s own atomic
commit: `sending_chain_key = Some(next_chain)` only happens after a
successful seal, all in one synchronous Rust call) → read counters back from
the live session → `stateRuntime.commitCounters()` (durable metadata write)
→ `session.sealState()` + `checkpointFedosDirectRatchetSecretsV1()` (durable
snapshot write, **BEFORE** constructing/sending the wire payload — this
file's own comment at `:357-361` states this explicitly) → `sendMailboxNip17()`
(Outbox-queued publish).

- **Crash after `encrypt()` returns (chain key already advanced in-memory,
  message key already consumed) but before `commitCounters()`/the snapshot
  checkpoint land**: this is the genuinely dangerous window the task asks to
  flag. The in-memory chain key has already moved past the message key that
  was just used to seal the just-encrypted `wireMessage`. If that
  `wireMessage` bytes were ALSO already durably queued for send (they are
  not, yet, at this point in the sequence — `sendMailboxNip17()` is called
  strictly after the checkpoint) then a restart-and-restore from the
  PRE-encrypt snapshot would let a future `encrypt()` call reuse the SAME
  message key to encrypt DIFFERENT plaintext — i.e., a real
  rollback/keystream-reuse hazard. This file's own ordering (checkpoint
  strictly BEFORE the outbound queue call) is precisely what prevents this:
  as implemented, if the process crashes before the checkpoint durably
  lands, the just-produced `wireMessage` was never queued/sent either, so no
  peer-visible artifact exists that could be replayed against rolled-back
  state. **Recoverable truth on restart in this window = the send never
  happened at all** (from the peer's perspective, and from the Outbox's,
  since it was never enqueued) — the caller should be told to resend the
  logical message from a higher layer (Conversation delivery's own
  Outbox/idempotent retry, already established for this exact "must not
  reuse a consumed key" rule per this file's own header lines 26-34). This
  is safe ONLY as long as the checkpoint-before-enqueue ordering is
  preserved — see §4 (Snapshot update policy) for why this ordering is load
  bearing and must never be reversed or made "eventual"/batched.
- **Crash during the checkpoint write itself**: same torn-write analysis as
  §(a) — a malformed trailing NDJSON line is rejected by the reader, so
  restore falls back to the last valid (older) snapshot. That older snapshot
  corresponds to chain state STRICTLY BEFORE this `encrypt()` call, so the
  message key consumed by the just-attempted `encrypt()` has never been
  durably "spent" from the recoverable state's point of view. Since (per the
  point above) the resulting `wireMessage` was also never enqueued/sent,
  this is safe: on restart, the FIRST `encrypt()` call for this session will
  regenerate the message key at the same chain position and produce a
  logically fresh send. No double-use of a key that ever reached the wire.
- **Crash after the checkpoint durably lands, before `sendMailboxNip17()`
  enqueues**: the durable snapshot is now AHEAD of what any peer has seen.
  This is safe and intended — restore reconstructs the advanced chain state,
  and the caller's own higher-level Outbox / retry logic (this file's header,
  lines 26-34) is what decides whether to resend the logical message; if it
  does, a **fresh** `encrypt()` call runs using the (correctly, already
  advanced) restored state, producing a new, valid wire message. This is the
  "Option A" retry-safety answer this file's header already documents for
  Outbox-level retries and is unaffected by this change.
- **Crash after `sendMailboxNip17()` enqueues, before/after real network
  publish**: unaffected by live-state durability at all — this is the
  Outbox's own existing retry-safety domain (unchanged by this work).

### (c) Inbound decrypt (`#receiveMessage()`, `inbound_integration.ts:423-547`)

Sequence: dedup check (BEFORE decrypt, `receiveRumor()` :182) → resolve/
restore-if-needed → `session.decrypt()` (Rust: authenticates FIRST, mutates
`self` in exactly one place at the very end, ONLY after every fallible step
succeeds — `direct_ratchet_session.rs:265-269`'s own doc comment) → commit
counters → checkpoint snapshot → import plaintext into the Conversation
pipeline → `#recordImport()` (durable dedup fact).

- **Crash after `decrypt()` returns plaintext (chain/skip state already
  advanced in Rust memory) but before the checkpoint lands**: mirrors (b).
  Recoverable truth on restart = the message was never durably imported
  (import happens AFTER the checkpoint in this file's own ordering, `:487-546`)
  and — critically — **no `#recordImport()` dedup fact was written either**.
  Since the wire message itself is idempotent replay-safe at the transport
  layer (the peer's Relay-published Gift Wrap is still sitting there,
  unconsumed from this Runtime's point of view), the SAME inbound rumor can
  and will be redelivered (Nostr relays don't consume messages on read).
  Because the checkpoint never landed, restore reconstructs the PRE-decrypt
  receiving-chain state, so redelivery of the identical wire message decrypts
  cleanly again with the SAME (still-current, not-yet-consumed) message
  key — this is the CORRECT and SAFE outcome, not a rollback hazard, because
  the message was never actually consumed from the recoverable state's point
  of view. This is exactly why checkpoint-before-import ordering matters here
  too: if import (and especially `#recordImport()`) landed durably BEFORE the
  checkpoint, a restart+redelivery would hit "duplicate" at the dedup check
  and skip decrypt entirely, while the receiving chain state would remain
  stuck at the PRE-decrypt position forever — a genuine, permanent state
  divergence from the peer (every subsequent inbound message would fail to
  decrypt, since the receiving chain never advanced). The current ordering
  (checkpoint strictly before import/dedup-record, `:487-546`) avoids this.
- **Crash during the checkpoint write**: same torn-write safety as (b) — the
  reader rejects a torn line, restore falls back to pre-decrypt state, and
  since import/dedup-record also never landed (they're strictly after the
  checkpoint), redelivery-and-clean-redecrypt is still the correct recovery
  path.
- **Crash after the checkpoint lands, before import completes**: the
  receiving chain has durably advanced past this message's key, but the
  plaintext was never durably imported into the Conversation. On restart,
  `dedup.getImport()` is still `null` (record not written), so a redelivered
  rumor is NOT rejected as duplicate — but `session.decrypt()` on the SAME
  redelivered wire message will now fail (the receiving chain has already
  moved past that message number, and the Rust core's own duplicate/replay
  rejection — this file's header lines 39-46, proven in
  `test/secure_runtime_alpha_5481_5560_real_vertical_slice.test.ts` — treats
  a message number behind the current receive counter as
  a rejected replay). **This is a real, narrow gap**: the message is
  durably un-importable (its plaintext is gone from any in-memory recoverable
  path) yet also not marked as a duplicate/failure anywhere durable — from
  the user's point of view a message could silently vanish if the process
  crashes in exactly this narrow window between checkpoint-durable and
  import-durable. This is NOT a rollback/key-reuse hazard (the crypto
  boundary stays safe — no key is ever reused), but it IS a delivery-loss
  edge case worth naming for whoever owns import path atomicity; it already
  exists today independent of this durability work (the checkpoint currently
  never lands at all, so today the window is effectively "always crash before
  checkpoint," meaning today's failure mode is always "clean redecrypt on
  redelivery," never this narrower "message vanishes" case — durability
  makes this new edge case reachable for the first time). Out of scope to
  fix here (it's an import-pipeline atomicity question, not a live-state
  restore-lifecycle question), but it should be flagged to whoever finalizes
  Agent S's design: ideally the checkpoint and the import-record write would
  become one atomic transaction, or the checkpoint write would be sequenced
  to land no earlier than the import completing (inverse of the ordering
  that makes (b)/(a) safe) — these two orderings pull in OPPOSITE directions
  (checkpoint-before-import protects against permanent chain-desync;
  checkpoint-after-import would protect against this narrow vanish case) and
  reconciling them is a real open design question for Agent S's persistence
  layer, not resolvable by restore-lifecycle changes alone.

## 4. Snapshot update policy

**Verdict: after every state-advancing step — establishment, every
send-side `encrypt()`, every receive-side `decrypt()`, and any future
key-rotation/reset event — never a coarser interval.** This is what the
codebase already does (three checkpoint call sites, §3 above), and the
crash-consistency analysis in §3 shows why a coarser policy is not safe: the
Rust ratchet core's own forward-secrecy contract is that each `encrypt()`/
`decrypt()` call irreversibly discards the PRIOR message/chain key the
instant it advances (`direct_ratchet_chain_kdf_internal`'s own doc comment,
`direct_ratchet.rs:237-249`: "one-way advance... the caller discards
`chain_key` and replaces it with the returned next chain key ONLY on
success" — and `encrypt()`'s own doc comment, `direct_ratchet_session.rs:235-241`:
"Advances `send_counter` and the sending chain ATOMICALLY with a successful
seal"). There is no way to "catch up" a stale, coarser-interval snapshot to
the true current chain position without already possessing the very state a
coarser policy would have discarded the opportunity to durably record — the
old key is gone (zeroized) the moment the chain advances in memory, whether
or not it was checkpointed. A "checkpoint every N messages" or
"checkpoint every 30 seconds" policy would mean: any crash between
checkpoints permanently strands the session on a stale root/chain position,
and since (per §3) the safe recovery for a stale snapshot is discarding
forward — not corruption, but real, avoidable loss of already-exchanged
messages' worth of ratchet progress — forcing unnecessary
`resetDirectRatchetSession()` re-establishments (§5 of
`04_MIGRATION_VERSIONING.md`) for gaps that per-step checkpointing would
have made unnecessary. Per-step checkpointing costs one extra durable write
per message (this codebase already accepts this cost — it is the SAME cost
`stateRuntime.commitCounters()` already pays per message for metadata) and
is the only policy consistent with "never restore a state that could let a
message be decrypted twice with the same key material" (§3's own governing
rule) AND "never silently lose ratchet progress that was already
peer-visible."

## Summary of file:line citations (restore/startup/crash-consistency)

- Lazy restore, outbound: `fedos_direct_ratchet_outbound_integration.ts:323-329,401-428`
- Lazy restore, inbound: `fedos_direct_ratchet_inbound_integration.ts:455-461,561-586`
- Snapshot restore helper: `fedos_direct_ratchet_secret_checkpoint.ts:109-141`
- Snapshot checkpoint helper: `fedos_direct_ratchet_secret_checkpoint.ts:69-107`
- Checkpoint call sites: `fedos_direct_ratchet_outbound_integration.ts:234-245` (establish), `:357-377` (send); `fedos_direct_ratchet_inbound_integration.ts:406-417` (session-init), `:487-502` (receive)
- Live session cache (in-memory only, no eager restore): `fedos_direct_ratchet_live_session_cache.ts`
- Eager Activation re-hydration precedent (NOT mirrored for live-state, see §2): `fedos_desktop_runtime.ts:1481-1512`
- Ports wired vs. not wired at real startup: `fedos_desktop_runtime.ts:1231-1252`
- In-memory default fallback: `fedos_conversation_runtime.ts:531-535,757-765`
- Unused durable snapshot backend: `fedos_direct_ratchet_live_state_snapshot_persistence.ts:76-121`
- Rust chain-key one-way advance: `packages/fedos-core-rust/src/crypto/direct_ratchet.rs:237-280` (approx, `direct_ratchet_chain_kdf_internal`)
- Rust encrypt atomic commit: `packages/fedos-core-rust/src/crypto/direct_ratchet_session.rs:242-263`
- Rust decrypt single-mutation-point discipline: `direct_ratchet_session.rs:265-269` (doc comment) and the function body through `:456`

# Direct Ratchet Live-State Durability — Legacy Migration and Snapshot Versioning

Agent M. Read-only investigation. Repo `C:/wt/fedos-installed-startup-root-cause`,
branch `arc/fedos-installed-startup-root-cause`, HEAD
`3b78add15642fd38af601647c7ca332b1027e658`. Companion document:
`03_RESTART_FAILURE_MODEL.md` (restore lifecycle, startup ordering,
crash-consistency, snapshot update policy — read that first for the traced
call graph this document builds on).

## 1. The legacy case: every existing session today is metadata-only

Confirmed in `03_RESTART_FAILURE_MODEL.md` §0: production Desktop Runtime
wiring (`fedos_desktop_runtime.ts:1236-1240` → `fedos_conversation_runtime.ts:761-762`)
has never passed a durable `snapshotPersistence`. Every session record any
real or test profile holds today — anything with
`lifecycleState: "active"` or `"initialized"` in
`AppendOnlyFedosDirectRatchetSessionPersistence`'s log — was checkpointed
only into `InMemoryFedosDirectRatchetLiveStateSnapshotPersistence`, which is
discarded on every process exit. When durable persistence ships, every one
of these becomes, structurally, indistinguishable from "genuinely never
checkpointed" — there is no way to tell, after the fact, "this session
predates the durability feature" from "this session's checkpoint write
failed" from "this session's checkpoint was lost some other way." All three
collapse into the same observable fact: `getSnapshot(sessionId)` (or its
future durable equivalent) returns nothing for this `sessionId`. That
collapse is fine — the safe handling (§3, §5) is identical for all three
causes; the important thing is fail-closed handling for all of them.

## 2. What `getDirectRatchetStatus()` does today, and what it must do post-ship

Current behavior (`fedos_direct_ratchet_conversation_runtime.ts:251-280`):
status is derived PURELY from `stateRuntime.getSessionMetadata(sessionId)`'s
`lifecycleState` — `"active"` metadata → `"active"` status, full stop. It
never consults `liveSessionCache` or `snapshotPersistence` at all. This means
today, and would continue to mean post-ship without a change, that a legacy
metadata-only session reports `"active"` to the UI regardless of whether a
live session can actually be restored — exactly the false-"active" hazard
the task calls out.

### The two distinguishable in-process cases

`getDirectRatchetStatus()` runs in the SAME process as everything else, so it
CAN cheaply check `liveSessionCache.get(sessionId)` (a synchronous, free
`Map` lookup — no new I/O) before falling back to a snapshot-existence check:

- **Case A — same process, never restarted since establishment**: the live
  `FedosDirectRatchetCryptographicSession` object is still sitting in
  `liveSessionCache` (it was `.set()` at establishment/first-restore and
  never evicted — `FedosDirectRatchetLiveSessionCache` has no eviction
  policy; `.clear()` is "test/shutdown-only" per its own doc comment,
  `fedos_direct_ratchet_live_session_cache.ts:37`). In this case the session
  genuinely works — `sendMessage()`/`#receiveMessage()` will find it in cache
  and never even attempt a restore. Status should be able to say `"active"`
  truthfully here, because it IS actively usable, snapshot or no snapshot.
- **Case B — this process restarted (or never established the session at
  all, or the cache was evicted for some other reason) and no durable
  snapshot exists**: `liveSessionCache.get()` returns `null` AND
  `snapshotPersistence.getSnapshot()` would also return `null` if attempted.
  This is the case that must fail closed and never be reported plain
  `"active"`.

### Recommended status resolution (design, not yet implemented — describing
the correct shape for whoever wires Agent S's snapshot backend in)

Add ONE additional check to `getDirectRatchetStatus()`, gated only for
`lifecycleState === "active"` (leave every other branch of the existing
`switch` untouched):

```
case "active": {
  if (this.#liveSessionCache.get(resolution.sessionId) !== null) return "active";
  if (this.#deps.snapshotPersistence.getSnapshot(resolution.sessionId as unknown as string) !== null) return "active";
  return "reset-required"; // or a new, more precise status value — see below
}
```

This is a pure, cheap, synchronous addition (no new I/O beyond a
`getSnapshot()` call the restore path already performs on-demand elsewhere;
calling it from `getDirectRatchetStatus()` too is the same read, just
earlier). It correctly resolves Case A (cache hit, still `"active"`, no
snapshot dependency at all) and Case B (cache miss AND snapshot miss →
NOT `"active"`).

Whether the fallback value should reuse the existing `"reset-required"`
status or introduce a new, more precise one (e.g. `"restore-unavailable"`) is
a UI/product decision outside this document's remit — but it must NOT be
`"active"`, and it must be one of the closed vocabulary's existing "this
needs the user to act" values (`"reset-required"` already carries exactly
that UI meaning per this file's own Phase N status-vocabulary header,
`fedos_direct_ratchet_conversation_runtime.ts:64-73`), never a silent
`"unavailable"` (which today means "not resolved to a session at all" —
reusing it for "session exists but can't be restored" would blur a real
distinction the rest of this file's callers rely on).

**Do NOT attempt the old in-memory-only restore path as a "fallback that
will always fail post-restart."** There is no separate "old path" to fall
back to — `#restoreLiveSession()` is the only restore path that has ever
existed, and it correctly already returns `null` when
`snapshotPersistence.getSnapshot()` is `null` (§1 of `03_RESTART_FAILURE_MODEL.md`).
Attempting it from `getDirectRatchetStatus()` would be pointless extra work
duplicating what `sendMessage()`/`#receiveMessage()` already correctly do
lazily — the cache check above is sufficient and cheaper, since it needs no
`await` and touches no Rust/WASM boundary just to answer a status query.

## 3. No invented secret migration — confirmed definitively

Read `fedos_direct_ratchet_device_pair_resolver.ts:139-221` (`sessionId`
derivation) and `packages/fedos-core-rust/src/crypto/direct_ratchet.rs` /
`direct_ratchet_session.rs` (Rust key-derivation chain). Answer: **no, the
live secret state can never be legitimately reconstructed from anything
durable — not from `sessionId`, not from `deviceId`, not from session
metadata, and only in one narrow, non-post-facto-usable sense from the
master seed.**

### `sessionId` is a public, deterministic, non-secret label — never key material

`resolveFedosDirectRatchetDevicePair()`'s own `sessionId` construction
(`fedos_direct_ratchet_device_pair_resolver.ts:188-217`) builds it from:
truncated (16-hex-char) account-ref public identifiers, device refs,
`conversationId`, `suite`, and `generation` — sorted into a canonical
side-independent order specifically SO both peers compute the identical
string (this file's own comment, `:188-201`: "it feeds the Rust HKDF context
binding"). It is used as a **domain-separation/context input** to the KDF
(`derivation_context_bytes(&session_id, generation)`,
`direct_ratchet_session.rs:208`), not as key material itself — a context
string cannot regenerate a secret; it only ensures different sessions derive
different outputs from the SAME secret input. Nothing about `sessionId`,
`deviceId`, or `conversationId` is secret or entropy-bearing.

### Only the very first `bootstrap_root_secret` is durably re-derivable — and only up to the point BEFORE any real session activity

`initialize_as_receiver`/`initialize_as_sender`
(`direct_ratchet_session.rs:163-225`) both take a `bootstrap_root_secret:
[u8; 32]` parameter, whose own doc comment (`:160-162`) states it "seeds the
root key — the review's own recommendation to reuse the EXISTING
`resolveConversationKey()` output for exactly this purpose (never a
fresh/random root seed)." This IS deterministically re-derivable from durable
material (account keys via `resolveConversationKey()`), by design — it is
the ONE piece of ratchet state this codebase already treats as
legitimately recomputable, and only as the pristine starting point of
generation N, before that generation has done anything.

That does NOT make later live state recomputable, for two independent,
each-individually-sufficient reasons, both verified directly against this
Rust file rather than assumed from ratchet theory:

1. **The local ratchet keypair is CSPRNG-random, never seed-derived.**
   `generate_direct_ratchet_keypair_internal()`
   (`packages/fedos-core-rust/src/crypto/direct_ratchet.rs:77-110`) draws
   fresh bytes from `fedos_random_bytes_32()` (the codebase's real entropy
   source) every single time a session is established or a DH ratchet step
   occurs — its own doc comment is explicit: "Generates a fresh,
   CSPRNG-backed secp256k1 keypair... never `Math.random`, never a
   placeholder." This keypair is never derived from the master seed, the
   account index, or anything else durable — it is thrown away
   (`old_local_private_key_is_discarded_after_dh_ratchet_step`, a real test
   name at `direct_ratchet_session.rs:746`) the moment a DH ratchet step
   moves past it. Once that happens, no durable input — including the
   master seed itself — can reproduce the discarded private scalar, and
   therefore cannot reproduce any DH output or root/chain key derived
   through it. This already breaks recomputability the instant
   `initialize_as_sender` runs (it performs a DH-and-root-KDF step
   immediately, `:207-210`) or the instant a receiver processes its first
   inbound message (which triggers the same DH step inside `decrypt()`,
   `:322`).
2. **The chain KDF is a one-way function even absent any DH step.**
   `direct_ratchet_chain_kdf_internal()` (`direct_ratchet.rs:250-280`)
   advances a chain key via `Hkdf::from_prk` + `expand` — its own doc
   comment: "one-way advance... the caller discards `chain_key` and
   replaces it with the returned next chain key ONLY on success." HKDF
   `expand` cannot be inverted; there is no operation that recovers chain
   key N from chain key N+1, let alone from a message count alone. Even if
   an attacker (or a recovery routine) knew every durable fact about a
   session (sessionId, deviceId, generation, message counters,
   `bootstrap_root_secret`), advancing the chain the "right" number of times
   requires ALREADY having chain key 0 in hand — and per point 1, chain key
   0 for anything past generation-establishment already depends on a
   discarded, non-reproducible ephemeral DH output.

**Plain statement of the answer, as the task requests:** for any Direct
Ratchet session that has ever sent or received a single message, or (for the
sender role) ever completed session establishment, the live root/chain/local-
private-key state is a genuine one-way ratchet output. It is lost forever
the instant durable state is lost, with NO legitimate recomputation path from
`sessionId`, `deviceId`, metadata, or the master seed. This matches ratchet
theory's expected answer, and this codebase's actual Rust implementation
verifiably enforces it via CSPRNG-random ephemeral keys (never seed-derived)
combined with one-way HKDF chain advances — it is not merely "hard to
recompute," it is cryptographically discarded input with no recovery
mechanism of any kind. A migration path that attempted to "reconstruct" a
legacy session's live state from anything durable would necessarily either
(a) silently fabricate incorrect key material that cannot possibly match
what the peer's side has advanced to, guaranteeing decrypt/encrypt failures
or, worse, some accidental key-reuse collision, or (b) be flatly impossible
to implement at all past the very first message. Neither is acceptable; §5
covers the only correct answer.

## 4. Generation vs. sessionId vs. this new snapshot's own monotonicity — three separate concerns, only one needs a new mechanism

Three DIFFERENT monotonicity guarantees already exist or are needed, and
they must not be conflated:

1. **Ratchet protocol `generation`** (a real reset/re-establishment counter)
   — already fully protected against rollback by
   `FedosDirectRatchetSessionResetAuthority.evaluate()`
   (`fedos_direct_ratchet_session_reset_authority.ts:69-118`): a reset must
   name exactly `previousGeneration + 1` AND match
   `locallyKnownPreviousGeneration` (`:84-91`), with a durable nonce-replay
   ledger (`:105-115`) rejecting a differing-content reuse of an
   already-consumed nonce. Out of scope here — already solid, per the task's
   own framing, and unrelated to the new snapshot mechanism.
2. **Session metadata `revision`** — a DIFFERENT, already-existing monotonic
   counter, one per `(sessionId)` tuple across its own lifecycle mutations
   (transitions, counter commits). `FedosDirectRatchetSessionPersistence`'s
   own port doc (`fedos_direct_ratchet_session_persistence.ts:19-33`) is
   explicit: `putSession()` requires `record.revision` to be exactly
   `0` (new) or `(current highest) + 1` (existing) — `"conflict"` for
   anything that skips, goes backward, or disagrees with history. This is
   the EXACT pattern §6 below should mirror for the new port; it is not
   itself a mechanism the new snapshot can reuse directly, because the
   snapshot is a genuinely different, current-value (not event-sourced)
   port for a structural reason already documented in this codebase
   (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:1-43`'s own
   header: the chain key mutates in place every message, so an
   insert-only-per-key port would `"conflict"` on the second message).
3. **The NEW live-state snapshot's own write-ordering** — does NOT exist
   today. `FedosDirectRatchetLiveStateSnapshotPersistence.putSnapshot()`
   (`fedos_direct_ratchet_live_state_snapshot_persistence.ts:52-55`) takes no
   sequence/ordering field at all — both the in-memory (`:57-67`) and file
   (`:76-121`) implementations are unconditional last-write-wins by CALL
   order (in-memory: whichever `.set()` call happens last in JS's single
   event loop; file: whichever line is LAST in the NDJSON file on replay,
   i.e. whichever `appendFileSync()` call physically completed last). This
   IS a real, independent gap from (1) and (2), and needs its own design.

### Why (3) matters independent of (1)/(2)

The ratchet protocol's own `generation` monotonicity protects against a
STALE GENERATION (an old reset) superseding a newer one at the metadata
layer. It says nothing about two checkpoint writes for the SAME `(sessionId,
generation)` racing each other. Concretely: `sendMessage()` and
`#receiveMessage()` for the SAME session can both be in flight concurrently
(a user sends a message at the same moment an inbound message from the peer
is being processed — both are independent async call chains awaiting Rust/
WASM calls, per `03_RESTART_FAILURE_MODEL.md`'s own crash-consistency
analysis). Both paths call `checkpointFedosDirectRatchetSecretsV1()` with
DIFFERENT sealed states (one reflecting the post-encrypt sending-chain
advance, one reflecting the post-decrypt receiving-chain advance) for the
SAME `sessionId`. If the async scheduling happens to let the OLDER
`sealState()` call's `putSnapshot()` land AFTER the newer one's (e.g. one
path's `sealState()` — itself several sequential `await`ed WASM calls,
`fedos_direct_ratchet_cryptographic_session.ts:509-559` — takes longer to
resolve than the other's), the newer chain-key advance would be silently
overwritten by an OLDER one at the durability layer, even though nothing
about `generation` or `revision` changed. This would NOT be a rollback of
the ratchet protocol's own security boundary (each call's OWN chain state
was correctly, monotonically advanced by the Rust core — see
`03_RESTART_FAILURE_MODEL.md` §3/§4), but it WOULD be a rollback of the
DURABLE record of that state — meaning a restart after this race restores a
session whose sending OR receiving chain (whichever's checkpoint got
clobbered) is stale by one or more steps, and the corresponding
send/receive counters (durable, from `commitCounters()`, which has NO
matching race — `FedosDirectRatchetStateRuntime.commitCounters()` operates
on the SAME `sessionPersistence` port that already enforces strict
revision ordering, §4 point 2) will disagree with the restored live chain
position. That disagreement is exactly the shape of bug this file's own
sibling code already reproduced and fixed once before for a related reason
(`fedos_direct_ratchet_secret_checkpoint.ts:22-27`'s own header: "a restored
session built from a STALE chain key snapshot combined with an up-to-date
plain counter decrypts/encrypts incorrectly, because
`FedosDirectRatchetSession::restore()` takes the given chain-key bytes
literally — it never re-derives or fast-forwards them from the counter").

### Recommended design for (3)

Add a monotonic sequence field to `FedosDirectRatchetLiveStateSnapshotV1`
(`fedos_direct_ratchet_live_state_snapshot_persistence.ts:45-50`), mirroring
the EXISTING `revision` pattern from `FedosDirectRatchetSessionPersistence`
(§4 point 2 above) rather than inventing a new scheme:

- **Field**: `sequence: number` — a per-`sessionId` strictly-increasing
  integer, incremented by the CALLER (the checkpoint helper,
  `checkpointFedosDirectRatchetSecretsV1()`) once per checkpoint attempt,
  sourced from the SAME place `commitCounters()`'s `revision` already comes
  from conceptually: "one more than the highest value this exact session has
  ever durably recorded." Concretely, `checkpointFedosDirectRatchetSecretsV1()`
  can read `sessionMetadata.revision` (already available to every one of its
  three call sites via `sessionMetadata`/`record`, per
  `03_RESTART_FAILURE_MODEL.md` §3) and pass it straight through as the
  snapshot's own `sequence` — this reuses an ALREADY-monotonic,
  ALREADY-durable counter (metadata `revision`, strictly increasing per
  `putSession()`'s own conflict rule) rather than inventing a second,
  independent counter that could itself drift out of sync. Since
  `commitCounters()`/`markActive()`/etc. always run in the SAME call before
  the checkpoint (§3 of `03_RESTART_FAILURE_MODEL.md`'s own traced call
  order: counters committed, THEN checkpoint), the metadata `revision` at
  checkpoint time is already the freshest available monotonic marker for
  "how far this session has durably progressed," with no new source of
  truth to keep consistent.
- **Compared how**: `putSnapshot()` must become conditional, not
  unconditional: reject/ignore (never throw) a `putSnapshot()` call whose
  `sequence` is `<=` the CURRENTLY-durable snapshot's own `sequence` for that
  `sessionId`. This is a read-then-conditionally-write — cheap for the
  in-memory implementation (already synchronous); for the file-backed
  implementation, requires reading the current tail (already what
  `getSnapshot()` does) before appending, or maintaining a small in-process
  "highest sequence written per sessionId" cache to avoid a full-file re-read
  on every write (a real efficiency concern for a long-lived NDJSON file, but
  orthogonal to correctness — Agent S's own call on whether to keep the
  NDJSON-append shape or move to a keyed store).
- **Tie-broken how**: an EQUAL `sequence` for identical content is the same
  idempotent-repeat shape this codebase already uses everywhere else
  (`FedosSealedDirectRatchetSecretPersistence.putSealedSecret()`'s own
  `"already-present"` outcome, `fedos_sealed_direct_ratchet_secret_persistence.ts:13,16`;
  `FedosDirectRatchetSessionPersistence.putSession()`'s own identical
  `"already-present"` rule) — accept silently, no-op. An equal `sequence`
  with DIFFERENT content, or a LOWER `sequence` at all, must be rejected
  (`"conflict"`/no-op — never overwrite), matching the same "never silently
  overwrite disagreeing history" rule this codebase already enforces on the
  two adjacent ports. This closes exactly the race described above: whichever
  of the two concurrent `sealState()`+checkpoint calls resolves SECOND will
  necessarily either (a) legitimately carry the higher `revision`/`sequence`
  (if it really did happen after, causally, in terms of durable session
  progress) and win correctly, or (b) — if the async resolution order was
  reversed relative to the true causal order — is now the one being
  correctly rejected as stale, which is the exact protection this section
  exists to add. Note this does NOT fully resolve the underlying "two
  concurrent ratchet operations on one session" hazard by itself — that
  requires either serializing send/receive per session at a layer above this
  port (a separate, real design question for whoever finishes Agent S's
  integration) or accepting that the LOSING side's in-memory advance is
  still correctly reflected in the live `liveSessionCache` object (which is
  unaffected by this durability race — only the DURABLE record would have
  been briefly out of sync before the ordering fix, or after it, would simply
  reject the stale write and let the next successful checkpoint, from either
  path, catch up).

## 5. Reset path is the correct, already-existing fallback — traced

`FedosDirectRatchetSessionResetAuthority`/
`fedos_direct_ratchet_session_reset_authentication.ts` (read in full) confirm
this codebase already has exactly the re-establishment mechanism a
legacy/unrestorable session should be routed through, and it is the ONLY
correct fallback — never (a) keeping a false `"active"` status (closed by §2
above) or (b) inventing a new recovery mechanism (foreclosed entirely by §3's
proof that no recovery mechanism could ever legitimately exist).

### How reset is triggered today — traced both directions

**UI/caller-initiated (confirmed, the only trigger path found):**
`FedosDirectRatchetConversationRuntime.resetDirectRatchetSession()`
(`fedos_direct_ratchet_conversation_runtime.ts:232-248`) — transitions the
current session to `"reset-required"` via `stateRuntime.markResetRequired()`.
Its own doc comment (`:231`): "the next `initializeDirectRatchetSession()`
call creates a NEW, independent generation." Grepped every caller of
`resetDirectRatchetSession`/`getDirectRatchetStatus`/
`initializeDirectRatchetSession` across `src/`: the only production call
sites are in `fedos_desktop_application_shell.ts` (`:1052-1132`) — a thin
Shell wrapper (`initiateDirectRatchetSession()`-style methods) that exists to
be invoked from the UI/IPC layer, and
`fedos_identity_transition_ratchet_impact_view.ts` (a status-reporting
consumer, not a trigger). There is no automatic call to
`resetDirectRatchetSession()` (or to `markResetRequired()` directly) anywhere
in `#restoreLiveSession()`, `sendMessage()`, or `#receiveMessage()` — restore
failure today just returns `"crypto-unavailable"`/`null` outcomes upward; it
never mutates lifecycle state.

**Remote/peer-initiated (the OTHER real path into a "reset"):** a peer can
send a fresh `session-init` payload naming a new `generation`
(`#receiveSessionInit()`, `fedos_direct_ratchet_inbound_integration.ts:261-421`),
which is a real reset from THIS side's point of view even though nothing
local "requested" it — `FedosDirectRatchetSessionResetAuthority.evaluate()`
validates it (§4 point 1) and, on acceptance, creates a brand new session
record/generation. This is not "automatic reset on restore failure" — it's
the existing protocol-level reset path, unrelated to whether local restore
ever failed, and it already works correctly today, unaffected by this
durability work.

### Should automatic reset-on-restore-failure be added?

**Recommendation: no — keep it user-initiated (via the existing Shell/UI
path), do not make restore-failure automatically call
`resetDirectRatchetSession()`.** Reasoning, weighing the tradeoff explicitly:

- **Argument for automatic**: a legacy/unrestorable session sitting silently
  in `"reset-required"` status (per §2's fix) does nothing on its own — the
  user has to notice the status and manually trigger re-establishment before
  they can message this peer again. Automatic reset on first restore-failure
  would remove that friction.
- **Argument against, and why it wins**: (1) `initializeDirectRatchetSession()`
  publishes a real NIP-17 control payload to the peer (`outbound_integration.ts:268-283`)
  — an outbound network side effect. Firing this automatically, from a purely
  local restore-failure detection (which could be transient — e.g. a
  momentarily-unavailable sealing authority immediately after profile
  unlock, distinct from a genuinely-lost snapshot — see the
  `"sealing-authority-unavailable"` outcome already modeled at
  `fedos_direct_ratchet_state_runtime.ts:163`), risks spamming reset-init
  payloads at the peer for a condition that might resolve itself on the very
  next call. (2) A reset is a real, user-visible security event (this
  codebase already treats it as one — the Identity Transition Ratchet Impact
  view, `fedos_identity_transition_ratchet_impact_view.ts`, exists
  specifically to let a user review affected sessions before authorizing a
  bulk reset; `fedos_desktop_application_shell.ts:1060-1066`'s own comment:
  "and only for an ALREADY-`\"accepted\"` transition" — i.e. this codebase's
  own established pattern is explicit user/flow authorization gating a
  reset, never silent automation). (3) `establishSession()`'s own guard
  (`outbound_integration.ts:167-177`) already requires a `reason` whenever a
  current generation exists — this is a structural signal that this
  codebase's design intent is for a reset to always be an explained, opt-in
  action, not a background side effect a restore-failure code path would
  have to synthesize a plausible `reason` for. (4) Fail-closed status (§2)
  already achieves the actually-important safety property — the user is
  never shown a false `"active"` and is never silently unable to message
  someone; a visible, actionable `"reset-required"` status routed to an
  ALREADY-EXISTING UI reset action is sufficient and strictly safer than
  auto-firing network-visible protocol messages from a local I/O failure
  signal.

If a future arc wants to reduce the friction, the safer middle ground is a UI
affordance that surfaces "this conversation needs to be re-established" and
offers a one-tap call into the EXISTING `resetDirectRatchetSession()` +
`initializeDirectRatchetSession()` pair — still user-confirmed, just
lower-friction — never a fully automatic background trigger.

## Summary of file:line citations (migration/versioning)

- `getDirectRatchetStatus()` current (metadata-only) status logic: `fedos_direct_ratchet_conversation_runtime.ts:251-280`
- Safe status vocabulary: `fedos_direct_ratchet_conversation_runtime.ts:64-73`
- `sessionId` derivation (public, non-secret): `fedos_direct_ratchet_device_pair_resolver.ts:139-221`
- `bootstrap_root_secret` reuse of `resolveConversationKey()`: `direct_ratchet_session.rs:160-162`
- CSPRNG ephemeral keypair generation (never seed-derived): `direct_ratchet.rs:77-110`
- One-way chain KDF: `direct_ratchet.rs:237-280`
- Discarded-old-private-key test naming the exact property relied on: `direct_ratchet_session.rs:746`
- Session metadata `revision` monotonicity precedent: `fedos_direct_ratchet_session_persistence.ts:19-33`
- Existing chain-key-staleness bug this codebase already fixed once (precedent for §4's race): `fedos_direct_ratchet_secret_checkpoint.ts:22-27`
- Reset trigger (`resetDirectRatchetSession`): `fedos_direct_ratchet_conversation_runtime.ts:232-248`
- Reset requires explicit `reason` on re-establishment: `fedos_direct_ratchet_outbound_integration.ts:160-177`
- Reset Authority evaluation (generation integrity, replay ledger): `fedos_direct_ratchet_session_reset_authority.ts:69-118`
- Reset authentication (best-effort Device signature): `fedos_direct_ratchet_session_reset_authentication.ts`
- Only production reset/status/establish call sites (Shell layer, user/flow-gated): `fedos_desktop_application_shell.ts:1052-1132`
- Peer-initiated reset path (protocol-level, independent of local restore failure): `fedos_direct_ratchet_inbound_integration.ts:261-421`

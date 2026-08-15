# P0 Closure — Coordinator Synthesis + Freeze (mandate task #47)

Frozen decisions for the four parallel implementation streams (task #48-51).
Each decision below is final for this arc; a stream must escalate (per
mandate §77's stop conditions) rather than silently deviate.

## 1. Conversation-discovery timing fix (Agent C scope)

**Root cause (confirmed, not a race):** `FedosConversationTransportScheduler.start()`
arms via `setInterval`, which has no t=0 firing, so the FIRST publish
attempt of anything freshly enqueued (conversation invitation, peer-device
announcement, Direct Ratchet handshake control payload) can legitimately
wait up to `DEFAULT_CONVERSATION_TRANSPORT_INTERVAL_MS` (30s) before ever
reaching a relay. Nothing on the inbound/subscription side is racy:
`FedosPrivateTransport.start()` fully awaits subscription-open before the
Runtime reports ready, and production's inbound filter is unbounded
(no `since`), so a late subscriber always durably recovers history.

**Fix (frozen):** in `fedos_private_transport.ts`, immediately after each
of `sendMailboxNip17()` and `sendMailboxNip17Control()` performs a
successful `#outboxPersistence.putIntent(record)` (i.e. `write` is neither
`"failed"` nor `"conflict"`), issue a **fire-and-forget** best-effort flush:
`void this.#scheduler.tick().catch(() => {});` — called AFTER the outcome
is already determined to be `"queued"`, and NOT awaited, so the method's
return timing/contract/durability semantics are unchanged for every
existing caller. This is safe to call concurrently with the periodic
timer's own `tick()` because `FedosConversationTransportScheduler.tick()`
is documented and implemented as single-flight (`#tickInFlight`) — a
second call while one is in flight returns the SAME promise, so there is
no double-publish risk and no new retry system is introduced. The
unmodified periodic tick remains the durable backstop for any case where
the immediate flush attempt fails transiently (relay momentarily
unreachable, etc.).

**Explicitly rejected:** awaiting the immediate tick before returning
(would make every enqueue call block on real network latency, changing
existing callers' timing contract for no durability benefit — the queued
outcome is already durable via `putIntent()` before the flush is even
attempted); a second/separate immediate-flush timer or queue; any
sleep/poll/retry-forever construct.

**Secondary, optional hardening (in scope, low-risk):** in
`websocket_relay.ts`'s `subscribe()`, register the subscription-id
listener before sending the REQ frame (currently sends first) — closes a
theoretical, currently unexploited (same-synchronous-tick) reorder risk.
Not required for the timing root cause; do only if it doesn't risk the
existing tests.

## 2. First-run Create-Profile interruption recovery (Agent F scope)

**Authority (frozen, already real, no new signal needed):** "safe to
reset" is exactly `initializationState` absent, or present and
`∈ {"initializing", "failed"}` — i.e. `"ready"` was **never** durably
written. `"ready"` itself must never be reset by this path. This mirrors
the coordinator's own existing state machine; no new state or heuristic
is invented.

**Fix (frozen):** add one new, narrowly-scoped, additive capability to the
onboarding subsystem — e.g. `resetInterruptedProfile()` on
`FedosProfileInitializationCoordinator` (or an equivalently-scoped new
persistence method) — that: (a) re-reads `detectProfileState()`, (b)
refuses (no-op, returns a typed refusal) unless the state is exactly
`"recovery-required"` **and** the underlying descriptor's
`initializationState !== "ready"` (or no descriptor exists at all — the
sealed-seed-only case), (c) on success, deletes the sealed master-seed
envelope and the profile descriptor (both narrowly scoped to the current
profile directory only — never touches any other profile), and (d)
returns the caller to `"absent"` so normal `createProfile()` can run
clean. This requires adding real delete capability to
`fedos_local_profile_persistence.ts` and
`fedos_sealed_master_seed_envelope_persistence.ts` — both currently
deliberately have none — but ONLY reachable through the new guarded
coordinator method, never as a general-purpose delete exposed elsewhere.
Wire `#recovery-actions` in `fedos_electron_beta_page.html` /
`onRecoveryRetry`-adjacent renderer code to a new "Start Over" action that
calls this method, with an explicit confirmation step (irreversible for
that interrupted attempt, though by construction it never had recoverable
user data — `"ready"` was never reached).

**Explicitly rejected:** deleting/overwriting anything when
`initializationState === "ready"`; a generic/unscoped delete method;
silently auto-resetting without a user-visible confirmation action.

## 3. Release integrity (Agent R scope)

**Checksum/filename mismatch (frozen):** fix `docs/pilot/INSTALLATION.md`
(and the other confirmed-stale docs) to reference the actual generated
artifact names, sourced from `release/release-manifest.v1.json` /
`SHA256SUMS.txt`'s real generation scripts (`generate_release_manifest.mjs`,
`generate_release_checksums.mjs`, `release_identity.mjs`) — i.e. correct
the hand-written docs to match the authoritative generated source, never
the reverse. No generator script content changes needed (they were
already confirmed correct/never-hardcoded).

**Cargo.lock (frozen decision — supersedes
`docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`
"Option B"):** commit `Cargo.lock`. Rationale: the "document a pin,
don't enforce it" approach has already measurably drifted once
(different lockfile hash, different `wasm-bindgen` patch version between
the doc's recorded snapshot and what's actually on disk today) — proving
documentation-only pinning does not hold for a crate now shipping real
cryptographic WASM in every artifact. Concretely: (a) remove the
`Cargo.lock` line from `packages/fedos-core-rust/.gitignore` (its
"Stage 69 skeleton" rationale is stale — the crate ships real crypto
WASM now), (b) `git add` the current, already-verified-self-consistent
lockfile (confirmed via a real `cargo build --locked` pass), (c) add
`--locked` to the `build:wasm` script so any future drift fails the build
loudly instead of silently re-resolving, (d) write a new short decision
doc recording this supersession (do not silently edit the old one — keep
history legible).

## 4. Peer-device UX entry point (Agent U scope)

**Trigger (frozen):** wire into `openConversation()` — call
`window.fedosApp.peerDeviceAnnounce(counterpartyAccountRef, conversationId, epoch)`
alongside the existing `refreshChatSecurityState()` call, reusing both
already-resolved values. No new Settings subsystem.

**Epoch source (frozen — minimal new persisted state, no wall-clock):**
add one new field, a monotonic integer `nextEpoch` (default `0` on first
creation), to the existing local peer-device-announcement identity file
(`readOrCreateFedosLocalPeerDeviceAnnouncementIdentity`'s persisted
schema — bump its `schemaVersion`). Each time an announcement is actually
sent, persist `nextEpoch + 1` back before returning. This keeps epoch
strictly local-monotonic (never wall-clock, never shared/derived), matches
the frozen protocol contract, and reuses the existing durable-identity
pattern rather than inventing a new one. Scope the trigger to fire once
per conversation-open (not on every render) to avoid needless
republishing; a stale/duplicate re-announce at the same epoch is already
handled safely by the existing acceptance policy (rejected as stale on
the receiving side), so this is a bounded, safe operation even if
triggered more than intended.

**Raw-hex UX (frozen):** reuse `commerceActorLabel()`'s existing
truncate+`<details>`-disclosure convention verbatim for any newly
surfaced peer-device identity/pubkey display. No new bech32/npub
encoding — explicitly forbidden by standing prior architectural decision.
The Identity Replacement full-raw-hex P1 and the invitation-flow
paste-raw-hex P1 remain explicitly OUT of this arc's scope (disclosed
already in the prior arc's report) unless a stream finds them trivially
and safely fixable using only this same existing convention with no
protocol change — optional, not required.

## Shared/composition files owned by the Coordinator

- `src/os/messenger/adapters/nostr/transport/fedos_private_transport.ts`
  (timing fix — Coordinator applies directly, single shared file).
- Any cross-stream composition/wiring in
  `fedos_desktop_runtime.ts`, `fedos_electron_beta_main.cts`,
  `window.d.ts`/preload if more than one stream needs to touch them.

Each stream implements its own scoped files directly; the Coordinator
applies the timing fix itself (already scoped to one file, no conflict
risk) and resolves any merge conflicts in shared files before the P0-
Closure CandidateHead (task #52).

# Secure Runtime Alpha 5961–6040 — Acceptance and Ratchet Reset Truth Document

## What "accepted" means, and does not mean

`FedosIdentityTransitionAcceptanceState` (Foundation, reused verbatim) is
computed by `computeFedosIdentityTransitionAcceptanceState(evidenceOutcome,
explicitLocalDecision)`. On the receiving side of a notification:

1. The Inbound Notification Coordinator computes `evidenceOutcome` from
   REAL, independently-reverified evidence (never trusting the sender's
   own claims). This can reach `"locally-acceptable"` on its own ONLY for
   a non-compromise reason with a valid old-key continuity signature (or
   an explicit local policy that auto-accepts old-key-only continuity) —
   never merely because a signature parsed.
2. A `"key-compromise-suspected"`/`"-confirmed"` reason NEVER reaches
   `"locally-acceptable"` from evidence alone, regardless of how many
   valid signatures are attached — it caps at
   `"manual-verification-required"` (or `"device-corroborated"` if a
   Device corroboration was ALSO present, itself still not automatic
   acceptance).
3. `recordIdentityTransitionDecision()` / `inspectPeerIdentityTransitionStatus()`
   apply an OPTIONAL, explicit local decision on top — but
   `"rejected"|"conflicting"|"stale"|"superseded"|"rollback-detected"`
   can never be promoted to `"accepted"` by any explicit decision (fail
   closed, enforced by the Foundation's own
   `fedos_identity_transition_acceptance_state.ts`, reused unmodified
   here).

**Peer capability advertisement of `"identity-transition-v1"` is
evidence of protocol support, never acceptance of any specific
transition.** A stale or superseded capability advertisement can never
undo a later, already-recorded acceptance or rejection — the two
mechanisms (capability advertisement vs. this Arc's own Peer
Observation) are entirely separate stores with entirely separate
revision/conflict scopes; nothing in either coordinator cross-references
the other's revision counter.

## What Ratchet reset actually does, and does not do

`authorizeFedosIdentityTransitionRatchetReset()` is the ONLY function in
this Arc that can mutate Ratchet state, and it:

- refuses outright (`"not-accepted"`) unless the caller's own
  `acceptanceState` is EXACTLY `"accepted"` — it never re-evaluates
  evidence itself, and there is no path from `"corroborated"`,
  `"manual-review-required"`, or any other non-final state into a reset
  dispatch;
- for every session `planFedosIdentityTransitionAffectedSessions()`
  identified, calls the EXISTING, real, unmodified
  `FedosDirectRatchetOutboundIntegration.establishSession(conversationId,
  remoteDeviceRef, { reason: "identity-transition" })` — the SAME method
  every other Ratchet reset in this codebase uses; no second reset
  message type exists;
- NEVER rebinds an old session's root/chain/skipped keys to the new
  identity — `establishSession()`'s own `createAsReceiver()` path always
  derives a fresh cryptographic session for the new `generation`; old
  secret material is neither read nor migrated by this Arc;
- records a durable, LOCAL, additive correlation fact
  (`FedosIdentityTransitionRatchetResetLinkV1`) binding `transitionId` to
  the resulting `sessionId` — this is a QUERY convenience only; the wire
  message's own cryptographic commitment is unaffected by it and would
  verify identically with or without this record existing;
- never touches Device Registry, Conversation Membership, Archive, or
  Search state — confirmed by the structural guard suite (zero imports
  from any of those domains anywhere in `peer_integration/`).

## Multi-Device truth

- One peer Device's corroboration or advertisement is never account-wide
  acceptance — the Peer Observation's own key includes `peerDeviceRef`,
  and the evaluator only ever sees ONE notification's own evidence at a
  time.
- Two different LOCAL Devices (e.g. Bob's desktop and Bob's tablet)
  maintain entirely independent lineages, acceptance decisions, and
  reset authorizations — `localDeviceRef` is part of both the
  Observation's row key AND its lineage key.
- A new (post-transition) Device inherits no live Ratchet session — every
  session `establishSession()` creates starts at `generation`
  `previousGeneration + 1` (or `0` for a genuinely new tuple), always via
  a fresh cryptographic handshake.

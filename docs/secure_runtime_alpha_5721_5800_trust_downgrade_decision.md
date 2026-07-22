# Secure Runtime Alpha 5721–5800 — Trust and Downgrade Decision Document

## Core principle

**Peer advertisement is evidence, never trust.** Every capability entry
and lifecycle fact this Arc processes passes through the SAME pipeline:
schema validation → real signature verification → identity/Device
binding → replay/expiry check → revision ordering → conflict detection →
a pure acceptance-policy decision → a durable, non-secret Observation
record. Nothing along this pipeline mutates the Device Registry, selects
a route, or establishes a Ratchet session. A verified signature proves
the CONTENT came from the claimed account (and, best-effort, the claimed
Device) — it never, by itself, means "accepted", "trusted", or
"activated".

**One Device observation is not account-wide.** `FedosRatchetPeerCapabilityObservationV1`
is keyed by `(localDeviceRef, peerAccountRef, peerDeviceRef, sourceKind,
sourceId)` — a fact observed by Alice's desktop about Bob's desktop is a
completely separate row from the same fact observed by Alice's tablet, or
a fact about Bob's tablet. Proven in
`test/secure_runtime_alpha_5721_5800_capability_and_lifecycle_unit.test.ts`'s
own Phase M test and in the real vertical slice's Device-B announcement
step.

## Downgrade and rollback resistance (Phase K)

| Scenario | Mechanism | Outcome |
|---|---|---|
| Active ratchet peer later advertises static-only | `isRouteDowngrade()` compares the new claim's routes against the PRIOR ACCEPTED advertisement's own `claimedRoutes` (durably stored, restart-safe) | `"downgrade-detected"` — never accepted, never silently activates the weaker route |
| Older advertisement replay (exact nonce) | `#existingObservationForSource()` short-circuit | `"duplicate"` — idempotent no-op, the already-accepted state is untouched |
| Lower revision after higher revision | `revision <= priorAccepted.revision` (scoped to the SAME `sourceKind` — see the execution spec's bug #3) | `"stale"` |
| Removed capability reappears from a stale Relay copy | Same stale-revision check — a replayed OLD advertisement can never revive a capability the peer's own LATER accepted advertisement already dropped | `"stale"` |
| Device-revocation notification arrives before an older Device-added record | Each is its OWN `sourceKind: "lifecycle-notification"` row, evaluated on its own merits (Device trust + expiry + replay) independent of ordering; `getPeerDeviceCapabilityStatus()` always prefers an actionable lifecycle recommendation over a mere Advertisement's compatibility status | The safe status reflects whichever lifecycle fact is currently accepted, never silently overridden by an unrelated Advertisement |
| Capability expiry | `now > expiresAt` | `"expired"` |
| Conflicting advertisements at the same revision | `#hasConflictingDuplicateAtSameRevision()` (same `sourceKind`+`revision`, different `sourceId`) | `"conflicting"` — recorded as evidence, never accepted |
| Different signatures over the same revision | Same conflicting-duplicate check; each is independently signature-verified before reaching this check | `"conflicting"` |
| Unknown suite / unsupported future version | Closed vocabulary predicates fail closed at the CODEC layer — never reaches the acceptance policy at all | Decode failure → `"not-peer-capability-payload"` (schema layer) or `"unsupported"`/`"peer-incompatible"` (policy layer, for a syntactically valid but unsupported combination) |
| Peer changes Device identity | A different `senderDeviceRef`/`affectedDeviceRef` is a DIFFERENT Observation subject — no continuity is ever assumed; Device replacement notifications carry an explicit `newDeviceRef`, never an in-place identity change | Treated as a brand-new, independently-evaluated peer Device |
| Local stale-state restoration | Append-only Observation persistence replays exactly on restart (Phase P step 9/10) | Identical safe status before and after restart |

**A stronger previously-accepted route never silently downgrades.**
`"downgrade-detected"` is a terminal, non-accepting acceptance outcome —
it is recorded as evidence, and `recommendFedosRatchetPeerSessionAction()`
maps it to `"manual-review-required"`, never a route change. Reversing an
already-accepted stronger route requires an explicit LOCAL decision this
Arc does not itself make (no UI, no auto-apply).

## No automatic trust / route activation / Registry mutation

- The Inbound Coordinator never calls `deviceRegistry.putEvent()`,
  `revokeDevice()`, or `registerDevice()` — confirmed by
  `secure_runtime_alpha_5721_5800_structural_guards.test.ts`.
- Neither coordinator calls `initializeDirectRatchetSession()`,
  `resetDirectRatchetSession()`, or `sendDirectRatchetMessage()` — same
  guard test.
- `recommendFedosRatchetPeerSessionAction()` returns a closed
  recommendation string; nothing in this Arc consumes that
  recommendation to automatically call into the Foundation Arc's own
  Reset Coordinator. A future, separate, explicit wiring (with its own
  authorization boundary) is the named next integration point, not built
  here.

## No account/Nostr identity rotation implemented

This Arc reuses the account's EXISTING signing key (via
`FedosNostrSigningAuthority`) unchanged. No account-key rotation,
Master-Seed replacement, or cross-account vouching mechanism is
introduced anywhere in this Arc's source.

# Secure Runtime Alpha 5721–5800 — Execution Specification

FedOS Ratchet Peer Notification and Capability Advertisement Arc. Base:
`f80889d`. Alpha range reconciliation: see
`secure_runtime_alpha_5721_5800_phase_a_reconciliation_report.md`.

## Scope

Implements the authenticated peer-notification and capability-advertisement
foundation the multi-device/identity-rotation review named, and that
`f80889d` itself deferred: a way for one FedOS endpoint to tell a specific
peer Device — over the existing authenticated private-message path, never a
new Nostr kind — which private-message routes, ratchet suite, and lifecycle
capabilities it supports, and to notify that peer of specific Device
lifecycle facts (added/revoked/replaced, a recommended session reset,
generation change, or capability supersession).

Self-advertisement is evidence, never trust. No capability entry or
lifecycle notification can, by itself, activate a route, establish Ratchet
trust, or mutate the local Device Registry.

## New source (all additive, under `src/conversation/ratchet/peer_capability/`)

| File | Phase | Responsibility |
|---|---|---|
| `fedos_ratchet_peer_capability_vocabulary.ts` | B | Closed route/suite/lifecycle-capability vocabulary, reusing (never widening) `FedosPrivateWireRouteRequest`/`FedosDirectRatchetSuite`. |
| `fedos_ratchet_peer_capability_nonce.ts` | C/D | Shared 128-bit CSPRNG nonce generator. |
| `fedos_ratchet_peer_capability_advertisement.ts` | C | The advertisement record: schema, canonical serialization, exact-field-set codec, bounded capability list. |
| `fedos_ratchet_peer_lifecycle_notification.ts` | D | Six closed lifecycle facts (`device-added`/`device-revoked`/`device-replaced`/`ratchet-session-reset-required`/`ratchet-session-generation-advanced`/`capability-superseded`); schema/codec mirroring the advertisement's own. |
| `fedos_ratchet_peer_capability_authentication.ts` | E | Real account-level signing/verification (fixed kind-1 event, reusing the Device Binding Account Authorization pattern) plus optional, best-effort Device-level signing/verification (reusing the Session Reset pattern); the three-value `FedosRatchetPeerCapabilityEvidenceLevel`. |
| `fedos_ratchet_peer_capability_control_payload.ts` | F | The wire envelope: `kind: "peer-capability-advertisement" \| "peer-lifecycle-notification"`, size-bounded, decoded from a Rumor's own `content: string`. |
| `fedos_ratchet_peer_capability_outbound_coordinator.ts` | G | Gathers local capabilities, signs, sends via the existing `sendMailboxNip17Control()` seam; local-device-revoked/recipient-unknown/stopped denial. |
| `fedos_ratchet_peer_capability_inbound_coordinator.ts` | H | Classify → schema → signature → identity/Device binding → exact-nonce replay short-circuit → revision ordering (scoped per `sourceKind`) → conflict detection → policy → durable record. |
| `fedos_ratchet_peer_capability_observation.ts` + `persistence/*` | I | The durable, append-only-capable Observation record and its port/in-memory/append-only implementations. |
| `fedos_ratchet_peer_capability_acceptance_outcome.ts` + `fedos_ratchet_peer_capability_acceptance_policy.ts` | J | The closed, 13-value, non-boolean outcome vocabulary and the pure decision function. |
| `fedos_ratchet_peer_capability_session_action_recommendation.ts` | L | Pure mapping from an accepted fact to a safe session-action recommendation — never itself resets/establishes/copies a session. |
| `fedos_ratchet_peer_capability_safe_status.ts` | O | The 10-value user-safe status DTO. |
| `fedos_ratchet_peer_capability_runtime.ts` | N | The safe facade composing everything above. |

## The one production integration hook

`src/conversation/runtime/fedos_conversation_runtime.ts`:
- A new, fully OPTIONAL `deps.peerCapability` dependency bundle (mirrors
  `deps.directRatchet`'s own "omitted → `null`, byte-for-byte unchanged"
  discipline).
- `#peerCapabilityRuntime: FedosRatchetPeerCapabilityRuntime | null`, a
  `peerCapability()` accessor mirroring `directRatchet()`.
- One narrow, additive third attempt inside `receiveNip17Rumor()`, tried
  AFTER the ratchet decode attempt and BEFORE the legacy chat-message
  fallback — so a peer-capability control payload can never be
  misclassified as a chat message, exactly mirroring how the ratchet
  decode attempt was itself added by `b8e9e06`.

No other production file is touched.

## Real bugs found and fixed by genuine testing

Three real, load-bearing bugs were found only because real coordinator
integration tests and the real vertical slice exercised more than one
round trip:

1. **Exact-nonce replay caused a spurious `"conflict"`.** Re-evaluating
   acceptance for an already-recorded nonce saw its own prior acceptance
   as `priorAccepted` and re-decided `"stale"` — a different
   `acceptanceOutcome` for the identical fact than the first pass
   recorded, which the append-only equality check correctly flagged as a
   conflicting duplicate. Fixed with an explicit exact-`sourceId`
   short-circuit (`#existingObservationForSource()`) run BEFORE revision
   ordering, mirroring the Session Reset record's own "keyed by nonce
   alone, doubles as audit trail and replay ledger" discipline.
2. **Lifecycle-notification observations were keyed by the wrong Device.**
   The inbound coordinator originally recorded every lifecycle
   notification's observation under the ISSUER's own Device (the Device
   that sent the message), not the AFFECTED Device (what the fact is
   about) — so a `"device-added"` notification about Alice's tablet was
   filed under Alice's DESKTOP. Fixed by keying the observation's
   `peerDeviceRef` on `record.affectedDeviceRef`, while still gating
   TRUST on the issuer's own Device binding (a brand-new Device, by
   definition, has no local binding yet — checking trust on the affected
   Device would make every genuine `"device-added"` fact unconditionally
   `"untrusted-device"`).
3. **Advertisement and lifecycle-notification revision counters were
   mixed.** `#priorAccepted()`/the safe-status "latest observation" query
   originally spanned BOTH `sourceKind`s on one timeline — an unrelated
   lifecycle notification's own `revision` could make a genuinely fresh
   advertisement look `"stale"`, and (the more serious half) a later,
   route-conflicting re-advertisement could silently overwrite an
   already-recorded Device revocation's `"revoked"` safe status just by
   having a later `observedAt`. Fixed by scoping every revision/latest
   query to one `sourceKind`, and by making `getPeerDeviceCapabilityStatus()`
   compute the Advertisement and Lifecycle-Notification dimensions
   SEPARATELY, always preferring an actionable lifecycle recommendation
   (revoked/reset-required/etc.) over mere protocol-compatibility status
   — a later Advertisement can never silently paper over an
   already-recorded Device-lifecycle fact.

## Deliberately not implemented

- `device-key-updated` as its own lifecycle fact — no in-place Device
  key-rotation primitive exists in this codebase (Phase A); key rotation
  is representable ONLY via `device-replaced`.
- Rumor-id-level dedup on the peer-capability inbound attempt itself
  (the ratchet/legacy attempts each maintain their own) — deferred, not
  silently skipped; a duplicate Relay redelivery still re-verifies but
  always terminates in `"duplicate"` via the Observation store's own
  idempotent write result, so this is a documented efficiency gap, not a
  correctness gap.
- Automatic session-reset/session-initialization/route-selection from any
  accepted fact — every accepted fact produces only a
  `FedosRatchetPeerSessionActionRecommendation`, never itself invoked.

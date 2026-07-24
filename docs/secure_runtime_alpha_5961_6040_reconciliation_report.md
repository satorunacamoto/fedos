# Secure Runtime Alpha 5961–6040 — Reconciliation Report

**FedOS Identity Transition Peer Notification and Ratchet Reset
Integration Arc.** Base commit `b4aaab9`
(`arc/identity-transition-types-validation-durable-evidence`). Worktree
`C:\wt\identity-transition-peer-reset`, branch
`arc/identity-transition-peer-notification-ratchet-reset`.

Written before any production source edit, per this Arc's own mandatory
reconciliation requirement.

## Alpha range reservation

`git log --all` shows the highest previously-claimed range is
**5881–5960** (`8981f81`, FedOS Signed Recipient Deletion Request Private
Transport and Local Policy Integration Arc — Arc B's *prior* Arc, already
landed since the last coordination round). No commit anywhere claims
5961–6120. Per this round's coordination brief:

- **Arc A (this Arc) reserves 5961–6040.**
- Arc B (Deletion Request Multi-Device Aggregation and Consent UI)
  reserves 6041–6120, in its own separate worktree.

No historical-range collision this round (the 5401–5480 collision
remains a one-time historical event, not repeated).

## Ancestry verification (mandatory reconciliation steps 1–3)

`git merge-base --is-ancestor` confirms `b4aaab9` already contains BOTH
live lineages this Arc needs:

- `d825aa0` (Ratchet Peer Notification and Capability Advertisement) —
  ancestor of `b4aaab9`. ✓
- `f80889d` (Ratchet Device Lifecycle and Authenticated Session Reset
  Foundation) — ancestor of `b4aaab9`. ✓
- `b8e9e06` (Direct Double Ratchet Conversation Runtime / NIP-17
  Integration) — ancestor of `b4aaab9`. ✓

**No merge is required.** `b4aaab9` is a single linear descendant of all
three prerequisite commits (`b4aaab9` → `45e0fce` → `d825aa0` → `f80889d`
→ `b8e9e06` → …). This Arc's one worktree, based directly on `b4aaab9`,
already has every live lineage in its working tree. Proceeding straight
to source edits with no separate integration/merge commit.

## Overlapping production files inspected

| File | Responsibility | Classification | Decision |
|---|---|---|---|
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_control_payload.ts` | closed 2-member discriminated union (`kind: "peer-capability-advertisement" \| "peer-lifecycle-notification"`) riding the private NIP-17 Rumor content | **mechanical additive** | add a THIRD union member `kind: "identity-transition-notification"`, its own exact-field-set validator branch. The file's own header already documents this as the intended extension point (a new `kind` value, never a new Nostr kind). |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_authentication.ts` | account-level (kind-1, fixed tag `["t","fedos-ratchet-peer-capability-v1"]`) + Device-level authentication primitives | **semantically compatible, reused verbatim** | `authorizeFedosRatchetPeerCapabilityContent()` / `verifyFedosRatchetPeerCapabilityAccountAuthorization()` / `createFedosRatchetPeerCapabilityDeviceSignature()` / `verifyFedosRatchetPeerCapabilityDeviceSignature()` are GENERIC over `canonicalContent` — the domain separation happens inside each record's own canonical bytes, not the tag. Reused directly by the new notification's own signing/verification, with the notification's own domain tag as its canonical content's first array element. **No new signing primitive, no file edit needed here.** |
| `src/conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_vocabulary.ts` | closed lifecycle-capability-id vocabulary (currently 4 values) | **mechanical additive** | add one new value, `"identity-transition-v1"`, so a peer can advertise "I understand identity-transition notifications" through the EXISTING, unmodified advertisement outbound/inbound path — no new coordinator needed for this half of Phase H. |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_reason.ts` | closed reset-reason vocabulary (currently 4 values) | **mechanical additive** | add `"identity-transition"`. The file's own header explicitly named "identity rotation" as a reason the Foundation Arc declined to add ("inventing a trigger for it would be inventing the feature itself") — this Arc IS that trigger. Confirmed additive and non-breaking: `resetReason` is already typed `FedosDirectRatchetSessionResetReason \| null` everywhere it flows (signable content, reset record, reset authority), so widening the closed union changes no field, no array shape, no existing test's fixed-count assumption. |
| `src/conversation/ratchet/fedos_direct_ratchet_session_reset_authentication.ts` | `FedosDirectRatchetSessionResetSignableContent`, a FIXED-POSITION array-tuple canonical serialization (`JSON.stringify([suite, generation, previousGeneration, resetReason, resetNonce, ...])`), already cryptographically committed by every existing reset signature/test | **architecture conflict, avoided by design** | **NOT modified.** Adding a `transitionId` field to this array would change the digest for every future reset (not a compatibility break for PAST signatures, but a structural widening of a positional, order-sensitive tuple this Arc judges too risky for the value gained — see "Phase J scope decision" below). `resetReason: "identity-transition"` alone already reaches the wire authentically; the transitionId is bound via a separate, additive, LOCAL correlation record instead (Phase J). |
| `src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts` | `FedosDirectRatchetOutboundIntegration.establishSession(conversationId, remoteDeviceRef, {reason, deviceSigningKeypair?})` — the REAL, ALREADY-LIVE authenticated reset dispatch path (crypto session creation, sealing, wire construction via `sendMailboxNip17Control`, `resetCoordinator.applyConsequences()`) | **reused verbatim, unmodified** | This Arc's own explicit reset-authorization method calls this EXISTING method directly with `reason: "identity-transition"` — this Arc adds NO new reset message type, exactly as required. `establishSession()`'s own `"initiated"` outcome returns `sessionId`, which this Arc's own new correlation record uses to bind `transitionId -> sessionId` durably. |
| `src/conversation/ratchet/fedos_direct_ratchet_reset_coordinator.ts` | local-decision-only audit + lifecycle bookkeeping (`evaluate()` / `applyConsequences()` / `applyDeviceRevocation()`) | **frozen, untouched** | Already called internally by `establishSession()`; this Arc never calls it directly. |
| `src/conversation/identity_transition/fedos_identity_transition_ratchet_impact_plan.ts` (this Arc's own prerequisite, `b4aaab9`) | read-only impact-plan DTO, explicitly named THIS Arc as its own "apply exclusively through" target | **consumed, unmodified** | `FedosIdentityTransitionFacade.planTransitionImpact()`'s output (`actionable`, `existingSessionsRequireReset`, etc.) is the trigger input to this Arc's new reset-authorization method — never re-derived. |

No architecture-conflict was found that blocks this Arc; the one
genuine tension (extending a frozen positional-array wire tuple) was
resolved by NOT extending it and using a local correlation record
instead — documented explicitly rather than silently worked around.

## Phase J scope decision (documented per this Arc's own "document the
decision" requirement)

`FedosDirectRatchetSessionResetSignableContent`'s canonical serialization
is a fixed-position `JSON.stringify([...])` array (not a keyed object) —
every field's POSITION, not just its presence, is part of the signed
digest. Inserting a new `transitionId` field would require reserializing
every position after it, which is safe for NEW signatures but changes the
preimage shape for a wire message type several prior Arcs have already
built real, passing tests against. Given this Arc's own "Fail Closed over
fabrication" instruction and "do not invent another reset message type"
prohibition, the chosen design binds `transitionId` via a SEPARATE,
additive, durable LOCAL correlation fact
(`FedosIdentityTransitionRatchetResetLinkV1 {transitionId, sessionId,
conversationId, remoteAccountRef, remoteDeviceRef, recordedAt}`,
`persistence/fedos_identity_transition_ratchet_reset_link_persistence.ts`)
written immediately after a successful `establishSession()` call — the
wire message itself carries the real, authentic `resetReason:
"identity-transition"` (visible and verifiable by the remote peer), while
the transitionId correlation lives in the LOCAL initiator's own durable
state, queryable by `inspectTransition()`/a future Arc, without touching
the signed wire tuple. This is the most conservative choice available and
is called out explicitly rather than silently narrowing scope.

## Conclusion

Base is `b4aaab9` directly (no merge commit). Proceeding to Phase B.

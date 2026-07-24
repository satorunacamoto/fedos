# 19 — Implementation Arc Packaging

This review does not recommend building the whole Identity Transition
system in one Arc — exactly the same "narrow, additive, one boundary at a
time" discipline `f80889d` and `d825aa0` both already followed for
Device lifecycle and peer capability.

## Sequence

1. **Identity Transition types, validation, and durable facts.** Closed,
   versioned transition-record schema (`20`'s conceptual fields), the
   evidence-level vocabulary (`07`), exact-field-set codecs mirroring
   `d825aa0`'s own discipline, and a durable, append-only-capable
   Observation-shaped store for transition facts — no signing, no
   transport, no acceptance policy yet. **This review's recommended next
   Arc, and no further.**
2. **Local authorization/evidence policy.** A pure, narrow acceptance
   function (mirroring `evaluateFedosRatchetPeerCapabilityAcceptance()`)
   deciding `"locally-accepted"`/`"rejected"`/`"conflicting"`/`"stale"`
   from already-verified evidence — still no live signing/transport.
3. **Peer notification integration.** Wire the transition-fact codec
   through the existing NIP-17 private-transport seam (`16`), reusing
   `sendMailboxNip17Control()` exactly as `d825aa0` does.
4. **Ratchet termination/reset integration.** The `applyIdentityTransitionToSessions()`
   sweep (`12`), the new `FedosDirectRatchetSessionResetReason` value,
   wired into the EXISTING Reset Coordinator — never a new reset
   mechanism.
5. **Device rebind/reverification.** The account-scoped Device
   Replacement pattern (`11`), reusing the live Account-to-Device
   authorization boundary under the new identity.
6. **Conversation continuity mapping.** The new Membership state
   (`13`'s proposed `"superseded-by-transition"`), the new-Membership
   creation flow, gated on `"locally-accepted"`.
7. **Archive/Search compatibility.** Confirm (via tests, not new
   production logic in most cases — `14` already describes existing,
   correct behavior) that Archive/Search continue to treat old and new
   identities as separate absent an accepted transition.
8. **UI/manual verification.** The safe status DTO (`10`) and whatever
   manual-confirmation UI a Desktop Arc chooses to build — explicitly the
   LAST engineering step, once every underlying fact/evidence/policy
   layer is real.
9. **Group support.** Deferred indefinitely pending Group's own identity
   model settling (`13`) — not scheduled as part of this sequence at all.

## Why step 1 is the safest first Arc

It ships zero live capability change — no signing, no transport, no
session mutation, no Membership mutation. It is pure types/validation/
durable-fact infrastructure, exactly the same shape as `d825aa0`'s own
Phase B/C/D/I (vocabulary, advertisement schema, lifecycle schema,
Observation domain) before ANY coordinator wiring existed. It lets every
later step build against a real, tested, versioned schema rather than a
document's own prose description — and, per this review's own Fail
Closed discipline, an unknown/malformed transition record can be rejected
correctly from day one, before any peer-facing behavior depends on it.

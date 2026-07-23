# Secure Runtime Alpha 7081–7160 — Completion Declaration

**FedOS Conversation Invitation and Shared Conversation Foundation Arc.**

## Verdict: Honest Partial

Per the mission's own explicit instruction — "If a production blocker is
discovered, stop immediately, document it honestly, and commit as Honest
Partial" — this Arc is declared **Honest Partial**, not full completion.
The blocker is Gap 1 in the companion deep-gap report: the real NIP-17
wire adapter is never constructed through the real production
Coordinator/packaged path, so the literal requirement "No fake transport.
No fake relay." could not be satisfied for the ACTUAL relay-transported
delivery leg of an invitation. That leg is a genuine, pre-existing,
cross-cutting production gap this Arc did not create and whose narrow
mandate does not authorize fixing (see the deep-gap report's "Common root
cause" section — closing it is a foundational Arc of its own).

This verdict mirrors, and is caused by the same underlying production
wiring gap as, the immediately-prior Arc's own Honest Partial
(`e43cf67a`, Secure Runtime Alpha 7001–7080), which was blocked by
`redeemInvitation()` being unavailable. This Arc closes THAT specific gap
(a real, working, additive Invitation/Acceptance mechanism now exists)
but surfaces the transport-layer gap sitting one layer beneath it.

## What was achieved, for real, and is proven by real tests

All of the following are proven in
`test/secure_runtime_alpha_7081_7160_real_vertical_slice.test.ts` and
`test/secure_runtime_alpha_7081_7160_failure_matrix.test.ts`, using real
BIP-340 Schnorr signing/verification, two genuinely independent real
production profiles (`FedosProfileInitializationCoordinator` +
`startFedosDesktopRuntime()`, not manually-wired test dependencies), and
a real local relay connection:

- **Invitation record** — `FedosConversationInvitationAdvertisementV1`,
  a signed, domain-separated, fixed-schema record.
- **Invitation token** — the wire-encoded control payload carrying it.
- **Acceptance coordinator** — `FedosConversationInvitationInboundCoordinator`,
  performing real signature verification, real addressee verification,
  real expiry checking, real duplicate detection.
- **Shared Conversation creation** — a single conversationId, generated
  once by the inviter, is genuinely held identically by both peers.
- **Membership persistence** — both peers' Memberships are durably
  admitted and independently confirmed present.
- **Conversation bootstrap** — both peers' local Drafts are genuinely
  constructed via the existing, unmodified
  `reactivateRestoredConversation()`.
- **Runtime wiring** — additive, optional, zero behavior change to any
  pre-existing caller (proven by structural guard test 6).
- **Restart safety** — Bob's Draft and Memberships genuinely survive a
  real Coordinator restart (lock release, fresh Coordinator instance,
  `unlockProfile()`), and a redelivered invitation after restart is
  correctly recognized as a duplicate, not a conflict.
- **Validation** — exact-field-set structural validators, fail-closed
  decode, fail-closed signature/expiry/duplicate checks.
- **Failure matrix** — 10/10 passing: wrong-recipient, expired, tampered
  content, non-invitation payload, malformed JSON, oversized payload,
  idempotent duplicate, invalid `expiresInMs`, signing-unavailable,
  identity-unavailable.
- **Structural guards** — 10/10 passing: no trust of the unsigned Rumor
  pubkey, no raw secrets in new files, real reuse (not reimplementation)
  of `admit()`/`reactivateRestoredConversation()`, the old Capability/
  Invitation Transport system (Alpha 991-1050) left untouched, Direct
  Ratchet/Identity Transition/Signed Deletion/Rust left untouched,
  additive-only Runtime wiring, real append-only NDJSON persistence, the
  narrow `conversationDraftLogPath` fix isolated to the Coordinator only,
  no `p2p/`/`.tmp_gen/` changes, a distinct closed invitation payload
  kind.
- **One real, narrow, in-scope production bug fixed**:
  `conversationDraftLogPath` was never wired by
  `FedosProfileInitializationCoordinator`, silently defaulting Draft
  persistence to in-memory-only through the real production path for
  EVERY Direct/Group conversation. Fixed.

## What remains blocked, honestly, and is out of this Arc's own scope

Three deep, pre-existing, cross-cutting production gaps — detailed in
full in `docs/secure_runtime_alpha_7081_7160_deep_production_gap_report.md`:

1. The real NIP-17 wire adapter is never constructed through the real
   Coordinator/packaged path (`productionCryptoGraph` never populated) —
   blocks REAL relay-transported delivery of Conversation Invitations
   AND every other control-message subsystem (Peer Capability, Direct
   Ratchet control messages, Identity Transition, Signed Deletion) today.
2. `FedosConversationIdentityResolver` resolves to a generic,
   non-per-account placeholder in the real production path — worked
   around in this Arc's own scope via a real per-account signing-derived
   identity, but not fixed at the root.
3. `FedosConversationDirectActivationCoordinator` requires a real
   production encryption authority that has never been built — Draft and
   Membership are durably established regardless (proven), but
   `activateDirectConversation()`'s own full "activated" state is never
   reached through the real production path today.

## No redesign occurred

Per the mission's own explicit constraint, confirmed by structural guard
tests 4 and 5: Direct Ratchet is untouched, Identity Transition is
untouched, Signed Deletion is untouched, the Rust/WASM core is untouched,
and the pre-existing Capability/Invitation Transport system (Alpha
991-1050) is untouched — this Arc is purely additive and parallel.

## Recommended next Arc

**FedOS Conversation-Level Production Crypto and Identity Authority
Wiring Arc** — close Gaps 1–3 coherently in one pass, since all three
share the same root cause (the real Coordinator/packaged path only ever
wires the narrow, Ratchet-specific Master Seed Authority field, never the
broader Conversation-level `conversationProductionCrypto`/
`conversationCreatorIdentityAuthority`/`conversationEncryptionAuthority`/
`conversationDecryptionAuthority`/`conversationDirectMessageDeliveryRoute`
fields). This is a narrower, more clearly-scoped recommendation than a
default "next sequential Arc," consistent with how the immediately-prior
Honest Partial Arc (7001-7080) handled its own next-step recommendation.

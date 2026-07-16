# Secure Runtime Alpha 789 — End-to-End Foundation Verification

`test/secure_runtime_alpha_789_end_to_end_verification.test.ts` #1 — the full, real, in-memory path this Arc's own instruction requires, entirely domain-local:

Conversation Record (a fixed `FedosConversationId`, no persistence write needed to exercise this path) → issuer Membership (the owner is admitted first, out-of-band of any Capability) → issue join Capability (`issueJoinCapability()`, gated by a REAL, injected active-membership authorization check) → redeem as participant (`redeem()`) → Membership admitted (`findMembership()` confirms `state: "active"`, `role: "member"`) → repeated redemption rejected (`already-redeemed`, the `maxUses: 1` capability already spent) → revoked member cannot issue (the former owner is `revoke()`d, then a second `issueJoinCapability()` attempt is honestly `denied: issuer-not-authorized`, proving the Alpha 773 Policy↔Membership boundary works end-to-end even without a dedicated production evaluator file).

No message is sent, no private Conversation is constructed — verified structurally by #2 (neither authority's own public surface exposes a `createPrivateGroup`/`createDirectMessage` method).

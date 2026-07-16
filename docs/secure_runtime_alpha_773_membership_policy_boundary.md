# Secure Runtime Alpha 773 — Membership Policy Boundary

Future shape:

```
Conversation Policy
    ↓
Membership Authority
    ↓
Authorization Decision
```

**Not implemented as production code in this Arc — a boundary sketch only**, per the same restraint the prior review's own `10_membership_boundary.md` already applied to the analogous authority ("not implemented, not even as a type in `src/`... adding even the interface, with zero implementations, would be the first step toward a caller eventually being tempted to construct a stub"). `FedosConversationPolicy.writeAccess: "restricted"` remains rejected by `validateFedosConversationPolicy()`, unchanged — widening that validator is an explicit compatibility decision out of this Arc's own scope (Conversation Record/Policy core files are untouched, per the Arc's own instruction to touch them only if strictly necessary).

A REAL, narrow authorization evaluator does exist, but only as a TEST-injected closure with a genuine consumer — `test/secure_runtime_alpha_789_end_to_end_verification.test.ts` #1 constructs `authorizationCheck = (conversationId, issuer) => membershipAuthority.findMembership(conversationId, issuer)?.state === "active"` and demonstrates the full Policy→Membership→Authorization-Decision shape working end-to-end: a revoked former owner is concretely denied `issueJoinCapability()`. This satisfies "implement only a narrow authorization evaluator if it has a real test consumer" without adding speculative `src/` surface with no current caller.

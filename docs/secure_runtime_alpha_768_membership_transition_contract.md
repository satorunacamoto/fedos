# Secure Runtime Alpha 768 — Membership Transition Contract

`isFedosConversationMembershipTransitionAllowed()` (`src/conversation/membership/fedos_conversation_membership_transition.ts`) — a pure decision function, consulted before any mutation.

Allowed: `nonexistent → active` (`admit`), `active → revoked`, `active → left`. Forbidden: `revoked → active`, `left → active`, `revoked → left`, `left → revoked`.

A revoked or left membership never silently reactivates. Re-admission, if ever needed, must create a new explicit membership generation or use a future reviewed design — out of this Arc's own scope; `InMemoryFedosConversationMembershipAuthority.admit()` returns `"invalid-transition"` for any attempt against a `revoked`/`left` membership, never a silent no-op and never a fresh `"active"` record. Verified for all six forbidden transitions by `test/secure_runtime_alpha_764_768_membership_model.test.ts` #6–8 and the resurrection checks in `test/secure_runtime_alpha_769_771_membership_authority.test.ts` #9–10.

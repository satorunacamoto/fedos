# Secure Runtime Alpha 784 — Local Exactly-Once Semantics

Stated explicitly, without hedging, per this Arc's own instruction:

- **In-memory authority**: exactly-once ONLY within that one instance's own state — a `maxUses: 1` capability is redeemed by at most one distinct redeemer, full stop, no claim beyond this instance's own boundary (`test/secure_runtime_alpha_786_in_memory_capability_authority.test.ts` #6/#7).
- **Durable authority**: not implemented by this Arc — would require an atomic durable backend (a genuinely separate Arc's own scope, see Alpha 790's own recommendation).
- **Distributed nodes**: not guaranteed by anything in this Arc. No claim of "disappears from every Node in the world instantly" is made anywhere in this Arc's own code, tests, or documentation.

This mirrors the prior review's own Option A conclusion (`docs/reviews/private_conversation_security/10_one_time_redemption.md`) exactly: single-authority atomic redemption gives a TRUE exactly-once guarantee, at the honest cost that redemption requires this one authority instance's own reachable state — never a workaround, a real tradeoff this Arc names rather than hides.

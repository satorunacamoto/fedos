# Secure Runtime Alpha 785 — Capability-to-Membership Coordination

Required sequence, implemented exactly in `InMemoryFedosConversationCapabilityAuthority.redeem()` (`src/conversation/capability/in_memory_fedos_conversation_capability_authority.ts`):

1. Validate the capability without mutation (unknown id/wrong secret collapsed into `invalid-capability`, expiry, recipient mismatch, already-redeemed-by-this-redeemer, exhausted).
2. Preview Membership admission (`FedosConversationMembershipAuthority.previewAdmission()`, a pure read) — a `"blocked"` preview stops here, BEFORE any mutation, so a doomed redemption never consumes the capability.
3. Commit the capability use (mark this redeemer as having redeemed) — the exactly-once gate.
4. Commit Membership admission (`FedosConversationMembershipAuthority.admit()`).

**No transactionality across the two separate authorities is claimed anywhere.** Steps 3 and 4 are two separate commits against two separate authorities (this class's own capability map, and the injected Membership Authority) — no shared transaction exists. If step 4 fails or is blocked AFTER step 3 already committed (e.g. the redeemer holds a conflicting role from an unrelated admission path), `redeem()` returns `"conflict"`, honestly disclosing that the capability was consumed but Membership was not granted — never hidden, never silently retried. Membership's own `admit()` is idempotent (Alpha 771), so this failure mode never compounds on a second, separate call against the SAME redeemer/capability pair.

A dedicated coordinator class was considered and rejected as a separate file: `InMemoryFedosConversationCapabilityAuthority` already holds both the capability state AND the injected Membership Authority reference it coordinates with, so a THIRD wrapper class coordinating two authorities it does not itself own would be pure indirection with no independent state or reuse value — a speculative abstraction this Arc's own instruction forbids.

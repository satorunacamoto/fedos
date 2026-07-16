# Secure Runtime Alpha 774 — Phase A Verification

Real execution, `test/secure_runtime_alpha_769_771_membership_authority.test.ts` + `test/secure_runtime_alpha_789_end_to_end_verification.test.ts`:

- admit participant — #2.
- duplicate admission — #3 (`already-present`).
- conflicting role — #4 (`conflict`, original membership untouched).
- revoke — #6.
- leave — #7.
- invalid resurrection — #9/#10 (revoked and left both permanently blocked from every one of `admit`/`revoke`/`leave`).
- two Conversations — #11 (no contamination).
- same identifier across distinct authorities — #12 (`nostr:same-id` and `fedos:same-id` are distinct memberships).
- immutable returned records — #14 (deep-frozen, caller mutation never reaches internal state).
- public Conversation unaffected — `test/secure_runtime_alpha_772_public_mode_compatibility.test.ts` #2, a real end-to-end `createPublicThread()`/`replyToPublicThread()` round trip through `FedosDesktopHost`.

**Phase A gate: PASSED.** Membership semantics are closed and protocol-neutral — proceeding to Phase B (Capability domain).

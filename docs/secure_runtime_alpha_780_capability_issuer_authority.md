# Secure Runtime Alpha 780 — Capability Issuer Authority

`FedosConversationCapabilityIssuerAuthority` (`src/conversation/capability/fedos_conversation_capability_issuer_authority.ts`) — `issueJoinCapability()` / `inspectDescriptor()`.

The issuer verifies, before issuing: the conversation exists (`FedosConversationExistenceCheck`, injected), the issuer is authorized (`FedosConversationCapabilityIssuanceAuthorizationCheck`, injected), and `maxUses`/`expiresAt` are well-formed (validated inline). BOTH checks are injected rather than hard-wired to `FedosConversationPersistence`/`FedosConversationMembershipAuthority` directly — an adapter boundary, matching this Arc's own "prefer adapters over replacements" instruction, so the Issuer Authority never gains a direct compile-time dependency on one specific persistence/membership implementation.

For V1, a caller/test may inject a static/always-true authorization check (`test/secure_runtime_alpha_786_in_memory_capability_authority.test.ts` uses `() => true`) — this file makes no claim that real, production private-invite authorization exists. `test/secure_runtime_alpha_789_end_to_end_verification.test.ts` demonstrates the HONEST, real version: an authorization check backed by a genuine `FedosConversationMembershipAuthority.findMembership()` call, denying a revoked former owner.

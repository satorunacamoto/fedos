# Secure Runtime Alpha 782 — Redemption Result Vocabulary

`FedosConversationCapabilityRedemptionResult` (`src/conversation/capability/fedos_conversation_capability_redemption_result.ts`) — `redeemed | already-redeemed | expired | exhausted | invalid-capability | recipient-mismatch | unauthorized | conflict | unavailable`.

`"invalid-capability"` covers BOTH an unknown `capabilityId` AND a wrong `bearerSecret` uniformly — per this Arc's own instruction, never exposing whether a guessed secret was "almost correct" (verified: `test/secure_runtime_alpha_786_in_memory_capability_authority.test.ts` #5).

`"already-redeemed"` and `"exhausted"` are given genuinely distinct, both-reachable meanings rather than treated as synonyms: `"already-redeemed"` fires when THIS SPECIFIC redeemer has redeemed this exact capability before (a duplicate attempt by the same participant); `"exhausted"` fires when `maxUses` has been reached by OTHER, different redeemers and this new redeemer cannot get in (`test/secure_runtime_alpha_786_in_memory_capability_authority.test.ts` #6 vs. #7).

`"unauthorized"` is defined but structurally UNREACHABLE from this Arc's own in-memory implementation today — reserved for a future redemption-time policy gate (Alpha 773's own boundary, not implemented), matching this codebase's own precedent of naming a forward-looking-but-currently-inert outcome explicitly (`FedosBoardRuntimeCommandResult`'s own `"unsupported-conversation-mode"`, Alpha 667).

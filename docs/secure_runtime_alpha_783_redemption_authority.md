# Secure Runtime Alpha 783 — Redemption Authority

`FedosConversationCapabilityRedemptionAuthority` (`src/conversation/capability/fedos_conversation_capability_redemption_authority.ts`) — one operation, `redeem(request, now)`.

Responsibilities: verify the bearer secret, enforce expiry, enforce `intendedRecipient`, enforce `maxUses`, produce a Membership admission request, enforce local atomicity within one authority instance (Alpha 784). Non-responsibilities, per this Arc's own Absolute Prohibitions: global distributed consensus, network broadcast, encryption key delivery, URL parsing, GUI.

# Secure Runtime Alpha 781 — Redemption Request

`FedosConversationCapabilityRedemptionRequest` (`src/conversation/capability/fedos_conversation_capability_redemption_request.ts`) — `capabilityId | bearerSecret | redeemer` only.

A caller cannot supply: use count, issuer, conversation mapping, role, Membership state, or the acceptance result itself — every one of those is Authority-derived, mirroring `CreatePublicThreadCommand`'s own "no id/author/source/createdAt on the command side" discipline (Alpha 624). `redeemedAt` is deliberately NOT a request field — `redeem(request, now)` takes `now` as a separate, caller-supplied parameter, matching the Membership Authority's own `admit(..., now)` convention rather than duplicating the timestamp inside the request object.

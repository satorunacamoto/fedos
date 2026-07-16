# Secure Runtime Alpha 779 — Capability Issuance Result

`FedosConversationCapabilityIssuanceResult` (`src/conversation/capability/fedos_conversation_capability_issuance_result.ts`) — `issued | denied (reason) | invalid-request | unavailable`.

An `"issued"` result carries the public `descriptor` AND the `bearerSecret` — the ONE dedicated boundary where the two are returned together, never separately re-derivable later (there is no `revealBearerSecret()` method anywhere in this Arc — a bearer secret is visible exactly once, at issuance). Never an internal authority/repository reference — `InMemoryFedosConversationCapabilityAuthority`'s own private `Map` is never exposed. `"denied"` carries a closed reason (`conversation-not-found | issuer-not-authorized`), never a free-text message.

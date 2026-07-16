# Secure Runtime Alpha 813 — Conversation Isolation

Stage 23. Verified
(`test/secure_runtime_alpha_813_conversation_isolation.test.ts`):

- A payload for Conversation A is never listed under Conversation B —
  `listConversationPayloads` filters strictly by `conversationId`.
- A caller must already know the exact payload id to read bytes —
  `listConversationPayloads` returns descriptors only (no `bytes`
  field); there is no "list all bytes for a Conversation" operation.
- **Storage itself is NOT a complete authorization system** — stated
  plainly, not hedged: `getPayload(id)` succeeds for ANY caller who
  knows the id; no membership/policy check happens at this layer.
  `FedosPayloadRetentionAuthority` gates on RETENTION state only
  (tombstoned/payload-removed), never on identity or membership — those
  concepts do not exist in this Arc's scope.
- **A future Membership/Policy gate must wrap reads** — this Arc does
  not claim storage-level access control exists; a future Arc
  introducing real Membership (per the approved Conversation Foundation
  V1 review's own dependency order) would need to add its own gate in
  front of `FedosPayloadRetentionAuthority.readPayload()`, not modify
  this Arc's own port.

# Secure Runtime Alpha 766 — Membership Record V1

`FedosConversationMembership` (`src/conversation/membership/fedos_conversation_membership.ts`) — `id | conversationId | participant | role | state | joinedAt | endedAt`. Every field `readonly`; only the in-memory authority's own internal construction (guarded by the Alpha 768 transition contract) ever produces one.

Explicitly excluded, per this Arc's own Absolute Prohibitions and the prior reviews' own §07/§13 "pseudonym/profile never used for authorization" finding: invitation secret/bearer material (Capability-domain, never Membership-domain), encryption key/key epoch reference (this Arc implements no encryption of any kind), message history, display pseudonym, device list, delivery status, arbitrary metadata bag.

`joinedAt`/`endedAt` are Unix seconds, matching `FedosConversationRecord.createdAt`'s own convention. `endedAt` is `null` while `state === "active"`, non-null the instant `state` becomes `"revoked"`/`"left"` — never deleted, matching this Arc's own "revoke and leave both land here" instruction.

# Secure Runtime Alpha 767 — Membership Identity

Compared: A. `conversationId` + participant `authority` + `publicIdentifier` (deterministic). B. a generated (random) membership id. C. the redeeming Capability's own `capabilityId`. D. a protocol-native id.

**Adopted: Option A.** `toFedosConversationMembershipId()` (`src/conversation/membership/fedos_conversation_membership_id.ts`), mirroring `toFedosConversationId`'s own "deterministic from an already-existing pair, never randomly minted" discipline (Alpha 743). Gives honest idempotency for free: admitting the same participant into the same Conversation twice always derives the identical id, so `admit()` detects "already a member" via a plain map lookup, no separate index.

Option B rejected — a random id would make two `admit()` calls for the same participant produce two different ids, breaking that idempotency. Option C rejected per this Arc's own explicit instruction ("do not make capability identity equal membership identity") — a Capability is a one-time issuance fact, a Membership is an ongoing relationship; a participant admitted without ever redeeming a Capability would have no `capabilityId` to key off of. Option D rejected per this Arc's own Absolute Prohibitions against embedding any protocol-native id as a FedOS application identifier.

Uses the same `::`-joined convention as `toFedosConversationId`/`makeFedosBoardOutboxId`, joining three parts. Inherits, not newly introduces, the same "assumes no part contains `::`" limitation `toFedosBoardId` already carries.

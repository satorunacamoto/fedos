# Secure Runtime Alpha 770 — Membership Authority Interface

`FedosConversationMembershipAuthority` (`src/conversation/membership/fedos_conversation_membership_authority.ts`) — six operations: `previewAdmission` (pure), `admit`, `findMembership`, `listMemberships`, `revoke`, `leave`. Mirrors `FedosConversationPersistence`'s own "one port per durable concern, no database vocabulary, no network" discipline.

Mutations are kept separate from the pure `previewAdmission()` read, matching this codebase's own existing read/write separation precedent. Timestamps are caller-supplied (`now: number`, Unix seconds) rather than read from `Date.now()` internally — keeps every implementation pure and deterministically testable, matching `validateFedosConversationRecord`'s own caller-supplied `createdAt` convention rather than inventing a second clock-injection idiom.

Not this authority's responsibility, per this Arc's own Absolute Prohibitions: message encryption of any kind; invitation secret issuance/redemption (Capability-domain — consulted BY the Capability domain via this interface, never the reverse, see Alpha 785); any protocol/network responsibility.

# Secure Runtime Alpha 823/824 — Persistence Ownership and Cross-Authority Coordination Decisions

Stages 3-4 of Phase A.

## Alpha 823 — Persistence Ownership Decision

Compared: (A) Authorities directly own filesystem persistence, (B)
dedicated persistence ports injected into Authorities, (C) Host reads/writes
raw Membership/Capability records, (D) reuse Conversation Persistence.

**Adopted: B.** Mirrors `FedosConversationPersistence`'s own established
port shape exactly. `FedosConversationMembershipPersistence`
(`src/conversation/membership/persistence/fedos_conversation_membership_persistence.ts`)
and `FedosConversationCapabilityPersistence`
(`src/conversation/capability/persistence/fedos_conversation_capability_persistence.ts`)
are new, dedicated ports — neither widens `FedosConversationPersistence`,
and neither performs a domain transition itself (`putMembership`/`putEvent`
are raw writes; transition legality stays owned by
`PersistedFedosConversationMembershipAuthority` /
`PersistedFedosConversationCapabilityAuthority`).

## Alpha 824 — Cross-Authority Coordination Decision

Compared: (A) consume Capability first, (B) admit Membership first, (C) one
shared generic transaction framework, (D) dedicated narrow
redemption-coordination record and recovery path, (E) claim atomicity
without rollback/recovery.

**Adopted: D**, per this Arc's own instruction ("reject C unless an
existing transaction abstraction already exists" — none does anywhere in
this codebase; "reject E unconditionally"). Consume-then-admit ordering (A)
is preserved as the actual write sequence — it already matches the frozen
Alpha 786 in-memory Authority's own step order — but ordering alone cannot
recover from a crash between the two writes, which is exactly what D adds:
`FedosPersistedConversationRedemptionCoordinationV1`
(`src/conversation/capability/coordination/fedos_persisted_conversation_redemption_coordination_v1.ts`)
plus `FedosConversationDurableRedemptionCoordinator`
(`src/conversation/capability/coordination/fedos_conversation_durable_redemption_coordinator.ts`).

Five phases only (`prepared` / `capability-consumed` / `membership-admitted`
/ `completed` / `terminal-failed`), a deterministic `coordinationId` keyed
by `(capabilityId, redeemer)`, and no generic saga machinery — the smallest
domain-specific recoverable solution the instruction asked for. See
`fedos_conversation_durable_redemption_coordinator.ts`'s own header for the
full recovery-by-phase design and Alpha 846/847's own test coverage in
`test/secure_runtime_alpha_843_849_redemption_coordination.test.ts`.

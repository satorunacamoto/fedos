# Review 13 — Read API

## Minimal application reads, mirroring `FedosConversationReader`'s own established discipline

`src/conversation/fedos_conversation_reader.ts`'s own header states the
precedent directly: "the ONLY thing `FedosBoardRuntime` holds a
reference to for Conversation reads; `FedosConversationPersistence`
itself is NEVER returned to a caller." `FedosConversationRuntime`
(`12`) must observe the identical discipline, extended to Membership
and Capability:

```ts
findConversation(id: string): FedosConversationRecord | null;

listParticipantMemberships(conversationId: string): readonly FedosConversationMembership[];
// forwards to FedosConversationMembershipAuthority.listMemberships() -- already
// returns deep-frozen values (PersistedFedosConversationMembershipAuthority's
// own freezeMembership(), confirmed in 01) -- no new freezing needed.

readinessStatus(conversationId: string): FedosConversationConstructionReadiness;
// 03's own vocabulary, re-evaluated live -- not cached from construction time.

policy(conversationId: string): FedosConversationPolicy | null;
// forwards to the injected FedosConversationPolicyAuthority.resolvePolicy();
// never returns an internal Authority reference.

visibleCapabilityDescriptors(conversationId: string, issuer: FedosConversationParticipantReference): readonly FedosConversationCapabilityDescriptor[];
// descriptors ONLY -- never a bearer secret (11) -- and ONLY those the
// calling issuer itself issued, matching FedosConversationCapabilityIssuerAuthority's
// own inspectDescriptor() being keyed by capabilityId, never a
// list-everything method (no such method exists on that Authority today,
// confirmed in 01 -- this read API does not invent one; it composes
// inspectDescriptor() over a caller-scoped id list a real implementation
// would need to track, itself a small, additive piece of state this
// review names but does not design in full).
```

## What is explicitly NOT exposed

- **No persistence port of any kind** — `FedosConversationPersistence`,
  `FedosConversationMembershipPersistence`,
  `FedosConversationCapabilityPersistence` are never returned,
  matching `FedosConversationReader`'s own guardrail exactly.
- **No bearer secret** — `FedosConversationCapabilityBearerSecret` is
  never returned by any read method; `11`'s own "returned exactly once,
  at issuance time" rule is the ONLY channel a bearer secret ever
  travels through.
- **No raw key material of any kind** — no read method returns
  anything from `src/crypto`/`src/vault`/`src/runtime/master_seed`;
  `readinessStatus()` reports ONLY the closed `03` outcome vocabulary,
  never a key handle, envelope, or capability object from those
  modules.
- **No internal Authority reference** — every method above forwards
  through the Runtime's own injected dependency, never returns the
  dependency object itself, matching `FedosBoardRuntime.findPost()`'s
  own "never returns the raw `FedosBoardReader`/`FedosBoardService`
  instance itself" precedent.

## Why `readinessStatus()` is separate from `findConversation()`

A Conversation record's own STORED `lifecycleState` (`09`) is a
snapshot from CONSTRUCTION time; `readinessStatus()` is a LIVE
re-evaluation (identity/membership/capability/encryption/storage may
each independently change availability after construction — a WASM
artifact could be built later, an identity provider could later be
configured). Collapsing the two would let a caller mistake a stale
construction-time snapshot for current system capability — the same
distinction `previewAdmission()`/`admit()` already draw for Membership
(`03`'s own reasoning, applied here to the read surface specifically).

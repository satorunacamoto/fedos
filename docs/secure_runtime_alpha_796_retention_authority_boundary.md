# Secure Runtime Alpha 796 — Retention Authority Boundary

Stage 6. `FedosPayloadRetentionPersistence`
(`src/conversation/retention/fedos_payload_retention_persistence.ts`) —
a dedicated port, mirroring `FedosConversationPersistence`'s own shape
(Alpha 749): `putDecision`/`getDecision`/`listDecisionsForPayload`/
`listDecisions`, no delete method (a retention decision is itself a
permanent fact, never un-recorded).

`FedosPayloadRetentionAuthority`
(`src/conversation/retention/fedos_payload_retention_authority.ts`) is
the narrow authority (Alpha 796's own instruction) connecting this port
to `FedosConversationPayloadStorage` (Alpha 804):

```ts
evaluatePayloadAccess(payloadId): FedosPayloadAccessEvaluation   // pure preview
readPayload(payloadId): FedosGatedPayloadReadResult              // pure preview + delegated read
tombstonePayload(payloadId, authorityReference, reasonCode): FedosPayloadRetentionResult      // mutation
removeLocalPayload(payloadId, authorityReference, reasonCode): FedosPayloadRetentionResult    // mutation
```

**Pure preview separated from mutation**, per this Arc's own
instruction: `evaluatePayloadAccess`/`readPayload` write nothing;
`tombstonePayload`/`removeLocalPayload` are the only two methods that
ever call `retentionPersistence.putDecision()`.

**No filesystem handle or persistence object is ever exposed** — the
Authority holds both dependencies privately (`#retentionPersistence`,
`#payloadStorage`); no public method returns either.

# Secure Runtime Alpha 795 — Retention Decision Record

Stage 5. `src/conversation/retention/fedos_payload_retention_decision.ts`:

```ts
type FedosPayloadRetentionAction = "tombstoned" | "payload-removed"; // no "active" record — see below
type FedosPayloadRetentionReasonCode = "user_requested_placeholder" | "policy_placeholder" | "test_placeholder";

interface FedosPayloadRetentionDecision {
  readonly payloadId: FedosConversationPayloadId;
  readonly action: FedosPayloadRetentionAction;
  readonly decidedAt: number;
  readonly authorityReference: string | null;
  readonly reasonCode: FedosPayloadRetentionReasonCode;
}
```

Implemented — real, tested (`test/secure_runtime_alpha_795_payload_retention_decision.test.ts`),
only because a real enforcement/read path uses it:
`FedosPayloadRetentionAuthority` (Alpha 796) is the sole consumer.

- **No free-form reason** — `reasonCode` is a closed vocabulary,
  mirroring `FedosBoardModerationReasonCode`'s own `_placeholder`
  discipline (Alpha 258).
- **No account profile** — `authorityReference` is an opaque,
  non-secret reference string or `null`; never a resolved identity/
  profile object.
- **No secret, no plaintext.**

Deterministic key: `fedosPayloadRetentionDecisionKey(payloadId, action)`
= `${payloadId}::${action}`, mirroring `toFedosConversationId`'s own
`::`-joined convention (Alpha 743). At most one `"tombstoned"` and one
`"payload-removed"` record can ever exist per payload — enforced by the
persistence port's own idempotent write semantics (Alpha 796), not by
this file.

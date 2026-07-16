# Secure Runtime Alpha 728 — Retry Policy Mapping

Stage 8.

## Finding

`outboundPublishOutcomeToRetryPolicy()`
(`src/board/publish/fedos_outbound_publish_result_retry_policy.ts`, Alpha
497, unchanged) already defines exactly the required canonical mapping:

```ts
const OUTCOME_TO_RETRY_POLICY = {
  accepted: "never",
  rejected: "never",
  failed: "later",
};
```

- **accepted:** never retry. ✅ (already true)
- **rejected:** never retry automatically. ✅ (already true — the
  defect this Arc closes was never in this table; it was that
  `"rejected"` never REACHED this table from the Nostr path.)
- **failed:** existing retry/abandonment policy evaluates
  (`FedosPublishScheduler`'s own `#abandonmentPolicy.evaluate()` call,
  unchanged) — a `"later"` retry policy does not itself abandon; the
  injected `FedosDeliveryAbandonmentPolicy` (unchanged) decides when
  enough transient failures warrant abandonment.

`FedosPublishScheduler` contains no protocol-name branch of any kind —
confirmed structurally in
`test/secure_runtime_alpha_733_scheduler_and_runtime_compatibility.test.ts`
test 1 (no `nostr` import anywhere in its own source). This table is the
ONE, universal, protocol-neutral retry-decision source every adapter
reuses — no Nostr-specific override was added or is needed.

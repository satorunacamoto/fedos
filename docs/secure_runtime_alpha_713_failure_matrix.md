# Secure Runtime Alpha 713 — Failure Matrix

Stage 13 of Phase B. `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts`
covers the cases with real, checkable behavior in this Arc's own scope:

| Case | Board | Outbox | Observation/Retry |
|---|---|---|---|
| Unavailable signer (author resolution itself fails) | not written | not created | n/a |
| Cleared/unavailable signer (binding only) | written | ineligible, not created | n/a |
| Author mismatch (`public-key-mismatch`) | written | ineligible, not created | n/a |
| Unsupported target (activitypub/atproto/session) | written | ineligible, not created | n/a |
| Disconnected/throwing Relay | written | created, stays pending | `"failed"`, retried later |
| Unrelated OK | written | created, stays pending | unaffected, no false match |
| Matching accepted OK | written | created → delivered | `"publishing"`/`"accepted"` |
| Matching rejected OK | written | created, stays pending | `"failed"`, retried later (Alpha 711's disclosed limitation) |
| Timeout | written | created, stays pending | `"failed"`, retried later |
| Malformed Outbox record | n/a | `deserializeFedosBoardOutboxIntent` returns `null`, event source returns `null` | untouched (pre-existing, Alpha 496, unchanged) |
| Duplicate Scheduler tick | written | created, delivered once | single accepted attempt (Alpha 707 test 3 / 709) |
| Runtime stop during in-flight | written | intent persists | `stopDelivery()`'s own pre-existing "in-flight tick completes" guarantee (Alpha 505/506/564, unchanged) |
| Restart | written (durable) | durable, restored | not resent (Alpha 709) |

Every row not independently re-tested in Phase B either (a) already has
dedicated, unmodified test coverage from an earlier Arc (malformed
Outbox, in-flight stop, Scheduler concurrency) that this Arc's own changes
do not touch, or (b) is directly covered by
`test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts` /
`test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts` /
`test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`.

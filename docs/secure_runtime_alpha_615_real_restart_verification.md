# Secure Runtime Alpha 615 — Real Restart Verification

Stage 15 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## The ten-step scenario, run for real, in `test/secure_runtime_alpha_615_real_restart_verification.test.ts`

Against a real OS temporary directory (`node:fs.mkdtempSync`), real
`AppendOnlyFedosBoardPersistence`/`AppendOnlyFedosBoardOutboxPersistence`/
`AppendOnlyFedosDeliveryObservationPersistence` backends, and TWO
genuinely independent `startFedosDesktopRuntime()` calls (no shared
in-memory object of any kind — only the three file paths are common):

1. Runtime起動 — `startFedosDesktopRuntime({..., deliveryEnabled: true})`.
2. Post submit — `submitPostWithOutbox()`.
3. Outbox queue — a real, durable Outbox intent (`outbox.length === 1`).
4. Delivery attempt — a real (2ms-delayed, see below) Publisher call
   observed.
5. Stop — `runtime.stop()`.
6. Fresh runtime instance — a SECOND `startFedosDesktopRuntime()` call,
   same three paths, new process-equivalent state.
7/8. Hydrate + query — `secondRuntime.host.board()!.findPost(post.id)`
   recovers the post via the pre-existing, unchanged
   `hydrateFedosBoardService()` path.
9. Recovery state — `FedosDeliveryRetryQuery.historyFor()`, read
   through the SECOND runtime's own `observationQuery()`, reports the
   FIRST runtime's own delivery outcome (`"accepted"`).
10. Duplicate delivery prevention — the SECOND runtime's own injected
    Publisher is NEVER called for the already-delivered intent.

## A real timing pitfall found and fixed during this Stage's own test-writing

The first version of this test used an instant-resolving Publisher and
failed step 9 (`"publishing"` instead of `"accepted"`) — the SAME
Alpha 513/529 millisecond tie-break already documented in the prior
Arc. Fixed with a 2ms artificial delay in the test's own Publisher
(matching real conditions more closely than an instant mock would),
not a production-code change.

## See also

- `docs/secure_runtime_alpha_589_real_restart_verification.md` (this Arc's own precedent, Alpha 581–600)
- `docs/secure_runtime_alpha_606_runtime_assembly.md`

# Secure Runtime Alpha 581 — Retry State Inventory

Stage 1 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc. Investigation only — no code changed this Stage.

## Every place retry-adjacent state currently exists, by real inspection

1. **`FedosPublishScheduler`'s own `#delivered`/`#abandoned`/
   `#completedAttempts`** (`src/board/outbox/fedos_publish_scheduler.ts`,
   Alpha 476/568) — three private, in-memory collections, keyed by
   `outboxId`. Constructed EMPTY every time; never read from anywhere
   durable at construction time.
2. **`FedosDeliveryRetryRegistry`'s own `#counts`**
   (`src/board/observation/fedos_delivery_retry_registry.ts`, Alpha
   527) — a private, in-memory `Map<subjectId, number>` allocating
   attempt numbers. UNLIKE the Scheduler's own state, this one is
   ALREADY Host-owned and constructed exactly once
   (`FedosDesktopHost`'s own `#deliveryRetryRegistry` field, Alpha
   531) — it survives a `startDelivery()`/`stopDelivery()` cycle
   within the SAME process, but not a genuine process restart (a new
   `FedosDesktopHost` instance has a new, empty one).
3. **The durable Observation history itself**
   (`FedosDeliveryObservationPersistence`/`FedosDeliveryObservationRepository`,
   Alpha 464/466) — Host-owned, constructed once, ALREADY durable
   WITHIN the process (an `InMemoryFedosDeliveryObservationPersistence`
   instance, shared, never reconstructed by `startDelivery()`). Every
   `"publishing"`/`"accepted"`/`"rejected"`/`"failed"` observation ever
   recorded is present here, in full, attempt-scoped
   (`FedosDeliveryRetryQuery.historyFor()`, Alpha 528, already exposes
   it) — but NOTHING currently reads it back to rebuild #1 or #2 above.
4. **`FedosBoardOutboxPersistence`** (`AppendOnlyFedosBoardOutboxPersistence`,
   Alpha 542, or `InMemoryFedosBoardOutboxPersistence`) — the raw
   intents themselves, append-only, no `"delivered"` flag of any kind.
   Already durable for what it stores; stores no delivery OUTCOME at
   all, by design (Alpha 415's own separation of Outbox state from
   Observation).

## The gap, confirmed by real execution this Stage

Item 3 already contains everything needed to rebuild items 1 and 2 —
confirmed directly: `FedosDeliveryRetryQuery.historyFor(subjectId)`
(unchanged) already returns, per attempt, `state`/`isFinal`/
`attemptNumber`. Nothing in this repository's own history has EVER
called it at Scheduler/Registry construction time. This is the
PRECISE, previously-undocumented root cause behind Alpha 573's own
finding (`docs/secure_runtime_alpha_573_restart_stable_abandonment.md`)
that a same-process `startDelivery()`/`stopDelivery()` cycle
re-attempts already-delivered intents — re-confirmed here as EXACTLY
"item 3 exists, nothing reads it back into item 1."

## See also

- `docs/secure_runtime_alpha_573_restart_stable_abandonment.md`
- `docs/secure_runtime_alpha_545_publish_runtime_recovery_audit.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`

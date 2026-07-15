# Secure Runtime Alpha 504 — Delivery Controller Design Decision

Stage 4 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

## 1. The shutdown-ordering problem, precisely

The required guarantee: **Scheduler停止 → tick終了待ち → Host停止**
("scheduler stop" → "wait for tick to finish" → "host stop"). But
`FedosPublishScheduler.start()` (Alpha 476, UNCHANGED, Scheduler変更
禁止) runs its OWN internal `setInterval`, whose callback is
`() => { void this.tick(); }` — a fire-and-forget call with NO
Promise returned to any caller. If this Arc used
`scheduler.start()`/`scheduler.stop()` directly, there would be no way
to `await` a currently-in-flight `tick()` during shutdown — `stop()`
could return while a `publish()` call is still running, violating the
required ordering outright, with no way to fix this from OUTSIDE
`FedosPublishScheduler` without editing it (forbidden).

## 2. Decision: a new class drives `tick()` directly; `FedosPublishScheduler.start()`/`stop()` are never called

`FedosHostDeliveryController` (`src/desktop/host/fedos_host_delivery_controller.ts`)
owns its OWN interval (injectable `setIntervalFn`/`clearIntervalFn`,
mirroring `FedosPublishScheduler`'s own Alpha 476 pattern for the SAME
testability reason), and calls the injected `FedosPublishScheduler`'s
own PUBLIC `tick()` method directly — the exact capability Alpha 476's
own header names as `tick()`'s reason for being public in the first
place ("so callers... can drive exactly one pass without depending on
a real timer"). This makes the in-flight tick's own `Promise` a value
THIS class holds (`#currentTick`), which `stop()` can `await` — solving
§1 without touching `FedosPublishScheduler` at all.

- **`start()`**: begins the interval; the FIRST `tick()` fires after
  one `intervalMs` elapses, never immediately — matching
  `FedosPublishScheduler.start()`'s own identical `setInterval`
  semantics.
- **Reentrancy guard**: if a `tick()` is still in flight when the next
  interval fires, the new firing is SKIPPED (not queued, not run
  concurrently) — a plain `if (this.#currentTick !== null) return;`,
  never a queue, buffer, or retry of any kind.
- **`stop()`**: clears the interval FIRST (no new tick can start),
  THEN `await`s `#currentTick` if one is in flight, THEN resolves —
  the exact three-step ordering required, now genuinely enforceable.

## 3. What the controller does with each `tick()` result

For every `FedosPublishSchedulerTickEntry` `tick()` returns, for every
`FedosBoardOutboxObservation` in that entry's own `observations` array
— data ALREADY produced by `FedosPublishScheduler`'s own internal,
UNCHANGED `#attemptIntent()`/`#observe()` logic, never fabricated by
this file — bridges it via `fedosBoardOutboxObservationToDeliveryObservation`
(Alpha 497, UNCHANGED) and writes it via the injected
`FedosValidatingDeliveryObservationRepository.record()` (Alpha 495,
UNCHANGED). `subjectId` is deterministically derived from the OUTBOX
INTENT's own `id` (`toFedosDeliveryObservationSubjectId(entry.intent.id)`)
— stable across every `tick()` call for the same intent, never
random, never caller-supplied per call.

This satisfies "SchedulerがPublishした結果のみObservation Repositoryへ
保存" literally: every byte written to the Observation Repository
traces back to a value `FedosPublishScheduler.tick()` itself returned;
this class never computes, guesses, or invents an observation of its
own. It satisfies "HostがPublishしない" because this class never
imports or calls anything Publisher-shaped — it reads `tick()`'s own
OUTPUT only.

## 4. What this Stage does NOT do

- Does not call `FedosPublishScheduler.start()`/`stop()` anywhere.
- Does not retry a failed `tick()` call, does not add backoff, does not
  queue skipped ticks.
- Does not persist anything beyond the Observation Repository — no
  Board, Outbox, or Publisher-side write of any kind.

## 5. See also

- `docs/secure_runtime_alpha_501_existing_host_and_delivery_boundary_inventory.md`
- `docs/secure_runtime_alpha_497_scheduler_contract_rewiring.md`
- `docs/secure_runtime_alpha_495_observation_write_validator.md`

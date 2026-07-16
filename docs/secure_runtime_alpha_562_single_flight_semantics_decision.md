# Secure Runtime Alpha 562 — Single-Flight Semantics Decision

Stage 2 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Options compared

- **Option A** (reject): a call made while one is in flight throws/
  rejects immediately. Rejected — turns a harmless, expected timing
  overlap (the interval firing again before a slow `Publisher` call
  resolves) into a caller-visible error for no benefit; the interval
  path (`start()`) uses `void this.tick()`, fire-and-forget, so a
  rejection there would be an unhandled rejection by construction.
- **Option B** (join — chosen): a call made while one is in flight
  returns the SAME in-flight `Promise`. No new queue, no new state
  beyond one field, smallest possible API-compatible change, and a
  caller `await`ing the returned `Promise` gets the CORRECT eventual
  result of "the pass that was already running," never a stale or
  fabricated one.
- **Option C** (queue): a call made while one is in flight schedules
  exactly one more pass after the current one finishes. Rejected —
  adds a new, unbounded-in-principle concept (a pending-tick flag) this
  Arc's own "smallest self-contained fix" framing does not need; the
  NEXT real interval firing (already unconditionally scheduled) already
  serves this purpose without inventing anything.
- **Option D** (per-intent lock): a `Map<outboxId, Promise>` guarding
  each intent individually, allowing different intents to publish
  concurrently within overlapping ticks. Rejected for THIS Arc —
  changes the Scheduler's own sequential-processing model (Alpha 476,
  `for (const intent of pending) { ... await ... }`, unchanged
  elsewhere in this repository) more than the defect requires; Alpha
  572 evaluates and explicitly declines broader intra-tick concurrency
  changes as out of scope.

## Decision

Option B, confirmed against the real source (Alpha 561's own inventory):
a single private field, `#tickInFlight: Promise<...> | null`, checked
at the top of `tick()` and cleared in a `.finally()` — see
`docs/secure_runtime_alpha_563_single_flight_implementation.md` for the
implementation and `test/secure_runtime_alpha_563_single_flight_implementation.test.ts`
§1 for the returned-Promise-identity proof.

## The five permanent conditions this Stage's own instruction named — verified held after implementation

1. Exactly one tick BODY runs at a time per Scheduler instance —
   verified by `test/secure_runtime_alpha_563_...test.ts` §3 (Publisher
   call count stays at 1 across two overlapping interval firings).
2. Interval and manual `tick()` share the SAME guard — the interval
   callback (`start()`) and the public `tick()` method are the SAME
   function; there is no separate code path to diverge.
3. Guard release is in `finally` — confirmed by direct inspection
   (`fedos_publish_scheduler.ts`, `tick()`) and Alpha 576's own
   structural guard test.
4. A caller-side throw/reject still allows the NEXT `tick()` — verified
   by `test/secure_runtime_alpha_563_...test.ts` §4 and Alpha 571's own
   exception verification.
5. No new tick starts during `stop()` — `stop()` still calls
   `#clearIntervalFn` before anything else, unchanged from Alpha 477;
   see `docs/secure_runtime_alpha_564_scheduler_stop_barrier.md` for the
   Controller-layer barrier this composes with.

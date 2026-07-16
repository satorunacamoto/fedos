# Secure Runtime Alpha 564 — Scheduler Stop Barrier

Stage 4 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## What changed, exactly

`src/desktop/host/fedos_host_delivery_controller.ts`:

- The interval callback (`start()`) and the public `tick()` method now
  both route through one new private `#ensureTick()`, instead of the
  interval callback inlining its own guard and `tick()` calling
  `#runTickAndPersist()` directly:

  ```ts
  #ensureTick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {
    if (this.#currentTick !== null) return this.#currentTick;
    const run = this.#runTickAndPersist();
    this.#currentTick = run;
    run.finally(() => {
      this.#currentTick = null;
    }).catch(() => undefined);
    return run;
  }
  ```

- `stop()` now awaits the in-flight tick's own SETTLEMENT, not its
  success: `await this.#currentTick.catch(() => undefined);` (was:
  `await this.#currentTick;`).

## Why the `stop()` change, specifically

Discovered by real execution this Stage
(`test/secure_runtime_alpha_564_...test.ts` §3): if the in-flight tick
rejects (e.g. `#observationRepository.record()` throws on a durable
write failure), the OLD `await this.#currentTick` propagated that
rejection into `stop()` itself, making `stop()` throw. `stop()`'s own
contract (Alpha 506) is shutdown ORDERING — "no new tick starts, THEN
wait for the current one to finish, THEN resolve" — not surfacing an
unrelated tick-side error to whatever caller happened to invoke
`stop()`. `.catch(() => undefined)` makes `stop()` wait for the SAME
settlement either way, without swallowing the error from the tick's own
`Promise` for anyone who awaits `tick()`/`#currentTick` directly.

## The three-part barrier this Stage's own instruction named — verified

1. New interval tick stopped — `#clearIntervalFn` still runs first,
   unchanged (Alpha 506).
2. New manual tick "rejected" (in the join sense, not throw) — a
   manual `tick()` call made while one is in flight now returns that
   SAME in-flight `Promise` via `#ensureTick()`, never starting a
   second `#runTickAndPersist()` pass. Verified:
   `test/secure_runtime_alpha_564_...test.ts` §1 (exactly one Publisher
   call, exactly one set of persisted Observations for one intent,
   across an interval-triggered tick plus an interleaved manual call).
3. In-flight tick awaited before `stop()` resolves — unchanged
   ordering, now failure-tolerant per above; re-confirmed by the
   pre-existing `test/secure_runtime_alpha_505_...test.ts`/
   `test/secure_runtime_alpha_506_...test.ts` suites, both still green.

"stop中にPublisher結果が返った場合もObservation処理を途中放棄しない" —
confirmed: `#runTickAndPersist()`'s own loop (Alpha 529, unchanged) is
not touched by this Stage; a Publisher result that resolves during
`stop()`'s own await still runs the SAME persistence path to
completion before `#currentTick` settles.

## See also

- `docs/secure_runtime_alpha_561_scheduler_concurrency_inventory.md`
- `docs/secure_runtime_alpha_562_single_flight_semantics_decision.md`
- `docs/secure_runtime_alpha_571_exception_and_recovery_verification.md`

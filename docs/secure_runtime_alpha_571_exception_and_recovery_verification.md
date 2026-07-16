# Secure Runtime Alpha 571 — Exception and Recovery Verification

Stage 11 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Cases verified, by real execution, in `test/secure_runtime_alpha_571_exception_and_recovery_verification.test.ts`

1. **Publisher throw:** `#attemptOnce()`'s own pre-existing `try`/
   `catch` (Alpha 476, unchanged) maps a throw to `FAILED_LATER_RESULT`
   — `tick()` itself never rejects; the single-flight guard's own
   `finally` releases normally regardless.
2. **Outbox `listIntents()` throw:** `tick()` DOES reject in this case
   (nothing catches a durable-read failure inside `#runTick()`) — but
   the guard still releases (`#tickInFlight` returns to `null`), and a
   later `tick()` call, once the fault clears, succeeds normally. No
   permanent wedge.
3. **Observation Repository write throw (Controller layer):**
   `controller.tick()` rejects (nothing inside `#runTickAndPersist()`
   catches a `record()` throw, unchanged from before this Arc) — the
   SAME "guard releases regardless" property holds at this layer too,
   confirmed by a subsequent successful `tick()` call once the fault is
   cleared.
4. **`stop()` called while an in-flight tick is about to reject:**
   `stop()` still resolves (does not throw, does not hang) — the Alpha
   564 fix (`await this.#currentTick.catch(() => undefined)`) this
   Stage independently re-confirms end-to-end, through a real
   `start()`/interval/`stop()` cycle rather than a direct field
   inspection.

## What is deliberately NOT changed

None of the above adds new `try`/`catch` blocks to `#runTick()` or
`#runTickAndPersist()` beyond what Alpha 564's own `stop()` fix already
required — a durable-storage failure (Outbox read, Observation write)
is a genuine, real error this Arc's own instruction does not ask it to
paper over; the guarantee this Stage verifies is narrower and more
useful: such a failure never leaves the Scheduler or Controller
PERMANENTLY unable to tick again, not that such a failure is silently
absorbed.

## See also

- `docs/secure_runtime_alpha_563_single_flight_implementation.md`
- `docs/secure_runtime_alpha_564_scheduler_stop_barrier.md`

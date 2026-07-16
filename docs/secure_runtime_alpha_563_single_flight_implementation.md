# Secure Runtime Alpha 563 — Single-Flight Implementation

Stage 3 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## What changed, exactly

`src/board/outbox/fedos_publish_scheduler.ts`:

- `tick()`'s own body (the loop over `pending` intents) is renamed to a
  new private `#runTick()`, byte-for-byte unchanged otherwise.
- `tick()` itself becomes a thin, synchronous (non-`async`) wrapper:

  ```ts
  tick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {
    if (this.#tickInFlight !== null) return this.#tickInFlight;
    const run = this.#runTick();
    this.#tickInFlight = run;
    run.finally(() => {
      this.#tickInFlight = null;
    }).catch(() => undefined);
    return run;
  }
  ```

- One new private field: `#tickInFlight: Promise<readonly FedosPublishSchedulerTickEntry[]> | null = null`.
- The `.finally(...).catch(() => undefined)` tail (not a bare
  `void run.finally(...)`) exists because `.finally()` returns a NEW,
  separate `Promise` that also rejects if `run` does — Node reports
  THAT derived `Promise` as an unhandled rejection independently of
  whatever handler `run` itself (returned to the caller) may or may not
  receive. Discovered by real execution during this Stage (an
  `Unhandled Rejection` report from `vitest` against
  `test/secure_runtime_alpha_564_...test.ts` §3), not assumed.

`tick()`'s own return type is UNCHANGED
(`Promise<readonly FedosPublishSchedulerTickEntry[]>`); `async` is
removed from its signature only because it no longer needs its own
`await` — it now returns an already-in-flight or freshly-started
`Promise` directly. `start()`/`stop()` are untouched.

## Verification

`test/secure_runtime_alpha_563_single_flight_implementation.test.ts` —
4 cases: identical-Promise-return, guard-releases-after-settling,
interval-overlap-produces-one-Publisher-call, throw-does-not-wedge.
`test/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.test.ts`
§1 (updated this Arc, see
`docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`)
independently re-confirms the fix at the original reproduction site.

## RIPPLE

Five prior-Arc regression-guard tests asserted this file's own EXACT
text (`async tick(): Promise<...> {`) as proof of "untouched by [that
Arc]" — Alpha 512, 519, 531 (text/`git status` checks) and Alpha 479/
486 (import-naming checks, tripped by the new sibling file this Arc
adds, Alpha 566/568, not by this Stage's own change) all needed a
scoped, documented update. See
`docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`
for the full account.

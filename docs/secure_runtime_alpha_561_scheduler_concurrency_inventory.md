# Secure Runtime Alpha 561 — Scheduler Concurrency Inventory

Stage 1 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc. Investigation only — no code changed this
Stage.

## The defect, restated precisely from source, re-confirmed by direct inspection

`FedosPublishScheduler.start()` (`src/board/outbox/fedos_publish_scheduler.ts`,
pre-Arc) registers `() => { void this.tick(); }` on `setInterval`, with
**no reentrancy guard of any kind** — `tick()` is `async`, awaits
`this.#publisher.publish(...)` per pending intent, and nothing checks
whether a PRIOR `tick()` call's own `Promise` has settled before a new
interval firing starts another one. `#delivered`/`#abandoned` are only
updated AFTER an attempt's own `await` resolves, so two overlapping
`tick()` calls both list the SAME intent as pending and both call
`Publisher.publish()` on it — proven by real execution already, not
hypothetically, in `docs/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.md`
and its own test (`test/secure_runtime_alpha_549_...test.ts` §1, prior
to this Arc's own fix).

## The eight questions this Stage's own instruction named, answered

1. **All paths that can run `tick()` concurrently:** (a) two interval
   firings overlapping when `Publisher.publish()` outlives one
   `intervalMs`; (b) a direct manual `tick()` call made while an
   interval-triggered pass is in flight; (c) two direct manual `tick()`
   calls made without an intervening `await`.
2. **Interval tick vs. manual tick conflict:** confirmed real — before
   this Arc, `tick()` had no guard against ANY of the three paths
   above; `FedosHostDeliveryController`'s own interval callback (Alpha
   505) already guarded ITS OWN re-entry via `#currentTick`, but its
   public `tick()` method (for manual/test driving) called
   `#runTickAndPersist()` directly, bypassing that guard entirely.
3. **Can `tick()` start during `stop()`:** `FedosPublishScheduler.stop()`
   only clears the interval — it does not, and structurally cannot
   (synchronous, `void`-returning), await an in-flight `tick()`. Real
   production shutdown ordering is enforced one layer up, by
   `FedosHostDeliveryController.stop()` (Alpha 506, async, already
   awaits `#currentTick`) — but that guarantee, pre-Arc, was only as
   strong as the (buggy) reentrancy guard underneath it.
4. **Is an in-flight Promise held anywhere:** yes, at the Controller
   layer only (`#currentTick`), not at the Scheduler layer.
5. **Same-intent-selection timing:** `#runTick()`'s `pending` list is
   computed ONCE per call, via a synchronous filter against
   `#delivered`/`#abandoned` — the exact structural cause of the race
   (see above).
6. **Is there a claim before `publish()`:** no — no per-intent lock or
   claim mechanism exists anywhere in the pre-Arc Scheduler.
7. **Fixable without breaking the current public API:** yes — see
   `docs/secure_runtime_alpha_562_single_flight_semantics_decision.md`;
   `tick()`'s own return type (`Promise<readonly FedosPublishSchedulerTickEntry[]>`)
   is unchanged, only its internal single-flight behavior is added.
8. **Expected RIPPLE:** `FedosHostDeliveryController`'s own manual
   `tick()` (Alpha 564); five PRIOR arcs' own "Scheduler/Controller
   untouched" structural regression-guard tests, all still checking
   this file's exact text (Alpha 512, 519, 531, plus import-naming
   guards Alpha 479/486) — see
   `docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`.

## See also

- `docs/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.md`
- `docs/secure_runtime_alpha_550_publish_runtime_observation_consistency_audit.md`
- `docs/secure_runtime_alpha_551_publish_runtime_retry_semantics_audit.md`
- `docs/secure_runtime_alpha_559_publish_runtime_recommendations.md`

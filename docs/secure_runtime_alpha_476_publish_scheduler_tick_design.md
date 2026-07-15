# Secure Runtime Alpha 476 — Publish Scheduler Tick Design

Stage 6 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. Algorithm

`FedosPublishScheduler.tick()` (`src/board/outbox/fedos_publish_scheduler.ts`):

1. Read every intent from `outboxPersistence.listIntents()`, then filter
   out any whose id is already in the Scheduler's own in-memory
   `delivered` or `abandoned` sets.
2. For each remaining intent, in order, `await` one attempt (never
   parallel — see §2 for why).
3. Each attempt: record an `"attempt-started"` Observation, call
   `publisher.publish(intent)`, then record `"delivered"`/`"rejected"`/
   `"failed"` per the (validated — Alpha 473 §4) result.
4. If the result's `outcome !== "delivered"` and `retryPolicy ===
   "immediate"`, perform exactly one more attempt for the SAME intent,
   in the SAME `tick()` call; if that second attempt also comes back
   non-delivered with `retryPolicy === "immediate"`, it is downgraded to
   `"later"` before being acted on (Alpha 474 §2's own termination
   guardrail).
5. Apply terminal bookkeeping on the FINAL result: `"delivered"` → add
   to `delivered`; non-delivered with `retryPolicy === "never"` → add to
   `abandoned` and record an `"abandoned"` Observation; non-delivered
   with `retryPolicy === "later"` → no bookkeeping change, the intent
   simply remains eligible for the next `tick()` call.
6. Return one `FedosPublishSchedulerTickEntry` per attempted intent —
   `{ intent, result, observations }` — and append every Observation
   produced to the Scheduler's own `observationLog()`.

## 2. Why sequential, not parallel, per `tick()`

Attempts within one `tick()` call are awaited one at a time, not issued
concurrently via `Promise.all`. This Arc's own scope is a FOUNDATION —
concurrency control (how many simultaneous `publish()` calls a given
Publisher/Relay can safely absorb) is exactly the kind of protocol-aware
policy question Alpha 472 already assigned to a future, Publisher-aware
Arc, not this one. Sequential execution is the simplest correct
behavior and introduces no ordering or fairness question this Stage
would otherwise have to answer.

## 3. Why `tick()` never throws for a Publisher-side problem

A rejected `publish()` Promise, a thrown synchronous error, or a
structurally invalid return value are all normalized to `{ outcome:
"failed", retryPolicy: "later" }` before any bookkeeping happens (Alpha
473 §4). `tick()` itself has no `try`/`catch` around its OWN loop for
this reason — by the time control reaches the terminal-bookkeeping step,
every possible Publisher misbehavior has already been reduced to a
valid `FedosBoardOutboxPublishResult`.

## 4. Bounded cost

Every `tick()` call performs AT MOST two `Publisher.publish()` calls per
currently-pending intent (one attempt, plus at most one `"immediate"`
re-attempt) — never unbounded, never recursive. This bound is enforced
structurally (§1 step 4 is not a loop), not merely by convention.

## 5. See also

- `docs/secure_runtime_alpha_474_retry_policy_model.md`
- `docs/secure_runtime_alpha_475_outbox_observation_realization.md`
- `docs/secure_runtime_alpha_477_scheduler_lifecycle_model.md`

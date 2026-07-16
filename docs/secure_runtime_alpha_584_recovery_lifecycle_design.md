# Secure Runtime Alpha 584 — Recovery Lifecycle Design

Stage 4 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## When hydration runs

On EVERY `FedosDesktopHost.startDelivery()` call — not only `Host.start()`
— because `startDelivery()` (Alpha 508, unchanged) constructs a BRAND
NEW `FedosPublishScheduler` every time it runs, whether that call is
the first ever, a same-process `stopDelivery()`/`startDelivery()`
cycle, or the first call on a freshly-constructed `FedosDesktopHost`
after a genuine process restart — all three cases need the identical
fix, and `startDelivery()` is the ONE call site common to all three.
Mirrors `hydrateFedosBoardService()`'s own call site (inside `Host.start()`,
Alpha 318) in spirit: hydration runs exactly where fresh in-memory
state is about to be constructed, never earlier, never speculatively.

## What gets applied, and in what order

1. `hydrateFedosDeliveryRecoveryState()` reads the durable Observation
   history (read-only).
2. `FedosDeliveryRetryRegistry.hydrateAttemptCount()` is called for
   every subject with recorded history — additive-only, so calling it
   again on an ALREADY-hydrated (same-process-cycle) registry is a safe
   no-op for subjects it already knows about.
3. A fresh `FedosPublishScheduler` is constructed with `initialDelivered`/
   `initialAbandoned`/`initialCompletedAttempts` from step 1.

Steps are ORDERED (registry seed before Scheduler construction) so
that the very FIRST real `tick()` this new Scheduler ever runs already
allocates correctly-numbered, never-reused attempt-scoped subject ids
for any intent it retries — closing the exact "invalid-transition on
retry" class of bug Alpha 514/525 already fixed for the same-process
case, now extended to a genuine restart.

## Fail Closed, per intent (not whole-hydration)

Unlike `hydrateFedosBoardService()` (Alpha 318), which voids the ENTIRE
hydration on any single corrupt record — necessary there because Board
posts have cross-record THREAD dependencies a corrupt record can break
for others — delivery/retry state has NO cross-intent dependency
(Alpha 536 already established "no cross-contamination" between
concurrent intents as a hard invariant). A read failure for ONE
intent's own history is therefore isolated to that intent: it is
treated as "no history exists," the SAME conservative default a
never-attempted intent already gets. This is deliberately the SAFE
direction — an intent wrongly left "pending" costs one redundant retry;
an intent wrongly marked "delivered" would be silent, permanent data
loss. See `fedos_delivery_recovery_hydration.ts`'s own header for the
precise statement.

## What this Stage does NOT change

`FedosPublishScheduler.start()`/`stop()`/`tick()`'s own public
contracts (Alpha 476/563/564, unchanged); `FedosHostDeliveryController`'s
own public contract (Alpha 505/506/563/564, unchanged);
`FedosDesktopHost.startDelivery()`/`stopDelivery()`/`deliveryStatus()`'s
own public signatures (unchanged — only `startDelivery()`'s own
INTERNAL construction call site changes, Alpha 586).

## See also

- `docs/secure_runtime_alpha_582_canonical_ownership_decision.md`
- `docs/secure_runtime_alpha_586_hydrate_retry_registry_during_host_startup.md`

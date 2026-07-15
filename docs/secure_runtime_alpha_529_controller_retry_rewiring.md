# Secure Runtime Alpha 529 — Controller Retry Rewiring

Stage 9 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage IMPLEMENTS.** Edits exactly one existing file —
`src/desktop/host/fedos_host_delivery_controller.ts` — REWIRING its
own private `#runTickAndPersist()` helper only.

## What changed

The naive "map each observation 1:1 under one flat subject id" loop
(Alpha 505) is replaced by `groupFedosBoardOutboxObservationsIntoAttempts()`
(a new, private, pure module function) plus attempt-scoped writes:

1. Group `entry.observations` (Alpha 476, unchanged) into
   `{ started, terminal, isFinal }` triples.
2. Allocate the next attempt number for the intent's own
   `FedosDeliveryObservationSubjectId` via the newly-owned
   `FedosDeliveryRetryRegistry` (Alpha 527).
3. Derive the attempt-scoped subject id (Alpha 525) and record BOTH
   the bridged `publishing` observation and the bridged terminal
   observation under it — the terminal one carrying an
   `encodeFedosDeliveryRetryReason()`-produced `reason` (Alpha 526).

## What is UNCHANGED in this same file

`start()`, `stop()`, `tick()`, `isRunning()`, the reentrancy guard, the
shutdown-ordering guarantee (Alpha 505/506), and
`FedosHostDeliveryControllerDependencies` itself — all byte-for-byte
identical. Only `#runTickAndPersist()`'s own body, plus one new private
field (`#retryRegistry`) and one new private module function, change.

## Honest edge case found during verification, not hidden

When a Publisher resolves synchronously/instantly (a `Mock`, or a very
fast local transport), the `publishing` and terminal observations for
ONE attempt can share the EXACT same millisecond `observedAt` (the real
clock's own resolution). `FedosDeliveryObservationQuery.historyFor()`'s
own tie-break rule (Alpha 467, unchanged: sort by `observedAt` ASC,
`id` ASC on a tie) can then sort `accepted`/`rejected`/`failed` BEFORE
`publishing` alphabetically, making `currentStateFor()` momentarily
report the non-terminal `publishing` state instead of the real
terminal outcome. This is a PRE-EXISTING property of Alpha 467's own
tie-break rule, not something this Stage introduces or may fix (Alpha
467 is unchanged) — real network I/O between an attempt's own start and
its own resolution naturally separates the two timestamps in practice;
this Stage's own test suite (Alpha 529/533–535) injects a deterministic
clock into `FedosPublishScheduler` specifically to make verification
reproducible despite this, matching the SAME technique Alpha 505/510's
own test suites already established for the identical reason.

## What this Stage does NOT do

Does not call `FedosPublishScheduler.start()`/`stop()` (still never,
Alpha 506's own guarantee untouched). Does not add a retry ALGORITHM —
`groupFedosBoardOutboxObservationsIntoAttempts()` only READS a shape
`FedosPublishScheduler` already unconditionally produces; it decides
nothing about whether/when to retry.

## See also

- `docs/secure_runtime_alpha_525_attempt_subject_id_implementation.md`
- `docs/secure_runtime_alpha_527_retry_registry_implementation.md`
- `docs/secure_runtime_alpha_505_delivery_controller_tick_loop.md`

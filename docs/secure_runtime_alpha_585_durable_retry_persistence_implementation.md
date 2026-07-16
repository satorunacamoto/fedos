# Secure Runtime Alpha 585 — Durable Retry Persistence Implementation

Stage 5 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## What was implemented, exactly

**New file:** `src/desktop/host/fedos_delivery_recovery_hydration.ts`.
Two exports:

- `hydrateFedosDeliveryRecoveryState(outboxPersistence, retryQuery)` —
  pure, read-only, never throws (Alpha 583's own derivation rule,
  implemented exactly).
- `createFedosDeliveryScheduler(dependencies)` — hydrates, seeds the
  given `FedosDeliveryRetryRegistry` (side effect, additive-only), and
  returns a fully-seeded `FedosPublishScheduler`. The ONE function
  `FedosDesktopHost.startDelivery()` calls (Alpha 586) — see "Boundary
  preserved" below for why this exists as a SEPARATE function rather
  than inlining the hydration call at the Host call site.

**Modified:** `src/board/outbox/fedos_publish_scheduler.ts` — THREE new
OPTIONAL constructor dependencies (`initialDelivered`/`initialAbandoned`/
`initialCompletedAttempts`), each defensively copied into a fresh
`Set`/`Map` (never the caller's own reference); `#delivered`/
`#abandoned`/`#completedAttempts` are now assigned in the constructor
instead of at field-declaration time, seeded from these when present,
empty otherwise — reproducing the exact prior behavior byte-for-byte
when all three are omitted.

**Modified:** `src/board/observation/fedos_delivery_retry_registry.ts`
— ONE new method, `hydrateAttemptCount(subjectId, count)`, additive-
only (never lowers a count), rejecting non-positive-integer input
(fail closed against a malformed seed).

## Boundary preserved: `FedosDesktopHost` never names `FedosDeliveryRetryQuery`/attempt-subject-id concepts

Discovered by real execution this Stage, not by re-reading the design
first: an early draft called `hydrateFedosDeliveryRecoveryState()`
directly from `FedosDesktopHost.startDelivery()`, tripping
`test/secure_runtime_alpha_522_retry_coordination_scope_decision.test.ts`
line 26 (`expect(hostSource).not.toMatch(/RetryQuery|AttemptSubjectId/)`)
— Alpha 522's own established decision that `FedosDesktopHost` stays
ignorant of attempt-level query internals, that boundary belonging to
`FedosHostDeliveryController` (and now this file, its own sibling)
alone. `createFedosDeliveryScheduler()` exists specifically so the
Host's own call site never imports or names `FedosDeliveryRetryQuery` —
confirmed structurally (Alpha 590's own regex check over
`fedos_desktop_host.ts`'s own code, not just this file's).

## No new npm dependency, no new schema, no Cargo.toml/package.json change

Confirmed: `git diff -- package.json Cargo.toml` (via
`packages/fedos-core-rust/Cargo.toml`) is empty at commit time (see
`docs/secure_runtime_alpha_591_599_regression_review.md`).

## See also

- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
- `docs/secure_runtime_alpha_583_durable_retry_record_schema.md`
- `docs/secure_runtime_alpha_586_hydrate_retry_registry_during_host_startup.md`

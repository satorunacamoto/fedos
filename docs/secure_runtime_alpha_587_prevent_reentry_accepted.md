# Secure Runtime Alpha 587 — Prevent Already-Accepted Intents From Re-Entering Scheduler

Stage 7 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## Mechanism

`FedosPublishScheduler`'s own `#runTick()` pending filter (Alpha 476,
UNCHANGED): `!this.#delivered.has(record.id) && !this.#abandoned.has(record.id)`.
This Arc changes nothing about the FILTER itself — it changes what
`#delivered` is populated with at CONSTRUCTION time (`initialDelivered`,
Alpha 585). An intent whose hydrated recovery state places it in
`delivered` is therefore excluded from `pending` on the very FIRST
`tick()` this Scheduler instance ever runs, by the exact same mechanism
that already excludes an intent delivered LATER, mid-lifetime, within
one Scheduler instance.

## Verified, at the raw Scheduler level, independent of the Host pipeline

`test/secure_runtime_alpha_587_prevent_reentry_accepted.test.ts` — 4
cases: a seeded-delivered intent is never published on the first tick;
a mix of seeded-delivered and genuinely-pending intents excludes only
the former; `initialDelivered` is defensively copied (a caller
mutating their own `Set` after construction has no effect); omitting
`initialDelivered` entirely reproduces the exact prior, unseeded
behavior.

## Relationship to Alpha 589

This Stage proves the MECHANISM in isolation (`initialDelivered` ->
never re-published). Alpha 589 proves the FULL, real end-to-end path
(durable Observation history -> hydration -> `initialDelivered` -> a
genuinely NEW `FedosDesktopHost` instance) produces the same outcome —
two different layers of the same guarantee, deliberately not merged
into one test, mirroring how Alpha 563 (raw single-flight) and Alpha
570 (Host-level double-publish closure) were kept separate in the
prior Arc for the identical reason: a unit-level proof and an
integration-level proof catch different classes of wiring mistake.

## See also

- `docs/secure_runtime_alpha_585_durable_retry_persistence_implementation.md`
- `docs/secure_runtime_alpha_588_prevent_abandoned_intents_from_restarting.md`
- `docs/secure_runtime_alpha_589_real_restart_verification.md`

# Secure Runtime Alpha 588 — Prevent Abandoned Intents From Restarting

Stage 8 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## Mechanism

`initialAbandoned`'s own counterpart to Alpha 587's `initialDelivered`:
the SAME pending filter (`!#delivered.has(id) && !#abandoned.has(id)`)
excludes a hydration-seeded-abandoned intent identically to one the
Publisher or an abandonment policy declared abandoned mid-lifetime.
`initialCompletedAttempts` additionally seeds `#completedAttempts`
(Alpha 568, unchanged) for an intent that is neither delivered nor
abandoned — a genuinely still-pending, mid-retry intent — so an
injected `abandonmentPolicy`'s own bound (Alpha 566) is evaluated
against the TRUE cumulative attempt count across a restart, not reset
to zero.

## Verified

`test/secure_runtime_alpha_588_prevent_reentry_abandoned.test.ts` — 3
cases: a seeded-abandoned intent is never published, even against a
Publisher that would otherwise retry forever; `initialCompletedAttempts`
seeded near an injected policy's own bound causes abandonment after
exactly ONE more attempt (proving the count is genuinely additive
across the seed, not reset); `initialDelivered` and `initialAbandoned`
together each govern their own disjoint intent correctly in the same
tick.

## Why abandonment-via-hydration reuses the identical vocabulary Alpha 567 already chose

No new state, no new Observation kind — a hydrated-abandoned intent is
indistinguishable, by construction, from one abandoned live within a
single Scheduler instance's own lifetime, because `initialAbandoned` is
populated using the EXACT SAME "latest attempt is terminal and not
`accepted`" rule (Alpha 583) that already governs the live path. There
is no separate "restart abandonment" code path to keep in sync with
the live one.

## See also

- `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`
- `docs/secure_runtime_alpha_567_abandoned_state_decision.md`
- `docs/secure_runtime_alpha_587_prevent_reentry_accepted.md`

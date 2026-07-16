# Secure Runtime Alpha 586 — Hydrate Retry Registry During Host Startup

Stage 6 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## What changed, exactly

`src/desktop/host/fedos_desktop_host.ts`'s own `startDelivery()`:
replaces the direct `new FedosPublishScheduler({...})` construction
with `createFedosDeliveryScheduler({...})` (Alpha 585), passing the
Host-owned `#outboxPersistence`/`#publisher`/`#deliveryIntervalMs`/
`#observationRepository`/`#deliveryRetryRegistry`. `git diff --numstat`
for this file at commit time: 26 insertions, 2 deletions (one import
line, one construction-call line — a like-for-like construction-site
swap, not a behavior removal; see
`docs/secure_runtime_alpha_591_599_regression_review.md` for why two
prior-Arc "purely additive" guard tests needed a scoped update).

## Why every `startDelivery()` call, not only the first

`startDelivery()` (Alpha 508, unchanged) has ALWAYS constructed a
fresh `FedosPublishScheduler` on every call — this Arc does not change
that. What changes is that the fresh Scheduler is no longer BLANK: it
is seeded from whatever the durable Observation history already
records, every single time. A caller that never stops delivery pays
this cost exactly once (Alpha 585's own hydration is O(n) over pending
intents — see Alpha 590's own protocol-neutral verification for
correctness, not a performance claim this Stage makes).

## Verified, end to end, by real execution

`test/secure_runtime_alpha_574_host_lifecycle_verification.test.ts`'s
own cycling test (updated this Arc): three `startDelivery()`/
`stopDelivery()` cycles on the SAME `FedosDesktopHost`, one new intent
added per cycle — BEFORE this Stage, `publisher.calls === 6` (`1+2+3`,
every cycle re-attempting every prior cycle's own already-delivered
intent); AFTER, `publisher.calls === 3` (one per cycle, its own new
intent only). This is the single clearest, most concrete before/after
proof this Arc's own fix produces.

## A real, subtle timing interaction found and resolved during this Stage's own verification

The FIRST attempt at re-verifying the above produced `6`, not `3`,
even with the fix correctly wired. Root cause, found by direct
instrumentation, not guessed: the test's own Publisher resolved
synchronously (0ms), so the Controller's own `"attempt-started"`/
terminal writes for the SAME attempt (Alpha 529) landed in the SAME
`Date.now()` millisecond; `FedosDeliveryObservationQuery`'s own
DOCUMENTED id-based tie-break (Alpha 513's own comment: "Real wall
clock can tie this single attempt's own publishing/terminal writes to
the same millisecond") then reported `"publishing"`, not `"accepted"`,
as the LATEST state — causing hydration to (safely, per its own Fail
Closed rule, Alpha 584) treat the intent as still-pending and retry it.
This is a PRE-EXISTING, already-documented repository characteristic
(Alpha 513/529), not a defect this Arc introduces or is in scope to
fix (the canonical Observation model's own tie-break sort is a
protected area). The test itself was corrected — a 2ms artificial
delay in its own mock Publisher, matching how a real Publisher never
resolves in literally 0ms — not the production code.

## See also

- `docs/secure_runtime_alpha_584_recovery_lifecycle_design.md`
- `docs/secure_runtime_alpha_573_restart_stable_abandonment.md`
- `docs/secure_runtime_alpha_591_599_regression_review.md`

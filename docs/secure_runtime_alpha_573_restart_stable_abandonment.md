# Secure Runtime Alpha 573 — Restart-Stable Abandonment

Stage 13 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc. Review only — no code changed this Stage.
Honest limitation record, per this Arc's own instruction not to declare
completion prematurely.

## The simulated-restart test, and what it found

`test/secure_runtime_alpha_574_host_lifecycle_verification.test.ts`
§2 constructs one real `FedosDesktopHost`, then cycles
`startDelivery()`/`stopDelivery()` three times, adding one new Outbox
intent per cycle. Confirmed, by real execution and an exact call count
(6, not 3 — `1 + 2 + 3`): `startDelivery()` (Alpha 505, unchanged)
constructs a BRAND NEW `FedosPublishScheduler` on every call; its own
`#delivered`/`#abandoned`/`#completedAttempts` are ALL private INSTANCE
state (this Arc's own new `#completedAttempts` inherits the identical
characteristic its two pre-existing siblings already had). Combined
with `InMemoryFedosBoardOutboxPersistence`'s own append-only design (no
`removeIntent`/`deleteIntent` method exists anywhere in this
repository), a fresh Scheduler instance has NO way to know a given
Outbox intent was already delivered by a PRIOR Scheduler instance — it
re-attempts every intent still physically present in the Outbox.

## This is broader than this Arc's own original scope, found honestly, not hidden

This Arc set out to evaluate whether RETRY/ABANDONMENT state survives a
restart. The real finding is stronger: `"delivered"` state itself does
not survive a `startDelivery()`/`stopDelivery()` cycle either, on the
SAME real `FedosDesktopHost` instance — not merely across a full
process restart. This is PRE-EXISTING behavior, present since Alpha 476
(`FedosPublishScheduler`'s own `#delivered` Set) and Alpha 505
(`startDelivery()`'s own fresh-Scheduler-per-call construction) — this
Arc introduces it nowhere and, per its own explicit Absolute
Prohibitions (`FedosPublishScheduler`/`FedosHostDeliveryController`
production-file scope only, no Board Runtime API work), does not fix
it.

## Consequence for this Arc's own new work specifically

The `#completedAttempts` Map (Alpha 568) and any injected
`abandonmentPolicy`'s own decision are BOTH subject to the identical
loss — an intent one Scheduler instance abandoned after N attempts
will, after any restart of delivery (Host-level cycle OR full process
restart), be re-attempted from `completedAttempts: 0` by the next
Scheduler instance, exactly like the pre-existing `#delivered`/
`#abandoned` Sets already were. This Arc does not claim otherwise.

## Named, not built, per this Arc's own explicit Absolute Prohibitions

A durable fix requires the Outbox itself (or a co-located store) to
persist "delivered"/"abandoned"/attempt-count PER intent, survivable
across Scheduler instances — this is squarely the **Durable Retry
Registry Persistence Arc**, already named as Candidate A in
`docs/secure_runtime_alpha_580_publish_scheduler_completion.md`'s own
next-Arc recommendation, now with concrete, freshly-confirmed evidence
(this Stage's own test) of exactly how much state is lost and under
what real, reproducible condition.

## See also

- `docs/secure_runtime_alpha_574_host_lifecycle_verification.md`
- `docs/secure_runtime_alpha_580_publish_scheduler_completion.md`

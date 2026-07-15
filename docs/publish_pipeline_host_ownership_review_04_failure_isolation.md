# 04 — Failure Isolation

## Question

Which failures should transition the WHOLE Host to `"failed"` (per
`FedosDesktopHostState`, Alpha 333 — a state, once entered, that is
permanent for that instance: "a `\"failed\"` instance stays `\"failed\"`
forever"), and which should degrade only the delivery subsystem while
Board read/write and the rest of the Host stay usable?

## Classification

| Failure | Scope | Why |
|---|---|---|
| Publisher failure (a `publish()` call rejects/throws/returns `"failed"`) | **Delivery-subsystem only** | Already the Scheduler's own designed-for case — `#attemptOnce` already catches a throw and normalizes it to `{ outcome: "failed", retryPolicy: "later" }` (`fedos_publish_scheduler.ts:204-210`). This is ROUTINE, expected behavior (a Relay being briefly unreachable is not exceptional), not a Host-fatal condition. Board read/write must remain fully usable while a Publisher is failing. |
| Observation persistence failure (`putObservation` returns `"failed"`) | **Delivery-subsystem only** | An Observation is a record OF a delivery attempt, not a precondition for one — Alpha 466's own `record()` already returns a typed outcome (`"failed"` among them) rather than throwing. A durability failure here means "this one historical fact did not get written," not "the Board is compromised." Should surface as a degraded-delivery signal (see Alpha 05's status API), never propagate to Host `state()`. |
| Scheduler `tick()` throwing an UNHANDLED exception (not a Publisher-side problem the Scheduler already normalizes, but a genuine bug inside the Scheduler itself, or a `#observe()`-level thrown `Error` — `fedos_publish_scheduler.ts:226-228` shows `#observe()` DOES throw if `createFedosBoardOutboxObservation` itself returns `null`, e.g. from a malformed outbox id) | **Delivery-subsystem only, but must not be silently swallowed** | `tick()` itself is not currently wrapped by anything except the Scheduler's own internal per-attempt try/catch around the Publisher call specifically — an unhandled throw from `#observe()` would propagate OUT of `tick()` uncaught. Host must catch this at the boundary where it drives `tick()` and treat it as a delivery-subsystem fault (log/surface via status, mark that one tick as failed) rather than let it become an unhandled rejection that could crash a long-lived process. It must NOT cascade into Host `state() = "failed"` — a single malformed record must not take down Board access. |
| Relay disconnect (inside the Nostr-specific Publisher, or any future protocol Publisher) | **Delivery-subsystem only** | Identical reasoning to "Publisher failure" above — `FedosRelayNostrBoardPublisher.publishOne()` already converts a Relay disconnect into `return false` (never a throw that escapes it). This is the LOWEST-severity, most expected failure in the entire chain and must never be Host-fatal. |
| Malformed Outbox record (a stored record that fails `deserializeFedosBoardOutboxIntent`, or a `listIntents()` call itself throwing on a corrupt durable log — `AppendOnlyFedosBoardOutboxPersistence`'s own header states a schema-conflicting line THROWS on replay, never silently repaired) | **Host-fatal, if it occurs during Host's OWN startup hydration** (mirrors the existing Board hydration precedent exactly — `hydrateFedosBoardService` failing today already fails `Host.start()` as a whole, by design). **Delivery-subsystem only, if it occurs during a later Scheduler `tick()`'s own `listIntents()` call** while Host is already `"ready"` — a single corrupt record surfacing after startup must degrade delivery, not retroactively invalidate an already-`"ready"` Host that Board reads/writes still depend on. |
| Corrupt Observation log (a durable Observation backend that throws or returns unreadable data on `listObservations()`) | **Delivery-subsystem only** | Mirrors the malformed-Outbox-at-runtime case. `FedosDeliveryObservationRepository.list()` (Alpha 466) already fails closed per-record ("skips, never throws on, any corrupt stored record") — a whole-backend failure (the underlying store itself throwing) should surface the SAME way: delivery/observation status degrades, Board and Outbox-write continue to function. |

## The one general rule

**A failure is Host-fatal ONLY if it occurs during `Host.start()`'s own
existing hydration boundary (Board hydration, `DesktopApplication.start()`)
— unchanged from today.** Every failure that originates from the
delivery subsystem (Publisher, Scheduler, Observation, whether at
startup-time construction or at any later `tick()`) degrades a
delivery-specific status signal instead, and never writes
`"failed"` to `FedosDesktopHostState`. This preserves the EXISTING
guarantee `FedosDesktopHostState`'s own Alpha 333 design already
protects — Board read/write availability — while giving the delivery
subsystem its own, narrower failure surface. See Alpha 05 for the
concrete API shape this narrower surface takes.

## See also

- `docs/publish_pipeline_host_ownership_review_02_startup_ordering.md`
- `docs/publish_pipeline_host_ownership_review_05_ownership_api.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`

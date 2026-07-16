# Secure Runtime Alpha 734 — Host and Runtime Compatibility

Stage 14. Verified in
`test/secure_runtime_alpha_733_scheduler_and_runtime_compatibility.test.ts`
tests 1/2/3 (real `startFedosDesktopRuntime()`, not a mock):

- Existing Local Runtime dependency injection still works unchanged —
  `FedosOutcomeAwareNostrBoardPublisherAdapter` is passed through the
  SAME, pre-existing `publisher` config field (Alpha 610), no new config
  field was needed.
- ACK timeout can be injected honestly — an explicit `2_000`ms timeout is
  passed directly to `FedosRelayOkCorrelatedNostrBoardPublisher`'s own
  constructor at Runtime-assembly time, confirmed end to end through a
  real `createPublicThread()` → durable Outbox → Scheduler → accepted
  Relay round trip.
- Delivery disabled remains network-free — `deliveryEnabled: false`
  needs no publisher at all; unaffected by this Arc's new adapter's mere
  availability.
- Host lifecycle unchanged — `start()`/`startDelivery()`/`stopDelivery()`/`stop()`
  all behave exactly as before (no file in this sequence was touched by
  this Arc).
- `stop()` waits for correlated publish completion — verified: a publish
  already in flight when `stop()` is called completes (the Relay records
  it) before the runtime fully stops, per the pre-existing, unchanged
  `stopDelivery()` in-flight-tick guarantee.

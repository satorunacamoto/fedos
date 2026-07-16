# Secure Runtime Alpha 737 — Transient Failure Verification

Stage 17. `test/secure_runtime_alpha_737_transient_failure_verification.test.ts`
(5 tests), each confirming a `"failed"` observation (never
`"rejected"`), continued retry eligibility, and no crash:

1. **Timeout** — a Relay that never fires an OK; a short (30ms) injected
   timeout causes repeated `"failed"` attempts, retried across multiple
   ticks, never `"rejected"`.
2. **Disconnect** — `relay.isConnected() === false`; `publish()` throws;
   `"failed"`, nothing actually sent.
3. **Socket send throw** — `relay.publish()` itself throws; caught,
   `"failed"`, no crash propagates.
4. **Signer unavailable** — the resolved author itself cannot be derived
   (`publicIdentityForAccount()` returns `null`); the WHOLE command fails
   closed (`outcome: "unavailable"`) before any Outbox intent is ever
   created — a stronger, earlier fail-closed point than the Publisher
   layer, confirmed distinct from the other four cases.
5. **Malformed event mapping** — `signEvent()` itself returns `null`
   (simulating a signer that refuses a malformed request); the Outbox
   intent IS created (author/binding already succeeded), but the event
   source yields no event, so the Relay is never even reached.

Attempt-scoped history remains valid throughout (no assertion failure in
any historical retry-count/attempt-number check); no listener/timer leak
was observed (all tests complete and `host.stop()` returns cleanly).

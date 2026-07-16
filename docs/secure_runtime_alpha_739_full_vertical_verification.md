# Secure Runtime Alpha 739 — Full Vertical Verification

Stage 19. `test/secure_runtime_alpha_739_full_vertical_verification.test.ts`
runs three independent, concurrently-running runtimes over the real
vertical path:

**A — Relay accepted:** BoardRuntime → Outbox → Scheduler → Publisher →
matching OK `true` → `"accepted"` Observation → delivered exactly once.

**B — Relay rejected:** BoardRuntime → Outbox → Scheduler → Publisher →
matching OK `false` → `"rejected"` Observation → no automatic retry
despite ~20 Scheduler ticks over the same window → delivered exactly
once (the one, terminal attempt).

**C — Transient failure:** a silent Relay (never ACKs) → repeated
`"failed"` Observations across multiple ticks → retry policy keeps
evaluating, never settling to `"accepted"`/`"rejected"`.

All three runtimes run CONCURRENTLY, each with its own independent
signing identity, Board/Outbox/Observation backend, and Relay double.
Confirmed: no cross-contamination — each Relay only ever recorded its
OWN runtime's post content; runtime B's `20`-tick window never triggered
a resend; runtime C's repeated failures never leaked into A or B's own
Observation history.

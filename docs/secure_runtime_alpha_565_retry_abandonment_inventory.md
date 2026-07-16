# Secure Runtime Alpha 565 — Retry / Abandonment Inventory

Stage 5 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc. Investigation only.

## Findings, per the question list this Stage's own instruction named

- **Failure-count authority:** none, at the Scheduler layer, pre-Arc.
  `FedosPublishScheduler` tracks only two booleans-by-Set membership
  (`#delivered`, `#abandoned`) — no per-intent attempt COUNT exists
  anywhere. One layer up, `FedosDeliveryRetryRegistry` (Alpha 527,
  `src/board/observation/fedos_delivery_retry_registry.ts`) DOES
  allocate monotonically-increasing attempt numbers, but it is
  write-time bookkeeping for Observation subject-id derivation only —
  never consulted for a retry/abandon DECISION anywhere.
- **Attempt number / retry reason / current state:** all exist, at the
  Observation layer (Alpha 462/524/525/527/528), all UNCHANGED by this
  Arc, all reachable via `FedosDeliveryRetryQuery` (Alpha 528).
- **Terminal observation / how the Scheduler judges "pending":** a
  `FedosBoardOutboxObservation` with `kind: "delivered"` or `"abandoned"`
  is terminal, at the Scheduler's own vocabulary level (Alpha 475);
  "pending" is `!#delivered.has(id) && !#abandoned.has(id)` — see Alpha
  561's own inventory.
- **Why a permanently-failing Intent is re-selected every tick:**
  because neither `#delivered` nor `#abandoned` is ever populated for
  an intent whose Publisher keeps returning `"later"` (or crashes,
  mapped to `FAILED_LATER_RESULT`) — confirmed, with a concrete
  triggering condition, by
  `docs/secure_runtime_alpha_551_publish_runtime_retry_semantics_audit.md`.
- **Manual vs. automatic retry:** no distinction exists anywhere in
  this codebase — every retry is the SAME mechanism, "the intent is
  still pending at the next `tick()`," whether that `tick()` was
  interval-driven or manually called.
- **Current retry directive vocabulary:** exactly
  `"immediate" | "later" | "never"` (`FedosBoardOutboxRetryPolicy`,
  Alpha 474, unchanged) — no fourth value, no numeric field anywhere.
- **Abandonment concept, pre-Arc:** exists ONLY as a direct consequence
  of the Publisher's OWN `"never"` directive for one specific attempt —
  there is no Scheduler-level or Host-level policy that can decide
  "abandon" independently of what the Publisher itself reports for its
  most recent call.

## The gap this Arc closes

A Publisher that never explicitly returns `"never"` — because it
crashes, times out, or is simply conservative and always says
`"later"` — is retried by `FedosPublishScheduler` for the lifetime of
the process, unbounded, with no mechanism ANYWHERE in this codebase
able to stop it short of the Publisher's own cooperation. See
`docs/secure_runtime_alpha_566_abandonment_policy_decision.md`.

## See also

- `docs/secure_runtime_alpha_527_retry_registry_implementation.md`
- `docs/secure_runtime_alpha_528_retry_query_implementation.md`
- `docs/secure_runtime_alpha_551_publish_runtime_retry_semantics_audit.md`

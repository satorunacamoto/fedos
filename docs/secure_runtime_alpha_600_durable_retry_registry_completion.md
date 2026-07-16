# Secure Runtime Alpha 600 — Durable Retry Registry & Delivery Recovery Arc Completion

Stage 20 (completion) of the Alpha 581–600 Arc.

## Objective, restated, and closed

Alpha 573 (prior Arc) found, honestly, that `startDelivery()`'s own
fresh-`FedosPublishScheduler`-per-call construction re-attempts EVERY
still-present Outbox intent on a restart — including already-`"delivered"`
ones, not merely retry/abandonment bookkeeping. **CLOSED**: recovery
state (delivered / abandoned / completed-attempt-count / next-attempt-
number) is now rebuilt from the EXISTING durable Observation history on
every `startDelivery()` call (Alpha 585/586), with NO new persistence
backend, NO new schema, and NO new npm dependency (Alpha 582's own
canonical-ownership decision: the Observation history already WAS the
durable record; nothing read it back before this Arc).

## Files changed

- `src/board/outbox/fedos_publish_scheduler.ts` — 3 new optional
  constructor fields (`initialDelivered`/`initialAbandoned`/
  `initialCompletedAttempts`), additive only.
- `src/board/observation/fedos_delivery_retry_registry.ts` — 1 new
  method (`hydrateAttemptCount`), additive-only, never-downward.
- `src/desktop/host/fedos_desktop_host.ts` — `startDelivery()`'s own
  internal Scheduler-construction call site swapped for
  `createFedosDeliveryScheduler()`; public API unchanged.
- `src/desktop/host/fedos_delivery_recovery_hydration.ts` — NEW file,
  the entire recovery read-back path.
- Five prior-Arc test files updated (Alpha 522/531/539/549-adjacent-
  574 group; see Alpha 591–599 for the itemized account).
- Five new test files (Alpha 585/587/588/589/590), 24 new test cases.
- 20 new docs (Alpha 581–600, this file included).
- `README.md` Status banner.

`package.json`, `Cargo.toml`, `p2p/`, and every path under Ontology
Engine / Humanizer / AI / Runtime crypto / Worker runtime / Rust crypto:
untouched — confirmed by `git status --porcelain` and targeted `git
diff --stat`, not merely by intent (see Alpha 591–599).

## Verification

- `npm run typecheck`: zero new errors (one pre-existing, unrelated,
  unchanged since Alpha 560/580).
- Focused tests: 5 new files, 24/24 passing.
- Relevant integration sweep (`test/secure_runtime_alpha_4*`/`5*`):
  170 files / 915 tests, 157/902 passing, the same 13 pre-existing
  environment-level failures unchanged.
- Rust untouched — `cargo check` correctly NOT run, per this Arc's own
  instruction.
- No generated artifact found (`git status --porcelain` shows no
  `dist/`, `pkg/`, or build-output path).

## Remaining limitations, honestly recorded

- **Cross-OS-process durability is still bounded by the injected
  Persistence backend's own nature.** This Arc's own "real restart"
  (Alpha 589) proves recovery across a fresh `FedosDesktopHost`
  instance sharing the SAME `InMemoryFedosDeliveryObservationPersistence`/
  `InMemoryFedosBoardOutboxPersistence` objects — exactly this
  repository's own established definition of "restart-verified" (Alpha
  545). A literal OS process kill-and-restart, with a genuinely
  separate `InMemory*` instance, would still lose everything — that
  has ALWAYS been true of every in-memory backend in this repository
  and remains a property of the BACKEND choice, not of the recovery
  logic this Arc adds (which is backend-agnostic and would recover
  correctly against a real file/DB-backed Persistence implementation,
  should one ever be adopted — outside this Arc's own scope, no new
  dependency permitted).
- **A crashed mid-flight attempt (a `"publishing"` observation with no
  terminal write) is correctly excluded from `completedAttempts`
  (Alpha 583's own rule) but is also not independently detected or
  reported as "stuck" anywhere** — it is simply re-attempted as attempt
  N+1 on the next `startDelivery()`, indistinguishable from ordinary
  retry. No dedicated "stale in-flight attempt" alerting exists.
- **The millisecond-resolution tie-break in `FedosDeliveryObservationQuery`
  (Alpha 513/529, pre-existing, unchanged, protected area) remains
  exactly as documented** — this Arc's own hydration fails closed
  toward it (an extra safe retry, never a false "delivered"), but does
  not eliminate the underlying ambiguity.
- **No manual recovery/inspection API was added** — an operator cannot
  currently query "what would hydration decide for this intent right
  now" without constructing a `FedosDeliveryRetryQuery` directly; this
  Arc's own Absolute Requirements (preserve existing public API,
  minimal additive extension only) did not call for one.

## Next Arc recommendation — ONE

**Publish Pipeline Production Caller Wiring Arc.** The prior Arc's own
completion doc (Alpha 580) already recommended Durable Retry Registry
Persistence ahead of production wiring, specifically because
retry/abandonment state loss on restart would have corrupted the FIRST
real production traffic this pipeline ever serves. That blocker is now
closed. `docs/secure_runtime_alpha_543_publish_runtime_ownership_audit.md`'s
own finding (nothing in `src/worker.ts` wires `FedosDesktopHost`/
`FedosPublishScheduler` to any real caller) remains the single largest
gap between "this pipeline is correct" and "this pipeline does
anything in production" — no other named candidate
(`docs/secure_runtime_alpha_559_publish_runtime_recommendations.md`)
has a comparable blocker remaining.

## Commit

One commit, per this Arc's own instruction:
`Add Secure Runtime Alpha 581-600: Durable Retry Registry and Delivery Recovery Arc`.

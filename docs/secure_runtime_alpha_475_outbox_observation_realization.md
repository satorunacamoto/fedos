# Secure Runtime Alpha 475 — Outbox Observation Realization

Stage 5 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. What Alpha 415 left open

Alpha 415 (`docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`)
named six candidate Observation kinds as VOCABULARY ONLY — `queued`,
`attempt-started`, `delivered`, `rejected`, `failed`, `abandoned` — and
implemented none of them, on the grounds that no real consumer (a
publisher) existed yet to write one. This Arc's own `FedosPublishScheduler`
is the first real consumer.

## 2. Candidates compared

- **Option A — realize all six named kinds, including `queued`.**
  REJECTED: `queued` belongs to the moment an intent is CREATED
  (`createFedosBoardOutboxIntent`, Alpha 414), a call site this Arc does
  not touch (`FedosDesktopHost.submitPost()`, Alpha 419, is out of
  scope). Adding an observation kind this Arc's own Scheduler never
  produces would be dead vocabulary with no real caller — the same
  discipline Alpha 415 §4 itself already applied.
- **Option B — realize exactly the five kinds `FedosPublishScheduler`
  itself produces (`attempt-started`, `delivered`, `rejected`, `failed`,
  `abandoned`), as an immutable type with a single fail-closed
  constructor.** ADOPTED.
- **Option C — persist Observations this Arc, adding
  `putObservation`/`listObservations` to `FedosBoardOutboxPersistence`.**
  REJECTED this Arc. See §3.

## 3. Why Observations remain unpersisted this Arc

The only consumer that would ever WRITE a durable Observation is a real
`FedosBoardOutboxPublisher` implementation — none exists yet within
this Arc's own scope (`MockFedosBoardOutboxPublisher` is test-only, per
Alpha 473 §3). Persisting Observations produced only by a Mock, that no
real Publisher and no real reader consumes, would be dead-code
persistence infrastructure with no honest caller — the identical
reasoning Alpha 415 §4 already applied to defer Observation persistence
in the first place. `FedosPublishScheduler.observationLog()` and each
`tick()` call's own returned entries are the ONLY way to read
Observations this Arc; both are in-memory, scoped to one Scheduler
instance's lifetime, lost on process restart. This is recorded here as
an explicit, load-bearing deferral, not an oversight: the next Arc that
gains a real Publisher is the right one to also decide Observation
persistence.

## 4. Shape

```ts
type FedosBoardOutboxObservationKind =
  | "attempt-started" | "delivered" | "rejected" | "failed" | "abandoned";

interface FedosBoardOutboxObservation {
  readonly outboxId: FedosBoardOutboxId;
  readonly kind: FedosBoardOutboxObservationKind;
  readonly observedAt: number;
  readonly reason?: string;
}
```

`createFedosBoardOutboxObservation()` is the only constructor, fails
closed to `null`, and freezes its result — mirroring
`createFedosBoardOutboxIntent()`'s own established convention exactly
(`src/board/outbox/fedos_board_outbox_types.ts`, Alpha 414).

## 5. See also

- `docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`
- `docs/secure_runtime_alpha_474_retry_policy_model.md`
- `docs/secure_runtime_alpha_476_publish_scheduler_tick_design.md`

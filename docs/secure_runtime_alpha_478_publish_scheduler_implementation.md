# Secure Runtime Alpha 478 — Publish Scheduler Implementation and Unit Verification

Stage 8 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. Files this Stage adds

- `src/board/outbox/fedos_board_outbox_publisher.ts` (Alpha 473) —
  `FedosBoardOutboxPublisher`, `FedosBoardOutboxPublishResult`,
  `isValidFedosBoardOutboxPublishResult`, `MockFedosBoardOutboxPublisher`.
- `src/board/outbox/fedos_board_outbox_observation.ts` (Alpha 475) —
  `FedosBoardOutboxObservation`, `createFedosBoardOutboxObservation`,
  `isFedosBoardOutboxObservationKind`.
- `src/board/outbox/fedos_publish_scheduler.ts` (Alpha 476–477) —
  `FedosPublishScheduler`, `FedosPublishSchedulerDependencies`,
  `FedosPublishSchedulerTickEntry`.

No existing file under `src/board/outbox/` (or anywhere else) is
modified by any of the three.

## 2. Test coverage added this Arc

Ten `test/secure_runtime_alpha_47{1..0}_*.test.ts` files (Alpha
471–480), one per Stage, 59 tests across the seven implementation-facing
Stages alone (471–477) at the time this Stage was written — meta-doc
assertions confirming each design doc's own claims, plus real,
non-mocked-except-at-the-Publisher-boundary unit and integration tests
against `FedosPublishScheduler`, `MockFedosBoardOutboxPublisher`, and
`createFedosBoardOutboxObservation`. In particular
`test/secure_runtime_alpha_476_publish_scheduler_tick_design.test.ts`
exercises: normal delivery, `"later"` re-eligibility across two
separate `tick()` calls, `"never"` permanent abandonment, a single
`"immediate"` same-tick re-attempt, two consecutive `"immediate"`
results bounded to exactly two `publish()` calls per `tick()`, a
rejected `Publisher.publish()` Promise normalized to
`failed`/`later`, a structurally invalid `Publisher` return value
normalized the same way, sequential (not parallel) attempt ordering,
and `observationLog()` accumulation/isolation.

## 3. Real execution results (this Stage's own, not restated from any
   earlier Arc)

- **This Arc's own seven implementation-facing test files, isolated**
  (`npx vitest run test/secure_runtime_alpha_47[1-7]_*.test.ts`): **7
  files passed, 59/59 tests passed, zero failures.**
- **This Arc's own three new source files, typechecked in isolation**
  (`npx tsc --noEmit --strict` against exactly
  `fedos_board_outbox_publisher.ts`, `fedos_board_outbox_observation.ts`,
  `fedos_publish_scheduler.ts`): clean, zero errors.
- **Full-project `npm run typecheck`**: at the time this Stage ran, this
  command reported one error — `TS1136: Property assignment expected`
  in `test/secure_runtime_alpha_468_security_regression_guards.test.ts`.
  Direct inspection confirms this file is NOT part of this Arc (it was
  never created or touched by any file this Arc adds) and was found, by
  `git status --short`, to be an UNTRACKED, uncommitted file belonging
  to a separate, concurrently-in-progress `Alpha 461–470 Canonical
  Delivery Observation Arc` — see Alpha 479 §1 for the full accounting.
  Re-running `tsc --noEmit` against exactly this Arc's own three new
  source files (§ above) confirms they are independently clean; the one
  project-wide error traces to a file outside this Arc's own diff
  entirely.
- **Full-project `npm test`** (`npm test -- --run`, 708 files / 10767
  tests total at the time this Stage ran): **637 files / 10657 tests
  passed, 71 files / 110 tests failed.** Every one of this Arc's own
  seven test files (§ above) is among the passing 637 — confirmed by
  re-running them in isolation immediately afterward with the identical
  result (7/7 files, 59/59 tests). The 71 failing files are NOT this
  Arc's own regression: they trace to (a) the same ~10 pre-existing
  hardcoded Rust structural-count assertions already flagged unchanged
  at every recent Arc's own baseline (Alpha 450 §4), confirmed present
  again by name (e.g.
  `test/secure_runtime_alpha_158_nostr_root_verification.test.ts`), and
  (b) a larger set introduced by the SAME separate, concurrently
  in-progress, uncommitted work found at Alpha 471 §4 — untracked
  `src/board/publish/*` and `src/board/observation/*` files from two
  other Arcs (`Alpha 451–460`, `Alpha 461–470`) not yet finished, whose
  own presence makes several OLDER committed tests' "this directory
  does not exist yet" assertions (e.g.
  `test/secure_runtime_alpha_423_nostr_signing_boundary_options.test.ts`,
  `test/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.test.ts`)
  stale — a ripple those Arcs' own later Stages, not this one, are
  responsible for reconciling. This Arc touches none of those files.

## 4. See also

- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
- `docs/secure_runtime_alpha_479_scope_and_security_regression_guards.md`

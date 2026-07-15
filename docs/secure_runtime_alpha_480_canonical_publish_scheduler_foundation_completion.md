# Secure Runtime Alpha 480 — Canonical Publish Scheduler Foundation Completion

Stage 10 (final) of the Alpha 471–480 Canonical Publish Scheduler
Foundation Arc.

## 1. Completion declaration

Declared complete:

- **Inventory** — no Scheduler and no protocol-agnostic Publisher port
  existed anywhere in committed history; a separate, uncommitted Arc's
  Nostr-specific Publisher was found and deliberately excluded from this
  Arc's own scope (Alpha 471).
- **Responsibility decision** — a separate `FedosPublishScheduler` class
  (Option B), owning cadence/orchestration/retry-directive application
  only, never signing/transport/protocol logic (Alpha 472).
- **Publisher Interface** — `FedosBoardOutboxPublisher`
  (`src/board/outbox/fedos_board_outbox_publisher.ts`), generic, typed
  to the existing `FedosPersistedBoardOutboxRecordV1`, returning a
  structured `{ outcome, retryPolicy, reason? }` result; no concrete
  protocol-wired implementation shipped, only a test-only Mock (Alpha
  473).
- **Retry Policy** — a closed `"immediate" | "later" | "never"` union,
  no numeric delay field, no exponential backoff anywhere; the
  Publisher decides, with one Scheduler-owned termination guardrail
  (Alpha 474).
- **Observation** — five of Alpha 415's six named kinds realized
  (`attempt-started`/`delivered`/`rejected`/`failed`/`abandoned`),
  immutable, fail-closed constructor, deliberately unpersisted this Arc
  (Alpha 475).
- **Tick design** — sequential, bounded (at most two `publish()` calls
  per pending intent per `tick()`), never throws for a Publisher-side
  problem (Alpha 476).
- **Lifecycle** — `start()` throws on double-start, `stop()` is
  idempotent, constructor performs no side effect, `tick()` callable
  independent of `start()`/`stop()` (Alpha 477).
- **Implementation and unit verification** — three new files, zero
  existing-file modification; this Arc's own seven implementation-facing
  test files 7/7 green, 59/59 tests (Alpha 478).
- **Scope and security regression guards** — every named prohibition
  (Publisher internals, Relay, Board, Nostr, Ontology, `p2p/`, GUI,
  exponential backoff) mechanically re-verified (Alpha 479).

## 2. Independent re-verification performed at this Stage

- `npx vitest run test/secure_runtime_alpha_47*.test.ts` — this Arc's
  own nine-of-ten-file test set (Alpha 471–479; this file, Alpha 480,
  cannot meaningfully assert on its own not-yet-final content), GREEN
  (9 files, 71/71 tests, all passing).
- `npx tsc --noEmit --strict` against exactly this Arc's own three new
  source files — clean, isolated from the rest of the project.
- Full-project `npm test -- --run` (708 files / 10767 tests at the time
  this Stage's own most recent full run completed) — 637 files / 10657
  tests passed, 71 files / 110 tests failed; every failure traced
  (Alpha 478 §3) to either the ~10-file pre-existing Rust
  structural-count baseline already flagged unchanged since Alpha 450,
  or to two SEPARATE, uncommitted, in-progress Arcs (Alpha 451–460,
  Alpha 461–470) this Arc does not depend on, read again, or modify.
  Re-running this Arc's own test files in isolation immediately
  afterward reproduced the identical 100%-passing result.
- `git diff --stat` restricted to this Arc's own staged files: empty —
  every file this Arc's commit adds is new; zero pre-existing tracked
  file is modified by this Arc (Alpha 479 §5).
- `git grep "implements FedosBoardOutboxPublisher"`: exactly one match,
  the test-only `MockFedosBoardOutboxPublisher` — no real Publisher
  implementation exists (Alpha 479 §4).

## 3. Phase Gate result

**PASS.** All ten Stages hold under direct re-verification, not merely
restated from their own individual Stage doc.

## 4. What this Arc establishes

A `FedosPublishScheduler` that periodically (`start()`/`stop()`,
injectable cadence) or on demand (`tick()`) flows every pending Outbox
intent to an injected, generic `FedosBoardOutboxPublisher`, applying a
Publisher-supplied, backoff-free `"immediate" | "later" | "never"`
Retry Policy and recording in-memory `FedosBoardOutboxObservation`s for
every attempt — with zero concrete protocol wiring, zero Board/Relay/
Nostr/Ontology/`p2p`/GUI change, and zero modification to any
pre-existing file.

## 5. Still out of scope

A real, protocol-wired `FedosBoardOutboxPublisher` implementation (this
Arc's own generic port is ready for one, mirroring the Publisher-
readiness posture Alpha 448 already established for the signing
boundary); durable Observation persistence; a Retry Policy DECISION
procedure inside a real Publisher (this Arc only defines and applies the
vocabulary, never decides when a real failure should be `"immediate"`
vs. `"later"` vs. `"never"` for any actual protocol); concurrency
control across simultaneous `publish()` calls within one `tick()`;
Desktop Host wiring of `FedosPublishScheduler` itself (no
`FedosDesktopHost` file is touched this Arc); GUI scheduler-status
display; reconciliation with whichever of the two separate,
concurrently in-progress Arcs (Alpha 451–460, Alpha 461–470) lands
first.

## 6. Next Arc recommendation

**Adapt, do not duplicate.** Once Alpha 451–460's own
`FedosNostrBoardPublisher` (or Alpha 461–470's own Delivery Observation
work) lands, the correct next Arc is a thin ADAPTER — a new file
implementing `FedosBoardOutboxPublisher` (this Arc's own generic port)
by internally calling whichever concrete, protocol-specific Publisher
those Arcs finish — never a modification to `FedosPublishScheduler`
itself, and never a second, competing generic Publisher port.

## 7. See also

- `docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md`
  through `docs/secure_runtime_alpha_479_scope_and_security_regression_guards.md`
- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`

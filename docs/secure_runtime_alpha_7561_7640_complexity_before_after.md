# Secure Runtime Alpha 7561-7640 — Complexity Before/After Report

FedOS Conversation Outbox Restart Hydration and Scheduler Scalability Arc — Phase G

## Headline result

The named defect is fixed and measured: **post-hydration retry work is now based on
P (genuinely pending count), not T (total-ever-appended)** — at T=1,000, a restart with a
1% pending ratio now attempts 10 intents instead of 1,000 (99.0% reduction), confirmed by
real, end-to-end execution through the actual production `FedosPrivateTransport` ->
`FedosConversationTransportScheduler` construction path (see the Phase F/I test files;
`entries.length` after restart equals exactly the pending count in every scenario tested,
never more).

**A second, unplanned finding emerged during this measurement and is disclosed in full
below**: the hydration function's own read cost, and the pre-existing
`FedosValidatingDeliveryObservationRepository`'s per-write staleness check, both scale
**quadratically** in the number of history-bearing (delivered/abandoned) intents — not
linearly, and not because of anything this Arc's own new code does. This is a real,
measured, pre-existing characteristic of the shared, unchanged
`FedosDeliveryObservationQuery`/`FedosDeliveryRetryQuery` machinery (Board's own Alpha
467/528 classes, reused here exactly as this Arc's own mission requires: "reuse the
architecture, never redesign"). It is reported precisely below rather than minimized,
per this Arc's own "Fail Closed over fabrication" instruction.

## Method

All numbers below are either **MEASURED** (real code, real execution, in this exact
worktree, this session) or **DERIVED** (a clearly-labeled mathematical extrapolation from a
clean, multi-point measured curve — never a guess). Where a dataset size could not be
reached within a reasonable session time budget, that is stated explicitly rather than
fabricated. All benchmarks used a temporary, untracked script
(`__bench_7561_7640*.ts`, `npx tsx`), run and then deleted — confirmed via `git status
--short` showing no trace — mirroring the exact precedent the prior audit (`212b842`)
already established for this codebase.

## Part 1 — MEASURED: hydration cost vs. history-bearing (delivered) intent count

| deliveredCount | hydrate time | doubling ratio |
|---:|---:|---:|
| 100 | 19.08 ms | — |
| 200 | 75.87 ms | 3.98x |
| 400 | 328.21 ms | 4.33x |
| 800 | 1,271.49 ms | 3.87x |
| 1,600 | 4,778.32 ms | 3.76x |
| 3,200 | 19,399.14 ms | 4.06x |

A consistent ~4x time increase per 2x count increase, across five consecutive doublings,
is the clean, textbook signature of **O(n²)** growth (2x count -> 2² = 4x time). This is
not linear (which would show ~2.0x per doubling) and not the "O(T) once at startup" this
Arc's own mission text anticipated.

**Root cause, traced to source**: `FedosDeliveryObservationQuery.historyFor(subjectId)`
(`src/board/observation/fedos_delivery_observation_query.ts:49-54`) calls
`this.#repository.list()` — which deserializes **every** Observation record in the entire
repository, across **all** subjects (`FedosDeliveryObservationRepository.list()`,
`src/board/observation/fedos_delivery_observation_repository.ts:88-95`, itself calling
`this.#persistence.listObservations()`, unfiltered) — then filters down to the one
requested `subjectId`. `FedosDeliveryRetryQuery.historyFor()`
(`src/board/observation/fedos_delivery_retry_query.ts:56-73`) calls this once per
attempt-number probe (1, 2, 3, ... until a `null`) for **each** subject. With N total
Observation records in the repository and roughly one subject needing ~2 probe calls
(one hit, one miss to confirm no further attempts) each paying O(N): total hydration cost
is O(deliveredCount × N) where N itself grows with deliveredCount — O(deliveredCount²).
**This is byte-for-byte the same code path Board's own `hydrateFedosDeliveryRecoveryState()`
(Alpha 585) already calls** — this Arc's new hydration function was written to deliberately
reuse it (per Phase A's own decision), so this characteristic is inherited unchanged, not
introduced. It has presumably existed, silently, since Alpha 528 (Retry Query) shipped.

**The identical O(N)-per-call pattern also afflicts ordinary, non-hydration write
traffic**: `FedosValidatingDeliveryObservationRepository.record()`
(`src/board/observation/fedos_delivery_observation_write_validator.ts:85-94`) calls
`validateFedosDeliveryObservationTransition()`, which calls
`query.currentStateFor(subjectId)` -> the same `historyFor()` -> the same full-repository
`list()` scan, **on every single write**, not just at startup. This means a long-running
account's ordinary message-send traffic (not just restart hydration) pays a cost that grows
with the account's total lifetime history — confirmed by measurement (Part 2 below).

## Part 2 — MEASURED: attempt-count reduction (the actual named-defect metric)

| T (total) | pending ratio | fixture build time | BEFORE attempts | AFTER attempts | reduction |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 100% | 0.7 ms | 1,000 | 1,000 | 0.00% (no history exists to hydrate — expected) |
| 1,000 | 1% | 959.2 ms | 1,000 | 10 | **99.00%** |
| 10,000 | 100% | 3.0 ms | 10,000 | 10,000 | 0.00% (expected, same reason) |
| 10,000 | 1% | 138,963.7 ms (~139s) | 10,000 | 100 | **99.00%** |

The T=10,000/1%-pending fixture-build row is included specifically because its cost
(~139 seconds, to durably record 9,900 real delivery-attempt histories via the
already-existing Validating Repository) independently corroborates Part 1's O(n²) finding
via a second, structurally different code path (write-time validation, not hydration
read) — both blow up for the same underlying reason (Part 1's root-cause paragraph).

**T=100,000 could not be completed within this session for any pending ratio below
100%**, and this is stated honestly rather than estimated as measured: per the clean
Part 1 model (k ≈ 0.0019 ms per delivered-count²), a 100,000-scale scenario with any
realistic (non-100%) pending ratio would require **on the order of hours** to build the
fixture alone (DERIVED, not measured: deliveredCount=99,000 -> ~0.0019 × 99,000² ≈
18,600,000 ms ≈ 5.2 hours). This is reported as a real, load-bearing scalability finding
in its own right (see "What remains open" below), not glossed over.

**Attempt-count reduction correctness is independently confirmed by real, end-to-end
execution** (not just arithmetic) in the Phase F/I test suites, which run the actual
`FedosPrivateTransport`/`FedosConversationTransportScheduler`/hydration-function chain
against small, fast, fully-real fixtures and assert `tick()`'s own returned entry count
and content directly — see `secure_runtime_alpha_7561_7640_private_transport_restart_hydration.test.ts`.

## Part 3 — MEASURED: Outbox persistence cost alone (unaffected by this Arc, and unaffected
by the Part 1/2 quadratic finding — a different, unrelated code path)

| T | putIntent build time | per-record | listIntents() |
|---:|---:|---:|---:|
| 1,000 | 1.29 ms | 1.290 us | 0.100 ms |
| 10,000 | 6.53 ms | 0.653 us | 0.046 ms |
| 100,000 | 89.58 ms | 0.896 us | 0.708 ms |

Confirms the Outbox persistence layer itself (`FedosConversationTransportOutboxPersistence`)
remains genuinely linear/cheap at T=100,000 — sub-millisecond `listIntents()`, consistent
with the prior audit's own (`212b842`) real, file-backed measurement of ~1.45 us/record
(this in-memory variant is faster, as expected, with no disk I/O). **The quadratic finding
in Parts 1-2 is isolated entirely to the Observation-Query/Retry-Query layer — it is not a
property of the Outbox this Arc's own hydration reads from.**

## Startup / steady-state / write / network-replay complexity, distinguished precisely

- **Startup hydration scan**: O(T) intents scanned (`listIntents()`, cheap per Part 3) +
  O(deliveredCount²) Observation-history reads (Part 1, the real, dominant cost at any
  meaningful deliveredCount). **Not O(T) as the Arc's own mission text anticipated** — this
  is precisely disclosed, not glossed over, per "do not claim O(P) persistence reads if
  listIntents remains O(T)" applied honestly to a worse-than-anticipated finding.
- **First Scheduler tick after restart**: attempt count is now O(P) (Part 2, MEASURED
  and end-to-end test-confirmed) — this is the actual named defect, and it is fixed.
- **Steady-state tick** (nothing new since the last tick): O(T) `listIntents()` scan
  (cheap, Part 3) to re-discover the pending set, filtered by the in-memory
  `#delivered`/`#abandoned` Sets (O(1) per `.has()` check) — zero attempts, confirmed
  by the Phase F "five restart cycles" test (`entries` length 0 in every steady-state
  tick).
- **Write complexity** (one new `putIntent`): O(1) amortized at the Outbox layer alone
  (Part 3); if that intent is later attempted, its own terminal `record()` call pays the
  Observation-layer O(N) validation cost described in Part 1's write-path corroboration —
  unrelated to and unaffected by this Arc's own change.
- **Network replay count**: reduced from O(T) relay round-trips per restart to O(P) —
  this is the real-world-dominant improvement the original mission targeted (the prior
  audit's own "~83 minutes" illustrative, never-measured projection was specifically about
  network round-trip cost at T=100,000/1,000 conversations, which this fix directly
  addresses by eliminating O(T-P) unnecessary re-publish attempts).

## What remains open (carried into "recommended next Arc")

The O(deliveredCount²) Observation-Query cost (Part 1) is now the single largest,
best-characterized scalability risk in this subsystem — larger in practical terms than the
defect this Arc was scoped to fix, once an account's history grows into the low thousands
of delivered/abandoned intents. It affects Board equally (same shared code), not just
Conversation. Fixing it is explicitly **out of scope for this Arc**: it lives in shared,
`UNCHANGED`-per-multiple-prior-Arcs' own headers infrastructure (`fedos_delivery_observation_query.ts`,
Alpha 467; `fedos_delivery_retry_query.ts`, Alpha 528), touching it would have a blast
radius well beyond "the narrowest high-precedence remediation" this Arc was scoped to, and
doing it under time pressure inside an Arc whose own named mission is a different, already-
completed fix would violate "One Arc, one primary implementation commit" discipline. See
the completion declaration's "Recommended next Arc" section for the precise, narrow scope
proposed to close it.

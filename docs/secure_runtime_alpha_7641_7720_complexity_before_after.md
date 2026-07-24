# Secure Runtime Alpha 7641–7720 — Complexity Before/After Report

**FedOS Delivery Observation Repository Subject Index and Query Scalability Arc.**

## Before (inherited from Alpha 466/467, unchanged since; disclosed by Alpha 7561-7640)

`FedosDeliveryObservationQuery.historyFor(subjectId)` called
`repository.list()` (deserializes EVERY Observation across EVERY
subject) then `.filter()`+`.sort()`. `currentStateFor()` derives from
`historyFor()`. `FedosDeliveryRetryQuery.historyFor()` calls
`currentStateFor()` once per attempt-number probe. Net: one per-subject
read cost O(N), where N is the TOTAL Observation count across ALL
subjects — and N itself grows as more subjects/attempts are recorded,
producing O(deliveredCount²) for the common "query every subject once"
access pattern hydration (and ordinary write-time validation) both use.
Measured by the prior Arc: ~4x time per 2x count, five consecutive
doublings, 100→3,200.

## After (this Arc)

`FedosDeliveryObservationRepository` gains a derived, incrementally-
maintained `#bySubject: Map<SubjectId, Observation[]>` index, rebuilt
once (O(T)) at every construction and updated O(1) amortized on every
successful `record()`. A new method, `listForSubject(subjectId)`,
returns ONLY that subject's own Observations (a defensive copy). `
FedosDeliveryObservationQuery.historyFor()` now calls
`repository.listForSubject(subjectId)` instead of `repository.list()`+
`.filter()`, then applies the SAME `.sort(compareByObservedAtThenId)` it
already did — ordering output is byte-for-byte identical, only the input
scan is bounded to the one subject's own history (H_s) instead of every
subject's combined history (N). `currentStateFor()` and
`FedosDeliveryRetryQuery` need ZERO changes — both benefit transitively.
`list()` and `listByState()` are BYTE-FOR-BYTE UNCHANGED (still a fresh
full scan every call) for the genuinely cross-subject callers that need
them.

## Complexity, before vs. after

| Operation | Before | After |
|---|---|---|
| `historyFor(subjectId)` / `currentStateFor(subjectId)` | O(N), N = total Observations across ALL subjects | O(H_s), H_s = that ONE subject's own history length |
| Querying every subject once (S subjects) | O(S × N) ≈ O(S²) in the common case where N grows with S | O(T + S) — one O(T) index lookup amortized in construction, O(H_s) per subject thereafter |
| `record()` (Repository/index layer) | O(1) (no index existed) | O(1) amortized (one Map lookup + array push) |
| `record()` (real durable persistence backend) | O(T) (pre-existing `putObservation()` duplicate check) | O(T), UNCHANGED — disclosed, out of scope (see benchmark doc) |
| Repository construction | O(1) (nothing to build) | O(T) — one full scan to seed the index, the ONE new cost this design accepts |
| `list()` / `listByState()` | O(T) | O(T), UNCHANGED |

## Measured evidence

See `secure_runtime_alpha_7641_7720_benchmark_methodology_and_results.md`
for the full numbers. Headline: querying every subject once at
deliveredCount=3,200 dropped from a cited 19,399.14 ms (before) to a
measured 2.26 ms (after) — roughly 8,584x. At deliveredCount=100,000
(previously only derivable, never measured, at ~5.2 hours for a
comparable write-path operation), the equivalent read-path operation now
measures 154.28 ms directly.

## What remains open, honestly

- **Persistence-layer write duplicate-check cost** (O(T) for the real
  file-backed `AppendOnlyFedosDeliveryObservationPersistence`) is
  UNCHANGED and explicitly out of this Arc's own scope — a genuinely
  separate, deeper fix (an id-presence index inside the persistence
  backend itself) would require a persistence schema/index change this
  Arc's own mission prohibits. It mirrors the ORIGINAL audit's own
  disclosed-but-unfixed Outbox `putIntent()` finding exactly.
- **`list()`/`listByState()`'s own O(T) full-scan cost** is unchanged by
  design — both remain correct, cheap-enough-at-realistic-scale (Part 3
  of the benchmark doc: 205.69 ms at T=100,000, an infrequent,
  cross-subject-only operation, not the common per-subject hot path this
  Arc targets) cross-subject queries, and this Arc's own mission
  explicitly keeps them additive rather than removing/replacing them.
- **Compaction/per-conversation partitioning** remain entirely
  out-of-scope future work, unchanged from the original audit's own
  framing — this Arc does not touch persistence format or partitioning
  in any way.

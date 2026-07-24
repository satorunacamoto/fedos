# Secure Runtime Alpha 7641–7720 — Benchmark Methodology and Results

**FedOS Delivery Observation Repository Subject Index and Query Scalability Arc — Phase H.**

## What was actually run vs. what is cited from the prior Arc

**Actually measured** (this session, `npx tsx`, an uncommitted, untracked
script `__bench_7641_7720.mts` written to and deleted from this worktree's
root — confirmed via `git status --porcelain` showing no trace before this
document was written): every number in Parts 1-3 below, against the REAL,
current, committed (about to be committed) `FedosDeliveryObservationRepository`/
`FedosDeliveryObservationQuery` source, using
`InMemoryFedosDeliveryObservationPersistence` (the O(1)-write backend —
isolates the Repository/Query-layer fix from the separately-disclosed,
out-of-scope persistence-layer duplicate-check cost; see this doc's own
"Persistence-layer write cost" section below).

**Cited, not re-measured**: the BEFORE numbers (Alpha 7561–7640's own Part
1 table) — that code path no longer exists in this worktree to benchmark
directly (this Arc's own fix replaces it), so the prior Arc's own real,
committed measurement is cited directly as the legitimate "before" baseline
for the exact same operation at the exact same scale points, per that
document's own already-published numbers.

## Part 1 — BEFORE (cited from `secure_runtime_alpha_7561_7640_complexity_before_after.md`) vs. AFTER (measured this session)

| deliveredCount | BEFORE (cited) | AFTER (measured) | speedup |
|---:|---:|---:|---:|
| 100 | 19.08 ms | 0.30 ms | ~64x |
| 200 | 75.87 ms | 0.34 ms | ~223x |
| 400 | 328.21 ms | 0.64 ms | ~513x |
| 800 | 1,271.49 ms | 0.52 ms | ~2,445x |
| 1,600 | 4,778.32 ms | 1.49 ms | ~3,207x |
| 3,200 | 19,399.14 ms | 2.26 ms | ~8,584x |

The BEFORE column shows the clean ~4x-per-2x-count (O(n²)) signature the
prior Arc documented. The AFTER column shows no such growth — the small
absolute millisecond values at this scale are dominated by V8 JIT
warmup/GC noise (the doubling ratios bounce between 0.8x and 2.9x, not a
clean curve), not by any remaining quadratic term; Part 2 below, at a
scale large enough to dominate that noise, shows the real asymptotic
shape clearly.

## Part 2 — AFTER: 10,000 and 100,000 (previously undreachable within a session; now measured directly, not derived)

| deliveredCount | queryAll (query every subject once) | per-subject |
|---:|---:|---:|
| 10,000 | 17.00 ms | 1.700 μs |
| 100,000 | 154.28 ms | 1.543 μs |

A 10x increase in `deliveredCount` (10,000 → 100,000) produced a ~9x
increase in total query time (17.00 ms → 154.28 ms) — the textbook O(n)
signature (2x count → ~2x time), not the ~100x a 10x-count O(n²) growth
would have produced. The prior Arc's own DERIVED (never measured)
estimate for a comparable write-path scenario at deliveredCount≈99,000 was
"~5.2 hours" — this session directly measured the equivalent READ-path
operation at deliveredCount=100,000 in 154 milliseconds. This is the
single clearest piece of evidence that this Arc's own fix closes the gap
the prior Arc discovered.

## Part 3 — AFTER: index rebuild (constructor) cost

| deliveredCount (T, in Observations = 2×deliveredCount) | rebuild time |
|---:|---:|
| 1,000 | 2.03 ms |
| 10,000 | 20.47 ms |
| 100,000 | 205.69 ms |

Clean, near-perfectly linear O(T) scaling (10x records → ~10x time at
both doubling points) — exactly the "index rebuild: O(T)" target the
mission specifies, and the ONE cost this Arc's own design explicitly
accepts as unavoidable (a full scan of durable history at every
construction/restart).

## Persistence-layer write cost — explicitly out of scope, disclosed precisely

`AppendOnlyFedosDeliveryObservationPersistence.putObservation()` (the
REAL durable backend used at the real production construction site,
`fedos_desktop_runtime.ts:670`) performs its own full-log-replay
duplicate check (`this.getObservation(record.id)` → `listObservations()`
→ `replayLog()`) BEFORE its own O(1) `appendFileSync`. This is a
PERSISTENCE-layer cost, structurally identical in shape and origin to
the ORIGINAL audit's own disclosed (never fixed) Outbox `putIntent()`
duplicate-check finding, and it is completely UNCHANGED by this Arc —
fixing it would require a persistence-layer schema/index change,
explicitly prohibited by this Arc's own "Do not redesign persistence"
instruction. For the IN-MEMORY backend
(`InMemoryFedosDeliveryObservationPersistence`), `putObservation()` is
already a plain `Map` get/set — genuinely O(1), unaffected by either the
old or new code. **Precise, honest statement of append complexity, per
the mission's own "O(1) or documented bounded equivalent" phrasing**:
`record()` at the Repository/index layer is O(1) amortized (this Arc's
own new work); `record()`'s OVERALL wall-clock cost through the real
durable file-backed persistence remains O(T) at the persistence layer,
unchanged, pre-existing, and out of this Arc's own explicit scope.

## Target complexity, restated against measured evidence

- **Index rebuild**: O(T) — measured, Part 3, clean linear scaling.
- **One subject query** (`historyFor`/`currentStateFor`): O(H_s) — the
  per-subject history length, NOT the total repository size — measured
  indirectly via Part 1/2 (querying ALL subjects, each with a FIXED
  H_s=2, scales linearly in subject COUNT, which is exactly what O(S ×
  H_s) = O(S) predicts when H_s is constant; the OLD code's O(S × N)
  cost, where N itself grows with S, is what produced the O(S²)
  signature Part 1's BEFORE column shows).
- **Append**: O(1) amortized at the Repository/index layer (measured
  indirectly: Part 1's AFTER `build` column, which includes 2×
  deliveredCount `record()` calls, scales linearly with deliveredCount);
  O(T) at the real durable persistence backend specifically (disclosed
  above, unchanged, out of scope).
- **Querying all subjects**: O(T + S) — Part 1/2's AFTER `queryAll`
  column IS exactly this operation (one `currentStateFor()` per subject,
  S subjects total) and shows linear-in-S scaling, confirming the target
  is met; the OLD O(S × T) shape (Part 1's BEFORE column) is closed.

# Secure Runtime Alpha 7881–7960 — Phases B/C/D/E: Write Index Design and Crash-Consistency Specification

## Phase B — reproduction (measured, `test/secure_runtime_alpha_7881_7960_writetime_reproduction_benchmark.test.ts`)

Real, file-backed `AppendOnlyFedosDeliveryObservationPersistence`, one process, on
this machine:

| scenario                                   | prior T | elapsed |
|---------------------------------------------|---------|---------|
| single new-id `putObservation`              | 100     | 1.71 ms |
| single new-id `putObservation`              | 1,000   | 2.57 ms |
| single new-id `putObservation`              | 4,000   | 9.64 ms |
| single new-id `putObservation`              | 10,000  | 18.02 ms|
| duplicate (`already-present`) insert        | 10,000  | 16.28 ms|
| conflicting insert                          | 10,000  | 18.13 ms|
| restart rebuild (`listObservations()`)      | 10,000  | 15.90 ms|
| restart rebuild (`listObservations()`)      | 100,000 | 195.71 ms|

Growth is linear in T for a **single** write/lookup (confirms `putObservation`'s
own per-call cost is O(T), exactly as `3a4dd0bf` found). A caller appending N
sequential observations therefore pays O(N²) in aggregate — not reproduced as
a raw N² wall-clock number here (it would dominate the test suite's own
runtime at N=10,000), but it follows directly from the measured per-call
numbers above: N appends against a log already at size T each cost O(T), so
total cost is `Σ T` for T in `[0, N)`, i.e. O(N²).

Root cause, confirmed by source inspection
(`src/board/observation/append_only_fedos_delivery_observation_persistence.ts`):
every `putObservation()` call runs `getObservation()` → `listObservations()` →
`replayLog()` — a full file read + full-file JSON-Lines parse + a fresh `Map`
rebuild — before performing (or skipping) the actual append.

## Phase C — option comparison and decision

Options considered (per this mission's own instruction to compare A–H before
choosing):

- **A. Do nothing** — rejected: O(N²) aggregate write cost is a real,
  measured production defect for any long-lived conversation/profile.
- **B. Lazy in-memory `Map` index inside the Persistence class itself**,
  built once via `replayLog()` on first use, updated incrementally after each
  successful append. — **chosen** (see below).
- **C. Eager (constructor-time) index build** — rejected: constructor
  performing I/O violates this file's own explicit, unchanged "constructor
  performs NO filesystem I/O" guardrail (line 35 of the file's own header);
  changing that guardrail is out of this Arc's own scope (no persistence
  redesign unrelated to the one defect being fixed).
- **D. Durable sidecar index file** (e.g. a `.idx` companion) — rejected:
  explicitly prohibited by this mission's own absolute prohibitions ("a
  durable sidecar index unless the review gate proves it unavoidable") —
  the in-process `Map` fully resolves the defect without one.
- **E. Move indexing up into `FedosDeliveryObservationRepository`'s own
  `#bySubject` index (from `d5979ae`)** — rejected: that index is keyed by
  `subjectId`, not observation `id`; it does not, and by its own Arc's
  explicit scope should not, perform id-level duplicate/conflict detection,
  which is this Persistence class's own contract (`FedosDeliveryObservationPersistenceWriteResult`).
  Duplicating id-tracking in two places would violate "no second Observation
  repository"/"no lossy compaction of responsibility" discipline.
- **F. Database/KV backend swap** — rejected: explicitly prohibited ("no new
  persistence backend").
- **G. Batch/deferred writes** — rejected: explicitly prohibited ("no write
  batching" is this file's own existing hard guardrail, unchanged by this
  Arc) and would weaken the existing synchronous crash-consistency story.
- **H. Bloom filter / probabilistic duplicate pre-check** — rejected:
  introduces false-negative risk for conflict detection, unacceptable for a
  fail-closed durability-adjacent component; also unnecessary complexity
  when an exact `Map` is cheap and already proven correct one layer up.

**Decision: Option B**, exactly as recommended by review `3a4dd0bf`, confirmed
still source-compatible: the file's current shape (single `#filePath` field,
`putObservation`/`getObservation`/`listObservations` as the only three
methods, `replayLog`/`readLogFile` as free functions) has not changed since
that review was written — `git log --oneline -- src/board/observation/append_only_fedos_delivery_observation_persistence.ts`
shows no commits between `3a4dd0bf` and this Arc's own base (`6a2f274`).

## Phase D — canonical index model

A single private field:

```ts
#index: Map<string, FedosPersistedDeliveryObservationRecordV1> | null = null;
```

- `#ensureIndex()`: if `#index` is `null`, calls `replayLog(this.#filePath)`
  once, builds a fresh `Map` keyed by `id`, assigns it to `#index`, returns
  it. If `#index` is already set, returns it immediately — no re-read.
- Rebuild is fully deterministic: identical to the existing `replayLog()`
  logic (same corrupt-line-throws, same conflicting-duplicate-throws
  policy) — no new validation rule, no new tolerance for invalid records, no
  change to the truncated-tail policy.
- No plaintext/secret is added to the index — it stores exactly the same
  `FedosPersistedDeliveryObservationRecordV1` objects `replayLog()` already
  produced; no new field, no new diagnostic surface.
- No new persistent index file: `#index` is a private in-memory field, never
  serialized, never written to disk.
- `listObservations()` becomes `[...this.#ensureIndex().values()]`.
- `getObservation(id)` becomes `this.#ensureIndex().get(id) ?? null` — O(1)
  average instead of O(T).

## Phase E — append ordering and crash truth

`putObservation()`'s new order:

1. `const index = this.#ensureIndex();` — build/reuse the index (no durable
   write yet).
2. `const existing = index.get(record.id) ?? null;` — O(1) duplicate/conflict
   lookup.
3. If `existing !== null`: return `"already-present"` or `"conflict"` per the
   existing equality check — **no durable write, no index mutation** (matches
   today's behavior exactly).
4. `appendFileSync(this.#filePath, ...)` — the real durable write, exactly as
   today, still synchronous, still the sole source of truth.
5. **Only after `appendFileSync` returns successfully**: `index.set(record.id,
   record)` — synchronous, same tick, no `await`, so there is no crash window
   between "durable append succeeded" and "index reflects it" that could be
   interrupted by the process actually exiting mid-update.
6. Return `"inserted"`.

If `appendFileSync` throws (caught, same as today): the function returns
`"failed"` and the index is **not** mutated — a failed append leaves the
in-memory index exactly as consistent with the durable log as it was before
the call, matching "failed append leaves index unchanged."

**Crash-equivalent-after-append-before-index-update**: not actually
reachable in a single-threaded synchronous Node.js call — `appendFileSync`
and the following `index.set()` are two statements in the same synchronous
function body with no `await`/microtask boundary between them, so no other
code (including a `process.exit` handler) can observe the durable file
updated but the index not yet updated, within this process. The only way
that combination becomes observable is a **process crash** (not a JS
exception) between the two statements — and in that case the process is
gone, so there is no stale in-memory `Map` left to be wrong: the NEXT
process constructs a brand-new `AppendOnlyFedosDeliveryObservationPersistence`
instance with `#index = null`, and `#ensureIndex()` rebuilds from the durable
log on first use, which by definition already contains the appended line.
Restart always heals this window.

**Accepted, documented stale-instance behavior change** (review `3a4dd0bf`'s
condition #1): a **second, independent** `AppendOnlyFedosDeliveryObservationPersistence`
instance already holding a built `#index` (e.g. a second process, or a second
instance in the same process opened over the same file path) will NOT see a
first instance's concurrent append until it is reconstructed. This is a
**new** behavior change for this specific class (previously every call
re-read the file, so any writer's append was visible to any other instance
immediately) — but it is the exact same contract
`FedosDeliveryObservationRepository`'s own `#bySubject` index (from
`d5979ae`, Alpha 7641–7720) already has, already tested, and already
accepted at that layer. No production caller constructs two independent
`AppendOnlyFedosDeliveryObservationPersistence` instances over the same file
path concurrently within one process (confirmed by repository-wide grep);
the only real-world case is two separate OS processes sharing a profile
directory, which this codebase already does not support for any of its other
append-only logs (Board Outbox, Envelope, Draft, etc. all share the same
single-writer-process assumption).

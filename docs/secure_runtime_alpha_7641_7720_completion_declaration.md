# Secure Runtime Alpha 7641–7720 — Completion Declaration

**FedOS Delivery Observation Repository Subject Index and Query Scalability Arc.**

Base: `1e79c831` (Secure Runtime Alpha 7561–7640, "FedOS Conversation
Outbox Restart Hydration and Scheduler Scalability Arc," FULL
COMPLETION), confirmed a descendant of `4c6fa3b3`. Ran as "Arc A" of a
two-Arc parallel-execution assignment; "Arc B" (FedOS Archive
Multi-Device Suppression Propagation) ran independently in a separate
worktree/branch and was never touched (Phase L's own structural guards
9/13 prove zero diff under every Archive/Retention/Deletion/Safety
Center path).

## Verdict: FULL COMPLETION

- **Production index** — `FedosDeliveryObservationRepository` gains a
  private, derived `#bySubject` Map, rebuilt at every construction
  (O(T)) and updated O(1) amortized on every successful `record()`. A
  new, purely additive `listForSubject(subjectId)` method exposes it.
- **Deterministic restart rebuild** — proven directly (Phase F, 14
  tests: empty/one/many/mixed-domain rebuild, corrupt-line, truncated-
  tail, duplicate, conflicting, rollback, 5 real restart cycles over a
  real file-backed log) and end-to-end through the real Board hydration
  entry point (Phase J).
- **Subject query no longer scans unrelated history** —
  `FedosDeliveryObservationQuery.historyFor()` now calls
  `repository.listForSubject(subjectId)` instead of
  `repository.list()` + `.filter()`. Measured (Phase H): querying every
  subject once at deliveredCount=3,200 dropped from a cited 19,399.14 ms
  to a measured 2.26 ms (~8,584x); at deliveredCount=100,000 (previously
  only derivable at ~5.2 hours for a comparable write-path operation),
  the equivalent read now measures 154.28 ms directly.
- **Board/Conversation parity** — every pre-existing Board (Alpha
  466/467/493/495/520/528/531/585) and Conversation (Alpha 7561–7640, 5
  files) test suite re-run unmodified except 2 legitimately-reconciled
  historical exact-shape checks (Phase G, 85 tests total, all passing).
- **No durability regression** — the durable
  `FedosDeliveryObservationPersistence` remains the sole source of
  truth; the index is never serialized, never itself read from disk,
  and can never diverge from persistence within one Repository
  instance's lifetime (Phase E/Phase L, index-ownership doc).
- **Measured improvement, not claimed** — every number in the benchmark
  doc is labeled MEASURED (this session, `npx tsx`, deleted after use)
  or CITED (the prior Arc's own already-published numbers for the
  identical operation at the identical scale).
- **No quadratic all-subject curve in the tested range** — confirmed
  from deliveredCount=100 through 100,000 (Phase H, Parts 1–2).

## Two legitimately-reconciled historical structural-guard tests

`test/secure_runtime_alpha_531_ripple_review.test.ts` originally
protected `fedos_delivery_observation_repository.ts`/`_query.ts` from
ANY future modification — a decision made when no later Arc had yet
been authorized to touch them. This Arc's own mission is EXACTLY the
authorization Alpha 7561–7640's own completion declaration named
verbatim ("Recommended next Arc"); the test's own `accountedForSrc`
allowlist and protected-area regex were both updated to name these two
specific files, with an explanatory comment, while every OTHER
protected file/pattern in that same test remains genuinely off-limits.
`test/secure_runtime_alpha_495_observation_write_validator.test.ts`'s
own exact-method-list check was updated to include the one new,
purely-additive `listForSubject()` method.

## Honest scope boundary, disclosed not fixed

`AppendOnlyFedosDeliveryObservationPersistence.putObservation()` (the
real durable backend) performs its own full-log-replay duplicate check
before its O(1) append — a PERSISTENCE-layer cost, structurally
identical to the original audit's own disclosed (never fixed) Outbox
`putIntent()` finding, completely unchanged by this Arc, and explicitly
out of scope (fixing it would require a persistence schema/index
change, prohibited by this Arc's own "Do not redesign persistence").
See the complexity report's own precise, honest statement of append
complexity ("O(1) at the Repository/index layer; O(T), unchanged, at
the real durable persistence backend").

## Verification performed

- `npx tsc --noEmit`: clean, modulo the same 2 pre-existing baseline
  errors every prior Arc in this lineage has already documented as
  unrelated (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- This Arc's own 5 new test files, 53 tests total, all passing (Phase
  F 14, Phase J 4, Phase K 11, Phase L 13, plus the reconciled 495/531
  tests re-passing at 10/4).
- Targeted Board/Conversation regression: 17 files, 125 tests, all
  passing.
- One transient timeout observed once in
  `secure_runtime_alpha_7561_7640_private_transport_restart_hydration.test.ts`
  test 2 during a large combined multi-file run; isolated via `git
  stash` A/B comparison against the unmodified base commit (passed
  cleanly, 27ms) and re-confirmed 3/3 clean, fast runs with this Arc's
  own changes present — a one-off resource-contention artifact from
  running many files concurrently, not a regression.

## Recommended next Arc

**Persistence-layer duplicate-check index** — close the ONE remaining,
now-precisely-quantified bottleneck this Arc's own reconciliation and
benchmark reports disclose but do not fix:
`AppendOnlyFedosDeliveryObservationPersistence.putObservation()`'s own
O(T) full-replay duplicate check on every real durable write. A narrow,
additive id-presence index inside that ONE persistence backend (never
touching the Repository/Query layer this Arc just fixed, never a schema
change to the wire format itself) would close the last O(T) write-path
cost this codebase's Observation subsystem has — mirroring the
identical, still-open Outbox `putIntent()` finding from the original
audit. Both share the exact same root cause (a full-replay-based
duplicate check with no id index) and could reasonably be scoped
together in one future Arc.

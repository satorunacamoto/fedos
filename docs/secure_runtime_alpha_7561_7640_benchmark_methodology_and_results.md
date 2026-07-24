# Secure Runtime Alpha 7561-7640 — Benchmark Methodology and Results

FedOS Conversation Outbox Restart Hydration and Scheduler Scalability Arc — Phase G
methodology note (results themselves are in
`secure_runtime_alpha_7561_7640_complexity_before_after.md`; this file documents exactly
how they were produced, for reproducibility).

## Methodology

- Tool: `npx tsx <script>.ts`, Node v24.15.0, this exact worktree/commit.
- Harness: a single, temporary, untracked TypeScript file
  (`__bench_7561_7640.ts`, later split into a second file
  `__bench_7561_7640_part3.ts` for an isolated, cheap measurement), written directly in the
  worktree root, run, then deleted — confirmed removed via `git status --short` showing no
  trace before this Arc's commit. This exact convention (real, run-once, deleted, never
  committed) mirrors the precedent already established by the prior audit (`212b842`).
- All classes measured are the REAL, unmodified-by-this-Arc production classes
  (`InMemoryFedosConversationTransportOutboxPersistence`, `FedosDeliveryObservationRepository`,
  `FedosDeliveryObservationQuery`, `FedosValidatingDeliveryObservationRepository`,
  `FedosDeliveryRetryQuery`) plus this Arc's own new
  `hydrateFedosConversationTransportDeliveryRecoveryState()` — never a stub/fake
  reimplementation of any measured class's own logic. The only intentionally-fake component
  anywhere in the benchmark is the Publisher (a trivial, zero-latency stub returning
  `{outcome:"delivered", retryPolicy:"never"}` immediately) — used ONLY in the first benchmark
  iteration to isolate Scheduler/Observation overhead from real network cost, and abandoned in
  the second iteration once the real bottleneck was found not to require it at all.
- Timing: `performance.now()`, wall-clock, single-run (not averaged across repeated trials) —
  appropriate given the measured effect sizes (up to 3 orders of magnitude) are far larger
  than any plausible single-run jitter, and given the session time budget did not allow
  multi-trial statistical averaging at the larger scales.
- In-memory backends were used throughout (not the real file-backed append-only backends) to
  isolate algorithmic complexity from disk I/O — the Phase I real vertical slice separately
  exercises the real, file-backed backends at small scale to confirm correctness (not
  performance) end-to-end.

## Why the originally-planned benchmark shape was abandoned mid-run

The Arc's own Phase G template specified measuring "first scheduler tick after restart" by
literally constructing a Scheduler and calling `tick()` against fixtures of 1,000/10,000/
100,000 total intents at four pending ratios. The FIRST benchmark run, executing exactly
this literal shape, revealed real, severe, previously-undocumented quadratic-time behavior
in the pre-existing (unmodified, shared with Board) `FedosDeliveryObservationQuery`/
`FedosDeliveryRetryQuery` machinery (see the complexity report's Part 1 root-cause
explanation) — a single T=10,000/1%-pending scenario's fixture-build step alone took
~139 seconds, and the literal T=100,000 scenarios were mathematically projected (from a
clean, 5-point measured curve) to take on the order of hours to tens of hours.

Rather than either (a) silently truncate the benchmark and under-report, or (b) burn the
remaining session budget attempting a run that would not complete, the benchmark was
redesigned mid-session into three separated parts (see the complexity report) that
each measure a genuinely different, honestly-labeled thing:
- Part 1 isolates and precisely characterizes the newly-discovered O(n²) hydration-read
  cost at small, fast, clean-signal scale (100-3,200), rather than trying to brute-force it
  at unreachable scale.
- Part 2 measures the ACTUAL named-defect metric (attempt count, BEFORE=T vs AFTER=P)
  directly and cheaply, since — once hydration's own correctness is independently proven
  (Part 1 + the unit/integration test suites) — the count relationship is a direct,
  measurable consequence of that correctness, not a separate thing requiring its own
  expensive re-execution at every scale.
- Part 3 isolates the (unaffected, genuinely cheap) Outbox-persistence-layer cost alone, at
  the full T=100,000 scale the Arc's own template asked for, to positively confirm that
  layer is NOT a scalability risk (ruling out the specific concern Phase H's own template
  was written to guard against).

This is disclosed here in detail because the change in benchmark shape is itself
evidence-bearing: it is the direct, honest record of how a real, unplanned finding was
discovered and handled, consistent with this Arc's own "Fail Closed over fabrication"
instruction.

## Reproducing these results

The exact scripts are not committed (per the established convention). To reproduce:
1. Recreate a script matching the shapes described in the complexity report's Parts 1-3
   (each is a straightforward, ~30-80 line script directly instantiating the classes named
   above).
2. Run via `npx tsx <script>.ts` from this worktree's root (requires `node_modules` —
   either `npm install` or a junction from a sibling worktree at the same dependency
   versions, as this session did).
3. Delete the script afterward; confirm via `git status --short` it left no trace.

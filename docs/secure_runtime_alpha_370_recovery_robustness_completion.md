# Secure Runtime Alpha 370 — Board Recovery & Host Robustness Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
361–370 Board Recovery & Host Robustness Arc.**

## 1. Why now

Alpha 361 inventoried every known Host/persistence failure path and
reproduced the one confirmed gap. Alpha 362 fixed the intended policy
that gap falls short of. Alpha 363 classified every corruption shape
into a complete taxonomy. Alpha 364 designed (without implementing) a
salvage recovery strategy. Alpha 365 reviewed append-path integrity
beyond what prior Arcs found, confirming two properties safe and
naming one design constraint for future re-review. Alpha 366 designed
(without implementing) a compaction architecture, finding compaction
is not yet even justified by real data need. Alpha 367 verified
`FedosDesktopHost` itself across multiple real restart cycles. Alpha
368 verified correctness at 1,000 records and precisely characterized
the already-known O(N²) cost shape. Alpha 369 reviewed `fsync`
in depth, confirming it is addable but should not be added yet. This
Stage answers this Arc's own Special Focus question and freezes every
finding.

## 2. Special Focus, answered: is the hydration-exception gap a true architectural defect?

**Yes.** Reasoning, drawing on Alpha 361/362 directly:

- It is REACHABLE with real, non-contrived inputs (a crash-truncated
  append-only log — not a hypothetical).
- It produces OBSERVABLY INCORRECT state: `FedosDesktopHostState`'s
  own Alpha 333 design requires `starting → failed` as an
  unconditional transition on any startup failure; the current
  implementation only honors it for ONE of the two ways a startup
  failure can be signaled (a returned outcome, never a thrown
  exception).
- It is ARCHITECTURAL, not incidental: the root cause is a mismatched
  ASSUMPTION between `FedosDesktopHost.start()` (which assumes
  hydration failure is always communicated by return value) and both
  `FedosBoardPersistence` (Alpha 315, which never promised its methods
  would not throw) and `hydrateFedosBoardService` (Alpha 318, which
  never wraps the persistence call it delegates to) — not a
  typo or an off-by-one error local to one line.
- It was INVISIBLE, not merely unnoticed, before a real throwing
  backend existed — confirming this is a genuine architectural gap
  that only THIS Arc's own predecessor could have exposed, not a
  regression this Arc introduced or could have caught earlier.

## 3. The minimal future fix, documented, NOT implemented

Per this Arc's own instruction ("DO NOT change the public API in this
Arc"), the following is a DESIGN SKETCH only — no file in this Arc's
own diff implements it:

```
async start(): Promise<void> {
  if (this.#state !== "constructed") { throw ...; }
  this.#state = "starting";

  let hydration;
  try {
    hydration = hydrateFedosBoardService(this.#boardPersistence);
  } catch (err) {
    this.#state = "failed";
    throw err;
  }
  if (hydration.outcome !== "hydrated" || hydration.service === null) {
    this.#state = "failed";
    throw new Error(...);
  }

  // ... unchanged: DesktopApplication.start(), #boardService assignment, "ready"
}
```

**Exactly one new `try`/`catch` block, wrapping exactly the
`hydrateFedosBoardService(...)` call.** No new state token, no new
public method, no change to `start()`'s own `Promise<void>` signature,
no change to any other branch. This satisfies Alpha 362's own policy
completely: BOTH failure-signaling shapes now produce identical
observable behavior (`state() === "failed"`, `start()` rejects).
**Confirmed, by design, to change ZERO currently-passing test's own
expected outcome** — every existing test that exercises the
`"hydrated"` path, the `DesktopApplication.start()` rejection path, or
the returned-outcome hydration-failure path observes IDENTICAL
behavior before and after this sketch; only the previously-untested
thrown-exception path changes, from `"starting"` to `"failed"`.

## 4. A second finding, confirmed by Alpha 367's own execution: `board()` writes are not durable

Beyond the Special Focus (§2/§3), this Arc's own Alpha 367 (Host
Restart Verification) confirmed, by direct execution, a
previously-undocumented architectural fact: `FedosDesktopHost.board()`
(Alpha 336) returns the `FedosBoardService` `hydrateFedosBoardService`
constructs at `start()` time using its own fully-defaulted, IN-MEMORY
constructor (`new FedosBoardService()`, Alpha 307) — never a
`PersistedFedosBoardRepository` (Alpha 317). A `registerPost()` call
made through `host.board()` therefore mutates ONLY that in-memory
service; it is NEVER written back to `FedosBoardPersistence`, and is
lost the moment the Host instance is discarded. Durable writes must go
through `FedosBoardPersistence.putPost()` directly — a fact this Arc's
own restart tests depend on and now document explicitly for the first
time (Alpha 367 §2a). **This is not treated as a defect** — no prior
Stage (Alpha 332–337) ever specified ongoing write-through as a Host
responsibility, only hydration — but it is a real, previously-implicit
gap between what a caller might reasonably ASSUME `board().registerPost()`
does and what it actually does, worth closing the documentation gap on
even though no code changes as a result.

## 5. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.** Recovery,
corruption handling, host robustness, and durability guarantees are
now formally DEFINED — inventoried (Alpha 361), policy-fixed (Alpha
362), classified (Alpha 363), strategized (Alpha 364), integrity- and
compaction-reviewed (Alpha 365/366), restart- and scale-verified
(Alpha 367/368), and durability-reviewed (Alpha 369) — exactly as this
Arc's own Goal states, with NO new storage format, EVERY public
interface preserved, and the current `AppendOnlyFedosBoardPersistence`
format preserved exactly, confirmed by direct inspection and by this
Arc's own regression tests.

## 6. Remaining limitations, named explicitly

- **The Host hydration-exception gap (§2/§3) remains UNFIXED** — by
  this Arc's own explicit instruction, not by oversight. It is now the
  most precisely documented, most ready-to-implement item this Arc
  leaves behind.
- **`board()` writes are not durable (§4)** — a documentation gap, not
  a code defect; any future caller relying on `board().registerPost()`
  for persistence must instead write through `FedosBoardPersistence`
  directly.
- **No `fsync`** — reviewed in depth (Alpha 369), confirmed
  technically addable, deliberately not added.
- **No compaction** — reviewed and designed (Alpha 366), confirmed not
  yet justified by real data need (nothing is ever superseded in the
  current format).
- **No recovery tool** — designed (Alpha 364), not implemented.
- **No concurrent-writer support** — unchanged; a same-process race is
  confirmed unreachable today (Alpha 365 §2), a multi-process race
  remains explicitly out of scope.
- **No filesystem path resolution, no Host wiring** — unchanged from
  Alpha 360; still gated on Alpha 338 §5's own open configuration
  question.

## 7. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- GUI, Relay changes, Protocol Adapter changes, Ontology integration,
  SQLite, D1, IndexedDB — no reference anywhere in this Arc's own
  code.
- New dependency of any kind — `package.json`'s `dependencies` count
  stays fixed at 2; no `Cargo.toml` change of any kind.
- Any new storage format — the JSON Lines record format (Alpha 352)
  is byte-for-byte unchanged; confirmed by this Arc's own regression
  tests against the actual `append_only_fedos_board_persistence.ts`
  source.
- Any public interface change — `FedosBoardPersistence`,
  `FedosDesktopHost`, `FedosDesktopHostState`, and
  `AppendOnlyFedosBoardPersistence` all carry zero diff from this Arc.

## 8. Next Arc recommendation

**Secure Runtime Alpha 371–380: FedosDesktopHost Hydration Exception
Handling Arc.**

Reason: this Arc's own Special Focus produced a precisely-scoped,
minimal, non-interface-breaking fix (§3) ready for implementation —
the most concrete, actionable, and lowest-risk piece of unfinished
work this Arc leaves behind, directly addressing the one confirmed
architectural defect this whole Arc exists to investigate. Compaction
and recovery-tool implementation (Alpha 364/366) remain reasonable
future candidates but are explicitly LOWER priority: compaction has no
real data-need justification yet (§6), and a recovery tool addresses a
narrower, less architecturally significant gap than the Host's own
state-reporting correctness.

## 9. See also

- `docs/secure_runtime_alpha_369_durability_fsync_review.md`
- `docs/secure_runtime_alpha_368_large_dataset_scalability_review.md`
- `docs/secure_runtime_alpha_367_host_restart_verification.md`
- `docs/secure_runtime_alpha_366_compaction_architecture_review.md`
- `docs/secure_runtime_alpha_365_append_integrity_review.md`
- `docs/secure_runtime_alpha_364_recovery_strategy.md`
- `docs/secure_runtime_alpha_363_corruption_classification.md`
- `docs/secure_runtime_alpha_362_hydration_failure_policy.md`
- `docs/secure_runtime_alpha_361_host_failure_inventory.md`
- `docs/secure_runtime_alpha_360_append_only_backend_completion.md`

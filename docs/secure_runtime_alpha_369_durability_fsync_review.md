# Secure Runtime Alpha 369 — Durability & fsync Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind. `fsync` is NOT added anywhere in this Arc.** Stage 9 of the
Alpha 361–370 Board Recovery & Host Robustness Arc.

## 1. Why now

Alpha 352 §3 (Arc 351–360) disclosed the no-`fsync` limitation but did
not review it in technical depth, nor consider whether it could ever
be added without violating this Arc's own — and the prior Arc's own —
constraints. This Stage does that deeper review, still without
implementing anything.

## 2. Could `fsync` be added without a new dependency?

**Yes, technically** — `node:fs` exposes `fsyncSync(fd)`, reachable
the same untyped way every other `node:fs` function this class already
uses is reached (Alpha 353). No new dependency would be required.

## 3. Could `fsync` be added without changing the current record format?

**Yes** — `fsync` is a DURABILITY property of an existing write, not a
format concern; adding it would not touch the JSON Lines shape (Alpha
352 §1) at all, satisfying this Arc's own "preserve the current format
exactly" requirement trivially.

## 4. Could `fsync` be added without changing `FedosBoardPersistence`'s own public interface?

**Yes** — `putPost()`'s own signature (`(record) =>
FedosBoardPersistenceWriteResult`) would not need to change; an
`fsync` call would be purely internal to `AppendOnlyFedosBoardPersistence`'s
own `putPost()` body.

## 5. So why is it still not implemented in this Arc?

Even though all three constraints above are satisfiable, this Stage
does NOT recommend adding `fsync` THIS Arc, for reasons independent of
those constraints:

- **It would change OBSERVABLE PERFORMANCE behavior** — every
  `putPost()` call that writes would newly block on a physical disk
  flush, a real latency cost with no test in this repository currently
  measuring or budgeting for it. Introducing that silently, inside a
  "robustness review" Arc whose own instruction says "strengthens the
  existing implementation" (not "changes its performance profile"),
  would be a larger, separately-motivated change than this Arc's own
  scope implies.
- **The exact implementation shape is itself an undecided design
  question.** Whether `appendFileSync` followed by a separate
  `fsyncSync(fd)` call requires re-opening the file with `openSync` to
  obtain a file descriptor (since `appendFileSync` with a path
  argument opens and closes its own internal descriptor per call) is a
  real implementation-shape DECISION this Stage does not make, since
  making it would mean writing code, which this Stage's own status
  explicitly forbids.
- **No real, demonstrated requirement calls for it yet** — matching
  every other capability this repository's own Arcs have consistently
  refused to build ahead of a real, evidenced need (Alpha 322
  §"NOT YET", Alpha 329 §2's own "no speculative shell" discipline,
  restated identically here).
- **The exact durability/latency TRADE-OFF an operator would want is
  not yet decided** — should `fsync` be unconditional (every write
  pays the cost), or OPT-IN (a future constructor parameter, itself a
  real API-shape decision this Stage does not make)? This Stage names
  the question; it does not answer it.

## 6. What durability IS already guaranteed, restated precisely

- Every record that `appendFileSync` returns successfully from is
  guaranteed durable against a PROCESS crash (the OS retains it
  independent of the crashed process) — this is the SAME guarantee
  Alpha 345 §4 already established generally for a Host crash, now
  re-confirmed specifically for THIS backend's own write mechanism.
- Only a true POWER-LOSS event (not a process crash, not an unhandled
  exception, not a `SIGKILL`) can lose the LAST few seconds of writes
  that the OS itself had not yet flushed to physical storage — a
  narrower, more precisely-scoped risk than "any crash," which this
  Stage's own review makes explicit for the first time.

## 7. Conclusion

Adding `fsync` is technically possible without violating any of this
Arc's own hard constraints (no new dependency, no format change, no
interface change) — but is deliberately NOT added, because doing so
would introduce an unreviewed performance/API-shape decision this
Stage's own REVIEW ONLY status is not positioned to make. The
narrower, more precise durability guarantee this Stage confirms
(safe against process crash; not yet safe against true power loss) is
recorded as the accurate current state, superseding Alpha 352 §3's own
less precise framing.

## 8. See also

- `docs/secure_runtime_alpha_352_append_only_record_format.md`
- `docs/secure_runtime_alpha_345_crash_recovery_review.md`
- `docs/secure_runtime_alpha_353_append_only_persistence_implementation.md`
- `docs/secure_runtime_alpha_366_compaction_architecture_review.md`

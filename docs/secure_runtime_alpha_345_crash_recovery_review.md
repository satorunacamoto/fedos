# Secure Runtime Alpha 345 — Crash Recovery Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 5 of the Alpha 341–350 Board Durable Backend
Re-evaluation & Local Backend Selection Arc. Compares how SQLite
(Alpha 343) and append-only (Alpha 344) each tolerate the same five
failure cases.

## 1. Power loss

- **SQLite (WAL mode):** the WAL is either fully applied or fully
  discarded on next open — the main database file is NEVER left in a
  partially-written state. Power loss mid-write is, by design, the
  case WAL mode exists to handle.
- **Append-only:** the OS-level `write()` for the in-flight record may
  itself be partial (a partial line at the tail of the file) — but
  EVERY record before it remains intact, byte-for-byte, because each
  `putPost` call is a single, independent append. Power loss can
  produce AT MOST one trailing partial record, never corrupt an
  already-committed one.

**Comparison:** SQLite tolerates this with zero special-case code
(the engine already handles it). Append-only tolerates it too, but
requires the hydration/deserialization path to recognize "trailing
partial line" as a DIFFERENT case from "structurally invalid complete
record" (Alpha 344 §4) — currently, `hydrateFedosBoardService` treats
ANY corrupt record identically (`"rejected-corrupt-record"`, whole
Board voided). A naive append-only implementation that fed a
crash-truncated tail line through the SAME `deserializeFedosBoardPost`
check unmodified would therefore void the ENTIRE Board on every
unclean shutdown — a real design gap this Stage names explicitly, not
a solved problem.

## 2. Partial write

Same analysis as §1 at the single-record granularity — SQLite's
transaction boundary already IS the record boundary it protects;
append-only's record boundary (one `putPost` = one line) is naturally
aligned with what a partial write can damage, but the DETECTION of "is
this a partial write or a corrupt complete record" is not automatic
the way SQLite's WAL check is.

## 3. Duplicate replay

Both backends handle this identically, and CORRECTLY, using the SAME
existing port semantics — no new logic required:

- `FedosBoardPersistence.putPost()`'s own `"already-present"` outcome
  (Alpha 315) is defined EXACTLY for this case: writing the same `id`
  with a STRUCTURALLY IDENTICAL record a second time is a safe no-op,
  detected via `fedosPersistedBoardPostRecordsAreEqual` (Alpha 315).
- A durable backend replaying an already-durable write after a crash
  (e.g. a caller retries a `putPost` call it is unsure completed)
  produces the SAME `"already-present"` outcome regardless of backend
  — this is a PORT-level guarantee (Alpha 342 §2), not something
  either backend must reimplement.

## 4. Host crash

`FedosDesktopHost` itself has no crash-specific behavior today —
`stop()` is never called on an unclean exit, by definition (Alpha 341
§2.6). For BOTH backends, the durable state on disk reflects whatever
was durably committed before the crash — SQLite via WAL, append-only
via completed `write()` calls — and the NEXT `FedosDesktopHost.start()`
call re-hydrates from that state exactly as a clean restart would
(Alpha 335, UNCHANGED). Neither backend requires the Host itself to
detect or react to its own prior crash — recovery is entirely a
property of the PERSISTENCE layer being read fresh on the next
`start()`, not of any Host-level crash-detection logic.

## 5. Unexpected shutdown

Distinct from a hard crash: `SIGTERM`/`SIGKILL`/window-close style
termination, still without `stop()` ever running (Alpha 338 §5 names
signal handling as explicitly out of THIS Arc's own scope, and out of
Alpha 331–340's). Both backends behave identically to §4 — the last
durably-committed state is what the next `start()` sees. The
difference between "unexpected shutdown" and "power loss" (§1) is
operationally irrelevant to either backend, since neither backend
today has any in-flight, not-yet-durable buffered state to lose (no
write buffering/batching exists in either design as reviewed).

## 6. Which backend naturally tolerates these cases better?

**SQLite, without qualification.** Every one of the five cases is
either already handled by the engine (WAL) or reduces to a case the
engine already handles. **Append-only tolerates four of the five
cases (§2–§5) via the port's own existing semantics or its own
naturally-aligned append-boundary — but §1/§2's shared open problem
(distinguishing a trailing partial write from a genuinely corrupt
complete record) is real, unsolved, and must be designed before an
append-only backend can be considered PRODUCTION-safe against power
loss specifically.** This is the single most important finding this
Stage contributes to Alpha 349's own selection: append-only is not
"as safe as SQLite" out of the box — it is "as safe as SQLite, once
one additional, well-scoped design problem is solved."

## 7. Conclusion

Crash tolerance favors SQLite on raw engineering maturity, but the gap
is narrow and well-understood: append-only needs exactly one
additional design decision (how to distinguish a trailing partial
write from genuine corruption) before it matches SQLite's own
power-loss guarantee. Every other failure case reviewed here is
already handled equally well by both, via the persistence PORT's own
existing, backend-independent semantics (Alpha 342).

## 8. See also

- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_343_sqlite_review.md`
- `docs/secure_runtime_alpha_342_current_persistence_review.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`

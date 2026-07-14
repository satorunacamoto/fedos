# Secure Runtime Alpha 344 — Append-only File Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind, and implements NO append-only backend.** Stage 4 of the Alpha
341–350 Board Durable Backend Re-evaluation & Local Backend Selection
Arc. Re-examines Alpha 326's own prior review under the new fact that
a real Host caller now exists (Alpha 341).

## 1. Implementation complexity

Low, relative to SQLite (Alpha 343). A conforming
`FedosBoardPersistence` needs: an in-process index (`Map<id, record>`,
mirroring `InMemoryFedosBoardPersistence`'s own Alpha 316 shape
exactly) for `getPost`/`listPosts`, PLUS one additional durable-write
step inside `putPost` — appending the SAME
`FedosPersistedBoardPostRecordV1` a caller already holds to a local
file, using ONLY Node APIs already reachable without a new dependency
(Alpha 331 §3.8, re-confirmed unchanged: no `@types/node`, but
`node:fs` is reachable the same untyped way
`fedos_windows_dpapi_helper.ts` already reaches `node:child_process`).
No schema, no query planner, no migration runner — the entire
"database" is a linear log plus the SAME hydration pass
(`hydrateFedosBoardService`, Alpha 318, UNMODIFIED) already used to
rebuild `FedosBoardService` from ANY backend's `listPosts()`.

## 2. Recovery

On process start, the backend reads its own log top-to-bottom,
reconstructing the SAME in-process `Map` `InMemoryFedosBoardPersistence`
already holds — recovery is not a special mode, it is simply "run the
constructor before anything else calls `putPost`." This is a strictly
SIMPLER recovery story than SQLite's own WAL-replay-on-open (Alpha 343
§4), because there is only ever one code path (sequential read), never
two (WAL replay vs. clean open).

## 3. Replay

`hydrateFedosBoardService` already performs a full "replay" of
whatever `listPosts()` returns, independent of insertion order (Alpha
318 §"Deterministic, order-independent hydration: posts are sorted by
`id` before registration"). An append-only backend's own on-disk
ORDER is therefore irrelevant to Board-level correctness — this
Stage's own log format could even append out of causal order (e.g. a
reply appended before its root, from a future out-of-order sync path)
without breaking hydration, since `hydrateFedosBoardService`'s own
bounded topological pass already handles exactly that case.

## 4. Corruption

Two distinct corruption shapes, requiring different handling:

- **A structurally invalid but COMPLETE record** (e.g. a hand-edited
  file, or a future schema mismatch) — already handled identically to
  every other backend: `deserializeFedosBoardPost` (Alpha 314) returns
  `null`, and `hydrateFedosBoardService` voids the WHOLE hydration
  (`"rejected-corrupt-record"`), fail closed, exactly as it does for
  `InMemoryFedosBoardPersistence` today.
- **A trailing, INCOMPLETE record from a mid-write crash** — a
  genuinely NEW corruption shape no existing backend can produce
  (`InMemoryFedosBoardPersistence` has no partial-write concept at
  all). This is NOT the same as a structurally-invalid-but-complete
  record, and treating the two identically — voiding the entire Board
  because the LAST line of the log happens to be a half-written
  crash artifact — would be a real usability regression relative to
  SQLite's own WAL-replay behavior (Alpha 343 §4). See Alpha 345 for
  the full crash-recovery comparison this distinction requires.

## 5. Truncation

Not required for a first implementation — no existing requirement
(Alpha 322) calls for shrinking the log; a first backend may simply
grow unboundedly, deferring truncation to whatever future compaction
strategy (§6) is eventually built.

## 6. Compaction

A REAL, currently-unsolved problem this Stage names but does not
solve: every `putPost` call — including a re-write of an
ALREADY-PRESENT post (Alpha 315's own `"already-present"` outcome) —
would, under a naive "always append" implementation, add ANOTHER copy
of that record to the log, growing it unboundedly even with zero new
Board content. A correct implementation needs periodic compaction
(rewrite the log keeping only the latest/canonical copy of each `id`)
— explicitly named here as required future design work, not solved by
this Stage or claimed to be simple.

## 7. Migration

Trivial, by construction: `listPosts()` already returns every record
in a fully backend-neutral shape (Alpha 342 §2) — migrating OUT of an
append-only backend into any other `FedosBoardPersistence`
implementation is "call `listPosts()` on the old one, call `putPost()`
for each record on the new one," using ONLY the existing port, no
custom export/import tooling. See Alpha 346 for the full migration
strategy this enables.

## 8. Scalability

Startup cost is O(n) in total post count (a full sequential read to
rebuild the in-process index) — worse than SQLite's own indexed
lookups at large scale, but adequate for a single-user local Board
with no concurrent-writer requirement (Alpha 322 §"NOT YET":
"concurrent writers" explicitly excluded from this repository's own
requirement set). This is a real, accepted tradeoff for a FIRST
backend, not a permanent architectural ceiling — Alpha 346's own
migration path exists precisely so this tradeoff can be revisited
later without redesigning the port.

## 9. Conclusion

Append-only is the lowest-complexity, zero-new-dependency candidate
reviewed in this Arc, with trivial migration and a recovery story
strictly simpler than SQLite's. Its one genuinely open design problem
— distinguishing a trailing partial-write crash artifact from a
structurally-corrupt complete record (§4), and eventual compaction
(§6) — is real, bounded, and explicitly deferred to the next Arc
(Alpha 350 §5), not hidden or claimed already solved.

## 10. See also

- `docs/secure_runtime_alpha_343_sqlite_review.md`
- `docs/secure_runtime_alpha_326_append_only_backend_review.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`

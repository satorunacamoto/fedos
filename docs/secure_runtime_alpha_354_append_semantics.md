# Secure Runtime Alpha 354 — Append Semantics

**Status: this Stage implements code.** Stage 4 of the Alpha 351–360
Append-only Durable Board Backend Arc. Fixes `putPost()`'s own write
behavior on `AppendOnlyFedosBoardPersistence`
(`src/board/persistence/append_only_fedos_board_persistence.ts`,
Alpha 353).

## 1. Required properties

`putPost()` must: append only, never rewrite, never truncate, never
reorder. Implemented as:

```ts
putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult {
  const existing = this.getPost(record.id);
  if (existing !== null) {
    return fedosPersistedBoardPostRecordsAreEqual(existing, record) ? "already-present" : "conflict";
  }
  try {
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
  } catch {
    return "failed";
  }
  return "inserted";
}
```

## 2. Never rewrite / never truncate / never reorder — how each is satisfied

- **Never rewrite:** the ONLY filesystem write call in this entire
  file is `appendFileSync` — no `writeFileSync` (which would replace
  the file's contents), no `fs.open(..., "r+")` seek-and-overwrite, no
  in-place byte mutation of any kind, anywhere in this class.
  `appendFileSync` opens with `O_APPEND` semantics — the OS itself
  guarantees the write lands at the CURRENT end of file, never
  overwriting an earlier byte.
- **Never truncate:** no `truncateSync`/`ftruncateSync`/`O_TRUNC` flag
  of any kind appears anywhere in this file. A record, once
  successfully appended, is never removed from the file by this class
  — there is no `deletePost`/compaction method (Alpha 315's own
  frozen port has no `delete` at all; compaction remains explicitly
  future work, named in Alpha 360 §"remaining limitations").
- **Never reorder:** records are written in the EXACT order
  `putPost()` is called, and `appendFileSync` never reorders bytes
  relative to prior writes — on-disk order is therefore call order,
  always. (Replay itself, Alpha 355, does not depend on this fact —
  `hydrateFedosBoardService`'s own sort-by-`id` pass, Alpha 318,
  already makes Board-level correctness independent of on-disk order —
  but the append log's own physical order is still never disturbed.)

## 3. Writing only on a genuine insert

`putPost()` writes to disk ONLY on the `"inserted"` path — an
`"already-present"` or `"conflict"` outcome returns its token WITHOUT
touching the filesystem at all, mirroring
`InMemoryFedosBoardPersistence`'s own identical behavior on those two
outcomes (Alpha 316: a `Map.get`/comparison only, no mutation). This
keeps the log free of redundant duplicate lines for every write THIS
class itself performs — a duplicate line can only ever originate from
something OTHER than this class's own `putPost()` (e.g. a hand-edited
file, or a future concurrent-writer scenario explicitly out of this
Arc's own scope) — see Alpha 356/357 for how replay handles that case
if it ever occurs.

## 4. Existing-record lookup reuses `getPost()`, not a separate scan

`putPost()`'s own pre-write check calls `this.getPost(record.id)` —
the SAME method Alpha 355 implements for ordinary reads — rather than
a second, bespoke lookup implementation. This guarantees the
insert-vs-already-present-vs-conflict decision is made against the
EXACT same replayed, deduplicated view of the log that any other
caller would see calling `getPost()` directly — no possibility of the
write path and the read path silently disagreeing about current state.

## 5. Conclusion

`putPost()` satisfies all four required properties by construction —
a single `appendFileSync` call is the only way this class ever
modifies the log file, reached only on a genuine new insert, using the
same replay-based lookup the read path itself uses.

## 6. See also

- `docs/secure_runtime_alpha_353_append_only_persistence_implementation.md`
- `docs/secure_runtime_alpha_352_append_only_record_format.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`

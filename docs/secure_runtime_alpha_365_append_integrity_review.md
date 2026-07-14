# Secure Runtime Alpha 365 — Append Integrity Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 5 of the Alpha 361–370 Board Recovery & Host Robustness
Arc. Reviews the CURRENT `AppendOnlyFedosBoardPersistence` write path
for integrity gaps beyond what Alpha 352/354/357 already found.

## 1. Embedded control characters in `body` — reviewed, confirmed safe

A `FedosBoardPost.body` may contain ANY valid string content,
including a literal newline (`\n`), carriage return (`\r`), or other
control character (Alpha 257's own validation caps LENGTH, never
CONTENT beyond that). Since the record format is one JSON object per
`\n`-terminated line (Alpha 352), an embedded literal newline inside
`body` would be catastrophic IF it appeared unescaped — it would split
one logical record into two physical lines, corrupting the log.

**Confirmed safe: `JSON.stringify()` NEVER emits a literal control
character inside a string value.** Per the JSON specification (RFC
8259 §7) and `JSON.stringify`'s own behavior, every control character
inside a string — `\n`, `\r`, `\t`, and others — is escaped as a
two-or-more-character sequence (`\n` becomes the two characters
backslash+`n`, never a raw `0x0A` byte) inside the emitted JSON text.
This Stage's own test suite verifies this directly: a post whose body
contains real newline/carriage-return/tab characters round-trips
through `AppendOnlyFedosBoardPersistence` with the body content fully
intact, and the log file's own line count is unaffected by the
content of any single record.

## 2. Same-process concurrent-write race — reviewed, named, not fixed

`putPost()`'s own implementation (Alpha 354) performs a
READ-THEN-WRITE sequence: `this.getPost(record.id)` (a full replay),
THEN, conditionally, `appendFileSync`. If TWO `putPost()` calls for
DIFFERENT `id`s were ever issued concurrently within the SAME process
— which cannot happen today, since every call site in this
repository's own test suite and every production caller invokes
`putPost()` synchronously to completion before the next call begins
(this method is fully synchronous, not `async`, so JavaScript's own
single-threaded execution model already serializes any two calls
made from the same synchronous or `await`-sequenced caller) — no race
is actually reachable from within a single process today.

A genuine TOCTOU (time-of-check-to-time-of-use) race would require
either a second, INDEPENDENT process writing to the SAME file
concurrently (explicitly out of scope — Alpha 322 §"NOT YET":
"concurrent writers"), or a hypothetical future ASYNC version of this
class (which does not exist — `AppendOnlyFedosBoardPersistence`
implements `FedosBoardPersistence`'s own synchronous contract exactly,
Alpha 315). **Named here as a design constraint that must be
re-reviewed if this class is ever made `async`, or if multi-process
writing is ever required — not a defect in the current, synchronous,
single-process implementation.**

## 3. Line-splitting robustness — reviewed, confirmed safe

`replayLog()`'s own `contents.split("\n")` followed by
`.trim().length === 0` filtering (Alpha 355) correctly handles: a
file with no trailing newline (the last line is still parsed, since
`split` never drops content), a file with MULTIPLE trailing newlines
(every extra blank entry is filtered, none is mistaken for a
corrupt record), and a file using ONLY `\n` line endings (Alpha 352 §1
— this class never emits `\r\n`, and `\r` immediately before a
legitimate `\n` is valid, ignorable JSON whitespace even if it were
ever present from an external source).

## 4. `id` collision across records with different `boardId` — reviewed, confirmed out of scope for this class

`FedosPersistedBoardPostRecordV1.id` is GLOBALLY unique by convention
(Alpha 255's own `FedosBoardPostId` branding), never scoped per-board
at the persistence layer. `AppendOnlyFedosBoardPersistence`'s own
replay/dedup logic (Alpha 357) keys SOLELY on `id`, matching
`InMemoryFedosBoardPersistence`'s own identical, unmodified behavior
(Alpha 316) — this is existing, frozen, cross-Arc behavior, not
something this Stage's own review found lacking.

## 5. Conclusion

Two integrity properties are newly, explicitly confirmed safe this
Stage (embedded control characters; line-splitting robustness under
various trailing-newline shapes) — both previously implicit, now
verified directly by test. One design constraint is named for future
re-review (same-process concurrency, currently unreachable, would need
re-review only if this class is ever made `async` or multi-writer).
Nothing in this Stage's own review found a NEW integrity gap requiring
a code change.

## 6. See also

- `docs/secure_runtime_alpha_363_corruption_classification.md`
- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_354_append_semantics.md`
- `docs/secure_runtime_alpha_352_append_only_record_format.md`

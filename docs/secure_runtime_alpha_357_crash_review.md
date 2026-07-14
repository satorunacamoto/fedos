# Secure Runtime Alpha 357 — Crash Review

**Status: this Stage verifies existing Alpha 353/355 behavior against
five named cases; no new production logic beyond what those Stages
already ship.** Stage 7 of the Alpha 351–360 Append-only Durable
Board Backend Arc. **Fail closed. Never repair automatically.**

## 1. Empty file

`listPosts()` on a missing or zero-byte file returns `[]`. NOT
corruption — a fresh, never-written log is the expected initial state
of every new `AppendOnlyFedosBoardPersistence`. `readLogFile()`
catches exactly `ENOENT` and returns `""`; splitting `""` on `\n`
yields `[""]`, and the single blank entry is filtered before any
`JSON.parse` is attempted.

## 2. Duplicate append

Two lines sharing the same `id`, with STRUCTURALLY IDENTICAL content
(`fedosPersistedBoardPostRecordsAreEqual`, Alpha 315) — collapse to
ONE record during replay. This is not repair: it is the exact same
idempotency guarantee the port itself already defines as correct
(`"already-present"`, Alpha 315 §"the same `id` was written again with
a STRUCTURALLY IDENTICAL record — idempotent, no mutation occurred").
Under NORMAL operation via THIS class's own `putPost()` (Alpha 354),
this case can never arise from the class's own writes (an
already-present write never re-appends) — it is reachable only via an
externally-modified file, which this Stage's own test suite
constructs directly to verify the behavior regardless of origin.

## 3. Truncated trailing line

A non-empty final line that fails `JSON.parse` — this Stage's own
Decision (carried from the design work in Alpha 352 §2): **treated
IDENTICALLY to malformed JSON anywhere else in the file (§4)**, with
NO special-casing of "trailing" versus "mid-file." `listPosts()`/
`getPost()` THROW. This is the explicit resolution of the "unsolved
design gap" Alpha 345 §6 named two Arcs ago: rather than build a
heuristic to guess "this is probably just a crash artifact, safe to
drop," which would itself be an automatic repair decision this
Stage's own instruction forbids, the fail-closed behavior is uniform
and unconditional.

## 4. Malformed JSON

Any non-empty line that fails `JSON.parse`, anywhere in the file —
`listPosts()`/`getPost()` THROW, with the exception propagating
unmodified to the caller. No line is ever skipped, no attempt is made
to recover a partial value from a malformed line.

## 5. Unknown schema version

`JSON.parse` SUCCEEDS (the line is syntactically valid JSON); the
resulting value is returned as a raw `FedosPersistedBoardPostRecordV1`
WITHOUT this file validating its own `schemaVersion` field — that
validation is explicitly not this layer's job (Alpha 315/317's own
established layering). `deserializeFedosBoardPost` (Alpha 314,
UNMODIFIED) rejects an unrecognized `schemaVersion` one layer up, and
`hydrateFedosBoardService` (Alpha 318, UNMODIFIED) voids the whole
hydration (`"rejected-corrupt-record"`) — **zero special-case code is
required in `AppendOnlyFedosBoardPersistence` itself for this case.**

## 6. Fail closed, confirmed uniformly

Every one of the five cases either (a) is not corruption at all
(empty file, harmless duplicate), or (b) causes an outright failure —
a thrown exception from the persistence layer itself (truncated line,
malformed JSON, conflicting duplicate), or a fail-closed rejection one
layer up in already-existing, unmodified code (unknown schema). **No
case in this Stage's own review causes a partial, silently-repaired,
or silently-truncated result of any kind.**

## 7. Conclusion

All five required crash cases are reviewed and verified against the
actual implementation. The single design question Alpha 345 §6 left
open — how to treat a trailing partial write — is now answered:
identically to any other malformed line, fail closed, unconditionally,
with no heuristic-based repair of any kind.

## 8. See also

- `docs/secure_runtime_alpha_356_conflict_handling.md`
- `docs/secure_runtime_alpha_352_append_only_record_format.md`
- `docs/secure_runtime_alpha_345_crash_recovery_review.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`

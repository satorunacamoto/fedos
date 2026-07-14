# Secure Runtime Alpha 366 — Compaction Architecture Review (Design Only)

**Status: DESIGN ONLY, exactly as this Arc's own instruction states.
No code, no compaction implementation, anywhere in this Stage.**
Stage 6 of the Alpha 361–370 Board Recovery & Host Robustness Arc.

## 1. Why now

Alpha 344 §6 (Arc 341–350) and Alpha 360 §3 (Arc 351–360) both named
compaction as an unsolved problem: `putPost()` never appends a
redundant line for an already-present/conflicting write (Alpha 354
§3), so THIS class's own writes never bloat the log by themselves —
but nothing exists to reclaim space if a record is ever superseded.
This Stage designs a compaction ARCHITECTURE, on paper only.

## 2. Is compaction even needed, given the port has no `delete`/update?

**Reviewed directly: today, genuinely, no.** `FedosBoardPersistence`
(Alpha 315) has no `delete` method, and `putPost()`'s own semantics
(Alpha 315/354) mean a record, once inserted, is NEVER superseded —
a later `putPost()` call for the same `id` is either `"already-present"`
(no-op) or `"conflict"` (also no-op, original preserved). **The
append-only log, as it exists today, therefore NEVER contains a
"stale" record that compaction would need to remove — every record on
disk is, and remains, the canonical, sole record for its own `id`,
forever.** Compaction's real justification today is narrower than the
prior Arcs' own framing suggested: it is not about removing SUPERSEDED
data (none can exist), but about two, more modest goals:

1. **Removing duplicate lines that should not exist** — e.g. those
   introduced by an EXTERNAL writer bypassing this class's own
   dedup-before-append check (Alpha 357 §2's own "duplicate append"
   case), which currently only collapse IN MEMORY on each replay, not
   on disk.
2. **Future-proofing** for whenever moderation/deletion IS eventually
   added to the port (explicitly NOT this Arc, NOT the prior two Arcs
   — Alpha 313's own "moderation persistence deliberately DEFERRED"
   still stands unmodified).

## 3. A design for compaction, in prose and pseudocode only

```
function compactAppendOnlyLog(filePath):
    records = replay filePath  # same dedup logic listPosts() already uses
    tempPath = filePath + ".compact.tmp"
    write each record in `records`, one JSON line each, to tempPath
    atomically rename tempPath over filePath
    return { recordCount: records.length }
```

- **Atomicity via rename, not in-place rewrite.** `node:fs`'s
  `renameSync` is atomic on the SAME filesystem volume on both POSIX
  (a single `rename(2)` syscall) and Windows (`MoveFileEx` with the
  replace-existing flag) — a reader that opens the file mid-compaction
  either sees the FULL OLD file or the FULL NEW file, never a
  half-written one. This is the SAME "never rewrite in place"
  discipline Alpha 354 already established for ordinary appends,
  extended to compaction specifically.
- **The format is UNCHANGED** — compaction produces the EXACT same
  JSON Lines shape (Alpha 352), just with duplicate/superseded lines
  removed. This satisfies this Arc's own Absolute Requirement,
  "Preserve the current `AppendOnlyFedosBoardPersistence` format
  exactly" — compaction is a MAINTENANCE operation on data already in
  that format, never a new format.
- **Trigger: manual/operator-invoked only, never automatic**,
  mirroring Alpha 364's own Recovery Strategy discipline exactly —
  compaction is NOT proposed as a hook inside `putPost()`/`getPost()`/
  `listPosts()`, which must remain exactly as simple and predictable
  as Alpha 355 left them.

## 4. Why compaction must never run inside `putPost()`'s own hot path

Running compaction automatically, even periodically, inside `putPost()`
would violate THREE separate guardrails this Arc's own Absolute
Requirements protect: it would change `putPost()`'s own OBSERVABLE
timing behavior (occasionally doing a full log rewrite instead of one
append), it would require deciding a trigger THRESHOLD this Stage
explicitly does not fix (an arbitrary choice with no real requirement
driving it yet, echoing Alpha 349 §2's own "no speculative shell"
discipline), and it would risk violating "never rewrite" (Alpha 354)
in spirit even if implemented via the safe rename-based mechanism —
the GUARANTEE that `putPost()` never touches bytes it did not just
write is more valuable, this Stage concludes, than any space savings
compaction would offer today, when (per §2) no superseded data can
even exist yet.

## 5. Conclusion

Compaction is architecturally straightforward — replay, write to a
temp file, atomically rename — and would require ZERO format change.
It is NOT currently justified by data need (§2: nothing is ever
superseded today), and even once it is justified (e.g. once
moderation/deletion exists), it must remain a separate,
operator/maintenance-triggered operation, never automatic inside the
write path. Nothing is implemented in this Stage.

## 6. See also

- `docs/secure_runtime_alpha_364_recovery_strategy.md`
- `docs/secure_runtime_alpha_360_append_only_backend_completion.md`
- `docs/secure_runtime_alpha_354_append_semantics.md`
- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`

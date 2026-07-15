# Secure Runtime Alpha 418 — Append-Only Durable Outbox Persistence

Stage 8 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc. Implements
`src/board/outbox/append_only_fedos_board_outbox_persistence.ts`.

## 1. Format and semantics

Byte-for-byte the SAME design `AppendOnlyFedosBoardPersistence` (Alpha
353–357) already established, applied to
`FedosPersistedBoardOutboxRecordV1` instead of
`FedosPersistedBoardPostRecordV1`:

- one JSON-serialized record per line (JSON Lines), `\n`-terminated;
- `putIntent()` never rewrites, truncates, or reorders the file — a
  genuinely new `id` is appended via exactly one `appendFileSync` call;
  `"already-present"`/`"conflict"` write nothing;
- `getIntent()`/`listIntents()` REPLAY the whole log on every call —
  no in-memory cache/index of any kind is held between calls;
- `getIntent()` is implemented in terms of `listIntents()`, guaranteeing
  identical corruption/fail-closed behavior between the two;
- an empty or missing file is NOT corruption — `listIntents()` returns
  `[]`;
- a non-empty line that fails `JSON.parse` (truncated mid-write or
  malformed for any other reason) THROWS on replay — never silently
  dropped or repaired, and never special-cased for a trailing line
  versus a mid-file one, mirroring Alpha 357's own "fail closed, never
  repair automatically" rule exactly;
- two lines sharing the same `id` with structurally identical content
  (`fedosPersistedBoardOutboxRecordsAreEqual`) collapse to one record on
  replay — the SAME idempotent semantics the port already defines as
  correct, not a repair;
- two lines sharing the same `id` with DIFFERENT content is a genuine,
  irreconcilable log conflict — replay THROWS rather than silently
  picking a winner.

## 2. Independent file from the Board-post log

`AppendOnlyFedosBoardOutboxPersistence` takes its own, separate,
caller-supplied file path — never the same path `AppendOnlyFedosBoardPersistence`
writes to, and nothing in this file reads or writes the Board-post log.
This is deliberate, not an oversight: see Alpha 419 §"two-file
atomicity" for the direct consequence (the two logs cannot form one
true filesystem transaction) and why that limitation is disclosed
rather than hidden.

## 3. No default path, no directory creation

The constructor performs NO filesystem I/O — it only stores the given
path. Nothing in this file selects a default Host-owned path (matching
`AppendOnlyFedosBoardPersistence`'s own identical restraint — Host path
selection remains entirely out of `src/board/persistence/`'s and
`src/board/outbox/`'s own scope) and nothing creates a parent directory
automatically — a missing parent directory causes `appendFileSync` to
throw, which `putIntent()` catches and maps to `"failed"`, exactly
matching `AppendOnlyFedosBoardPersistence`'s own Alpha 356 mapping.

## 4. No generic append-only helper extracted

Reviewed and rejected: extracting a shared, generic
`readLogFile`/`replayLog`/append helper between the Board-post and
Outbox append-only backends would require either a generic equality
comparator parameter or a generic record-shape parameter threaded
through both call sites — a bigger, less-obvious abstraction than the
~15 lines of duplication it would remove. This Arc's own instruction is
explicit: "Do not perform speculative refactoring." The two files stay
independent, each locally readable end to end.

## 5. See also

- `docs/secure_runtime_alpha_351_existing_persistence_layer_inventory.md`
- `docs/secure_runtime_alpha_352_append_only_record_format.md`
- `docs/secure_runtime_alpha_353_append_only_persistence_implementation.md`
- `docs/secure_runtime_alpha_357_crash_review.md`

# Secure Runtime Alpha 358 — Hydration Review

**Status: this Stage verifies existing, unmodified behavior — no
production code change.** Stage 8 of the Alpha 351–360 Append-only
Durable Board Backend Arc. Hydrates `AppendOnlyFedosBoardPersistence`
through the existing `hydrateFedosBoardService()`, without
modifications.

## 1. Requirement

`hydrateFedosBoardService` (`src/board/persistence/fedos_board_hydration.ts`,
Alpha 318) must work against `AppendOnlyFedosBoardPersistence`
UNCHANGED — this Stage adds ZERO lines to that file.

## 2. Verification

`hydrateFedosBoardService(persistence)` calls
`persistence.listPosts()` exactly once — for an
`AppendOnlyFedosBoardPersistence`, this triggers one full replay of
the log file (Alpha 355), producing the SAME
`readonly FedosPersistedBoardPostRecordV1[]` shape any other backend
would return. Everything downstream — `deserializeFedosBoardPost`
per record, the bounded topological registration pass, the
`"hydrated"` / `"rejected-corrupt-record"` /
`"rejected-unresolvable-thread-integrity"` outcome — is IDENTICAL
code, run identically, regardless of which backend produced the
records.

## 3. What this proves

- Hydrating an empty append-only log yields a hydrated, empty, usable
  `FedosBoardService` — identical to hydrating a fresh
  `InMemoryFedosBoardPersistence`.
- A root-only append-only log hydrates that root into the feed.
- A root plus a reply hydrates correctly regardless of the ORDER the
  two were originally appended in — `hydrateFedosBoardService`'s own
  sort-by-`id` pass (Alpha 318) already makes this true for ANY
  backend; this Stage confirms it holds for THIS one too, using real
  on-disk records, not merely in-memory fixtures.
- A corrupt append-only log (a malformed/truncated trailing line, per
  Alpha 357) causes `listPosts()` itself to throw BEFORE
  `hydrateFedosBoardService` ever gets a chance to run its own
  corruption check — a DIFFERENT failure mode than
  `"rejected-corrupt-record"` (which handles a syntactically-valid but
  semantically-invalid record), but equally fail-closed: no
  `FedosBoardService` is ever produced, no partial Board state is ever
  exposed. See Alpha 360 §"remaining limitations" for how this
  interacts with `FedosDesktopHost.start()` specifically.

## 4. Conclusion

`hydrateFedosBoardService` requires, and receives, ZERO modification
to work correctly against the new backend — confirming Alpha 351 §4
and Alpha 342 §4's own prior findings hold, now proven against a REAL
durable backend rather than only against `InMemoryFedosBoardPersistence`.

## 5. See also

- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_351_existing_persistence_layer_inventory.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`

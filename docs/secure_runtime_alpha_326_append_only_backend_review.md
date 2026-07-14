# Secure Runtime Alpha 326 — Candidate D: Append-Only File Backend Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind, and does NOT implement filesystem writes.** Stage 6 of the Alpha
321–330 Board Durable Backend Selection & Architecture Arc.

## 1. Why now

Completing the four-candidate comparison against Alpha 322's requirement
set: an append-only file / JSONL / framed-record backend — the one
candidate needing zero new dependency of any kind.

## 2. Findings

- **Dependency-free implementation potential.** Highest of all four
  candidates: framed/newline-delimited text plus plain string operations
  needs no new npm package at all.
- **Desktop filesystem requirements.** Needs a REAL filesystem API
  (Node's `fs`/`fs/promises`) — unavailable in the Cloudflare Worker
  (Alpha 321 §3.1) and unavailable in a browser without the (not
  universally supported) File System Access API. This project's own
  `tsconfig.json` types no Node API at all (`lib: ["ES2022", "WebWorker"]`,
  no `@types/node`) — reaching `fs` cleanly would need the SAME
  `// @ts-expect-error` pattern `fedos_windows_dpapi_helper.ts` already
  uses for `node:child_process` (Alpha 023), not a new problem, but a
  real one to repeat correctly.
- **Crash consistency.** Requires a genuine append-with-framing design —
  a length-prefixed or newline-delimited-plus-checksum frame, so a crash
  mid-write corrupts at most the LAST, incomplete frame, never any
  earlier one. **This is the one candidate this Stage explicitly warns
  against getting wrong**: reading the whole file, mutating an in-memory
  array, and overwriting the file with `JSON.stringify` on every write is
  NOT append-only durability — a crash mid-overwrite can destroy the
  ENTIRE file, not just the newest record. Genuine append-only means only
  ADDING bytes at the end, never rewriting bytes already on disk.
- **Duplicate/conflict detection.** Naturally expressed at replay time:
  rebuild an in-memory map keyed by `id` while replaying every frame in
  order, applying the SAME `"inserted"`/`"already-present"`/`"conflict"`
  discipline `InMemoryFedosBoardPersistence` already implements
  (Alpha 316) — an extremely close match to what
  `hydrateFedosBoardService` (Alpha 318) already does at startup.
- **Compaction.** Grows unboundedly without a periodic rewrite/compaction
  pass — out of scope this Arc, a real operational concern for whichever
  future Arc implements this candidate.
- **Corruption recovery.** A torn/partial final frame must be detected
  and either truncated or rejected, fail-closed — matching Alpha 314's
  own corruption discipline (a record that fails to parse is treated as
  corrupt, never silently repaired), but requiring its OWN explicit
  design for "where does a truncated final frame end."
- **Schema migration.** No additional backend-level mechanism needed
  beyond what Alpha 313/314 already established — each frame already
  carries its own `schemaVersion` field.
- **Replay cost.** O(n) full-file read at every startup — exactly what
  `hydrateFedosBoardService` already assumes and bounds (Alpha 318's own
  "bounded topological pass" reasoning already prices in a full
  `listPosts()` read).
- **Indexing.** None at the file level — Source/Board/Thread Index stay
  entirely in-memory, unchanged, exactly as they already are for every
  other candidate (Alpha 322 §4, "secondary indexes: NOT YET").
- **Concurrent writers.** A single append-only file is safe for exactly
  one writer without external locking — matches this Arc's own NOT YET
  requirement (Alpha 322 §4), not a rejection reason.
- **Backup.** Trivial — a plain file copy.
- **Portability.** Fully portable — plain text, no platform-specific
  binary format.
- **Windows behavior.** Append semantics work correctly via `fs.appendFile`,
  but file locking during concurrent access is weaker than POSIX; worth
  flagging alongside this exact checkout's own already-observed Windows
  path fragility (the MinGW `dlltool` failure this Arc's own baseline
  reproduces, caused by a checkout path containing spaces and non-ASCII
  characters) — a general environment caution for any future
  filesystem-touching Stage on this checkout, not a design blocker for
  the append-only format itself.
- **Testability.** Excellent — write to a fresh temp directory per test,
  reason about plain string/byte operations, no native or binary
  dependency to mock.
- **Encryption-at-rest possibility.** Straightforward to layer later
  (encrypt each frame's payload independently), explicitly out of scope
  this Arc (Alpha 322 §4).
- **Operational simplicity.** Highest of all four candidates: no server,
  no native addon, no client library, no vendor account, no deployment
  manifest.

## 3. The one caution this Stage insists on

A naïve "read whole file → `JSON.parse` → mutate array → `JSON.stringify`
→ overwrite" implementation is explicitly NOT what "append-only" means
in this review, and must never be substituted for it in a future Arc —
see the "Crash consistency" finding above.

## 4. Conclusion

Of all four candidates, append-only file is the only one needing zero
new dependency and the only one directly runnable, today, under this
repository's real Node test/dev environment (Alpha 321 §3.1) without any
new host. Its remaining gap is not technical: it is the SAME gap every
candidate shares (Alpha 321 §3.4) — **no real Desktop process exists yet
to OWN a Board data file as its authoritative local state**; a file-
backed backend built today would have no real production caller beyond
its own test suite, which is close to the "imaginary environment" this
Arc's own Decision Constraints (Alpha 329) forbid building against.

## 5. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
- `docs/secure_runtime_alpha_023_windows_dpapi_storage_backend.md`

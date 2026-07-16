# Secure Runtime Alpha 752 — Append-Only Persistence

Stage 12. `AppendOnlyFedosConversationPersistence`
(`src/conversation/persistence/append_only_fedos_conversation_persistence.ts`) —
mirrors `AppendOnlyFedosBoardPersistence`'s own established backend
exactly (Alpha 353–357).

## Requirements, checked

- **Independent log file** — its own caller-supplied path, never
  sharing a file with Board/Outbox/Observation.
- **One V1 JSON record per newline** — NDJSON, matching the Board
  backend's own record format exactly.
- **Insert-only, no rewrite, no compaction, no delete** — `putConversation()`
  performs exactly one `appendFileSync` call for a genuinely new
  record; this Arc's own Absolute Prohibitions forbid a delete method
  outright.
- **Malformed line fails closed** — a non-blank line that fails
  `JSON.parse` throws, unconditionally, mirroring Alpha 357's own
  "fail closed, never repair automatically" policy verbatim.
- **Trailing partial line treated honestly as corruption** — no
  special-casing of a trailing line versus a mid-file one, identical
  reasoning to Alpha 357: distinguishing the two is itself a repair
  decision this backend refuses to make.
- **Caller-supplied path** — the constructor takes an explicit
  `filePath` string; no default, no `cwd`-relative path.
- **No constructor I/O** — the constructor only stores `filePath`;
  confirmed by the same "field assignment only" pattern
  `AppendOnlyFedosBoardPersistence`'s own constructor already
  establishes.
- **No new dependency** — `node:fs` only, reached via the same
  `@ts-expect-error` pattern already established
  (`fedos_windows_dpapi_helper.ts`, Alpha 023).

## Reading

`getConversation()`/`listConversations()` REPLAY the log on every
call — no in-memory index/cache held between calls, the same "no side
index" discipline Alpha 355 established for Board persistence. This is
also why Alpha 753 concludes no separate Conversation repository/index
is needed at the read-facade layer: the persistence layer itself
already re-derives a consistent view on demand, and there is nothing
further worth caching for a record shape with no cross-record integrity
graph to maintain (unlike `FedosBoardService`'s own thread/reply
tracking).

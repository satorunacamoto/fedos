# Secure Runtime Alpha 389 — Four-Protocol Host Query Verification

**Status: this Stage verifies existing behavior end to end by real
execution — no production code change.** Stage 9 of the Alpha
381–390 Canonical Board Query Host Integration & Startup Failure
Closure Arc.

## 1. Requirement

Using real Nostr, ActivityPub, AT Protocol, and Session Gateway
fixtures — the SAME four real, unmodified Board Adapters every prior
Board integration-verification Stage has relied on (Alpha 309, 339,
359, 379) — create and persist Board posts, start a FRESH
`FedosDesktopHost`, and verify through `host.query()`.

## 2. What is verified

- **All four protocols appear in the same recent feed**, via
  `host.query()!.recentFeed(boardId)`.
- **Protocol filter works** — isolating each of the four registered
  protocols in turn, through the Host-owned Query instance.
- **Author filter works** — `authorPublicIdentifier`, across all four
  protocols' own differently-shaped identifier strings
  (`npub...`/an ActivityPub actor URI/a DID/a Session identifier),
  matched opaquely, with no protocol-specific parsing (Alpha 379 §2,
  re-confirmed at the Host layer).
- **since/until filters work**, identically to the standalone Query
  verification (Alpha 379).
- **Thread query crosses protocols honestly** — a cross-protocol
  reply (mirroring the Nostr-root/AT-Protocol-reply fixture every
  prior four-protocol Stage has used) groups correctly through
  `host.query()!.thread(...)`, in `createdAt` ASC order.
- **Ordering is deterministic** — two independent `host.query()!.recentFeed(...)`
  calls against the SAME started Host return byte-identical `id`
  sequences.
- **Pagination is deterministic** — `limit`/`offset` composed with a
  mixed-protocol result set produce the SAME page across repeated
  calls.
- **Query never exposes protocol-native objects** — every
  `FedosBoardQueryResult.posts` entry is a plain `FedosBoardPost`
  (Alpha 255) — no raw Nostr event, ActivityPub Activity, AT Protocol
  record, or Session gateway message of any kind is ever returned,
  confirmed by structural inspection of every returned post's own
  field set.
- **Query never inspects source-protocol internals beyond the
  canonical filter** — `FedosBoardQueryFilter.protocol` compares
  against `post.source.protocol` ONLY (an opaque
  `FedosBoardSourceProtocol` token, Alpha 253) — no branch, switch, or
  protocol-specific code path exists anywhere in
  `src/board/query/fedos_board_query.ts`, confirmed unchanged.
- **No adapter modification** — every fixture's own known-good
  validated shape is reproduced unchanged, mirroring Alpha 309 §15/
  Alpha 359 §6/Alpha 379 §7's own identical regression discipline.
- **Independent Hosts do not share Query or Board state** — two
  separately-constructed, separately-started `FedosDesktopHost`
  instances, each with its own persistence, produce COMPLETELY
  independent `query()` results — confirmed directly, extending Alpha
  367's own Host-restart independence finding (Arc 361–370) to Query
  specifically.

## 3. Also confirmed, and documented as a remaining limitation

- **`board()` still accepts valid canonical writes while `"ready"`** —
  `host.board()!.registerPost(...)` succeeds normally, unchanged.
- **`query()` observes those in-memory writes immediately** — a post
  registered via `board()` is visible via `query().recentFeed()`/
  `.thread()` on the VERY NEXT call, with no delay, no cache, no
  refresh step — because `FedosBoardQuery` reads THROUGH to the SAME
  live `FedosBoardService` `board()` itself returns (Alpha 372's own
  `FedosBoardQuerySource` contract: `FedosBoardQuery` holds a
  reference to the Service, never a snapshot).
- **Those writes are NOT automatically persisted** — confirmed
  directly: after `host.board()!.registerPost(...)` succeeds and
  `host.query()` immediately reflects it, the UNDERLYING
  `FedosBoardPersistence` instance's own `listPosts()` does NOT yet
  contain the new record — a caller must separately call
  `boardPersistence.putPost(...)` for the write to survive a restart,
  EXACTLY the gap Alpha 367 §2a (Arc 361–370) first documented and
  this Arc's own "Durable Write Warning" names explicitly as
  out of scope. **This Stage does not implement autosave** — it
  documents the fact honestly, as required.

## 4. Conclusion

`FedosDesktopHost`'s own `query()` accessor works correctly against
real, multi-protocol Board data, end to end, with Host-level isolation
confirmed and the memory-only write limitation re-confirmed and
honestly documented, not silently left implicit.

## 5. See also

- `docs/secure_runtime_alpha_388_append_only_host_query_compatibility.md`
- `docs/secure_runtime_alpha_379_four_protocol_query_verification.md`
- `docs/secure_runtime_alpha_367_host_restart_verification.md`
- `docs/secure_runtime_alpha_359_four_protocol_append_only_verification.md`

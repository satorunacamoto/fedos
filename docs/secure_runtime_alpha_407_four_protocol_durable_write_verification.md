# Secure Runtime Alpha 407 — Four-Protocol Durable Write Verification

**Status: this Stage is verification only — it makes NO production
code change of any kind.** Stage 7 of the Alpha 401–410 Desktop Host
Canonical Write Boundary Closure Arc. Runs the full
write → observe → restart → re-observe cycle for real fixtures from
all four Board Adapters, through the NOW read-only-`board()` Host.

## 1. Why now

Alpha 397 (Arc 391–400) already verified four-protocol write
neutrality; Alpha 399 already verified restart durability. This Stage
reverifies BOTH, specifically through the POST-Alpha-404 accessor
shape — confirming `board()`'s own rewiring to `FedosBoardReader`
changed nothing about durability or protocol neutrality, and adds
Reader-specific observation (not merely Query) to the verified surface.

## 2. Method, exactly as this Arc's own instruction specifies

For each of Nostr, ActivityPub, AT Protocol, and Session Gateway:

1. Host starts with an injected REAL `AppendOnlyFedosBoardPersistence`.
2. `submitPost(post)`.
3. `board()` (the Reader) observes the post.
4. `query()` observes the post.
5. Host stops.
6. A fresh, independent Host starts on the SAME file.
7. `board()` (a NEW Reader instance, from the NEW Host) observes the
   hydrated post.
8. `query()` observes the hydrated post.

## 3. Result

Every required property holds, for all four protocols, verified by
direct execution:

- **Identical canonical values**: every field of the post as observed
  via `board()!.findPost()` after restart matches the originally
  submitted post exactly.
- **Provenance preserved**: `source.protocol`/`source.reference`
  survive the restart unchanged.
- **Author preserved**: `author.publicIdentifier`/`author.protocol`
  survive unchanged.
- **Thread grouping preserved**: an AT Protocol reply, submitted after
  its root, remains grouped under the same `threadId` after restart,
  observed identically via both `board()!.listThreadPosts()` and
  `query()!.thread()`.
- **Deterministic feed order**: `query()!.recentFeed()`'s own
  `createdAt` DESC ordering (Alpha 373, unmodified) is unchanged by
  this Arc.
- **Duplicates do not append**: submitting the same fixture twice still
  appends exactly one log line (`AppendOnlyFedosBoardPersistence`'s own
  Alpha 354 semantics, unmodified).
- **Conflicts do not append**: a conflicting duplicate `id` still
  writes nothing (Alpha 356, unmodified).
- **Independent Hosts do not share memory**: the fresh, post-restart
  Host's own `#boardReader`/`#boardService`/`#boardQuery` are
  freshly-constructed instances, confirmed by reference inequality —
  matching Alpha 367/389's own established independent-instance
  finding.
- **All four protocols use exactly the same write path**: `submitPost()`
  is called identically for each fixture, with zero protocol-specific
  branch — reconfirmed by the same structural check Alpha 397/405
  already established.

## 4. No adapter change

Confirmed by direct inspection: this Stage's own test suite imports
`validateNostrBoardPost`/`validateActivityPubBoardPost`/
`validateAtprotoBoardPost`/`validateSessionBoardPost` UNMODIFIED — the
same four adapter functions Alpha 261–300 shipped and Alpha 379/389/397
already reused without alteration.

## 5. Conclusion

The full four-protocol, restart-durable write cycle holds identically
through the NEW `board()` Reader accessor, with zero regression from
Alpha 397/399's own established findings and zero adapter
modification.

## 6. See also

- `docs/secure_runtime_alpha_405_submit_post_authority_verification.md`
- `docs/secure_runtime_alpha_399_write_restart_integration_verification.md`
- `docs/secure_runtime_alpha_397_write_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_389_four_protocol_host_query_verification.md`

# Secure Runtime Alpha 396 — Immediate Query Visibility

**Status: this Stage is verification only — it makes NO further
production code change of any kind.** Stage 6 of the Alpha 391–400
Desktop Host Durable Write Coordination Arc. Verifies, by direct
execution, that `host.query()` observes a `submitPost()`-written post
immediately, with no rebuild, no reload, and no restart.

## 1. Why now

Alpha 395 implemented `submitPost()`. Alpha 393 §"Query visibility"
already argued this is automatic, a structural consequence of
`FedosBoardQuery` and `FedosBoardService`'s own write path sharing one
live object — this Stage proves that argument by direct execution
rather than resting on inspection alone.

## 2. Why visibility is automatic, restated precisely

`FedosDesktopHost.start()` constructs exactly ONE `FedosBoardQuery`,
over the SAME `FedosBoardService` instance (`hydration.service`) that
becomes `#boardService` (Alpha 383, unmodified by this Arc).
`submitPost()`'s own step 3 calls `boardService.registerPost(post)` —
mutating THAT SAME instance. `FedosBoardQuery.recentFeed()`/`thread()`
(Alpha 373/374, unmodified) call `#source.listBoardPosts()`/
`#source.listThreadPosts()`, which is `FedosBoardService`'s own
`listBoardPosts()`/`listThreadPosts()`, reading the SAME
`FedosBoardIndex` `registerPost()` just updated. There is no cache, no
snapshot, no copy anywhere in this chain — every read is a live read of
the current state of the one shared object.

## 3. What "immediately" means here, precisely

No `await` of any kind separates `submitPost()`'s own return and the
following `query()` call observing the write — `submitPost()` itself
is fully synchronous (Alpha 395), and `query()`'s own
`recentFeed()`/`thread()` are fully synchronous (Alpha 373/374,
unchanged). A caller can call `host.submitPost(post)` and
`host.query()!.recentFeed(post.boardId)` back to back, in the same
synchronous block of code, and the second call already reflects the
first.

## 4. What this Stage does NOT test

Cross-process visibility (a SECOND Host instance, or the same Host
after a restart, observing a write made by a different instance) is
explicitly out of scope for "immediate" visibility — that is a
DURABILITY question, verified separately by Alpha 399's own
write-restart-hydrate-query integration test, not a visibility
question within one live Host instance.

## 5. Conclusion

Query visibility after `submitPost()` requires no new code, no new
step, and no explicit "refresh" of any kind — it is a direct structural
consequence of `FedosBoardQuery` and the Repository/Index layer
`submitPost()` writes to being the exact same live object, confirmed
here by direct synchronous execution immediately after a successful
write.

## 6. See also

- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_393_write_transaction_order.md`
- `docs/secure_runtime_alpha_383_host_owned_query_construction.md`
- `docs/secure_runtime_alpha_389_four_protocol_host_query_verification.md`

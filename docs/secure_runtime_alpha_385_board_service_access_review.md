# Secure Runtime Alpha 385 — Board Service Access Review

**Status: this Stage is REVIEW ONLY — `board()`'s own signature and
body are byte-for-byte unchanged by this Arc.** Stage 5 of the Alpha
381–390 Canonical Board Query Host Integration & Startup Failure
Closure Arc.

## 1. Candidates compared

- **Option A — keep `board()` unchanged and add `query()`.**
- **Option B — deprecate `board()` but do not remove it.** Rejected:
  no real caller of `board()` exists anywhere in this repository yet
  (Alpha 381 §8) — deprecating an API with zero real callers, purely
  in anticipation of `query()`'s own existence, would be a
  documentation-only gesture with no actual migration to drive, and
  risks discouraging the ONE capability (`registerPost()`) `query()`
  cannot provide.
- **Option C — remove `board()` and expose Query only.** Rejected
  outright: `FedosBoardQuery` is READ-ONLY (Alpha 381 §7/Alpha 384
  §2) — removing `board()` would remove ALL write capability through
  the Host, a genuine capability regression, and would violate this
  Arc's own "no public API removal" Absolute Requirement.
- **Option D — expose separate read/write boundaries.** This IS,
  functionally, what adopting Option A achieves — `board()` as the
  write boundary, `query()` as the read boundary — without inventing
  a THIRD, differently-named pair of accessors; Option D as literally
  a distinct pair of NEW methods would just duplicate Option A under
  different names.

## 2. Decision

**Option A**, for compatibility, exactly as this Arc's own instruction
states.

## 3. The frozen distinction

```
Host.board()
    → application writes and direct canonical lookup

Host.query()
    → filtering, ordering, pagination, feed and thread reads
```

`board()` returns the full `FedosBoardService` — `registerPost()`
(the ONLY write path), `findPost()` (a direct, unfiltered, single-ID
lookup), `listBoardPosts()`/`listThreadPosts()` (the raw, unsorted,
unfiltered, unpaginated read paths `FedosBoardQuery` itself is built
on top of, per Alpha 372's own `FedosBoardQuerySource` contract).
`query()` returns `FedosBoardQuery` — `recentFeed()`/`thread()`,
filtered, deterministically ordered, paginated, NEVER a write.

## 4. Why removing `board()` would break existing ownership semantics

Every EXISTING test across Alpha 331–380's own combined suite that
exercises Host-level Board writes (registering a post, then verifying
it appears via hydration on a subsequent restart) calls
`host.board()!.registerPost(...)` or writes directly through the
INJECTED `FedosBoardPersistence` — `FedosBoardQuery` was never
designed, at any prior Stage, to accept a write. Removing `board()`
would break EVERY one of those call sites with no equivalent
replacement available through `query()` alone.

## 5. Why Query must not become a write façade

Adding a write method to `FedosBoardQuery` itself — even a thin
delegation to `#source`'s own (nonexistent, since
`FedosBoardQuerySource` has no write method either) write path — would
directly contradict Alpha 372's own frozen contract ("No mutation of
any kind — this file defines shapes only") and Alpha 373's own
guardrail ("Both `recentFeed()` and `thread()` are PURE reads").
This Arc's own Absolute Prohibition, "Query semantic changes,"
forbids this outright regardless.

## 6. No protocol-specific method on either boundary

Neither `board()`'s own returned `FedosBoardService` nor `query()`'s
own returned `FedosBoardQuery` gains a `nostr`-specific,
`activitypub`-specific, or any other protocol-specific method — both
remain exactly as protocol-neutral as Alpha 253/307/372 already
established; `FedosBoardQueryFilter.protocol` (Alpha 376) remains the
ONLY protocol-aware surface, and it is a FILTER VALUE, never a
dedicated method.

## 7. Conclusion

`board()` is confirmed unchanged, byte-for-byte, by this Arc's own
regression tests — it remains the canonical write boundary, exactly
as it was before `query()` existed. The write/read distinction between
the two accessors is now a frozen, documented architectural decision,
not an incidental byproduct of Alpha 384's own additive change.

## 8. See also

- `docs/secure_runtime_alpha_384_host_query_access_boundary.md`
- `docs/secure_runtime_alpha_381_host_query_integration_inventory.md`
- `docs/secure_runtime_alpha_336_desktop_host_access_boundary.md`
- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`

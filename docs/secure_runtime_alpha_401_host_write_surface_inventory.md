# Secure Runtime Alpha 401 — Existing Host Write Surface Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 401–410
Desktop Host Canonical Write Boundary Closure Arc.

## 1. Why now

Alpha 400 closed the Desktop Host Durable Write Coordination Arc with
one honestly-named, deliberately-unsolved residual gap: `board()`
still returns the full `FedosBoardService` (`registerPost()` included),
so `host.board()?.registerPost(post)` remains a live,
Persistence-bypassing write route, coexisting alongside the new,
correct `submitPost()`. This Stage inventories the actual current
write/read surface before deciding how to close it.

## 2. Every Host-reachable write route (Question 1)

Exactly two, confirmed by direct inspection of
`src/desktop/host/fedos_desktop_host.ts`:

1. `submitPost(post)` (Alpha 395) — the correct, durable,
   Persistence-then-Repository coordinated route.
2. `board()?.registerPost(post)` — the FULL `FedosBoardService`
   returned by `board()` still exposes `registerPost()`
   (`src/board/repository/fedos_board_service.ts`, Alpha 307/395,
   unchanged), an in-memory-only route that never reaches
   `#boardPersistence`.

No third route exists — `query()` returns `FedosBoardQuery`, which has
zero mutating method (Alpha 373–376, reconfirmed unchanged).

## 3. Every Host-reachable read route (Question 2)

Three, confirmed by direct inspection:

1. `query()` → `FedosBoardQuery.recentFeed()`/`thread()` — filtered,
   ordered, paginated reads.
2. `board()` → `FedosBoardService.findPost()`/`listBoardPosts()`/
   `listThreadPosts()` — direct, unordered, unpaginated canonical
   lookup and grouping. `FedosBoardService` also exposes `registerPost()`/
   `previewRegistration()` on the SAME returned object — these are NOT
   read routes, but they ARE reachable through the exact same accessor
   that provides the three read routes above, which is precisely this
   Arc's own closure target.
3. No third read route — `desktop()` returns `DesktopApplication`,
   unrelated to Board data.

## 4. Whether any production caller currently uses host.board() (Question 3)

**No.** Confirmed by direct search of every file under `src/` (outside
`src/desktop/host/` itself and `src/board/repository/fedos_board_service.ts`,
where `.board()` cannot mean this accessor): zero reference to
`.board()` called on a `FedosDesktopHost` instance. `src/worker.ts`
carries zero reference to `FedosDesktopHost` at all — confirmed
unchanged since Alpha 341 first found this, reconfirmed by every Arc
since (most recently Alpha 400 §6).

## 5. Whether any production caller calls registerPost() through the Host (Question 4)

**No.** A direct consequence of §4 — with zero production caller of
`host.board()` at all, there is zero production caller of
`host.board()?.registerPost()` either. Every reference to
`host.board()!.registerPost(...)` anywhere in this repository, before
this Arc, exists in exactly two TEST files
(`test/secure_runtime_alpha_385_board_service_access_review.test.ts`,
`test/secure_runtime_alpha_389_four_protocol_host_query_verification.test.ts`)
— both deliberately DEMONSTRATING the bypass as a documented, honest,
confirmed limitation (Alpha 385 §3, Alpha 389 §12), not exercising a
real caller's own need.

## 6. Whether board() is required for anything Query cannot provide (Question 5)

**Yes**, for exactly two capabilities `FedosBoardQuery` does not offer:

- A direct single-post lookup by `id` with NO ordering/filtering
  overhead (`findPost()`) — `FedosBoardQuery` has no equivalent method
  at all.
- An UNPAGINATED, UNFILTERED listing of every post in a board or
  thread (`listBoardPosts()`/`listThreadPosts()`) —
  `FedosBoardQuery.recentFeed()`/`thread()` both apply mandatory
  pagination (`FEDOS_BOARD_QUERY_DEFAULT_LIMIT = 20`,
  `FEDOS_BOARD_QUERY_MAX_LIMIT = 100`, Alpha 375, unmodified) and
  mandatory ordering (`createdAt` DESC/ASC, Alpha 373/374) — neither is
  optional, so `board()`'s three read methods are NOT redundant with
  `query()`, they serve a genuinely different, narrower use: direct
  canonical lookup and grouping, not feed/thread presentation.

## 7. Whether a read-only interface can be structurally satisfied by FedosBoardService (Question 6)

**Yes**, verbatim, with zero change to `FedosBoardService` beyond a
purely additive `implements` declaration (Alpha 403). `FedosBoardService`
already exposes `findPost(id: FedosBoardPostId): FedosBoardPost | null`,
`listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[]`, and
`listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[]`
— confirmed, by direct inspection, to be the EXACT three signatures the
`FedosBoardReader` candidate interface (this Arc's own instruction,
§"Alpha 403") names.

## 8. Exact expected ripple scope (Question 7)

Confirmed by direct search across `test/*.test.ts`:

- Two test files call `host.board()!.registerPost(...)` and will no
  longer compile once `board()`'s return type narrows — both are
  updated by this Arc to demonstrate the NOW-CLOSED bypass instead
  (Alpha 404).
- Five test files assert `board()`'s own exact return type/body via a
  structural regex against `hostSource`
  (`secure_runtime_alpha_335_board_hydration_ownership.test.ts`,
  `secure_runtime_alpha_336_desktop_host_access_boundary.test.ts`,
  `secure_runtime_alpha_370_recovery_robustness_completion.test.ts`,
  `secure_runtime_alpha_381_host_query_integration_inventory.test.ts`,
  `secure_runtime_alpha_382_host_startup_failure_closure.test.ts`) —
  each updated to assert the NEW return type/body, with an explicit
  comment naming this Arc as the reason.
- Fourteen additional test files call `host.board()!.findPost(...)`/
  `.listBoardPosts(...)`/`.listThreadPosts(...)` — ALL continue to
  compile and pass UNMODIFIED, since `FedosBoardReader` provides the
  exact same three signatures.
- No file outside `test/` and
  `src/desktop/host/fedos_desktop_host.ts`/
  `src/board/repository/fedos_board_service.ts`/the new
  `src/board/repository/fedos_board_reader.ts` requires any change.

## 9. Whether closure can remain additive (Question 8)

**Partially.** Adding `FedosBoardReader`/`FedosBoardServiceReader`
(Alpha 403) is purely additive — a new file, a new interface, a new
class, zero change to any existing export's own behavior. REWIRING
`board()`'s own return TYPE (Alpha 404), however, is NOT additive by
definition — it narrows an existing public method's own return type,
which is why §4/§5's own finding (zero production caller) is
load-bearing: a narrowing change with zero production caller is a
SAFE, honest closure, not a breaking one in practice, even though it
is not additive in the strict type-system sense.

## 10. Whether removing board() would be breaking (Question 9)

**Not for any REAL caller** (§4), but **yes for this repository's own
established capability set** (§6) — removing `board()` outright
(Option E) would eliminate direct canonical lookup and unpaginated
listing, a capability `query()` cannot replace without violating its
own frozen pagination/ordering guarantees (Alpha 373–376). This Arc
therefore does not adopt Option E; see Alpha 402's own comparison.

## 11. Whether TypeScript structural typing creates hidden mutation exposure (Question 10)

**Yes — this is the single most important finding of this Stage.**
TypeScript's structural typing ERASES NOTHING at runtime. If `board()`
were simply changed to return `this.#boardService` RE-TYPED as
`FedosBoardReader` (i.e. `board(): FedosBoardReader | null { return
... this.#boardService; }`, with NO new wrapper object), the RUNTIME
object returned would still, in actual fact, be a `FedosBoardService`
instance whose `registerPost` method is fully present and callable —
confirmed by direct reasoning about JavaScript's own object model, not
merely a theoretical concern. A caller could defeat the STATIC type
narrowing trivially: `(host.board() as unknown as FedosBoardService).registerPost(post)`
would compile (with an explicit unsafe cast) AND succeed at runtime,
completely undermining "no public object reachable from a ready Host
may provide a Persistence-bypassing Board mutation route." Closing the
bypass HONESTLY therefore requires a REAL, separate wrapper object
(Alpha 403's own `FedosBoardServiceReader`) whose OWN actual public
surface — inspected directly, not merely typed — has no `registerPost`
property at all, so even an unsafe cast has nothing to call. This
finding is why Option B (Alpha 402, "wrap or proxy `registerPost()`")
and Option C (Alpha 402, "replace `board()` with a read-only Board
interface") are NOT the same option: Option C only closes the bypass
HONESTLY if its own implementation avoids exactly the hidden-exposure
trap this Section names.

## 12. Conclusion

Exactly two write routes exist today, one correct (`submitPost()`) and
one a confirmed, still-open bypass (`board()?.registerPost()`); zero
production caller anywhere depends on the bypass; `board()`'s own
read capabilities (direct lookup, unpaginated listing) are genuinely
needed and not redundant with `query()`; `FedosBoardService` already
structurally satisfies a minimal read-only contract with zero behavior
change; and closing the bypass honestly requires a REAL wrapper object,
not a mere type-level narrowing, because TypeScript's structural typing
provides no runtime enforcement on its own.

## 13. See also

- `docs/secure_runtime_alpha_400_desktop_host_write_coordination_completion.md`
- `docs/secure_runtime_alpha_395_host_write_api_implementation.md`
- `docs/secure_runtime_alpha_385_board_service_access_review.md`
- `docs/secure_runtime_alpha_373_recent_feed_query.md`

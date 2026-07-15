# Secure Runtime Alpha 395 — Implement Host Write API

**Status: this Stage implements code.** Stage 5 of the Alpha 391–400
Desktop Host Durable Write Coordination Arc. Implements the order
Alpha 393 fixed and the policy Alpha 394 named.

## 1. Why now

Alpha 392 decided the Host coordinates writes directly (Option A).
Alpha 393 fixed the exact step order. Alpha 394 named every failure
shape's own expected behavior. This Stage writes the code.

## 2. `FedosBoardService.previewRegistration()` (new public method)

`src/board/repository/fedos_board_service.ts`. `registerPost()`'s own
two pure-read pre-checks (thread integrity, source-conflict) are
factored into a new PRIVATE `#precheckRegistration()`, joined by a
THIRD pure-read check this Stage adds: a post-id conflict pre-check
via `this.#repository.findPost(post.id)` compared with
`fedosBoardPostsAreStructurallyEqual` (Alpha 302, unmodified, reused
directly — never reimplemented). `registerPost()` itself calls
`#precheckRegistration()` first, exactly reproducing its own PRE-Stage
395 behavior byte-for-byte (verified by the entire pre-existing Alpha
307/309/310/etc. test suite passing unmodified). `previewRegistration()`
is a new one-line public wrapper: `return this.#precheckRegistration(post);`.
`FedosBoardService` gains **zero** new field, **zero** new import
beyond `fedosBoardPostsAreStructurallyEqual` (already exported by the
ALREADY-imported `fedos_board_repository.js`), and **zero** reference
to `FedosBoardPersistence`, `FedosDesktopHost`, or any other new
module — confirmed by direct inspection of the file's own import list.

## 3. `FedosDesktopHost.submitPost()` (new public method)

`src/desktop/host/fedos_desktop_host.ts`. Implements the Alpha 393
order exactly:

```ts
submitPost(post: FedosBoardPost): FedosDesktopHostSubmitPostResult {
  if (this.#state !== "ready" || this.#boardService === null) {
    throw new Error(/* ready-state guard, matches start()/stop() */);
  }
  const boardService = this.#boardService;

  const preview = boardService.previewRegistration(post);      // 1. Validate
  if (preview !== null) return preview;

  const record = serializeFedosBoardPost(post);
  const persistResult = this.#boardPersistence.putPost(record); // 2. Persistence
  if (persistResult === "failed") return "persistence-failed";
  if (persistResult === "conflict") return "post-id-conflict";

  const registerResult = boardService.registerPost(post);       // 3. Repository
  if (registerResult !== "inserted" && registerResult !== "already-present") {
    throw new Error(/* fail-closed invariant guard, Alpha 394 §1 */);
  }

  return registerResult;                                        // 4/5. Query visibility is automatic; Success.
}
```

`FedosDesktopHostSubmitPostResult` (new exported type) mirrors
`FedosBoardRegistrationResult` (Alpha 307) plus exactly one new token,
`"persistence-failed"` — the SAME additive-mirroring pattern
`FedosBoardPersistenceWriteResult` (Alpha 315) already established over
`FedosBoardRepositoryWriteResult` (Alpha 302). `serializeFedosBoardPost`
(Alpha 314, unmodified) is imported and reused directly — never
reimplemented.

## 4. Guard style: matches `start()`/`stop()`, not `board()`/`query()`

`submitPost()` THROWS for the `"ready"`-state guard — the SAME
convention `start()`/`stop()` already use for an invalid-state call —
rather than returning `null` the way `board()`/`query()` do. This is a
deliberate distinction: `board()`/`query()` are pure ACCESSORS, safe
to call from any state, returning `null` as an ordinary "not available
right now" signal. `submitPost()` is an IMPERATIVE write action, like
`start()`/`stop()` — calling it in the wrong state is treated as a
programming error, not a normal condition a caller should silently
branch on. Every DOMAIN-level rejection (`"invalid-thread"`,
`"missing-parent"`, etc.), by contrast, is a RETURNED token, never a
throw — matching `FedosBoardService.registerPost()`'s own "no
exceptions for normal rejection" convention (Alpha 307) exactly.

## 5. Ripple scope

Exactly one pre-existing test required an update:
`test/secure_runtime_alpha_386_host_query_delegation_review.test.ts`
§2, which asserted `FedosDesktopHost` exposes EXACTLY six public
methods (a Stage 6/Arc 381–390 finding about Query DELEGATION methods
specifically — Alpha 386 declined to add `recentBoardPosts()`/
`threadPosts()`/`queryBoard()`). Updated to expect SEVEN methods,
`submitPost` included, with an explicit comment distinguishing a WRITE
boundary (this Arc's own Objective) from a Query delegation
convenience method (what Alpha 386 declined) — Alpha 386's own actual
finding (test §3: no `recentBoardPosts`/`threadPosts`/`queryBoard`
anywhere in the file) is UNCHANGED and still passes. No other existing
test file required modification — confirmed by full `npm test` run,
pre-existing unrelated Rust-structural failures excluded (see Alpha
400 §5).

## 6. Conclusion

The Host write API is implemented exactly as Alpha 392 decided
(directly on `FedosDesktopHost`) and exactly in the order Alpha 393
fixed, with every failure shape behaving exactly as Alpha 394 named.
`FedosBoardService`, `FedosBoardRepository`, and `FedosBoardPersistence`
all keep their own frozen contracts — `previewRegistration()` is a pure
ADDITIVE read method, `submitPost()` is a pure ADDITIVE write method on
an already-owning class.

## 7. See also

- `docs/secure_runtime_alpha_394_write_failure_policy.md`
- `docs/secure_runtime_alpha_393_write_transaction_order.md`
- `docs/secure_runtime_alpha_392_write_coordination_ownership_decision.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`

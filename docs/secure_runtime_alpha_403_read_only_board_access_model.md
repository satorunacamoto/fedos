# Secure Runtime Alpha 403 — Read-Only Board Access Model

**Status: this Stage implements code.** Stage 3 of the Alpha 401–410
Desktop Host Canonical Write Boundary Closure Arc. Introduces
`src/board/repository/fedos_board_reader.ts` — the smallest honest
read-only Board access contract, plus its one real implementation.

## 1. Why now

Alpha 402 adopted Option C: replace `board()`'s own return type with a
read-only interface, implemented honestly (a real wrapper object, per
Alpha 401 §11's own hidden-exposure finding), with zero transitional
legacy path. This Stage writes that contract and its implementation;
Alpha 404 wires it into the Host.

## 2. `FedosBoardReader` (the contract)

```ts
export interface FedosBoardReader {
  findPost(id: FedosBoardPostId): FedosBoardPost | null;
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[];
}
```

Byte-for-byte the candidate this Arc's own instruction named. Exactly
three methods — no `registerPost()`, no `previewRegistration()`, no
Repository/Index/Persistence reference, no protocol-specific method,
no network, no background work — confirmed by direct inspection: this
file imports only `FedosBoardId`/`FedosBoardPostId`/`FedosThreadId`
(`../fedos_board_identifiers.js`) and `FedosBoardPost`
(`../fedos_board_post.js`), nothing else.

Deliberately does NOT duplicate `FedosBoardQuery`'s own filtering,
ordering, or pagination (Alpha 373–376) — matching this Arc's own
instruction's own division of responsibility: Reader is direct
canonical lookup and grouping ONLY; Query remains the sole owner of
ordering, filtering, and pagination. Neither method set is
reimplemented inside the other.

## 3. `FedosBoardServiceReader` (the one real implementation)

```ts
export class FedosBoardServiceReader implements FedosBoardReader {
  readonly #source: FedosBoardReader;
  constructor(source: FedosBoardReader) { this.#source = source; }
  findPost(id) { return this.#source.findPost(id); }
  listBoardPosts(boardId) { return this.#source.listBoardPosts(boardId); }
  listThreadPosts(boardId, threadId) { return this.#source.listThreadPosts(boardId, threadId); }
}
```

A genuine, minimal forwarding object — NOT a `Proxy`, not a type-level
re-cast of an existing object. Every method is a one-line delegation to
whatever `FedosBoardReader`-shaped object it was constructed with. The
constructor accepts the INTERFACE type, not the concrete
`FedosBoardService` class — this file has zero import of
`fedos_board_service.ts`, avoiding any dependency in that direction;
`FedosBoardService` itself structurally satisfies `FedosBoardReader`
(§4) and can be passed in directly by any caller that owns one (Alpha
404's own `FedosDesktopHost`).

## 4. `FedosBoardService`'s own additive declaration

`src/board/repository/fedos_board_service.ts` gains exactly one
change: `export class FedosBoardService implements FedosBoardReader`.
TypeScript itself verifies, at compile time, that
`findPost`/`listBoardPosts`/`listThreadPosts` already satisfy the
contract verbatim — a genuine compiler-checked confirmation, not a
comment. `registerPost()`/`previewRegistration()` remain present on
`FedosBoardService` itself, completely unaffected — this declaration
narrows nothing about `FedosBoardService`'s own actual shape; it only
confirms a STRUCTURAL SUPERSET relationship the class already had.
Zero new method, zero new field, zero behavior change — confirmed by
the entire pre-existing `FedosBoardService` test suite (Alpha
301–310/395) passing unmodified.

## 5. Why this closes Alpha 401 §11's own hidden-exposure finding

`FedosBoardServiceReader` is the object `FedosDesktopHost.board()`
will return (Alpha 404) — NOT `#boardService` itself, re-typed.
`typeof (new FedosBoardServiceReader(anyService)).registerPost` is
`"undefined"` — confirmed directly: the wrapper's own class body has
no such method, so no such property exists on any instance of it,
regardless of what object it was constructed with. An unsafe cast
through `FedosBoardServiceReader`'s own declared shape has nothing to
call — the closure holds at the object level, not merely the type
level.

## 6. Conclusion

`FedosBoardReader`/`FedosBoardServiceReader` together form the
smallest honest read-only Board access contract this Arc's own
instruction asked for: three methods, one real (non-`Proxy`) wrapper
implementation, zero duplication of Query's own scope, and a genuine
runtime closure against the mutation bypass Alpha 401 named.

## 7. See also

- `docs/secure_runtime_alpha_402_canonical_host_write_authority_decision.md`
- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
- `docs/secure_runtime_alpha_373_recent_feed_query.md`

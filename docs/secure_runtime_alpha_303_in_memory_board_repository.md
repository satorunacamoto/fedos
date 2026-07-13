# Secure Runtime Alpha 303 — In-Memory Board Repository

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/repository/in_memory_fedos_board_repository.ts`.** Stage 3
of the Alpha 301–310 Canonical Board Repository, Index & Feed Foundation
Arc.

## 1. Why now

Alpha 302 fixed the contract. This Stage implements the first (and this
Arc's only) concrete `FedosBoardRepository`, following the private-field
`Map`-backed class convention Alpha 301 §3.4 already found reused twice
in this repository (`InMemorySpaceDirectory`, `InMemoryEventCache`).

## 2. The shape

```ts
export class InMemoryFedosBoardRepository implements FedosBoardRepository {
  readonly #posts = new Map<FedosBoardPostId, FedosBoardPost>();

  register(post: FedosBoardPost): FedosBoardRepositoryWriteResult { ... }
  findPost(id: FedosBoardPostId): FedosBoardPost | null { ... }
  listPosts(): readonly FedosBoardPost[] { ... }
}
```

## 3. Required behavior, confirmed field by field

- **New ID + new post** → insert into `#posts`, return `"inserted"`.
- **Same ID + structurally identical canonical post**
  (`fedosBoardPostsAreStructurallyEqual`, Alpha 302 §5) → NO mutation,
  return `"already-present"`.
- **Same ID + different canonical post** → the ORIGINAL entry is
  preserved untouched; the new one is rejected; return `"conflict"`.
  Fail closed: `#posts` is never overwritten.

## 4. Stored by reference — relying on the already-verified frozen
boundary, not re-copying

This Arc's own instruction asks whether registered posts should be
stored by reference or copied/frozen, and prefers relying on the
existing validated/frozen boundary "if that property is already
guaranteed and verified." It is: `validateFedosBoardPost`
(`../fedos_board_post_validator.js`, Alpha 257) already deep-copies
every nested value and calls `Object.freeze` on the result AND on its
`author`/`source` sub-objects — confirmed by that Stage's own doc §4
("Deep-copy mutable mutable nested values... Freeze output") and its
own structural test. Every `FedosBoardPost` value that could ever reach
this repository was ALREADY produced by that boundary (directly, or via
one of the four Board Adapters, which all compose with it unmodified).
Re-copying or re-freezing here would duplicate work an already-verified
boundary already performed — this repository stores the reference
AS-IS.

## 5. `listPosts` returns a NEW array every call

```ts
listPosts(): readonly FedosBoardPost[] {
  return [...this.#posts.values()];
}
```

A fresh array is constructed on every call — no caller can observe or
mutate the repository's own internal `Map` through the returned value,
and mutating a previously-returned array (if a caller cast away
`readonly`) can never affect a LATER call's own result.

## 6. Insertion order must not silently define feed ranking — named
explicitly

`Map` iteration order is insertion order, so `listPosts()`'s own output
order happens to reflect registration order. This Arc's own instruction
requires this NOT become an implicit ranking: `listPosts()` makes NO
ordering GUARANTEE beyond "some deterministic order reflecting
`Map` semantics" — it is `FedosBoardFeed` (Alpha 308), never this
repository, that defines the ONE meaningful post order
(`createdAt` DESC, id ASC tie-break). This Stage's own test suite
confirms the feed's own ordering is independent of registration order,
not merely documents the claim.

## 7. Requirements, confirmed by construction

- **Deterministic** — `register`/`findPost`/`listPosts` read/write only
  `#posts`; no timestamp, random value, or external state is consulted.
- **No constructor side effects** — the class defines no constructor of
  its own; the implicit default constructor performs no work beyond
  field initialization (`#posts = new Map()`).
- **Independent instances do not share state** — each `new
  InMemoryFedosBoardRepository()` call creates its OWN `Map`; no static
  or module-level shared state exists anywhere in this file.
- **No persistence** — no `import` from `src/storage/`, no file I/O.
- **No background work** — no `setTimeout`/`setInterval`/async work of
  any kind.
- **No implicit source deduplication** — this repository is keyed
  PURELY by `FedosBoardPostId`; it has no knowledge of
  `FedosBoardSourceReference` at all (that is
  `FedosBoardSourceIndex`'s own, separate job, Alpha 304).
- **No clone policy invented without review** — the "store by
  reference" decision is the reviewed policy (§4); no ad hoc
  copy/freeze logic is added anywhere in this file.

## 8. See also

- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`

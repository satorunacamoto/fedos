# Secure Runtime Alpha 316 — In-Memory Board Persistence Backend

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/persistence/in_memory_fedos_board_persistence.ts`.** Stage 6
of the Alpha 311–320 Canonical Board Persistence Boundary Arc.

## 1. Why now

Alpha 315 fixed the port. This Stage implements the first (and this
Arc's only) concrete `FedosBoardPersistence`, following the SAME
private-field `Map`-backed class convention `InMemoryFedosBoardRepository`
(Alpha 303) already established.

## 2. The shape

```ts
export class InMemoryFedosBoardPersistence implements FedosBoardPersistence {
  readonly #records = new Map<string, FedosPersistedBoardPostRecordV1>();

  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult { ... }
  getPost(id: string): FedosPersistedBoardPostRecordV1 | null { ... }
  listPosts(): readonly FedosPersistedBoardPostRecordV1[] { ... }
}
```

## 3. Not the same thing as `InMemoryFedosBoardRepository` — confirmed
by what each one stores

This Arc's own instruction states this explicitly, and it is worth
confirming precisely, not merely asserting: **Persistence stores plain
persisted records** (`FedosPersistedBoardPostRecordV1`, Alpha 313 —
unbranded strings, no runtime behavior). **Repository stores validated
`FedosBoardPost` application objects** (Alpha 303 — branded ids,
produced exclusively by `validateFedosBoardPost`, Alpha 257). The two
classes are STRUCTURALLY parallel (both a private `Map`, both the same
three-way `"inserted"`/`"already-present"`/`"conflict"` outcome
discipline) but hold DIFFERENT TYPES at DIFFERENT layers —
`PersistedFedosBoardRepository` (Alpha 317) is the ONE place that
bridges them, never this file.

## 4. Required behavior, confirmed field by field

- **New record → inserted.**
- **Identical record** (`fedosPersistedBoardPostRecordsAreEqual`, Alpha
  315 §3a) **→ already-present**, no mutation.
- **Same ID, different record → conflict**, the original preserved,
  never overwritten.
- **Independent instances** — each `new InMemoryFedosBoardPersistence()`
  call creates its OWN `Map`; no module-level shared state exists
  anywhere in this file.
- **`listPosts()` returns a NEW readonly array** every call — no live
  reference to the internal `Map` is ever exposed, the identical
  guarantee `InMemoryFedosBoardRepository.listPosts()` (Alpha 303 §5)
  already makes.
- **Deterministic insertion retention** — `putPost` never reorders or
  drops an existing entry except via the explicit conflict rule above;
  the SAME record inserted, queried, and inserted again always yields
  the SAME `getPost` result.
- **No shared global state, no filesystem, no background work** —
  confirmed structurally: no module-level `let`/`var`, no `import` from
  `src/storage/`/`src/runtime/`, no `setTimeout`/`setInterval`/async
  function anywhere in this file.
- **No serialization to JSON required internally** — `#records` stores
  the PLAIN OBJECT record directly; nothing in this file ever calls
  `JSON.stringify`/`JSON.parse` (continuing Alpha 314 §3's own decision
  that no JSON step exists anywhere in this Arc's own code).
- **No indexes, no feed logic** — this file exposes exactly the three
  `FedosBoardPersistence` methods (Alpha 315) and nothing else; board/
  thread indexing and feed ordering remain `FedosBoardIndex`/
  `FedosBoardFeed`'s own exclusive concern (Alpha 305/308, rebuilt from
  persisted records only during hydration, Alpha 318 — never persisted
  themselves, per this Arc's own Core Persistence Rule).

## 5. See also

- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_303_in_memory_board_repository.md`
- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_317_persisted_board_repository.md`

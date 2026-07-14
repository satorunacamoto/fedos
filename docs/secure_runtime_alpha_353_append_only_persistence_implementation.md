# Secure Runtime Alpha 353 — Implement AppendOnlyFedosBoardPersistence

**Status: this Stage implements code.** Stage 3 of the Alpha 351–360
Append-only Durable Board Backend Arc. Adds
`src/board/persistence/append_only_fedos_board_persistence.ts`,
exporting `AppendOnlyFedosBoardPersistence`.

## 1. Naming

This Arc's own instruction names the class `AppendOnlyBoardPersistence`.
This Stage names it **`AppendOnlyFedosBoardPersistence`** instead —
matching this repository's own established, exceptionless naming
convention for every concrete `FedosBoardPersistence` implementation:
`InMemoryFedosBoardPersistence` (Alpha 316), `PersistedFedosBoardRepository`
(Alpha 317, a related-but-distinct type). Every class in
`src/board/persistence/` carries the `Fedos` infix; this Stage keeps
that convention unbroken rather than introducing the first exception.

## 2. Location and dependency footprint

`src/board/persistence/append_only_fedos_board_persistence.ts` — the
same directory as every other persistence implementation. Uses ONLY
`node:fs` (`readFileSync`, `appendFileSync`), reached the exact same
untyped way `fedos_windows_dpapi_helper.ts` already reaches
`node:child_process` (Alpha 023): a `// @ts-expect-error` comment,
since this project's own `tsconfig.json` carries no `@types/node`.
**Zero new `package.json`/`Cargo.toml` dependency of any kind** —
confirmed by this Arc's own regression tests.

## 3. Constructor: no I/O

```ts
constructor(filePath: string) {
  this.#filePath = filePath;
}
```

Performs ONLY a field assignment — no `readFileSync`, no `existsSync`,
no directory creation, matching `InMemoryFedosBoardPersistence`'s own
"Deterministic, no constructor side effects" guardrail (Alpha 316)
exactly. The file is read fresh on every `getPost`/`listPosts` call
(Alpha 355) — never once, eagerly, at construction.

## 4. Shape

```ts
export class AppendOnlyFedosBoardPersistence implements FedosBoardPersistence {
  readonly #filePath: string;
  constructor(filePath: string) { ... }
  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult { ... }
  getPost(id: string): FedosPersistedBoardPostRecordV1 | null { ... }
  listPosts(): readonly FedosPersistedBoardPostRecordV1[] { ... }
}
```

Exactly the `FedosBoardPersistence` port (Alpha 315) — no additional
public method, no additional exported type beyond the class itself.

## 5. Why the file path is caller-supplied, not resolved internally

This class never chooses, constructs, or defaults a filesystem path of
its own — the caller supplies one, fully formed, to the constructor.
This matches Alpha 347 §3's own explicit non-decision ("the actual
filesystem ROOT... is Alpha 338 §5's own still-open 'configuration
sourcing' question, unresolved by this Arc") — carried forward
unresolved into THIS Arc too, deliberately: nothing in
`FedosDesktopHost` or `createFedosDesktopHost` is wired to construct
or select a path for this class (this Arc does not touch either
file — see Alpha 360 §"remaining limitations").

## 6. Conclusion

`AppendOnlyFedosBoardPersistence` exists, implements
`FedosBoardPersistence` exactly, uses zero new dependency, performs no
constructor-time I/O, and accepts a caller-supplied path without
resolving one itself — every design constraint fixed by Alpha 349–352
carried through into real code, unmodified.

## 7. See also

- `docs/secure_runtime_alpha_352_append_only_record_format.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`
- `docs/secure_runtime_alpha_023_windows_dpapi_storage_backend.md`
- `docs/secure_runtime_alpha_347_storage_layout_review.md`

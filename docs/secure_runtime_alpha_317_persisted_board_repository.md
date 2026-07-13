# Secure Runtime Alpha 317 — Persisted Board Repository Adapter

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/persistence/persisted_fedos_board_repository.ts`.** Stage 7
of the Alpha 311–320 Canonical Board Persistence Boundary Arc.

## 1. Why now

Alpha 313–316 fixed the record shape, codec, port, and in-memory
backend. This Stage bridges them to the ALREADY-FROZEN
`FedosBoardRepository` contract (Alpha 302, "MUST NOT be redesigned")
so a persistence-backed repository can be used anywhere an in-memory one
already is, with NO change to `FedosBoardService` (Alpha 307) or any
other existing caller.

## 2. The shape

```ts
export class PersistedFedosBoardRepository implements FedosBoardRepository {
  constructor(persistence: FedosBoardPersistence);

  register(post: FedosBoardPost): FedosBoardRepositoryWriteResult;
  findPost(id: FedosBoardPostId): FedosBoardPost | null;
  listPosts(): readonly FedosBoardPost[];

  // Supplementary, NOT part of FedosBoardRepository -- see §4.
  listPostsDiagnostic(): FedosBoardRepositoryListDiagnostic;
}
```

## 3. `register` — serialize, write, map the result

```
register(post):
  record = serializeFedosBoardPost(post)          (Alpha 314)
  result = persistence.putPost(record)            (Alpha 315)
  "inserted"        -> "inserted"
  "already-present" -> "already-present"
  "conflict"        -> "conflict"
  "failed"          -> "conflict"   (§3a)
```

### 3a. Mapping `"failed"` to `"conflict"` — a documented, currently
unreachable decision

`FedosBoardRepository`'s own frozen contract (Alpha 302) has exactly
THREE outcomes — it was fixed before `FedosBoardPersistenceWriteResult`'s
FOURTH outcome (`"failed"`, Alpha 315 §3) existed, and this Arc may not
redesign it. `InMemoryFedosBoardPersistence`
(`./in_memory_fedos_board_persistence.js`, Alpha 316) — this Arc's ONLY
backend — can NEVER actually produce `"failed"` (confirmed structurally:
its own `putPost` returns only `"inserted"`/`"already-present"`/
`"conflict"`), so this mapping is UNREACHABLE in this Arc's own test
suite. It is decided and documented here anyway, for the FUTURE durable
backend `"failed"` exists to describe (Alpha 320 §5): `"conflict"` is
the conservative, fail-closed choice — it means "this adapter refuses to
claim the write succeeded," which is true whether the underlying cause
was a genuine content conflict or a backend I/O failure. This decision
should be REVISITED, not silently inherited, once a real backend that
can produce `"failed"` is built.

## 4. `findPost` — deserialize and validate, `null` on corruption

```
findPost(id):
  record = persistence.getPost(id)
  record === null -> null
  return deserializeFedosBoardPost(record)   (Alpha 314, already fails
                                               closed to null on ANY
                                               malformed/corrupt shape)
```

Exactly this Arc's own required flow.

## 5. `listPosts` — Option B, strict fail-closed, plus a documented
Option C diagnostic

`FedosBoardRepository.listPosts()`'s own frozen signature returns
`readonly FedosBoardPost[]` — it CANNOT be widened into Option C's own
richer "posts + corruption count" result object without redesigning the
frozen contract (prohibited). This Stage therefore implements the
REQUIRED `listPosts()` using **Option B** ("return an empty list if any
corrupt record exists"): every persisted record is deserialized; if EVEN
ONE fails, `listPosts()` returns `[]` — never a partial, silently-missing
list masquerading as complete.

**"Do not silently hide corruption without documenting it"** is
satisfied by a SUPPLEMENTARY method, NOT part of `FedosBoardRepository`,
implementing **Option C**:

```ts
export interface FedosBoardRepositoryListDiagnostic {
  readonly posts: readonly FedosBoardPost[];
  readonly corruptRecordCount: number;
}

listPostsDiagnostic(): FedosBoardRepositoryListDiagnostic
```

`listPostsDiagnostic()` deserializes every record, keeping the VALID
ones and counting the corrupt ones — giving a caller who explicitly asks
for it BOTH partial visibility and an honest corruption count, while
`listPosts()` itself stays strict. **Do not implement repair. Do not
mutate corrupt records.** Confirmed: neither method ever writes back to
`persistence` — both are pure reads.

## 6. Compose, don't reimplement

`PersistedFedosBoardRepository` performs NO validation of its own beyond
what `serializeFedosBoardPost`/`deserializeFedosBoardPost` (Alpha 314)
already do — it is a thin composition layer over the codec and the port,
matching this whole series' repeated "compose, don't duplicate"
discipline (Alpha 266 §4, Alpha 287 §6, Alpha 297 §6, Alpha 307 §4/§6).

## 7. See also

- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`

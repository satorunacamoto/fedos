# Secure Runtime Alpha 342 — Current Persistence Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 2 of the Alpha 341–350 Board Durable Backend
Re-evaluation & Local Backend Selection Arc.

## 1. Why now

Alpha 341 confirmed the Host can structurally own any
`FedosBoardPersistence` implementation. Before comparing SQLite and
append-only again, this Stage re-reads the FOUR frozen pieces every
backend must satisfy — the port, the persisted-repository adapter,
hydration, and serialization — and separates what is genuinely
backend-INDEPENDENT (binding on any future implementation) from what
merely happens to be true of `InMemoryFedosBoardPersistence` today. **No
redesign is proposed anywhere in this Stage.**

## 2. `FedosBoardPersistence` (Alpha 315) — the port

```ts
export interface FedosBoardPersistence {
  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult;
  getPost(id: string): FedosPersistedBoardPostRecordV1 | null;
  listPosts(): readonly FedosPersistedBoardPostRecordV1[];
}
```

Backend-independent, by the port's own frozen contract (Alpha 315
"HARD GUARDRAILS", unmodified):

- **Synchronous.** Every method returns a plain value, never a
  `Promise`. Alpha 315 §"HARD GUARDRAILS" states directly: "a future
  async backend needs a SEPARATE port, never a silent mutation of this
  one." Any backend selected by THIS Arc must therefore be
  implementable synchronously, or else this Arc's own recommendation
  would require a second, not-yet-designed port — a materially bigger
  decision than a backend choice alone.
- **No database vocabulary.** No SQL, no KV key, no filesystem path,
  no Secure Runtime handle, no `p2p` type, no protocol adapter, no
  network — confirmed unchanged by direct inspection.
- **No `delete` method.** Deliberately excluded (Alpha 315 §4) —
  binding on every future backend equally; this Arc does not revisit
  that exclusion.
- **`FedosBoardPersistenceWriteResult`** — `"inserted"` /
  `"already-present"` / `"conflict"` / `"failed"`. `"failed"` is
  reserved for "the backend itself could not complete the write for a
  reason unrelated to record content" — `InMemoryFedosBoardPersistence`
  never returns it (an in-memory `Map` write cannot fail), but ANY
  disk-backed backend genuinely can (a full disk, a permissions error,
  a corrupt file). `PersistedFedosBoardRepository.register()`
  (`src/board/persistence/persisted_fedos_board_repository.ts`, Alpha
  317) already conservatively maps `"failed"` to `"conflict"` at the
  `FedosBoardRepository` boundary — its own comment states this is
  "Unreachable with `InMemoryFedosBoardPersistence` this Arc — a
  documented, deliberate, conservative mapping for a future durable
  backend." **This is the single clearest piece of evidence in this
  repository that a real disk-backed backend was always anticipated,
  not merely permitted.**

## 3. `PersistedFedosBoardRepository` (Alpha 317)

Bridges ANY `FedosBoardPersistence` to the already-frozen
`FedosBoardRepository` contract (Alpha 302) with zero backend-specific
code — `register`/`findPost`/`listPosts` do nothing but serialize/
deserialize and delegate. `listPosts()` is Option B (strict
fail-closed: empty array on ANY corrupt record); `listPostsDiagnostic()`
(not part of the frozen contract) is Option C (partial visibility plus
a count). Both are backend-independent — neither reads anything
backend-specific from `#persistence`.

## 4. `hydrateFedosBoardService` (Alpha 318)

Reads `persistence.listPosts()` ONCE, deserializes every record,
performs a bounded topological registration pass, and returns
`"hydrated"` with a fresh `FedosBoardService`, or one of two rejection
outcomes with `service: null`. Nothing in this function's own body
branches on which `FedosBoardPersistence` implementation produced the
records — it is already, completely, backend-independent, and this
Arc's own recommendation (Alpha 349) reuses it UNCHANGED regardless of
outcome.

## 5. Serialization (`fedos_board_post_codec.ts`, Alpha 314; `fedos_persisted_board_post_v1.ts`, Alpha 313)

`FedosPersistedBoardPostRecordV1` — `schemaVersion: 1`, plain
serializable fields only (no branded types, no `Map`/`Set`, no class
instance, no function). `serializeFedosBoardPost`/
`deserializeFedosBoardPost` perform field-by-field copying — NO
`JSON.stringify`/`JSON.parse` step exists anywhere in this file today.
This matters directly for Alpha 344: an append-only backend that
chooses a JSON-lines wire format would be the FIRST place in this
repository's Board layer to introduce an actual JSON serialization
step — currently backend-independent code stops one layer short of
any wire format, deliberately (Alpha 314 §"No mutation, no JSON string
produced or parsed anywhere in this file").

## 6. Conclusion

Four properties are binding on ANY future backend, confirmed
unchanged: (1) the port must be reachable synchronously; (2) the port
carries no database vocabulary and no `delete`; (3) a real disk-backed
backend is expected, eventually, to be able to report `"failed"` —
already anticipated at the repository-adapter boundary; (4) hydration
and the persisted-repository adapter are ALREADY fully
backend-independent and require zero change for any backend this Arc
might select. No redesign is warranted or proposed.

## 7. See also

- `docs/secure_runtime_alpha_341_host_capability_inventory.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`

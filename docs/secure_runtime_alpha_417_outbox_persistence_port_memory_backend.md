# Secure Runtime Alpha 417 — Outbox Persistence Port and In-Memory Backend

Stage 7 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc. Implements `src/board/outbox/fedos_board_outbox_persistence.ts`
and `src/board/outbox/in_memory_fedos_board_outbox_persistence.ts`.

## 1. Port

```ts
export interface FedosBoardOutboxPersistence {
  putIntent(record: FedosPersistedBoardOutboxRecordV1): FedosBoardOutboxPersistenceWriteResult;
  getIntent(id: string): FedosPersistedBoardOutboxRecordV1 | null;
  listIntents(): readonly FedosPersistedBoardOutboxRecordV1[];
}
```

`FedosBoardOutboxPersistenceWriteResult` mirrors
`FedosBoardPersistenceWriteResult` (Alpha 315) exactly: `"inserted"` /
`"already-present"` / `"conflict"` / `"failed"`.

**No `putObservation`/`listObservations` this Arc** — Alpha 415 decided
directly that no observation model is strictly required this Arc (no
consumer exists to write one), so this port ships with exactly the
three methods above. Adding observation methods later is additive and
non-breaking.

## 2. Explicitly excluded

No `delete`, `dequeue`, `acknowledge`, `retry`, `lease`, `lock`,
`claim`, protocol-publisher method, database-specific vocabulary, SQL,
KV key, network call, or Board Repository mutation of any kind —
confirmed by direct inspection of the finished interface: three methods,
nothing else.

## 3. `InMemoryFedosBoardOutboxPersistence`

Follows `InMemoryFedosBoardPersistence`'s own Alpha 316 convention
exactly: one private `Map<string, FedosPersistedBoardOutboxRecordV1>`
field, deterministic construction with no side effects,
`fedosPersistedBoardOutboxRecordsAreEqual` (this Stage's own equality
helper, mirroring `fedosPersistedBoardPostRecordsAreEqual`) deciding
`"already-present"` vs `"conflict"`.

Verified behavior:

- writing the identical record twice → `"already-present"`, no
  mutation;
- writing the same `id` with a different `target`/`postId`/`createdAt`
  → `"conflict"`, original preserved;
- two `InMemoryFedosBoardOutboxPersistence` instances never share state
  — no module-level mutable variable exists in the file;
- `listIntents()` returns a freshly-spread array on every call — a
  caller mutating a previously-returned array cannot affect the
  backend's own internal `Map`.

## 4. See also

- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`
- `docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`
- `docs/secure_runtime_alpha_418_append_only_durable_outbox.md`

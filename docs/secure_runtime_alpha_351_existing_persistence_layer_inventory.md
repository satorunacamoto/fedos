# Secure Runtime Alpha 351 — Existing Persistence Layer Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 351–360
Append-only Durable Board Backend Arc, implementing the architecture
Alpha 349 froze.

## 1. Why now

Alpha 350 closed the Board Durable Backend Re-evaluation Arc with an
explicit Decision (Alpha 349): append-only, first. It recommended
exactly this Arc next — building the real implementation. Before
writing a line of backend code, this Stage re-reads the four frozen
pieces every backend must satisfy, confirming — by direct inspection
of the ACTUAL source, not by recollection of Alpha 342's own prior
summary — that no interface change is required.

## 2. `FedosBoardPersistence` (`src/board/persistence/fedos_board_persistence.ts`, Alpha 315)

Unchanged: `putPost(record): FedosBoardPersistenceWriteResult`,
`getPost(id): FedosPersistedBoardPostRecordV1 | null`,
`listPosts(): readonly FedosPersistedBoardPostRecordV1[]`. Synchronous.
No `delete`. `FedosBoardPersistenceWriteResult` — `"inserted"` /
`"already-present"` / `"conflict"` / `"failed"`. A new implementing
class needs NOTHING beyond satisfying this exact shape — confirmed by
direct inspection, byte-for-byte identical to Alpha 342 §2's own
reading.

## 3. `PersistedFedosBoardRepository` (`src/board/persistence/persisted_fedos_board_repository.ts`, Alpha 317)

Unchanged: bridges ANY `FedosBoardPersistence` to the frozen
`FedosBoardRepository` contract (Alpha 302) via `serializeFedosBoardPost`/
`deserializeFedosBoardPost` alone — no backend-specific code exists in
this file, and none needs to be added for an append-only backend to
work through it. `register()`'s own conservative `"failed"` →
`"conflict"` mapping (Alpha 317 §3a) is now, for the first time,
REACHABLE — a durable backend can genuinely fail a write; confirmed
this remains exactly as documented, unmodified.

## 4. Hydration (`src/board/persistence/fedos_board_hydration.ts`, Alpha 318)

Unchanged: `hydrateFedosBoardService(persistence)` calls
`persistence.listPosts()` exactly once and branches on NOTHING
backend-specific. This Arc's own Alpha 358 will hydrate an
`AppendOnlyFedosBoardPersistence` through this EXACT function, with
zero modification, confirming Alpha 342 §4's own finding still holds.

## 5. Serialization (`src/board/persistence/fedos_board_post_codec.ts`, Alpha 314; `fedos_persisted_board_post_v1.ts`, Alpha 313)

Unchanged: `FedosPersistedBoardPostRecordV1` — `schemaVersion: 1`,
plain serializable fields only. `serializeFedosBoardPost`/
`deserializeFedosBoardPost` perform field-by-field copying, no
`JSON.stringify`/`JSON.parse` step. Confirmed this remains exactly as
Alpha 342 §5 found it — this Arc's own append-only backend will be the
FIRST place in the Board persistence layer to introduce an actual JSON
wire step, entirely inside its own file, never inside the codec.

## 6. Verification: no interface change is required

Confirmed, by direct inspection of all four files above: EVERY method
signature, EVERY exported type, and EVERY guardrail from Alpha 313–318
remains byte-for-byte unchanged. `AppendOnlyFedosBoardPersistence`
(Alpha 353) will implement `FedosBoardPersistence` exactly as written
today — no new method is added to the port, no existing method's
signature changes, and no caller of `FedosBoardPersistence` (
`PersistedFedosBoardRepository`, `hydrateFedosBoardService`) needs any
change to accept it. This satisfies this Arc's own Absolute
Requirement, "Preserve every existing public interface," structurally,
before any implementation code is written.

## 7. Conclusion

The persistence layer this Arc builds on is frozen and confirmed
sufficient, exactly as Alpha 342 found it two Arcs ago. No redesign,
no interface change, and no modification to any of these four files is
required — or performed — anywhere in this Arc.

## 8. See also

- `docs/secure_runtime_alpha_350_backend_reevaluation_completion.md`
- `docs/secure_runtime_alpha_342_current_persistence_review.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`

# Secure Runtime Alpha 315 — Board Persistence Port

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/persistence/fedos_board_persistence.ts`.** Stage 5 of the
Alpha 311–320 Canonical Board Persistence Boundary Arc.

## 1. Why now

Alpha 313–314 fixed the persisted record shape and its codec. This
Stage fixes the BACKEND-NEUTRAL port every future persistence backend
(the in-memory one this Arc ships, Alpha 316; a real durable one, Alpha
320 §5's own recommended next Arc) implements.

## 2. The contract

```ts
export type FedosBoardPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosBoardPersistence {
  putPost(record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult;
  getPost(id: string): FedosPersistedBoardPostRecordV1 | null;
  listPosts(): readonly FedosPersistedBoardPostRecordV1[];
}
```

## 3. `FedosBoardPersistenceWriteResult` — the SAME three-way discipline,
plus one persistence-specific outcome

`"inserted"`/`"already-present"`/`"conflict"` mirror
`FedosBoardRepositoryWriteResult` (Alpha 302) EXACTLY — the identical
discriminated-outcome discipline this whole series has applied at every
layer (Repository, Source Index, Board Index, Service, and now
Persistence). A FOURTH outcome, `"failed"`, is added because a
persistence BACKEND (unlike an in-memory container) can fail for
reasons entirely outside this port's own control (a future durable
backend's own I/O error, disk full, connection lost) — `"conflict"`
would misrepresent that kind of failure as "the same id, different
content," which it is not. No boolean hides the reason, continuing this
whole series' own convention.

## 3a. `fedosPersistedBoardPostRecordsAreEqual` — structural equality
lives with the port, not the record type

Exported alongside the contract (not from `fedos_persisted_board_post_v1.ts`,
which stays TYPE ONLY per Alpha 313's own guardrail) because it is part
of the PORT's own semantics — what `"already-present"` (§3) MEANS —
mirroring exactly where `fedosBoardPostsAreStructurallyEqual` lives
relative to `FedosBoardRepository` (Alpha 302 §5: the equality helper
lives with the CONTRACT, not the immutable model). A plain, explicit
field-by-field comparison (`schemaVersion`/`id`/`boardId`/`threadId`/
`replyTo`/`body`/`createdAt`/`author.*`/`source.*`) — deliberately NOT a
`JSON.stringify` comparison, since this port makes no claim about key
enumeration order for any backend's own record construction (Alpha 316
§"Use structural equality with a documented deterministic policy" is
satisfied by this explicit, order-independent comparison, not by an
unproven assumption about serialization order).

## 4. `delete` — reviewed and excluded, same reasoning as the Repository

This Arc's own instruction asks explicitly whether `delete` belongs
here. **Preferred decision: no delete in this Arc**, adopted. "Federated
deletion and moderation remain separate facts" — the IDENTICAL reasoning
`FedosBoardRepository`'s own contract already applied (Alpha 302 §3):
`FedosBoardPost` is immutable, and a persisted record's removal is a
moderation/federated-deletion concern this Arc does not design (Alpha
313 §5, Alpha 320 §4). The persistence port stays minimal, matching the
Repository contract's own minimality exactly.

## 5. Requirements, confirmed by construction

- **Synchronous interface for the memory implementation** — no method
  returns a `Promise` (see §6 for why this is explicitly named as an
  IN-MEMORY-SPECIFIC choice, not a permanent constraint).
- **No database-specific vocabulary** — no `table`, `row`, `query`,
  `transaction`, or SQL-shaped term anywhere in this file.
- **No SQL** — confirmed; no string-based query of any kind.
- **No KV keys exposed** — no Cloudflare KV-shaped key/namespace
  concept.
- **No filesystem paths** — no `path`/`file`/`directory` field or
  parameter of any kind.
- **No Secure Runtime handles** — no reference to `AeadCiphertextWire`,
  `RuntimeStorageBackend`, or any symbol from `src/runtime/`.
- **No `p2p` types** — no reference to anything under `p2p/`.
- **No protocol adapters** — no reference to any of the four Board
  Adapters (`src/board/fedos_board_nostr_adapter.ts`,
  `src/board/activitypub/*`, `src/board/atproto/*`,
  `src/board/session/*`).
- **No network** — no `fetch`, no `WebSocket`, no async function of any
  kind.

## 6. A future asynchronous backend needs a SEPARATE async port, not a
silently-mutated contract

This Arc's own instruction requires documenting this explicitly, not
leaving it implicit. A real durable backend (SQLite, D1, IndexedDB — all
explicitly out of scope this Arc, Alpha 320 §4) would almost certainly
need `Promise`-returning methods (matching `RuntimeStorageBackend`'s own
async shape, Alpha 021, reviewed and explicitly NOT reused this Arc for
unrelated reasons, Alpha 311 §3.2). Changing `FedosBoardPersistence`'s
OWN synchronous methods to return `Promise`s LATER would be a BREAKING
change to every existing caller (`PersistedFedosBoardRepository`, Alpha
317; `hydrateFedosBoardService`, Alpha 318) — silently mutating a
contract those callers were written against. The correct future path,
named here so it is not improvised later, is a SEPARATE, explicitly-new
`FedosAsyncBoardPersistence` (or similarly-named) interface — mirroring
`SpaceDirectory`/`AsyncSpaceDirectory`'s own existing SEPARATE-interface
precedent (`src/community/directory.ts`, Stage 11: "A backing store like
D1 cannot satisfy the synchronous interface, so persistent adapters
implement this one [async] instead... the same conceptual role... not
one interface with an optional-Promise return type"). This Arc adopts
that same discipline in advance, rather than inventing a new one when
the async backend eventually arrives.

## 7. See also

- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`

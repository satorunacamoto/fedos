# Secure Runtime Alpha 322 — Durable Backend Requirements

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 2 of the Alpha 321–330 Board Durable Backend Selection &
Architecture Arc. Freezes the requirement set BEFORE any candidate
technology (Alpha 323–326) is compared against it.

## 1. Why now

Alpha 321 established which environments are real (Cloudflare Workers,
Node) and which are not (browser, Desktop shell), and that Board has no
real caller in any production runtime yet. Comparing SQLite/IndexedDB/
D1/append-only file without a frozen requirement set first would let
each candidate's own strengths silently define "what's required" —
backwards. This Stage fixes requirements against the ALREADY-FROZEN
contracts instead: `FedosBoardPersistence` (Alpha 315),
`FedosPersistedBoardPostRecordV1` (Alpha 313), and
`hydrateFedosBoardService` (Alpha 318).

## 2. MUST

Directly required by contracts already frozen and MUST NOT be
redesigned:

- **`putPost`/`getPost`/`listPosts`** — the exact three-method shape
  `FedosBoardPersistence` already defines (Alpha 315). No backend may
  require a fourth core operation to function.
- **Deterministic conflict detection** — `"inserted"` / `"already-present"`
  / `"conflict"` / `"failed"`, via
  `fedosPersistedBoardPostRecordsAreEqual` field-by-field comparison
  (Alpha 315), not a hash or `JSON.stringify` shortcut a backend might
  otherwise be tempted to substitute.
- **No overwrite on conflict** — a `"conflict"` result MUST leave the
  original stored record untouched, exactly as
  `InMemoryFedosBoardPersistence.putPost` already guarantees (Alpha 316).
- **`schemaVersion` preservation** — the stored physical representation
  MUST round-trip `FedosPersistedBoardPostRecordV1` exactly, including
  its literal `schemaVersion: 1` field, byte-for-byte through
  `serializeFedosBoardPost`/`deserializeFedosBoardPost` (Alpha 314).
- **Corruption detection, fail-closed** — any record a backend cannot
  faithfully return MUST be treated as corrupt by the layer above it
  (`deserializeFedosBoardPost` already returns `null` on any mismatch,
  Alpha 314) — a backend must never silently coerce or repair a record.
- **Independent instances** — exactly as `InMemoryFedosBoardPersistence`
  already guarantees (Alpha 316 §"Independent instances never share
  state"): two backend instances constructed separately MUST NOT share
  mutable state, even if backed by the same physical medium (e.g. two
  file-backed instances pointed at two different paths).
- **Atomic single-record writes** — `putPost` operates on exactly ONE
  record; a backend MUST NOT partially apply a single `putPost` call
  (e.g. write half a record on crash/error).
- **Bounded startup hydration** — `hydrateFedosBoardService` (Alpha 318)
  already assumes `listPosts()` returns a finite, enumerable collection
  it can sort and replay in a bounded topological pass; a backend MUST
  support a full, terminating enumeration of every stored record.
- **Backup feasibility** — the stored physical form MUST be copyable/
  exportable by some means external to the application (even if that
  means is "copy this file" or "export this table") — required so a
  future migration/backup story (Alpha 328) has something to act on.
- **Migration feasibility** — a backend MUST NOT make future
  `schemaVersion` migration structurally impossible (e.g. by baking the
  wire shape irreversibly into a physical schema with no `schemaVersion`
  column/field of its own).
- **Test isolation** — exactly as `InMemoryFedosBoardPersistence`
  already provides trivially: a fresh backend instance per test MUST NOT
  leak state into another test, whether via a shared file path, a shared
  in-memory singleton, or a shared table.
- **No protocol-specific logic** — exactly as `FedosBoardPersistence`'s
  own guardrail already states (Alpha 315): no Nostr/ActivityPub/AT
  Protocol/Session vocabulary may leak into a backend's own storage
  logic; it stores `FedosPersistedBoardPostRecordV1` only.
- **No ontology coupling** — no reference to `p2p/`, directly or
  transitively, in any backend implementation.

## 3. SHOULD

Desirable, but not required by any already-frozen contract:

- **Batch insert** — would speed up hydration's own bulk load at
  startup, but `hydrateFedosBoardService` already tolerates one
  `putPost`-equivalent call per record; no correctness property depends
  on batching.
- **Ordered iteration** — would be a nice backend property, but
  `hydrateFedosBoardService` already imposes its OWN deterministic order
  (sort by `id` before topological replay, Alpha 318) independent of
  whatever order `listPosts()` returns records in — so backend iteration
  order is not load-bearing.
- **Worker-environment support** — Cloudflare Workers is this
  repository's own primary real environment (Alpha 321 §3.2), so a
  backend usable there is desirable, but Board has zero current wiring
  into `src/worker.ts` (Alpha 321 §3.4), so no concrete Worker caller
  requires this YET.

## 4. NOT YET

Explicitly not required this Arc, several because this Arc's own
Absolute Prohibitions forbid implementing them regardless:

- **Transactions** — `FedosBoardPersistence`'s own port is single-record
  (`putPost` one record at a time); no multi-record atomicity requirement
  exists anywhere in the frozen contract. A future async port (Alpha 315
  §6) might introduce one, but that is a separate, unbuilt port.
- **Secondary indexes** — Source/Board/Thread Index are already rebuilt
  entirely as a side effect of `FedosBoardService.registerPost` during
  hydration (Alpha 318 §3/§4); a backend that tried to own its own
  secondary index would duplicate authority that already lives
  in-memory, one layer above the backend.
- **Encryption at rest** — explicitly out of scope and prohibited this
  Arc (and the prior Arc, Alpha 320 §4).
- **Concurrent writers** — no multi-process Board deployment exists or
  is planned this Arc; Board has no real caller at all yet (Alpha 321
  §3.4), so there is no concurrent writer to support.
- **Multiple processes** — same reasoning; a single caller, once one
  exists, is the only scenario in view.
- **Browser support** — no browser environment exists in this repository
  (Alpha 321 §3.1); requiring it now would be building against an
  environment that is not real.
- **Worker support (as a hard requirement)** — desirable (§3 SHOULD) but
  not required, since Board is not wired into the Worker's `fetch`
  handler today.
- **Desktop support (as a hard requirement)** — no real Desktop shell
  exists (Alpha 321 §3.3); requiring it now would be the same
  imaginary-environment error the browser bullet above names.

## 5. Conclusion

The MUST list is derived entirely from contracts this Arc's own
instruction says MUST NOT be redesigned (`FedosBoardPersistence`,
`FedosPersistedBoardPostRecordV1`, `hydrateFedosBoardService`) — nothing
here is invented for a candidate technology's convenience. The NOT YET
list is dominated by capabilities no real environment or caller
currently needs (Alpha 321), not by any technology's own limitation —
this distinction matters for Alpha 323–326, which must not penalize a
candidate for lacking a NOT YET capability, and must not credit a
candidate for a MUST capability it does not actually have.

## 6. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`

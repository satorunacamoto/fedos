# Secure Runtime Alpha 356 — Conflict Handling

**Status: this Stage implements code (verification of existing Alpha
353/354 behavior; no new production logic beyond what those Stages
already ship).** Stage 6 of the Alpha 351–360 Append-only Durable
Board Backend Arc. Verifies `"inserted"` / `"already-present"` /
`"conflict"` / `"failed"` behave exactly like
`InMemoryFedosBoardPersistence`.

## 1. `"inserted"`

No existing record for `record.id` is found by `getPost()` — the
record is appended, and `"inserted"` is returned. Identical to
`InMemoryFedosBoardPersistence.putPost()`'s own first branch (Alpha
316: `existing === undefined` → `Map.set` → `"inserted"`).

## 2. `"already-present"`

A record already exists for `record.id`, and
`fedosPersistedBoardPostRecordsAreEqual(existing, record)` is `true`
(Alpha 315's own field-by-field equality, UNMODIFIED, imported
directly — never reimplemented). Nothing is written to disk.
Identical to `InMemoryFedosBoardPersistence`'s own second branch.

## 3. `"conflict"`

A record already exists for `record.id`, and the equality check is
`false` — a genuinely different record sharing the same `id`. Nothing
is written; the ORIGINAL record on disk is preserved, untouched,
exactly as `InMemoryFedosBoardPersistence`'s own third branch
guarantees (Alpha 316's own regression coverage already proves this
holds for the in-memory backend; this Stage's own test suite proves it
holds identically here).

## 4. `"failed"` — REACHABLE for the first time in this repository

`InMemoryFedosBoardPersistence` can NEVER return `"failed"` — a `Map`
write cannot fail. `AppendOnlyFedosBoardPersistence` genuinely CAN: if
`appendFileSync` throws for any reason unrelated to record content
(the case this Stage's own test suite exercises concretely: a missing
PARENT directory, portable across Windows and POSIX, requiring no
platform-specific trick), the exception is caught and `"failed"` is
returned — matching `FedosBoardPersistenceWriteResult`'s own Alpha 315
definition precisely: "the backend itself could not complete the
write for a reason unrelated to record content." This is EXACTLY the
case `PersistedFedosBoardRepository.register()`'s own Alpha 317
comment anticipated as "Unreachable with `InMemoryFedosBoardPersistence`
this Arc — a documented, deliberate, conservative mapping for a future
durable backend" — that future backend is this one, and its
conservative `"failed"` → `"conflict"` mapping at the repository layer
now has a real caller to exercise it.

## 5. What is deliberately NOT distinguished

A "failed" write due to a missing parent directory and a "failed"
write due to (for example) a full disk both map to the SAME
`"failed"` token — the port (Alpha 315) defines no finer-grained
reason code, and this Stage adds none. A caller that needs to
distinguish failure causes must inspect its own environment
separately; this is unchanged from the port's own frozen contract.

## 6. Conclusion

All four `FedosBoardPersistenceWriteResult` outcomes are verified
against `AppendOnlyFedosBoardPersistence`, three of them
byte-for-byte identical in observable behavior to
`InMemoryFedosBoardPersistence`, and the fourth (`"failed"`) reachable
for the first time, exactly as this repository's own Alpha 317
comment anticipated two Arcs ago.

## 7. See also

- `docs/secure_runtime_alpha_355_append_only_reading.md`
- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`

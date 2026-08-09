# `src/os/core/storage/` — reserved placeholder seam, zero production consumers

**Status, verified fresh in the Architecture Dependency Closure arc:** this
directory is real, tested, working TypeScript (`types.ts`, `noop_storage.ts`,
`policy.ts`, `encrypted_payload.ts`) — but nothing in the shipped app wires
it into any real backend, and it never has. Its own file-level doc comments
already say so (`noop_storage.ts`: "NEITHER is wired into the runtime or
Worker"). This README makes that status visible at the directory level too,
matching how `src/os/messenger/onion/` documents its own reserved-seam
status.

## What this actually is

A **Stage 107 / Stage 182–185** forward-looking placeholder for a pluggable
storage backend, originally scoped to let a prior "Python v8.6 host"
prototype's Google Drive coupling eventually be replaced. It performs no
real network IO, file IO, or cryptography anywhere — every operation
resolves to a policy decision (`accepted_placeholder` / `rejected` /
`unavailable`) and stores nothing.

The live Messenger implementation (conversations/board/device, 42+ files
under `os/messenger/conversations/` alone) does NOT use this seam — it
hand-rolls its own `node:fs`-based append-only persistence per feature
instead. That hand-rolled pattern repeats near-identically across roughly
15+ locations (interface / append-only implementation / in-memory test
double triads) — a real, documented consolidation opportunity for a future
arc, but this seam is not currently that consolidation; adopting it as-is
would not fit the durable, encrypted, real-file persistence the Messenger
domain actually needs without redesign.

## Why it's kept rather than deleted

Deleting it would discard real, working, tested code and the "swap a real
backend in behind one seam" design intent it still names honestly. The
options considered (see `docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`
for the full three-option analysis) were: delete as dead scaffolding, wire
it to a real `AppendOnlyPersistence<T>` extraction from the Messenger
persistence-triad duplication, or relabel it as an honestly-documented
reserved seam. This README is the third option — the lowest-risk, most
honest choice available without committing to an un-reviewed
`AppendOnlyPersistence<T>` design in the same pass as the secrets-authority
move. Wiring a real backend, or extracting the shared persistence
primitive, remains open for a future arc that scopes and reviews that
design on its own.

Do not treat anything under this directory as live, wired, or a real
persistence guarantee. `test/storage_backend_boundary.test.ts` and
`test/storage_metadata_sanitizer.test.ts` are this seam's own historical
test coverage, not evidence of production use.

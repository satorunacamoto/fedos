# `src/os/core/storage/` — retired reserved seam, zero production consumers

**FINAL DISPOSITION (Compatibility Facade Reduction + Package Extraction
Readiness arc):** DECIDED and EXECUTED, superseding the prior arc's "still
open, three options" framing. This directory stays exactly as it is —
real, tested, working TypeScript — but is now formally retired: it will
never be wired to a real backend, never become the real Messenger
persistence layer, and will not be repurposed as the basis for a future
generic `AppendOnlyPersistence<T>` primitive. See `types.ts`'s own header
for the full reasoning; the short version:

1. **Zero live consumers, confirmed fresh this arc.** The only importers
   repo-wide are `src/os/_legacy_prototype/runtime/` (dead, pre-pivot code
   with no deploy path — see that directory's own README) and this seam's
   own tests (`test/storage_backend_boundary.test.ts`,
   `test/storage_metadata_sanitizer.test.ts`).
2. **Structurally incompatible with the one real persistence need this
   codebase has**, not just unwired. `StorageBackend`'s own guardrail —
   "OPAQUE, non-secret labels ONLY — never raw bytes" — means
   `NoopStorageBackend`/`PlaceholderStorageBackend` cannot, even in
   principle, be extended to store a byte without breaking the contract.
   Every real Messenger persistence backend (conversations, device, board,
   sync — all under `os/messenger/**/persistence/`) needs to store actual
   encrypted bytes in a domain-shaped, append-only record. This seam
   cannot become that without a redesign into a different interface, so it
   won't be asked to.
3. **Kept, not deleted**, because deleting real, working, tested code with
   an honestly-documented (if unrealized) design intent has a real cost
   (discarding it) and no compensating benefit — its only problem is being
   unused, not being wrong. Its blast radius if deleted (rewriting two
   dedicated guardrail tests, breaking the dead legacy-prototype import)
   also outweighs the value of removing inert code that already documents
   its own status accurately.

This closes the "reserved-but-not-resolved" status the prior arc left open
(`docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`, option 3 chosen for
`os/core/vault`, this directory addressed separately as described there).
This README previously read as a directory-level status note pending a
follow-up decision; it now IS that decision.

## What this actually is

**Status, verified fresh in the Architecture Dependency Closure arc, and
reconfirmed fresh this arc:** this directory is real, tested, working
TypeScript (`types.ts`, `noop_storage.ts`, `policy.ts`,
`encrypted_payload.ts`) — but nothing in the shipped app wires it into any
real backend, and it never has. Its own file-level doc comments already say
so (`noop_storage.ts`: "NEITHER is wired into the runtime or Worker"). This
README makes that status visible at the directory level too, matching how
`src/os/messenger/onion/` documents its own reserved-seam status.

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
backend in behind one seam" design intent it still names honestly, for no
compensating benefit — see the FINAL DISPOSITION section above for the
decision and its full reasoning. The three options originally weighed (see
`docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`) were: delete as dead
scaffolding, wire it to a real `AppendOnlyPersistence<T>` extraction from
the Messenger persistence-triad duplication, or retire it as an
honestly-documented, never-to-be-adopted reserved seam. This arc traced
every real consumer and every real persistence need and confirmed the
third option is not just lowest-risk but correct: this seam's own
byte-forbidding contract cannot express what real Messenger persistence
needs, so wiring it (option two, folded into this one) was never a
realistic path forward. A future `AppendOnlyPersistence<T>` extraction, if
pursued, needs its own bytes-carrying design and does not start from this
file.

Do not treat anything under this directory as live, wired, or a real
persistence guarantee. `test/storage_backend_boundary.test.ts` and
`test/storage_metadata_sanitizer.test.ts` are this seam's own historical
test coverage, not evidence of production use.

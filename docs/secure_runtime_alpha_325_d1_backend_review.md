# Secure Runtime Alpha 325 — Candidate C: Cloudflare D1 Backend Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind, and does NOT implement a Board D1 schema.** Stage 5 of the Alpha
321–330 Board Durable Backend Selection & Architecture Arc.

## 1. Why now

Continuing the candidate comparison against Alpha 322's requirement set:
D1 as the hosted/Worker-side backend — the ONE candidate this repository
already has real, working (if differently-scoped) wiring for
(Alpha 321 §3.12).

## 2. Findings

- **Current D1 bindings.** Real: `src/worker.ts`'s `Env.NOSTR_SPACE_DB?:
  D1LikeDatabase`, consumed by `D1SpaceDirectory`
  (`src/community/d1_directory.ts`) and `D1MetadataIndex`
  (`src/indexer/d1_index.ts`), both prepared-statement-bound against
  `schema/d1_space_directory.sql`/`schema/d1_index.sql`. No
  `wrangler.toml` or migrations directory exists in this checkout,
  though — this repository has never recorded an actual live deployment
  of these bindings (Alpha 321 §3.6/§3.12).
- **Worker architecture.** Stateless-per-request: `export default {
  fetch(request, env) }` builds a fresh `AppRuntime` via
  `createRuntime(env)` on every call — nothing survives between
  requests inside the isolate itself. This is exactly WHY a durable
  backend (D1, KV, or otherwise) is needed for anything that must
  outlive one request.
- **Per-request lifecycle.** Follows directly: any Board hydration
  through a D1 backend would need to run fresh per request (or be
  cached in KV/elsewhere) — there is no long-lived in-process
  `FedosBoardService` anywhere in the Worker today.
- **SQL schema.** Would need its OWN schema (e.g. a `board_posts` table
  mirroring `FedosPersistedBoardPostRecordV1`'s fields), separate from
  the existing `nostr_events_index`/`nostr_spaces` tables — not a
  trivial extension of the existing index schema, a category Alpha 321
  §3.12/Alpha 311 §3.7 already ruled out as the wrong authority level.
- **Transaction limitations.** D1's `batch()` gives sequential-atomic
  multi-statement execution within one call, not full interactive
  transactions spanning separate round trips — sufficient for this
  Arc's own MUST (atomic single-record writes, Alpha 322 §2), not a
  blocker.
- **Migrations.** Cloudflare ships real `wrangler d1 migrations` tooling,
  but no `wrangler.toml` exists in this repository today (Alpha 321
  §3.6) — the deployment/migration PIPELINE itself is not yet present,
  independent of D1's own migration capability.
- **Multi-user Board hosting.** A strong natural fit — D1 is exactly the
  kind of shared, multi-writer store this repository's own stated
  architecture names for a HOSTED, multi-user board
  (`README.md`: "targeting Cloudflare Workers + D1 + KV + R2").
- **Latency.** Edge SQL round-trip per operation — higher than in-process
  memory, ordinary for any hosted-database architecture.
- **Offline behavior.** None — D1 requires connectivity; the wrong fit
  for an offline-first, user-owned Desktop store.
- **Local-first suitability.** Poor — D1 is a Cloudflare-hosted service,
  never a file the user locally owns or controls.
- **Desktop ownership conflict.** Direct: if Board's AUTHORITATIVE state
  ever needs to be user-owned/local-first (the direction this Arc's own
  Future Relationship diagram implies, feeding a LOCAL P2P Ontology
  Engine), a Cloudflare-hosted D1 table is the architecturally opposite
  kind of authority — appropriate for a HOSTED mirror/service, not for
  the canonical local record.
- **User-controlled-data expectations.** Conflicts with a local-first
  expectation if D1 were the ONLY store; compatible if D1 is ever a
  secondary, hosted projection of a locally-authoritative store instead.
- **Deployment cost.** Real Cloudflare billing/row-read/row-write limits
  apply once deployed — not evaluated further here since no deployment
  manifest exists to cost out.
- **Operational complexity.** Requires `wrangler.toml` + binding
  configuration + a migrations pipeline, none of which exists in this
  repository yet — a real, nontrivial prerequisite independent of any
  Board-specific schema work.
- **Export/backup.** `wrangler d1 export` exists at the CLI tooling
  layer (outside this repository's own code), not as an in-application
  API.
- **Vendor coupling.** `D1Database`'s own binding type is Cloudflare-
  specific — not portable to any other host without a fresh adapter.

## 3. Important — D1 is not automatically the right backend for the
Desktop side

D1 may be entirely appropriate for a future HOSTED Board service, but
inappropriate as the authoritative LOCAL Desktop database — these two
roles must not be forced into one backend (Alpha 327 §2's "Preferred
principle" applies here directly: the port stays uniform, the physical
backend does not).

## 4. Conclusion

D1 is this repository's single most operationally proven storage
technology (Alpha 321 §3.12) and the best-aligned with this project's
own stated hosted architecture — but adopting it for Board persistence
today would mean building, from scratch, both a new Board-specific SQL
schema AND the Worker-Board wiring that does not exist yet (Alpha 321
§3.4: Board has zero current callers in `src/worker.ts`), plus a
deployment/migration pipeline (`wrangler.toml`) this repository has
never had. Deferred not because D1 itself is unproven, but because its
CALLER — a Board-aware Worker route — is exactly as absent as a Desktop
shell is for SQLite (Alpha 323).

## 5. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
- `docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md`

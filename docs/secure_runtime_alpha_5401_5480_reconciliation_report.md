# Secure Runtime Alpha 5401–5480 — Reconciliation Report

**FedOS Local Deletion Capability and Deletion-State Foundation Arc — Phase A**

Status: factual inventory, written before any production edit in this Arc's
own worktree (`C:\wt\local-deletion-foundation`, branch
`arc/local-deletion-capability-state-foundation`). No `src/`, `packages/`,
`package.json`, `package-lock.json`, `Cargo.toml`, `p2p/`, or `.tmp_gen/`
change is made by this document.

## 0. Base selection

**Selected base: `master @ 3eb9ead`** ("Add Secure Runtime Alpha 2581-2620:
Conversation Search Retention Authority and Index Purge Hardening Arc").

The normative review (`cf5b870`,
`review/fedos-secret-capability-deletion-v1`) itself branched from
`arc/nostr-secure-messaging-architecture-v1 @ d62090f`, an EARLIER point.
Verified: `d62090f` is **not** an ancestor of `master @ 3eb9ead`
(`git merge-base --is-ancestor d62090f HEAD` fails) — the two lineages
diverged. However, direct inspection shows `master`'s tip contains every
file the review cites by name (`fedos_payload_retention_authority.ts`,
`fedos_conversation_search_index.ts`, `fedos_conversation_membership_authority.ts`,
`fedos_sync_device_registry.ts`, `fedos_conversation_archive_collector.ts`,
`fedos_conversation_archive_cli_file_system.ts`, etc.), and the review's own
prose explicitly cites facts only present on `master`'s later history (the
Alpha 2581–2620 query-time race-guard completion record, itself `master`'s
own tip commit). **No dry reconciliation between divergent Archive/Search
lineages is required** — `master` is a strict superset for this Arc's
purposes: one coherent lineage already carries Retention, Search,
Membership, Device Sync, and Archive/Archive-CLI in mutually consistent
form. This Arc's worktree and branch are cut directly from `master @
3eb9ead`.

## 1. Arc number

Highest `Secure Runtime Alpha` range found across **all** branches (not just
`master`, whose own tip is only at 2581–2620): `5321-5400` (two DIFFERENT
Arcs on two different branches both independently claimed this exact range
— `arc/runtime-secure-memory @ 406c144` and a Desktop Beta packaging Arc —
confirming numbering already collides across divergent lineages in this
repository, consistent with [[project_concurrent_session_risk]]). No
`Secure Runtime Alpha` range has been claimed yet for a "Ratchet Foundation"
Arc — only a docs-only specification-review commit exists on
`review/fedos-forward-secrecy-double-ratchet-v1` (`b34d608`), with no
numeric range attached.

**Chosen range for this Arc: Secure Runtime Alpha 5401–5480** — the
immediate next free block after the highest confirmed range (5400), leaving
no gap that would itself require justification, while remaining clear of
every range found in any branch's commit history. Because the Ratchet
Foundation Arc has not yet claimed a numeric range, this choice cannot
collide with a range that does not yet exist; if a concurrent session claims
5401–5480 for Ratchet before this Arc lands, the two sessions must
reconcile by shifting one range at merge time — flagged here explicitly per
this Arc's own instructions, not resolved unilaterally.

## 2. Operation inventory

| Concern | Real? | Durable? | Idempotent? | User-controlled? | Physical/logical? | Owner | Rollback? | Status vocabulary today |
|---|---|---|---|---|---|---|---|---|
| Payload retention authority | Yes, `[LIVE]` | Yes (Retention Decision Log) | Yes (`already-tombstoned`/`already-removed`) | Yes, via caller-invoked `tombstonePayload`/`removeLocalPayload` | Logical (access-state transition only) | `FedosPayloadRetentionAuthority` (`src/conversation/retention/`) | No restore path (`payload-removed → active` forbidden, Alpha 798) | `FedosPayloadRetentionState`: `active`\|`tombstoned`\|`payload-removed` |
| Payload tombstone model | Yes | Yes, append-only NDJSON or in-memory (`FedosPayloadRetentionPersistence`) | Yes | Indirect (via Authority) | Logical | Same | No (append-only, no delete) | `FedosPayloadRetentionResult` outcomes |
| Message read behavior after tombstone | Yes | N/A | Yes | N/A | Logical (gated read) | `readPayload()`/`evaluatePayloadAccess()` | N/A | `FedosGatedPayloadReadResult` |
| Search index ingestion gate | Yes, `[LIVE]` (Alpha 2581–2620) | No (in-process only) | Yes | N/A | Logical | `FedosConversationSearchIndex#ingest()` | N/A (index is rebuildable) | `"indexed"\|"duplicate"\|"denied"` |
| Search purge/reconcile | Yes, `[LIVE]` | No | Yes | Caller-invoked (`reconcilePayloadRetention`) | Logical, but real `Map`/`Set` deletion (`local-verified`-strength) | `FedosConversationSearchIndex` | N/A | `removeEnvelope` outcome `"removed"\|"not-found"` |
| Local caches/projections | None distinct from the Search index itself | — | — | — | — | — | — | No dedicated `purge-cache` producer exists |
| Direct Archive runtime | Yes, `[LIVE]` | Yes (filesystem, via injected `FileSystem`) | N/A (export/import) | Yes | Physical (file), no in-app delete | `FedosConversationArchiveCliDirectory`/`Package`/`FileSystem` | N/A | No deletion status exists for Archive files today |
| Group Archive runtime | Same underlying Collector/Restore, mode-agnostic | Same | Same | Same | Same | Same | N/A | Same |
| Incremental Archive | **Not merged into this base** (`arc/incremental-archive-snapshot-chain`, not present in `src/`) | — | — | — | — | — | — | Out of scope; target named but zero real producer |
| Archive CLI/package file ownership | Yes — `FedosConversationArchiveCliFileSystem` (`readFile`/`writeFile`/`listFiles`); tracked via ONE directory index (`FEDOS_CONVERSATION_ARCHIVE_CLI_DIRECTORY_MANIFEST_FILE_NAME`) | Yes (filesystem) | writes are, reads are | Yes | Physical | `fedos_conversation_archive_cli_file_system.ts`, `fedos_conversation_archive_cli_directory.ts` | N/A | **No `deleteFile` method exists anywhere — confirmed gap, this Arc's one new capability** |
| Profile/data path authority | No dedicated profile-root authority found in this lineage; Archive directory path is caller-supplied at the CLI layer, trusted (in-process) input | — | — | — | — | — | — | — |
| File-removal precedent | **None** — no `unlink`/`deleteFile` call exists anywhere under `src/conversation/` | — | — | — | — | — | — | — |
| Device Registry revocation | Yes, `[LIVE]` | Yes (in-memory `Map`, no file backend found for this specific registry) | Yes (`revokeDevice` returns `false` if already revoked/absent) | Yes | Logical (forward-only state flip) | `FedosSyncDeviceRegistry`/`fedos_sync_device_binding.ts` | No (`bound → revoked` only; no un-revoke) | `bound\|unbound\|revoked` |
| Membership revocation | Yes, `[LIVE]` | Depends on injected `FedosConversationMembershipPersistence` | Yes (`already-present`/`conflict` outcomes) | Yes | Logical | `FedosConversationMembershipAuthority.revoke()` | No | `FedosConversationMembershipMutationResult` |
| Sync Journal | Yes, `[LIVE]` | Yes | N/A (append-only) | N/A | N/A (never carries bytes) | `FedosSyncJournal` (`src/sync/`) | No (no delete/rewrite method) | `"upsert"\|"tombstone"` change kind |
| Device Sync allowlist | `listActiveDevices()` filters by binding state | Same as registry | Yes | Yes | Logical | `FedosSyncDeviceRegistry` | No | Same |
| Notification previews | `src/notification/` exists (`NoopNotificationBridge`, `PlaceholderNotificationBridge`) but **persists nothing and sends nothing** — no notification preview content is ever stored anywhere in this lineage | No | N/A | N/A | N/A | — | N/A | Zero real producer for a `local-notification-preview` deletion target |
| Logs/error redaction | Ad hoc; only `FedosProfileUnlockSecret`-shaped exceptions self-redact; no repo-wide log pipeline | No | N/A | No | N/A | — | N/A | No enforcement outside the guarded types |
| Attachment placeholders | Confirmed absent — no attachment type/blob/content-key concept anywhere under `src/conversation/` on this base | — | — | — | — | — | — | Architecture boundary only |
| `FedosPayloadDeletionMeaning` (existing, Alpha 792) | Yes, `[LIVE]`, 8 values, 3 marked `V1_ENFORCEABLE` (`application-hidden`, `logically-tombstoned`, `local-payload-removed`) | Yes | — | — | — | `src/conversation/retention/fedos_payload_retention_state.ts` | — | This Arc extends, never replaces, this vocabulary |

## 3. What this confirms about scope

- The **only genuinely missing local capability** this inventory finds,
  matching the normative review's own §19/§20 conclusion, is a real,
  tracked, best-effort **Archive-file `remove-file` operation** — no
  `deleteFile` method exists anywhere in `src/conversation/archive_cli/`
  today.
- Every other operation this Arc must normalize (Retention transition,
  Search purge, Device/Membership revocation) is **already real** — this
  Arc's job for those is a thin observation/vocabulary layer over existing
  behavior, changing none of it.
- `local-cache` and `local-incremental-archive-file` and
  `local-notification-preview` have **zero real producers** on this base —
  their capability descriptors must say so honestly (`localSupport: false`),
  never invent a fake one.
- No reconciliation between divergent persistence models is required; no
  stop condition from this Arc's own Phase A is triggered.

## See also

- `docs/secure_runtime_alpha_5401_5480_execution_spec.md` — the
  implementation this report's findings feed into.
- `docs/reviews/fedos_secret_capability_deletion_v1/` (read via
  `git show cf5b870:...`, not merged into this branch) — the normative
  design review this Arc implements Option A of.

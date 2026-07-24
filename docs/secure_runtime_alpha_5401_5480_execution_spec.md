# Secure Runtime Alpha 5401–5480 — Execution Specification

**FedOS Local Deletion Capability and Deletion-State Foundation Arc**

Base: `master @ 3eb9ead`. Normative review: `cf5b870`
(`review/fedos-secret-capability-deletion-v1`), read via `git show`, never
merged into this branch. Findings this spec assumes are in
`docs/secure_runtime_alpha_5401_5480_reconciliation_report.md` (Phase A).

This is a **local-only V1**. No remote deletion request, no
acknowledgement, no Relay deletion, no wire protocol, no NIP — all remain
unbuilt, by design, per this Arc's own Absolute Prohibitions.

## 1. Module layout

Ten new files under `src/conversation/deletion/`, one narrow addition to
two existing Archive CLI files, zero other production changes:

| File | Phase | Role |
|---|---|---|
| `fedos_deletion_target.ts` | B | closed target vocabulary (10 values) |
| `fedos_deletion_operation.ts` | B | closed operation vocabulary (8 values) |
| `fedos_deletion_evidence.ts` | B | closed evidence vocabulary (4 values) |
| `fedos_deletion_capability_descriptor.ts` | C | static, fixed registry — one descriptor per target |
| `fedos_deletion_status.ts` | D | closed 15-value status vocabulary + `FedosPayloadDeletionMeaning` mapping |
| `fedos_deletion_non_guarantees.ts` | N | closed 7-code non-guarantee vocabulary + fixed text |
| `fedos_deletion_assessment.ts` | E | four read-only assessment functions (payload, Archive-file, Device, Membership) |
| `fedos_deletion_plan.ts` | F | four deterministic, pure plan builders |
| `fedos_deletion_archive_path_authority.ts` | H | structural traversal/bare-root guards |
| `fedos_deletion_archive_file_authority.ts` | H | trusted handle resolution + removal, over the existing Archive CLI directory index |
| `fedos_deletion_execution_coordinator.ts` | G | four narrow, idempotent execution entry points |
| `fedos_persisted_deletion_execution_record_v1.ts` | K | durable aggregate-outcome record shape |
| `fedos_deletion_execution_persistence.ts` / `in_memory_*` / `append_only_*` | K | persistence port + two backends, mirroring `FedosPayloadRetentionPersistence`'s own convention |
| `fedos_deletion_user_summary.ts` | M | plain DTO + builders, no framework |

Existing-file changes: `fedos_conversation_archive_cli_file_system.ts`
gains one method (`deleteFile`); `fedos_conversation_archive_cli_directory.ts`
gains one function (`removeFedosConversationArchiveCliDirectoryEntry`).
These are the ONE missing local capability Phase A confirmed: no
`deleteFile`/`removeFile` existed anywhere in this codebase before this Arc.

## 2. Design decisions and why

**Four narrow execution entry points, not one polymorphic executor.**
`executeFedosLocalPayloadDeletionPlan` / `executeFedosLocalArchiveFileRemovalPlan`
/ `executeFedosLocalDeviceAccessRevocationPlan` /
`executeFedosLocalMembershipAccessRevocationPlan` each declare the minimal
real dependency set their own domain needs (`Pick<...>` of the real
authority). This is what makes Phase N's "Archive removal never touches
Retention/Search" and "Device/Membership revocation never implies payload
deletion" guarantees *structural* rather than a runtime check: the payload
executor's own dependency type has no `fileSystem`; the Archive-file
executor's own dependency type has no `retentionAuthority`/`searchIndex`.

**Idempotency via `persistence.getRecord(planId)` first, always.** Every
entry point checks the durable record before doing anything. Re-running an
identical `(planId, canonicalTargetRef)` pair returns the already-persisted
outcome (`"already-executed"`), never re-invokes Retention/Search/Archive.
A DIFFERENT `canonicalTargetRef` under the SAME `planId` is
`"conflicting-plan"` — refused, not overwritten.

**`FedosDeletionCapabilityDescriptor` is a fixed, static, per-target
lookup table**, never a caller-constructed value — `getFedosDeletionCapabilityDescriptor`
always succeeds for a real `FedosDeletionTarget`;
`resolveFedosDeletionCapabilityDescriptor` fails closed (`null`) for
anything else. `local-cache`, `local-incremental-archive-file`, and
`local-notification-preview` are honestly `localSupport: false` — Phase A
found zero real producer for any of the three on this base; inventing one
would be exactly the "unknown capabilities fail closed" violation this
Arc's own Phase C forbids.

**Assessment never mutates, never decrypts.** Every function in
`fedos_deletion_assessment.ts` calls only a read-only method
(`evaluatePayloadAccess`, `getDevice`, `findMembership`, the Archive
directory's own index read) — never `tombstonePayload`/`removeLocalPayload`/
`revokeDevice`/`revoke`/`removeFedosDeletionArchiveFile`.

**Plans are pure functions of an assessment.** `buildFedosLocalPayloadDeletionPlan`
etc. take an already-computed assessment and return the same plan for the
same input, always — no authority call inside a plan builder. A payload
plan's steps are `["retention-transition", "purge-index"]`, never
`"remove-archive-file"`; an Archive-file plan's one step is
`"remove-archive-file"`, never a Retention/Search step. The two plan kinds
cannot be built together, so a caller cannot accidentally combine them into
one confirmation prompt.

**Archive-file removal only ever accepts a `FedosDeletionArchiveFileHandle`**,
produced exclusively by `resolveFedosDeletionArchiveFileHandle`, which
resolves through the Archive CLI directory's own trusted index — never a
caller-supplied path, never a directory scan. `removeFedosDeletionArchiveFile`
re-checks the handle's own `conversationId` against the index's CURRENT
entry at removal time (never trusting a possibly-stale earlier resolution)
and requires a non-empty `planId` confirmation token. The underlying
`fedosConversationArchiveCliNodeFileSystem.deleteFile` refuses a
symlink/reparse-point target outright (`lstatSync().isSymbolicLink()`
check) rather than following it, and treats a missing target as already
removed (`true`) — never an error.

**Durable execution record is new only because nothing existing captures
the cross-cutting outcome.** The Retention Decision Log already durably
records a payload's own tombstone/removal transitions; this Arc's own
`FedosPersistedDeletionExecutionRecordV1` does not duplicate that — it
exists because no record anywhere in this codebase ties one coordinated
plan's Retention-AND-Search-AND-(optionally)-Archive outcome to one
restart-recoverable `planId`. Append-only, corruption fails closed
(mirrors `AppendOnlyFedosPayloadRetentionPersistence` exactly): an
unparseable line or a conflicting duplicate record for the same `planId`
throws on the next read, never silently drops or merges.

**User-safe summaries are a plain DTO**, not a new presentation
framework — this lineage has no accepted view-model boundary for
Conversation deletion. Every warning is drawn from the closed
`FedosDeletionNonGuaranteeCode` vocabulary's own fixed text; the universal
`"no-deleted-everywhere"` warning is always appended last.

## 3. What this Arc reuses unmodified

`FedosPayloadRetentionAuthority` (`tombstonePayload`/`removeLocalPayload`/
`evaluatePayloadAccess`), `FedosConversationSearchIndex.reconcilePayloadRetention()`,
`FedosSyncDeviceRegistry.revokeDevice()`/`getDevice()`,
`FedosConversationMembershipAuthority.revoke()`/`findMembership()` — every
one of these is called through this Arc's own coordinator exactly as it
already exists. No Search redesign, no Retention redesign, no Device/
Membership redesign.

## 4. What this Arc does not build

Everything on the Absolute Prohibitions list: remote deletion request,
deletion Relay event, new NIP, recipient acknowledgement, Relay deletion,
remote filesystem operation, arbitrary file deletion, physical secure
erase / SSD overwrite guarantee, cloud-history / OneDrive version-history
deletion, backup deletion, automatic cross-deletion between message and
Archive, cryptographic key destruction as a plaintext-deletion proof,
moderation/legal-hold, generic capability framework, new crypto
primitives, new dependencies, Electron IPC/UI. `p2p/` and `.tmp_gen/` are
untouched (verified structurally in
`test/secure_runtime_alpha_5401_5480_non_guarantees_and_structural_proof.test.ts`,
items 14–20).

## 5. Test coverage

Seven new test files (82 new tests):
`..._vocabulary_and_capability` (18), `..._assessment_and_plan` (9),
`..._execution_coordinator` (9), `..._archive_removal` (19),
`..._restart_and_corruption` (6), `..._non_guarantees_and_structural_proof`
(20), `..._vertical_slice` (1, the real Phase O flow). Two pre-existing
Archive CLI test files gained a four-line `deleteFile` stub on their own
already-existing in-memory `FedosConversationArchiveCliFileSystem` fixture,
to satisfy the interface's new method — no other change, no new test case
in either file.

See `docs/secure_runtime_alpha_5401_5480_completion_declaration.md` for
the verification run and completion criteria.

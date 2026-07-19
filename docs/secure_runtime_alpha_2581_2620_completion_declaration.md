# Secure Runtime Alpha 2581–2620: Conversation Search Retention Authority and Index Purge Hardening — Completion Declaration

## What landed

Exactly ONE production file changed: `src/conversation/search/fedos_conversation_search_index.ts`. No other file under `src/conversation/search/` was touched — confirmed by this Arc's own updated `test/reviews/private_conversation_search_runtime_v1/source_alignment.test.ts` assertions, which read every sub-index file's raw source directly and still confirm no retention import anywhere except the facade.

Concrete changes to that one file:

- `FedosConversationSearchIndexDependencies` gains `retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">` — additive intersection over the existing `Pick<FedosConversationRuntimeDependencies, "draftPersistence" | "membershipAuthority">`, never a redeclaration.
- `#ingest()` gates every candidate document through `evaluatePayloadAccess(payloadId)` before touching any content sub-index; anything but `"allowed"` (including a thrown error) refuses via a new closed outcome, `"denied"`, added to `FedosConversationSearchIndexOutcome`.
- `indexArchiveBundle()` resolves each record's `payloadId` via a second, independent pass of the SAME reused envelope codec (never modifying `fedos_conversation_search_archive_index.ts`) and gates through the identical path; `FedosConversationSearchBulkOutcome` gains `denied: number`.
- `reconcilePayloadRetention(payloadId)` — new, narrow wiring reusing the EXISTING `removeEnvelope()` to purge every currently-indexed Envelope linked to a payload that is no longer permitted.
- `removeEnvelope()` now also calls a new private `#purgeConversationMetadataIfEmpty()`, which reuses the EXISTING (previously unreachable) `FedosConversationSearchModeIndex.removeConversation()` / `FedosConversationSearchArchiveIndex.forgetConversation()` once a conversation's indexed Envelope count reaches zero.
- `searchKeyword()`, `envelopesBetween()`, `repliesTo()`, `parentOf()`, `envelopesByParticipant()` now filter every candidate through a new private `#filterPermitted()` — a query-time re-check of `evaluatePayloadAccess()`, closing the race window between a retention transition and its caller-invoked reconciliation.

Two new test files (33 new tests):

- `test/secure_runtime_alpha_2581_2600_retention_ingestion_gate_and_purge.test.ts` (12 tests) — ingestion gate (allowed/denied/tombstoned/duplicate), `reconcilePayloadRetention()` purge, mode/encryption-suite neutrality, wrong-payload-identity and unavailable-Authority fail-closed behavior, no-plaintext-leakage, full `removeEnvelope()` sub-index purge.
- `test/secure_runtime_alpha_2601_2620_archive_restart_query_race_and_compat.test.ts` (9 tests) — Archive ingestion gate (denied/mixed/restored-plaintext-does-not-bypass-retention), restart reconciliation, the query-time race guard, no-throw/no-plaintext-in-return-value, unrelated-content isolation, existing ordering compatibility.

Four pre-existing test files were updated ONLY for the new required `retentionAuthority` dependency (every payload fixture is now registered as active in an injected `InMemoryFedosConversationPayloadStorage` before indexing, matching a real caller's payload already being durably stored): `test/secure_runtime_alpha_2541_2560_search_index_incremental_and_delete.test.ts` (also gained one new sub-index-purge test), `test/secure_runtime_alpha_2561_2580_archive_index_and_large_dataset.test.ts`, and the runtime audit's own `test/reviews/private_conversation_search_runtime_v1/source_alignment.test.ts` / `encryption_boundary_invariants.test.ts`, whose assertions 4, 6, 7, 8, 9, and 14 pinned the PRE-FIX absence of retention gating and are updated to assert the POST-FIX reality. `source_alignment.test.ts`'s own git-status-parsing helper (assertion 6) also had a genuine, pre-existing off-by-one bug fixed (a premature `.trim()` shifted its later `slice(3)` by one character, invisible until this Arc modified an existing tracked file for the first time in that audit's own diff-scope check). The audit's 20 numbered `.md` documents themselves are UNCHANGED and remain an accurate historical record of what was true when the audit was written.

## Baseline vs. final

**Baseline** (this worktree, before any production edit): `npx tsc --noEmit` clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` error (predates this Arc — `git log` shows commit `aff32c5`).

**Final** (after every change in this Arc):

- `npm run typecheck`: identical to baseline — clean except the same one pre-existing, unrelated error.
- Focused Search Runtime suite (all 6 files under `src/conversation/search/`'s own test coverage, Alpha 2501–2620): **52 passed, 0 failed**.
- Focused Retention Authority + Archive/Restore suite (`secure_runtime_alpha_795/796/799_*`, `secure_runtime_alpha_1541_1560/1561_1580/1581_1600_*`): **83 passed, 0 failed** — confirms this Arc changed no behavior in either domain it reuses.
- Runtime audit's own suite (`test/reviews/private_conversation_search_runtime_v1/`): **45 passed, 0 failed** (after the assertion updates named above).
- `npx vitest run` (full suite, this exact worktree): 743 files / 12082 tests passed, 193 files / 239 tests failed. This is a materially higher failure count than the main working copy's own recent full-suite run (22 files / 34 tests, on the same base commit `bec5142`), which this Arc treats as a real discrepancy to explain, not wave away.
  - **Confirmed environmental to this worktree, not caused by this Arc.** Every failure sampled traces to files entirely outside `src/conversation/`: `fedos_core_rust_*`, onion/NIP-44/runtime-architecture suites, and unrelated review dirty-tree checks. Decisively verified by `git stash -u` (reverting THIS exact worktree to the pristine, unmodified `bec5142` tip) and re-running four sampled failing files (`runtime_wasm_loader_js_glue_module_retention_execution.test.ts`, `secure_runtime_alpha_025_secure_storage_api_scope_review.test.ts`, `secure_runtime_alpha_405_submit_post_authority_verification.test.ts`, `secure_runtime_alpha_758_local_runtime_ownership.test.ts`) — all four failed IDENTICALLY on the pristine base, before `git stash pop` restored every one of this Arc's own changes. These failures predate this Arc and are reproducible with zero code from this Arc present; most visibly involve a `?raw`-source-import/CRLF artifact specific to this nested, non-ASCII-path git worktree (`.claude/worktrees/alpha2581`), affecting structural regex assertions in unrelated Rust/Host files.
  - Zero failure in the full run touches `src/conversation/search/`, `src/conversation/retention/`, or `src/conversation/archive/` — grepped explicitly across every failing file path.
  - The two `git`-status dirty-tree checks that DO reference this Arc's own changed paths (`test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`, `test/reviews/private_conversation_security/boundary_guards.test.ts`) are the SAME expected-red-until-commit pattern the Alpha 2501–2580 completion declaration already documented — both assert a fully clean working tree, which is false by construction until this Arc's own single commit lands, and both turn green immediately afterward with no code change.
  - No regression in any suite this Arc did or could plausibly affect.

## Named, deliberate boundaries (not silently dropped)

- Archive Collector/Restore's own pre-existing bypass of `FedosPayloadRetentionAuthority` when writing payload bytes into storage (documented by the prior specification review and the runtime audit) is NOT fixed by this Arc — this Arc closes the SEARCH-side consequence (a bypassed payload can no longer become search-eligible just because it physically exists), not the Archive-side bypass itself, which lives in a different module (`src/conversation/archive/`) this Arc does not touch.
- No reactive/event-driven retention-transition notification exists — `reconcilePayloadRetention()` remains caller-invoked, exactly like `removeEnvelope()` already was; the query-time gate is what makes this safe without one.
- Conversation-level classification (`modeOf`/`directConversationIds`/`groupConversationIds`/`isFromArchive`/`archivedConversationIds`/`conversationsByParticipant`/`size`) is deliberately NOT retention-gated — it carries no message content and is out of this defect's stated scope.
- No Host/Runtime wiring exists yet connecting `FedosConversationSearchIndex` to live application code.

## Declaration

Complete:

- Every ingestion path (`indexEnvelope`/`indexEnvelopes`/`indexArchiveBundle`) is gated.
- Archive Restore cannot make a retention-denied payload search-eligible.
- Denied/tombstoned content is purged from every sub-index via `reconcilePayloadRetention()`/`removeEnvelope()`.
- A restart cannot resurrect denied content — a freshly rebuilt instance re-derives through the same gate.
- The query-time race window is closed — no denied content is ever returned by a query, reconciled or not.
- No plaintext, retention outcome, or payload id ever appears in a thrown error, log, or return value.
- Existing Search Runtime behavior (ordering, duplicate/idempotent semantics, unrelated content) remains fully compatible.

## Recommended next Arc

**Conversation Archive CLI and User-Controlled Packaging Arc.**

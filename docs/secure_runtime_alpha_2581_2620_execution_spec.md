# Secure Runtime Alpha 2581–2620: Conversation Search Retention Authority and Index Purge Hardening — Execution Spec

Architecture frozen. This Arc redesigns nothing: no new Rust/WASM primitive, no new persistence port, no Host/GUI wiring, no network transport, no second retention policy, no second index implementation. It threads the EXISTING `FedosPayloadRetentionAuthority` (Alpha 796–811) into the EXISTING Conversation Search Runtime (Alpha 2501–2580) through the narrowest additive dependency boundary, closing the High-severity defect the Private Conversation Search V1 runtime audit found.

Base revision: commit `3b7143f` (Conversation Search Runtime) + commit `bec5142` (the runtime audit), both on this worktree's own branch history.

## Phase A — Reconciliation (verified against real source, not audit prose alone)

1. **Every Search Runtime ingestion path**: `indexEnvelope()`, `indexEnvelopes()` (which forwards to `indexEnvelope()`), and `indexArchiveBundle()` — all three, and only these three, on `FedosConversationSearchIndex` (`src/conversation/search/fedos_conversation_search_index.ts`).
2. **Every method that receives plaintext**: `indexEnvelope()`'s own `FedosConversationSearchEnvelopeInput.text` and `indexArchiveBundle()`'s own `plaintextByEnvelopeId` parameter — both already caller-supplied, already-decrypted, per the Alpha 2501–2580 plaintext boundary (`fedos_conversation_search_document.ts`), unchanged by this Arc.
3. **Archive indexing flow**: `fedosConversationSearchDocumentsFromArchiveBundle()` (`fedos_conversation_search_archive_index.ts`) deserializes `bundle.envelopes` via the existing `deserializeFedosConversationMessageEnvelope` codec and builds documents; `FedosConversationSearchIndex.indexArchiveBundle()` is the only caller. Confirmed this function performs no retention check of its own (audit Review 04/12 confirmed; re-confirmed here by direct read) and this Arc does not add one there — see Phase C.
4. **Current Retention Authority API and result vocabulary**: `FedosPayloadRetentionAuthority` (`src/conversation/retention/fedos_payload_retention_authority.ts`) exposes `evaluatePayloadAccess(payloadId): { outcome: "allowed" } | { outcome: "denied", state } | { outcome: "not-found" }` (pure preview) and `readPayload()` (pure preview, returns bytes), plus the mutating `tombstonePayload()`/`removeLocalPayload()`. Alpha 797 deliberately excludes an `"unavailable"` token — "nothing in this synchronous design ever produces it." No push/event notification exists anywhere in this Authority for a downstream consumer to subscribe to.
5. **Tombstone/retention transition producers**: only `FedosPayloadRetentionAuthority.tombstonePayload()`/`removeLocalPayload()` ever change retention state; both are synchronous, caller-invoked, and unconditionally durable via `FedosPayloadRetentionPersistence.putDecision()`. No other file in this codebase writes a retention decision.
6. **`removeEnvelope()` and sub-index removal**: `removeEnvelope()` already purged Keyword/Date/Reply/Participant via each sub-index's own `removeDocument()`. `FedosConversationSearchModeIndex.removeConversation()` and `FedosConversationSearchArchiveIndex.forgetConversation()` already existed but were never called from the facade — audit Review 03/14's "dead code" finding, reconfirmed here.
7. **Restart/persistence behavior**: unchanged from Alpha 2501–2580 — `FedosConversationSearchIndex` remains a pure, rebuildable, in-memory structure; a restart is "construct a fresh instance, re-feed it from already-durable source data."
8. **Current callers**: none. `git grep -rn "FedosConversationSearchIndex\|conversation/search" src/` outside `src/conversation/search/` itself returns nothing — no Host/Runtime wiring exists yet. This confirms the fix's entire blast radius is contained within the Search Runtime's own module and its own tests.
9. **Exact production files expected to change**: exactly one — `src/conversation/search/fedos_conversation_search_index.ts`. Every other file under `src/conversation/search/` (document, incremental, keyword, date, reply, participant, mode, archive) is unmodified; confirmed by this Arc's own updated `test/reviews/private_conversation_search_runtime_v1/source_alignment.test.ts` assertions, which read those files' raw source directly.
10. **Baseline failures in this worktree**: before any production edit, `npx tsc --noEmit` was clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` error (confirmed via `git log` to predate this Arc entirely, already named by every recent completion declaration); `npx vitest run` reproduced the same categories of pre-existing failures the Alpha 2501–2580 completion declaration already documents (expected-red-until-commit review dirty-tree checks, unrelated Rust static-analysis suites, transient collection timeouts).

## Phase B — Ingestion gate

`FedosConversationSearchIndexDependencies` gains one field: `retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">` — the narrowest possible additive dependency. Never `tombstonePayload()`/`removeLocalPayload()` (Search Runtime never mutates retention state) and never `readPayload()` (Search Runtime never reads a payload byte; it only asks whether the plaintext it already has is currently authorized).

`#ingest()` calls `evaluatePayloadAccess(payloadId)` before touching any content sub-index. Only `{ outcome: "allowed" }` passes; `"denied"`, `"not-found"`, or a thrown exception (an unavailable Authority) all refuse via a new closed outcome, `"denied"`, added to `FedosConversationSearchIndexOutcome`. A denied Envelope never reaches the Incremental Index, so no dedup-guard slot is consumed and no plaintext is retained anywhere — `#ingest()` returns before `#keyword.indexDocument()` (the only sub-index that stores `text`) is ever called.

No second retention policy is created: the gate is exactly `evaluatePayloadAccess(...).outcome === "allowed"`, wrapped in a `try/catch` that treats any thrown error as not-permitted (fail-closed for an unavailable Authority).

## Phase C — Archive ingestion

`indexArchiveBundle()` resolves each candidate Envelope's `payloadId` via a second, independent pass of the SAME reused `deserializeFedosConversationMessageEnvelope` codec `fedosConversationSearchDocumentsFromArchiveBundle()` already calls — that function itself is UNCHANGED, preserving its own existing "pure conversion, no retention check" boundary (and the audit's own source-alignment assertions that pin it). Each document is then gated through the identical `#ingest()` path used by the live envelope path.

- **Archive integrity** (is the wire record well-formed?): governed entirely by `deserializeFedosConversationMessageEnvelope` — a malformed record is silently skipped, exactly as before this Arc, never counted in the bulk outcome.
- **Archive decryptability** (did the caller supply plaintext for this id?): governed entirely by `plaintextByEnvelopeId` — orthogonal to retention.
- **Payload retention authorization** (does the CURRENT destination Runtime's Retention Authority permit this payload?): the ONLY question this Arc's gate answers.
- **Search index eligibility**: requires ALL three of the above — a byte-perfect, successfully-decrypted Archive record is still refused if retention denies it. This directly closes the audit's central finding: Archive Restore's own pre-existing bypass of retention when writing bytes into storage (Review 11 of the prior specification review, reconfirmed by Review 11 of the runtime audit) no longer propagates into search eligibility, because this Arc's gate re-checks the CURRENT retention state at the moment of indexing, never trusting that a payload's mere physical presence implies authorization.

`FedosConversationSearchBulkOutcome` gains `denied: number`, reported honestly alongside `indexed`/`duplicate` for a mixed Archive — never silently dropped, never conflated with `duplicate`.

## Phase D — Retention-transition purge

`reconcilePayloadRetention(payloadId)` is new, narrow wiring: re-checks `evaluatePayloadAccess()`; if not permitted, purges every currently-indexed Envelope this facade has linked to `payloadId` by calling the EXISTING `removeEnvelope()` once per id. No new removal implementation — full reuse.

`removeEnvelope()` additionally now calls a new private helper, `#purgeConversationMetadataIfEmpty()`, once a conversation's own currently-indexed Envelope count reaches zero, which calls the EXISTING (previously dead) `FedosConversationSearchModeIndex.removeConversation()` and `FedosConversationSearchArchiveIndex.forgetConversation()` — closing the audit's Medium-severity "dead code" finding (Review 03/14) with the smallest possible wiring, not a new sub-index.

## Phase E — Restart and reconciliation

Chosen strategy: **(C) rebuild from currently-authorized local records**, the same restart guarantee Alpha 2501–2580 already established, now retention-aware for free — because every re-ingestion path on a freshly constructed instance runs through the SAME Phase B/C gate, a payload denied at the time of restart is never re-indexed, with no additional code. This is verified directly: `test/secure_runtime_alpha_2601_2620_archive_restart_query_race_and_compat.test.ts`'s restart test feeds two independent `FedosConversationSearchIndex` instances from the SAME durable retention/payload state and confirms both reproduce identical, retention-correct results.

Combined with **(B) query-time authorization** (Phase F) as defense-in-depth for the live-instance-drift window between a transition and its `reconcilePayloadRetention()` call, this is a narrowly-justified combination (D) — never a rebuild-only strategy, because a rebuild alone says nothing about an already-running instance that has not yet restarted.

`retentionAuthority` is a REQUIRED constructor dependency (not optional-with-a-default-allow) — `FedosConversationSearchIndex` cannot be constructed at all without one. This is the strongest available "fail closed when the Retention Authority is unavailable" guarantee: a compile-time impossibility, not a runtime fallback. At the per-call level, `#isPermitted()` additionally treats a thrown exception from `evaluatePayloadAccess()` as not-permitted.

## Phase F — Query safety

Every query surface that can expose message-adjacent content or its reply/participant graph — `searchKeyword`, `envelopesBetween`, `repliesTo`, `parentOf`, `envelopesByParticipant` — re-checks `evaluatePayloadAccess()` per candidate result via a new private `#filterPermitted()` before returning it. This closes the one honest race a synchronous, non-reactive Retention Authority leaves open: an Envelope indexed while allowed, then denied by a transition the caller has not yet reconciled, can no longer surface through any of these queries even before `reconcilePayloadRetention()` runs.

Deliberately NOT gated: `modeOf`, `directConversationIds`, `groupConversationIds`, `isFromArchive`, `archivedConversationIds`, `conversationsByParticipant`, `size()` — all purely conversation-level classification or bookkeeping, carrying no message content, out of this defect's own stated scope. Search Query is not broadened into a general authorization system; the filter is narrow and content-surface-specific.

## Failure matrix

| Input / condition | Outcome |
| --- | --- |
| Payload unknown to storage (`getDescriptor` → `null`) | `evaluatePayloadAccess` → `"not-found"` → `"denied"` |
| Payload tombstoned | `evaluatePayloadAccess` → `{outcome:"denied", state:"tombstoned"}` → `"denied"` |
| Payload removed | `evaluatePayloadAccess` → `{outcome:"denied", state:"payload-removed"}` → `"denied"` |
| Retention Authority throws | caught → `"denied"` (never propagated, never logged) |
| Same allowed Envelope indexed twice | `"indexed"` then `"duplicate"` (unchanged Alpha 2501–2580 behavior) |
| Malformed Archive wire record | silently skipped by the existing codec — never counted as `denied` |
| Mixed Archive (some permitted, some not) | `{indexed, duplicate, denied}` — every count honest, nothing silently dropped |
| Query after an un-reconciled retention transition | filtered out by `#filterPermitted()` — never returned |
| `reconcilePayloadRetention()` on a still-permitted payload | no-op, returns `0` |
| `reconcilePayloadRetention()` twice on the same denied payload | second call is a no-op, returns `0` |

## Security guarantees this Arc makes

- No plaintext enters any content sub-index unless `evaluatePayloadAccess()` currently returns `"allowed"`, checked at the instant of ingestion.
- No plaintext remains queryable once its payload is no longer permitted, whether or not `reconcilePayloadRetention()` has been called (query-time gate is the backstop).
- Archive possession, decryptability, or a byte-perfect round-trip is never treated as search authorization on its own.
- A denial or an unavailable Retention Authority never throws, never logs a retention outcome, a payload id, or plaintext — every failure path is a typed return value.
- Unrelated, still-permitted content is never affected by purging a different, denied payload.

## Deliberately out of scope (named, not silently dropped)

- Fixing Archive Collector/Restore's own pre-existing bypass of retention when writing payload BYTES into storage (a separate, already-named defect in the prior specification review and the runtime audit, in a different module `src/conversation/archive/`) — this Arc closes the SEARCH-side consequence of that bypass (Phase C), not the bypass itself.
- Any Host/Runtime wiring connecting `FedosConversationSearchIndex` to live application code — still not chartered by any Arc to date.
- A reactive/event-driven retention-transition notification mechanism — `reconcilePayloadRetention()` remains caller-invoked, matching `removeEnvelope()`'s own existing caller-invoked-hook precedent; the query-time gate (Phase F) is what makes this safe without one.

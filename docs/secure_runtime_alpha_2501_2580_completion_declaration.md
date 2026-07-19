# Secure Runtime Alpha 2501–2580: Conversation Search Runtime — Completion Declaration

## What landed

`src/conversation/search/` (new directory, 9 files):

- `fedos_conversation_search_document.ts` — the indexable unit (`FedosConversationSearchEnvelopeDocument`), naming the plaintext boundary every other file in this directory respects.
- `fedos_conversation_search_incremental_index.ts` — the dedup/progress guard (satisfies "incremental index").
- `fedos_conversation_search_keyword_index.ts` — token index over already-decrypted text (satisfies "keyword index").
- `fedos_conversation_search_date_index.ts` — `createdAt` range index (satisfies "date index").
- `fedos_conversation_search_reply_index.ts` — parent/child reply-thread index (satisfies "reply index").
- `fedos_conversation_search_participant_index.ts` — sender-participant index, reusing `FedosConversationMembershipAuthority` (satisfies "participant index").
- `fedos_conversation_search_mode_index.ts` — one shared `conversationId → mode` map, reusing `FedosConversationDraftPersistence` (satisfies BOTH "group index" and "direct index" — see execution spec §"Key design decisions", item 2).
- `fedos_conversation_search_archive_index.ts` — Archive-sourced conversation tracking + `FedosConversationArchiveBundleV1` → document conversion (satisfies "archive index").
- `fedos_conversation_search_index.ts` — `FedosConversationSearchIndex`, the top-level facade (satisfies "search index").

No existing file was modified. `FedosConversationSearchIndexDependencies` is a literal `Pick<FedosConversationRuntimeDependencies, "draftPersistence" | "membershipAuthority">` — the concrete "Reuse Conversation Runtime" tie-in; `indexArchiveBundle()`/`fedosConversationSearchDocumentsFromArchiveBundle()` consume `FedosConversationArchiveBundleV1` and its existing envelope codec directly — the concrete "Reuse Archive" tie-in.

Four new test files (30 new tests):
- `test/secure_runtime_alpha_2501_2520_keyword_date_reply_indexes.test.ts` (13 tests)
- `test/secure_runtime_alpha_2521_2540_participant_mode_indexes.test.ts` (8 tests)
- `test/secure_runtime_alpha_2541_2560_search_index_incremental_and_delete.test.ts` (6 tests) — **duplicate** and **delete** verification.
- `test/secure_runtime_alpha_2561_2580_archive_index_and_large_dataset.test.ts` (3 tests) — **archive restore** (a real Bundle round-tripped through the existing collector/restore path into the new index) and **large dataset** (3,000 Envelopes across 20 conversations / 3 participants, every query checked against independently-computed expected counts). **Restart** is verified inside the incremental/delete file: two independent `FedosConversationSearchIndex` instances fed identical source data reproduce identical query results across every query method.

## Verification

`npm run typecheck`: clean except one PRE-EXISTING, unrelated error (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`), confirmed via `git log`/`git diff` to predate this Arc entirely — zero diff to that file, and already named in every recent completion declaration.

`npx vitest run` (full suite, 931 test files): this Arc's own 4 new files / 30 new tests all pass. Every pre-existing failure observed falls into a category already documented by prior Arcs' own completion declarations, and none touches anything this Arc adds or modifies (`src/conversation/search/`, or the four new test files):

- **Pre-existing, confirmed unrelated Rust-source static-analysis** (`test/fedos_core_rust_public_crypto_api.test.ts`, `test/fedos_core_rust_public_opaque_crypto_api.test.ts`, `test/fedos_core_rust_secret_handle_real_bytes.test.ts`, and the Identity/Master-Root/Protocol-Root/Nostr-Root/Host-ownership structural suites) — `git status packages/` shows a clean, fully-committed working tree with zero diff to `packages/fedos-core-rust/`; this Arc touches no Rust file, and none of these tests reference `src/conversation/` at all.
- **Expected-red-until-commit review docs** (`test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`, `test/reviews/private_conversation_security/boundary_guards.test.ts`, `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`) — these assert a CLEAN working tree (`git status`/`git diff`), which is by construction false while this Arc's own new files sit uncommitted. Every one of these review docs' own header already states this check "is expected to be red only until this Arc's own single commit lands" — the same documented pattern the Alpha 1051–1110 and Alpha 1541–1610 completion declarations both already relied on.
- **Transient collection-level timeouts** (`[vitest-worker]: Timeout calling "fetch"` on a handful of unrelated files, e.g. `test/secure_runtime_alpha_015_decrypt_opaque_handle_api.test.ts`) — infra/resource-contention noise under sustained load (this Arc ran the full suite twice back-to-back while another Arc's own commit landed concurrently in the same working tree); the count and membership of this category varied between consecutive runs with zero source change in between, confirming it is not a deterministic code regression.

No test this Arc's own new files could plausibly affect (anything outside `src/conversation/`) shows a genuine regression, and no test inside `src/conversation/` regressed either — this Arc added files, modified none.

## Named, deliberate boundaries (not silently dropped)

- No real decryption anywhere — the Keyword Index indexes only caller-supplied, already-decrypted text (see execution spec §"Key design decisions", item 1).
- No durable/persisted search index — every sub-index is in-memory and rebuildable only (see execution spec, item 3).
- No search UI, ranking/relevance scoring beyond AND-semantics token matching, stemming, or stop-word handling.
- No cross-conversation-boundary search authorization — this Arc indexes whatever it is handed; access control over what gets handed to it is a caller/Runtime-wiring concern.

## Recommended next Arc

Decryption-Authority wiring that resolves real plaintext for the Keyword Index to consume (closing the boundary named in decision 1), and Host-side wiring exposing `FedosConversationSearchIndex` through the Desktop Runtime alongside `boardRuntime()`/`conversationRuntime()`.

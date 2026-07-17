# Secure Runtime Alpha 1541–1610: Conversation Export, Restore, Archive Foundation — Completion Declaration

## What landed

`src/conversation/archive/` (new directory, 11 files):

- `fedos_conversation_archive_schema_version.ts` — Schema Version.
- `fedos_conversation_archive_bundle.ts` — Bundle V1 type (aggregates five existing wire shapes).
- `fedos_conversation_archive_collector.ts` — read side of Export.
- `fedos_conversation_archive_bundle_codec.ts` — canonical byte encoding + coarse decode.
- `fedos_conversation_archive_integrity.ts` — SHA-256 content hash.
- `fedos_conversation_archive_manifest.ts` / `fedos_conversation_archive_manifest_codec.ts` — cleartext Manifest V1 + codec.
- `fedos_conversation_archive_header.ts` — Alpha 856-style prefix-then-encrypt identity binding.
- `fedos_conversation_archive_encryption.ts` — `FedosWasmConversationArchiveEncryptionAuthority` (Encrypted Export / Encrypted Import).
- `fedos_conversation_archive_restore.ts` — Restore, replaying a decrypted Bundle into the five existing ports.
- `fedos_conversation_archive_duplicate_detection.ts` — read-only preflight report.

One additive port method, `FedosConversationCapabilityPersistence.listConversationCapabilityEvents()`, plus its two backend implementations (`InMemoryFedosConversationCapabilityPersistence`, `AppendOnlyFedosConversationCapabilityPersistence`) — necessary for lossless Capability Restore (see execution spec §"Key design decisions", item 4).

Four new test files (48 new tests): `test/secure_runtime_alpha_1541_1560_archive_manifest_integrity.test.ts`, `test/secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts`, `test/secure_runtime_alpha_1581_1600_archive_restore_duplicate_detection.test.ts`, `test/secure_runtime_alpha_1601_1610_capability_event_listing.test.ts`.

## Verification

`npm run typecheck`: clean except one PRE-EXISTING, unrelated error (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`, confirmed via `git log` to predate this Arc entirely — zero diff to that file).

`npx vitest run` (full suite, 915 files / 12,119 tests): 48/48 new tests pass. Of the pre-existing suite, 31 assertions across 20 files failed; every one falls into a category this codebase's own README already documents as expected:

- **Pre-existing, confirmed unrelated** (10 Rust-source static-analysis files this Arc's own `git diff` shows zero touch to `packages/fedos-core-rust/`, plus the four files the Alpha 1051–1110 completion declaration already named verbatim as pre-existing: `test/publish_pipeline_host_ownership_review_current_state.test.ts`, `test/secure_runtime_alpha_405_submit_post_authority_verification.test.ts`, `test/secure_runtime_alpha_472_scheduler_responsibility_decision.test.ts`, `test/secure_runtime_alpha_543_publish_runtime_ownership_audit.test.ts`, plus `test/secure_runtime_alpha_531_ripple_review.test.ts`, scoped to `src/board/`, which this Arc never touches).
- **Expected-red-until-commit** (3 files: `test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`, `test/reviews/private_conversation_security/boundary_guards.test.ts`, `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`) — these assert a CLEAN working tree (`git status`/`git diff` against nothing staged), which is by construction false while this Arc's own new files sit uncommitted. Every one of these review docs' own header already states this exact check "is expected to be red only until this Arc's own single commit lands (they check the working tree, not history)" — the same documented pattern the Alpha 1051–1110 Arc's own completion declaration relied on.

No test this Arc's own new/modified files could plausibly affect (anything under `src/conversation/`, `src/conversation/archive/`, or the Capability persistence port/backends) shows a genuine regression.

## Named, deliberate boundaries (not silently dropped)

- No passphrase-protected export independent of live conversation-key availability (see execution spec).
- No Host/file-path/GUI wiring for where exported bytes are read from or written to.
- No Cloud upload, no Sync, no network transport of any kind.
- Draft (private, not-yet-active) conversations (`src/conversation/construction/`) are out of scope — this Arc covers the canonical, active `FedosConversationPersistence` record only.
- No new Rust/WASM primitive, no new `AeadAadDomain` variant — Architecture Frozen, honored throughout.

## Recommended next Arc

Host-side wiring: where Export/Import bytes actually get written to/read from local disk (still No Cloud/Sync per this Arc's own boundary), and extending Archive coverage to draft/private-construction conversations.

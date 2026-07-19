# Secure Runtime Alpha 2341–2420: Conversation Archive CLI and User Packaging — Completion Declaration

## What landed

`src/conversation/archive_cli/` (new directory, 7 files):

- `fedos_conversation_archive_cli_package.ts` — `FedosConversationArchiveCliPackageV1`/`FedosConversationArchiveCliMultiPackageV1` types and this Arc's own packaging `formatVersion` (satisfies "single archive"/"multiple archive bundle").
- `fedos_conversation_archive_cli_package_codec.ts` — serialize/deserialize for both shapes, deep Manifest validation delegated entirely to the existing Manifest codec.
- `fedos_conversation_archive_cli_file_system.ts` — the one injectable `FedosConversationArchiveCliFileSystem` boundary, plus a real `node:fs`-backed implementation following this codebase's own established sync-`node:fs`-plus-`@ts-expect-error` convention.
- `fedos_conversation_archive_cli_export.ts` — `exportFedosConversationArchiveCliPackage()` (satisfies "archive export").
- `fedos_conversation_archive_cli_import.ts` — `verifyFedosConversationArchiveCliPackage()`/`preflightFedosConversationArchiveCliPackage()`/`importFedosConversationArchiveCliPackage()` (satisfies "archive verify"/"archive preflight"/"archive import").
- `fedos_conversation_archive_cli_metadata.ts` — `describeFedosConversationArchiveCliPackage()`/`summarizeFedosConversationArchiveCliManifests()`/`FEDOS_CONVERSATION_ARCHIVE_CLI_VERSION_INFO`/`fedosConversationArchiveCliContentHashMatches()` (satisfies "archive inspect"/"archive metadata"/"archive summary"/"archive version display"/"archive hash verification").
- `fedos_conversation_archive_cli_directory.ts` — `FedosConversationArchiveCliDirectoryManifestV1` (satisfies "metadata manifest") plus `exportFedosConversationArchiveCliDirectory()`/`listFedosConversationArchiveCliDirectory()`/`importFedosConversationArchiveCliDirectory()` (satisfies "directory export"/"archive list"/"directory import").

No existing file under `src/conversation/archive/`, `src/conversation/runtime/`, or anywhere else was modified — every reused function/type is imported verbatim. No Rust file, `package.json`, or `Cargo.toml` was touched.

Four new test files (42 new tests):
- `test/secure_runtime_alpha_2341_2360_cli_package_codec_and_export.test.ts` (15 tests) — Package/multi-Package codec round-trips and rejections, and "archive export" including a **Real Runtime** (structurally real, non-cryptographic round-trip) encrypt path, **Direct**- and **Group**-classified conversations (via the separate Draft port, alongside the Archive Bundle's own structurally-always-`"public"` conversation record), and an **empty archive**.
- `test/secure_runtime_alpha_2361_2380_cli_verify_preflight_import.test.ts` (12 tests) — "archive verify"/"archive preflight"/"archive import," including three distinct **tampered archive** scenarios (mutated `conversationId`, mutated `contentHash`, substituted ciphertext) and a **duplicate archive** re-import.
- `test/secure_runtime_alpha_2381_2400_cli_metadata_and_directory.test.ts` (12 tests) — metadata/inspect/summary/version/hash-verification, and "directory export"/"archive list"/"directory import" round trips covering Direct, Group, and **empty archive** conversations together in one directory, against an in-memory `FedosConversationArchiveCliFileSystem` fake.
- `test/secure_runtime_alpha_2401_2420_cli_large_archive_and_multi_package.test.ts` (3 tests) — a **large archive** (1,000 envelopes/payloads) exported/verified/imported losslessly both as a single Package and through "directory export"/"directory import," and a real "multiple archive bundle" round trip.

## Verification

`npm run typecheck`: clean except one PRE-EXISTING, unrelated error (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`), confirmed via `git diff` to predate this Arc entirely — zero diff to that file, and already named in every recent completion declaration.

`npx vitest run` (full suite, 938 test files): this Arc's own 4 new files / 42 new tests all pass. Every pre-existing failure observed falls into a category already documented by prior Arcs' own completion declarations, and none touches anything this Arc adds (`src/conversation/archive_cli/`, or the four new test files) or anything this Arc's own reused Archive functions depend on:

- **Pre-existing, confirmed unrelated Rust-source static-analysis and Host/Scheduler structural suites** (`test/fedos_core_rust_*`, `test/secure_runtime_alpha_{018,147,151,154,155,156,158,405,472,543,606,617,758}_*`) — `git status packages/`/`git diff` show zero change to `packages/fedos-core-rust/` or `src/desktop/`; this Arc touches neither.
- **Expected-red-until-commit review docs** (`test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`, `test/reviews/private_conversation_security/boundary_guards.test.ts`, `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`, `test/reviews/private_conversation_search_runtime_v1/source_alignment.test.ts`) — these assert a CLEAN working tree, which is by construction false while this Arc's own new files (and the pre-existing, unrelated `p2p/`/`.tmp_gen/` untracked paths) sit uncommitted. Every one of these review docs' own header already states this check "is expected to be red only until this Arc's own single commit lands" — the same documented pattern the Alpha 1051–1110, 1541–1610, and 2501–2580 completion declarations already relied on.

No test this Arc's own new files could plausibly affect (anything outside `src/conversation/archive_cli/`) shows a genuine regression, and no test inside `src/conversation/` regressed either — this Arc added files, modified none.

`cargo test`: not run — this Arc touches no Rust file; `packages/fedos-core-rust/` has zero diff.

## Named, deliberate boundaries (not silently dropped)

- No new Archive wire shape, crypto primitive, or `AeadAadDomain` variant (see execution spec, "Key design decisions," item 4).
- No path-traversal/sandboxing logic in the file-system boundary — `path` is always this Arc's own in-process, trusted caller's own value.
- No `bin`/argv-parsing CLI entrypoint — this Arc builds the library-level functions a future Host-wiring Arc would expose as an actual command line.
- No retention-authority gating — unchanged from, and no worse than, the pre-existing Archive Collector/Restore gap named by the Alpha 2501–2580 review audit; this Arc adds no new payload read/write path of its own.

## Recommended next Arc

An actual `bin`/argv-parsing CLI entrypoint wiring these library functions to a real command line (`archive export <id> ...`), and Host-side wiring exposing `FedosConversationArchiveCliFileSystem`'s real implementation alongside `boardRuntime()`/`conversationRuntime()`.

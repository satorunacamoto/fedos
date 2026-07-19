# Secure Runtime Alpha 2341–2420: Conversation Archive CLI and User Packaging — Execution Spec

Architecture frozen. This Arc adds no new Archive wire shape, no new
crypto primitive, no new `AeadAadDomain` variant, no Rust/WASM change,
and no change of any kind to `src/conversation/archive/` or
`src/conversation/runtime/`. Every byte this Arc encrypts, decrypts,
restores, or reports on is produced entirely by the ALREADY-EXISTING,
unmodified Archive Runtime (Alpha 1541–1610); this Arc is a pure,
additive CLI/packaging layer sitting on top of it.

## Scope

**Reuse** (consumed as-is, unmodified):

- `collectFedosConversationArchiveBundle()` (`src/conversation/archive/fedos_conversation_archive_collector.ts`, Alpha 1541–1610) — the entire read side of "archive export."
- `FedosWasmConversationArchiveEncryptionAuthority.export()`/`.import()` (`src/conversation/archive/fedos_conversation_archive_encryption.ts`, same Arc) — the entire seal/open step every CLI command built here composes around; never re-implemented.
- `restoreFedosConversationArchiveBundle()` (`fedos_conversation_archive_restore.ts`) — the entire write side of "archive import."
- `detectFedosConversationArchiveDuplicates()` (`fedos_conversation_archive_duplicate_detection.ts`) — the entire read-only side of "archive preflight."
- `FedosConversationArchiveManifestV1`/`deserializeFedosConversationArchiveManifest()` (`fedos_conversation_archive_manifest.ts`/`_manifest_codec.ts`) — the cleartext record every "archive metadata"/"archive inspect"/"archive summary"/"archive list" command reads directly, never re-derived.
- `computeFedosConversationArchiveContentHash()`/`fedosConversationArchiveContentHashesAreEqual()` (`fedos_conversation_archive_integrity.ts`) — "archive hash verification"'s own entire implementation.
- `FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION` (`fedos_conversation_archive_schema_version.ts`) — named alongside this Arc's own new packaging version for "archive version display," never duplicated.

**Implement** (new, under `src/conversation/archive_cli/`, 7 files):

- `fedos_conversation_archive_cli_package.ts` — `FedosConversationArchiveCliPackageV1` ("single archive") and `FedosConversationArchiveCliMultiPackageV1` ("multiple archive bundle") types, plus this Arc's own packaging `formatVersion` constant.
- `fedos_conversation_archive_cli_package_codec.ts` — serialize/deserialize for both Package shapes; coarse-then-fine validation delegating all deep Manifest checking to the reused Manifest codec.
- `fedos_conversation_archive_cli_file_system.ts` — the one injectable `FedosConversationArchiveCliFileSystem` boundary ("directory export"/"directory import"/"archive list" reach the real filesystem only through this).
- `fedos_conversation_archive_cli_export.ts` — `exportFedosConversationArchiveCliPackage()` ("archive export").
- `fedos_conversation_archive_cli_import.ts` — `verifyFedosConversationArchiveCliPackage()`/`preflightFedosConversationArchiveCliPackage()`/`importFedosConversationArchiveCliPackage()` ("archive verify"/"archive preflight"/"archive import").
- `fedos_conversation_archive_cli_metadata.ts` — `describeFedosConversationArchiveCliPackage()`/`summarizeFedosConversationArchiveCliManifests()`/`FEDOS_CONVERSATION_ARCHIVE_CLI_VERSION_INFO`/`fedosConversationArchiveCliContentHashMatches()` ("archive inspect"/"archive metadata"/"archive summary"/"archive version display"/"archive hash verification").
- `fedos_conversation_archive_cli_directory.ts` — `FedosConversationArchiveCliDirectoryManifestV1` ("metadata manifest") plus `exportFedosConversationArchiveCliDirectory()`/`listFedosConversationArchiveCliDirectory()`/`importFedosConversationArchiveCliDirectory()` ("directory export"/"archive list"/"directory import").

## Key design decisions

1. **The Manifest already travels in the clear — so metadata/inspect/summary/list/version/hash-verification are all pure, synchronous, key-free functions.** `FedosConversationArchiveManifestV1` was already designed (Alpha 1541–1610) to let a caller inspect record counts without decrypting; this Arc's own read-only commands simply exercise that existing property rather than adding any new "peek without the key" mechanism of their own.
2. **"archive verify" is a direct, un-embellished pass-through of `authority.import()`'s own result.** That function already performs the FULL decrypt-and-check (AEAD authentication, Header identity check, Integrity content-hash check) and never touches persistence — there is no narrower "verify-only" check to build; naming the existing call as its own CLI command is the entire feature.
3. **"archive preflight" and "archive import" are the SAME decrypt step, differing only in which of the two already-existing post-decrypt functions (`detectFedosConversationArchiveDuplicates()` vs. `restoreFedosConversationArchiveBundle()`) runs on the resulting bundle.** Sharing one `openPackage()` helper for the decrypt step, rather than duplicating it three times, keeps "verify"/"preflight"/"import" mechanically guaranteed to treat a given Package identically up through the point they diverge.
4. **A CLI Package's own `formatVersion` is independent of the Archive's own `schemaVersion`.** Conflating them would mean a future purely-CLI-side packaging change (e.g. a new sidecar field) forces a bump to the frozen Archive wire format itself — exactly the coupling "Architecture frozen" rules out.
5. **"directory export"/"directory import" go through ONE injected `FedosConversationArchiveCliFileSystem`, and "archive list" reads ONLY that directory's own index file, never a raw scan.** A directory may contain files this Arc did not write; trusting an index this Arc itself produced (and updates on every export) is safer than guessing which arbitrary file is a Package, and mirrors Alpha 1541–1610's own "coarse-then-fine, reuse the existing deep validator" layering one level up, at the directory level.
6. **Every batch operation (`exportFedosConversationArchiveCliDirectory()`/`importFedosConversationArchiveCliDirectory()`) tallies outcomes per conversation and never aborts on one failure** — the same "a partially-invalid Archive should not block the rest" discipline Restore (Alpha 1541–1610) already established, extended here from one bundle's nested records to many conversations in one directory.

## Deliberately out of scope (named, not silently dropped)

- No new Archive wire shape, crypto primitive, or `AeadAadDomain` variant — every ciphertext byte this Arc ever produces or consumes is exactly what `FedosWasmConversationArchiveEncryptionAuthority` already produces/consumes.
- No path-traversal/sandboxing logic in `FedosConversationArchiveCliFileSystem` — `path` always originates from this Arc's own in-process, trusted caller, never from untrusted external input.
- No actual command-line argument parser/`bin` entrypoint/`process.argv` handling — this Arc builds the library-level functions a future, separate CLI-entrypoint Arc would wire to argv, mirroring every prior Arc's own "no Host/GUI wiring" deferral.
- No retention-authority gating of any kind in this Arc's own code — Archive Collector/Restore (Alpha 1541–1610) already do not gate through `FedosPayloadRetentionAuthority`, and this Arc adds no new payload read/write path beyond what those two functions already perform; the pre-existing gap they carry is unchanged by anything here.

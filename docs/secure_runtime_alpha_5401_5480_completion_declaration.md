# Secure Runtime Alpha 5401–5480 — Completion Declaration

**FedOS Local Deletion Capability and Deletion-State Foundation Arc**

## Declared: full completion

All criteria this Arc's own instructions require for a "full completion"
title are met:

- [x] Closed capability/status types exist (`FedosDeletionTarget` — 10
      values, `FedosDeletionOperation` — 8 values, `FedosDeletionEvidence`
      — 4 values, `FedosDeletionStatus` — 15 values,
      `FedosDeletionCapabilityDescriptor` — never a bare boolean, never
      caller-self-declared, unknown target fails closed to `null`).
- [x] Real Retention integration works — `executeFedosLocalPayloadDeletionPlan`
      calls the real `FedosPayloadRetentionAuthority.tombstonePayload()`/
      `.removeLocalPayload()`, verified by re-querying
      `evaluatePayloadAccess()` after execution.
- [x] Real Search purge works — the same execution path calls the real
      `FedosConversationSearchIndex.reconcilePayloadRetention()`; a purged
      payload's own indexed Envelope is independently re-queried as gone
      (`searchKeyword`, `size()`), not merely claimed.
- [x] Archive/live separation holds — structurally (the payload executor's
      own dependency type carries no filesystem; the Archive-file
      executor's own dependency type carries no Retention/Search
      authority) and behaviorally (two dedicated tests, plus the Phase O
      vertical slice, exercise both directions).
- [x] Trusted Archive removal works — `resolveFedosDeletionArchiveFileHandle`
      resolves only through the existing Archive CLI directory's own
      index; `removeFedosDeletionArchiveFile` re-checks identity, refuses
      symlinks, refuses traversal-shaped/bare-root paths, is missing-file
      idempotent, and removes exactly one named file, never a directory.
- [x] Restart idempotency works — verified against the REAL
      `AppendOnlyFedosDeletionExecutionPersistence` NDJSON backend: a
      fresh persistence instance over the same log file converges to the
      identical durable record; a conflicting duplicate or a corrupt line
      fails closed (throws) rather than silently resolving.
- [x] User summaries are honest — closed non-guarantee vocabulary only,
      universal "never presented as deleted everywhere" warning always
      appended, no raw path, no plaintext, verified structurally.
- [x] No remote deletion mechanism is added — no network transport, no
      Relay event, no NIP, no recipient-acknowledgement vocabulary exists
      anywhere in this Arc's own source (verified by direct source-text
      scan, not merely prose claim).
- [x] No physical-erasure guarantee is claimed — the one non-guarantee
      code covering it (`no-physical-erasure`) states erasure is "never
      guaranteed or claimed"; no sentence anywhere in this Arc's own
      module affirms the opposite.

## Local-only V1 — explicit scope statement

This Arc implements **local deletion only**. The following remain
deliberately, honestly **unbuilt**:

- Remote deletion request (no wire message, no protocol).
- Recipient acknowledgement of any kind.
- Relay deletion (no Relay event, no NIP).
- Physical/secure erase or SSD-overwrite guarantee of any already-written
  byte.
- Cloud-history or OneDrive version-history deletion.
- Automatic backup deletion.
- Cryptographic key destruction as a substitute for plaintext deletion
  proof.

A local user can, today, honestly: tombstone/remove a local payload and
purge it from the local Search index; independently remove one tracked
local Archive Package file; revoke a Device's or a Membership's local
access. None of these claims — nor may they ever be presented as claiming
— that any copy outside this local install was touched.

## Archive/live separation — restated

Deleting an Archive file never changes live Conversation history (Retention
state, Search index) — the Archive-file execution path imports nothing
from `../retention/`, `../search/`, or the payload persistence layer.
Deleting live history never silently removes an Archive file — the payload
execution path's own dependency type carries no filesystem or Archive
authority at all. Both are independently confirmed, separately planned,
separately executed, separately recorded.

## Verification run (this worktree, `C:\wt\local-deletion-foundation`)

1. `npm run typecheck` — clean except one PRE-EXISTING, unrelated failure
   (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
   a Publish Scheduler test this Arc never touched; byte-identical to
   `master`'s own copy of the same file).
2. This Arc's own 7 new test files: **82/82 passed.**
3. The two pre-existing Archive CLI test files whose own fixture needed a
   4-line `deleteFile` stub for interface compliance: **15/15 passed**,
   unchanged test count.
4. Retention (`secure_runtime_alpha_795/796/799_payload_retention_*`),
   Search (`secure_runtime_alpha_2541_2560_search_index_*`,
   `..._2581_2600_retention_ingestion_gate_and_purge`), Archive
   (`secure_runtime_alpha_1541–1600_archive_*`, `..._2561_2620_archive_*`),
   Device (`..._2421_2500_device_binding_and_registry`), Membership
   (`..._764_768/769_771/825_832/866_membership_*`) — every one of these
   test files' own name is absent from the full `npm test` failure list;
   zero regression.
5. `npm test` (full suite, 947 files / 12,445 tests): 194 files / 240
   tests fail, **none of them a regression this Arc caused**:
   - ~160 files are Rust/WASM/crypto-runtime artifact tests
     (`test/fedos_core_rust_*`, `test/runtime_wasm_*`,
     `test/runtime_crypto_*`, `test/secure_runtime_alpha_0*`–`0*_*`, etc.)
     that fail identically because this worktree — like the primary
     checkout itself — has no compiled `pkg/` WASM artifact and no
     top-level `Cargo.toml` (the real one lives at
     `packages/fedos-core-rust/Cargo.toml`); pre-existing environmental
     gap, confirmed present in the primary checkout too, not something
     any Rust file this Arc never touches could regress.
   - ~34 files are `test/reviews/**/boundary_guards.test.ts`-style
     self-checks belonging to PRIOR, unrelated design reviews, which
     literally shell out to `git status --porcelain -- src ...` and
     assert empty output as their own "this review touched no source"
     proof. They spuriously fail while this Arc's own legitimate,
     intended `src/` changes sit uncommitted in the working tree — by
     construction, resolved the moment this Arc's own commit lands and
     the tree returns to clean.
6. No file under `p2p/` or `.tmp_gen/` was read, written, or referenced by
   this Arc.

## Files changed

Ten new files under `src/conversation/deletion/`; one new method
(`deleteFile`) on `FedosConversationArchiveCliFileSystem`; one new function
(`removeFedosConversationArchiveCliDirectoryEntry`) on the Archive CLI
directory module; seven new test files (82 tests); two pre-existing test
files' own local fixture gained the four-line `deleteFile` stub their
already-existing interface now requires; two new docs (this one and the
execution spec) plus the Phase A reconciliation report. No `package.json`,
`package-lock.json`, `Cargo.toml`, `p2p/`, or `.tmp_gen/` change.

## Next Arc

**FedOS Signed Recipient Deletion Request Protocol Foundation Review** —
a design-review-only Arc (no production code) to specify, subject to this
same repository's Architecture-Frozen discipline, what a signed remote
deletion REQUEST (never a guaranteed remote erasure) could honestly look
like as a NEW, explicitly-versioned protocol surface, and what evidence
class a recipient's acknowledgement could honestly carry — before any
production implementation is attempted.

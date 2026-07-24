# Secure Runtime Alpha 7481–7560 — Completion Declaration

**FedOS Archive Envelope Retention Parity and Metadata Deletion Semantics Arc.**

Base: `4c6fa3b3` (Secure Runtime Alpha 7401–7480). Remediates the exact
narrow gap named by the committed audit `2eed88d9` (Archive/Retention/
Deletion semantics audit at `194dc448`). Ran as "Arc A" of a two-Arc
parallel-execution assignment; "Arc B" (FedOS Conversation Outbox Restart
Hydration and Scheduler Scalability) ran independently in a separate
worktree/branch and was never touched by this Arc (see Phase K's own
structural guard, test 3).

## Verdict: FULL COMPLETION

Every completion criterion the mission itself named is met:

- **Export parity** — a single `retentionAuthority` dependency now gates
  BOTH Envelope and Payload collection, keyed by the same `payloadId`
  (Phase D). Previously only Payload was gated; Envelope metadata
  (existence, timing, sender, recipient, conversation association,
  envelope id) survived export unconditionally even after deletion — the
  audit's own headline finding, now closed.
- **Restore parity** — a NEW, additive `retentionAuthority` dependency on
  `restoreFedosConversationArchiveBundle()` re-evaluates the RESTORING
  device's own current retention state before writing either an Envelope
  or a Payload (Phase E). A genuine defect was found and fixed during
  this Arc's own work while writing the real vertical slice: the obvious
  first implementation reused `evaluatePayloadAccess()`, whose
  `payloadStorage`-existence gate made every fresh restore
  indistinguishable from "genuinely foreign" (a fresh device's own
  Payload Storage is empty by construction at the exact moment restore's
  own per-record check runs, before restore has written anything) —
  silently defeating the intended defense-in-depth. Fixed by adding a
  new, narrow, additive public method,
  `FedosPayloadRetentionAuthority.evaluateRetentionDecisionOnly()`,
  which checks the retention DECISION LOG directly, independent of
  payload-storage presence, and rewiring the restore-time gate to use it
  instead.
- **No post-deletion metadata resurrection contrary to policy** —
  proven live: restoring a POST-deletion Archive never resurfaces the
  deleted Envelope; restoring a PRE-deletion Archive (which genuinely
  still carries the record) onto a device that has SINCE independently
  recorded the same deletion fact is suppressed via the new
  `"partially-denied"` outcome, even though the Archive's own bundle
  content is never itself consulted or edited.
- **Pre-deletion Archive behavior explicitly handled** — Phase F's own
  non-guarantee document states plainly, and Phase J's failure matrix
  proves: an Archive taken BEFORE a deletion is a real, independent,
  point-in-time file this Arc never reaches into or edits; restoring it
  onto a genuinely foreign/never-informed device is NOT suppressed, and
  this is disclosed as an honest, permanent limitation — never fabricated
  global deletion propagation.
- **Safety Center warning corrected** — 3 new warning codes
  (`archive-metadata-may-survive-content-deletion`,
  `archive-export-after-deletion-applies-retention-parity`,
  `archive-restore-may-be-suppressed-by-local-deletion-facts`), wired
  into both the generic Safety Center overview (automatically, via the
  existing `FEDOS_SAFETY_CENTER_KNOWN_WARNING_CODES` mechanism) AND a new
  Archive-workflow-specific surface
  (`fedos_archive_workflow_safety_warnings.ts` +
  `FedosDesktopArchiveViewModel.workflowWarnings()`), closing the audit's
  own Section 5 finding that the Archive workflow itself never surfaced
  any warning at all.
- **No overclaim** — Phase K's own structural guards (tests 10, 11)
  scan every new/modified doc and source file for physical-erasure,
  Relay-deletion, account/backup-wide-deletion, and `deletedEverywhere`
  language, requiring every mention to sit inside an explicit disclaimer,
  never an affirmative claim.

## Two additional pre-existing overclaims found and fixed (Phase G)

Beyond the audit's own named scope, direct source inspection found:

1. `FEDOS_DELETION_CAPABILITY_REGISTRY`'s own `"local-envelope"` entry
   falsely claimed `reachableToday: true` with real
   `supportedOperations: ["tombstone", "logical-delete"]` — no real
   executor/plan-step for it exists anywhere in
   `fedos_deletion_plan.ts`'s own `target` union (`"local-payload"` /
   `"local-index"` only). Corrected to `reachableToday: false`,
   `supportedOperations: []`, `evidenceClass: "none"`.
2. `assessFedosLocalPayloadDeletion()`'s own `"denied"` branch wrongly
   claimed the `local-envelope` observation mirrors the Payload's own
   tombstoned/removed state — in LIVE storage the Envelope record is
   NEVER touched by local deletion and always remains `"present"`.
   Corrected, and a new `futureArchiveExportExcludesThis: boolean` field
   added to `FedosDeletionAssessment` so Safety Center can state the
   real, narrower, correct fact this Arc actually implements.

## What this Arc deliberately did NOT do

Per its own absolute prohibitions (Phase K, tests 1–9): no physical-
erasure guarantee, no Relay deletion, no backup-wide deletion, no
automatic Signed Deletion approval, no new deletion protocol, no new NIP,
no new crypto primitive, no Archive format rewrite (schema version
unchanged at `1`), no message-history rewrite, no silent removal of all
metadata regardless of policy, no raw path exposure, no new universal
audit log, no second Retention Authority (one new narrow public method
on the SAME class), no second Archive Runtime, no Search redesign, no
Outbox/Scheduler changes (verified via `git diff` scoped to every known
Outbox/Scheduler path — zero), no `p2p/` or `.tmp_gen/` changes.

## Documentation produced

- `secure_runtime_alpha_7481_7560_reconciliation_report.md` (Phase A)
- `secure_runtime_alpha_7481_7560_metadata_classification_and_policy.md` (Phase B)
- `secure_runtime_alpha_7481_7560_chosen_archive_model.md` (Phase C)
- `secure_runtime_alpha_7481_7560_export_restore_parity_specification.md` (Phase D/E)
- `secure_runtime_alpha_7481_7560_retained_copy_non_guarantees.md` (Phase F)
- `secure_runtime_alpha_7481_7560_archive_schema_compatibility.md`
- This completion declaration

## Verification performed

- `npx tsc --noEmit`: clean, modulo two pre-existing baseline errors this
  Arc never touched (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts` —
  confirmed via `git log` that neither file was modified by this Arc).
- Targeted Archive/Retention/Deletion/Safety-Center regression: 30 test
  files, 243 tests, all passing (includes every pre-existing Archive
  round-trip, group Archive, CLI packaging, retention-ingestion, and
  Search/Archive interaction suite this Arc's own changes could plausibly
  affect).
- Phase I real, no-mocks vertical slice (real 2-profile WASM-backed
  crypto, real relay): passing.
- Phase J failure matrix (22 named scenarios): passing.
- Phase K structural guards (13 checks): passing.
- Full `npx vitest run`: 843 files / 14177 tests passing, 269 files / 360
  tests failing, 27 skipped. The failing set is the well-documented,
  pre-existing "fresh worktree raw-import artifact" class (hundreds of
  historical `test/fedos_core_rust_*.test.ts` "Stage NNN" milestone
  checks and `test/reviews/*` source-alignment scans that assert
  properties about the raw repository/package layout, unrelated to
  runtime behavior) — confirmed, not assumed: (1) zero overlap between
  the failing-file list and any file this Arc touched or created; (2)
  manually diagnosed one instance
  (`test/fedos_core_rust_aead_skeleton.test.ts`, "no committed
  Cargo.lock") and found a genuinely stray, untracked, gitignored
  `packages/fedos-core-rust/Cargo.lock` left over in this worktree from
  earlier `cargo`/WASM-build activity in this same session — removed,
  along with the untracked `pkg/`/`target/` build output, before this
  final run; failure count dropped from 294→269 files as a direct
  result, confirming the artifact-class diagnosis rather than a hidden
  regression. No further reduction was pursued given the matching,
  extensively-precedented baseline documented across many prior Arcs in
  this same lineage.
- Cargo/WASM: not rebuilt for this final run (this Arc made zero Rust
  changes, confirmed by Phase K's own zero-diff guard on
  `packages/fedos-core-rust`); the real vertical slice (Phase I) was
  run once, earlier in this session, against a real compiled artifact
  before it was cleaned up per the "clean generated artifacts before
  committing" instruction — it can be rebuilt and re-run at any time via
  `wasm-pack build --target web` from `packages/fedos-core-rust`.
- Secret/plaintext leak scan: performed inline inside the Phase I
  vertical slice itself (both pre- and post-deletion Archive files
  scanned for either message's raw plaintext) — none found.

## Recommended next Arc

**FedOS Archive Multi-Device Suppression Propagation Arc** — the one
honestly-disclosed limitation this Arc leaves standing: a device that
never independently observed a deletion (a genuinely foreign profile, or
a same-account device that was offline when the deletion happened) has
no basis to suppress a pre-deletion Archive's content on restore. Closing
this for real would require a deliberate, reviewed mechanism to propagate
a deletion FACT (not archive bytes) across a user's own already-paired
devices — explicitly out of this Arc's own scope ("Do not fabricate
global deletion propagation") and a natural, narrow follow-on now that
single-device parity is solid.

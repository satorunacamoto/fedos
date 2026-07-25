# FedOS Documentation Consolidation V1 — Review Index and Deletion Candidates

Docs-only. No source code changed. No review branch merged, pushed, or
deleted. This document is the traceability map for the FedOS
Documentation Consolidation: which of the nine requested review
categories map to which real source commit(s), which of the seven
canonical top-level documents (`README.md`, `SECURITY.md`,
`ARCHITECTURE.md`, `ROADMAP.md`, `KNOWN_LIMITATIONS.md`, `BUILDING.md`,
`CONTRIBUTING.md`) now carries their content, and — per the consolidation
request — which existing documents are now **duplicate-content deletion
candidates**.

None of the branches below are ancestors of `master`. Their content was
read via `git show <hash>:<path>`, never checked out or merged. "Deletion
candidate" below means: **if and when a human decides to merge one of
these branches**, the specific listed files would be safe to delete at
that point because their content is now captured in a canonical
top-level doc — not an instruction to delete anything now, and not an
instruction to merge these branches.

## Category → commit → canonical doc map

| # | Category | Branch | Commit | Primary canonical doc(s) |
|---|---|---|---|---|
| 1 | Validation V1 | `review/fedos-validation-program-v1` | `9b9ce274` | ARCHITECTURE, KNOWN_LIMITATIONS, SECURITY, ROADMAP |
| 2 | Validation V2 | `review/fedos-original-vision-expected-behavior-v2` | `09140dd5` | ARCHITECTURE, ROADMAP, KNOWN_LIMITATIONS |
| 3 | Security Review | `review/desktop-beta-security-audit-preparation` | `8e730f25` | ARCHITECTURE (threat-model section), SECURITY |
| 3 | Security Review | `review/desktop-beta-security-audit-delta-8041-8120` | `6873d24f` | SECURITY, KNOWN_LIMITATIONS |
| 3 | Security Review | `review/public-docs-security-claims-audit` | `dbc1386` | KNOWN_LIMITATIONS (already reconciled pre-consolidation) |
| 4 | Performance Review | `review/conversation-outbox-scheduler-scalability-audit` | `212b8420` | ROADMAP |
| 4 | Performance Review | `review/delivery-observation-writetime-duplicate-check-scalability` | `3a4dd0bf` | ROADMAP (historical design rationale for the Alpha 7881-7960 fix) |
| 5 | Architecture Review | `review/architecture-conformance-secure-runtime` | `17c6cef6` | ARCHITECTURE, ROADMAP |
| 6 | UX Review | `review/desktop-beta-ux-acceptance` | `9c238a11` | ROADMAP (mostly stale — see below), KNOWN_LIMITATIONS (accessibility) |
| 7 | Release Review | `review/desktop-beta-release-claims-reconciliation` | `d760c95f` | BUILDING, ROADMAP |
| 7 | Release Review | `review/release-readiness-alpha7161-7240` | `72598a6e` | BUILDING (historical context only — describes a much earlier, since-resolved lineage) |
| 8 | Technical Debt Review | `review/fedos-technical-debt-performance-v1` | `1e4d68d4` | ROADMAP, KNOWN_LIMITATIONS |
| 9 | Dead Runtime Review | `review/fedos-dead-runtime-production-path-v1` | `ad3c400e` | ARCHITECTURE, ROADMAP |

Additionally reconciled, already merged to `master` before this
consolidation pass (Arc 8201-8280's own prior follow-up commit
`81305b37`): the four-review reconciliation covering Dead Runtime
(`ad3c400e`), Technical Debt (`1e4d68d4`), Validation V2 (`09140dd5`),
and Closed Beta Operations/Audit Readiness (`600157b9`, **not** one of
the nine categories in this consolidation request — it covers pilot
operations/audit-readiness process, not architecture/security/
performance/UX/release engineering, and was already fully reconciled
into `SECURITY.md`/`KNOWN_LIMITATIONS.md` by that prior commit).

## Deletion candidates — now-redundant documents within THIS repository

These are real files in this checkout (not the unmerged review branches
above) whose content has been fully absorbed into the seven canonical
docs. Each has been left in place as a short pointer stub rather than
deleted, so existing cross-references from other documents and past
commit messages don't 404:

- `docs/desktop_beta_known_limitations.md` — superseded by
  `KNOWN_LIMITATIONS.md`. Now a stub.
- `docs/secure_runtime_alpha_8201_8280_deferred_findings_roadmap.md` —
  superseded by `ROADMAP.md`. Now a stub.

A human or a future Arc with explicit authorization to delete files
(this consolidation was not given that authorization) could safely
remove both stub files entirely once confident nothing else references
them by path.

## Deletion candidates — IF the unmerged review branches above are ever merged

If a future Arc merges any of the branches in the table above, these
newly-introduced files would become duplicate content at that point and
should be deleted or stubbed the same way, since their substance now
lives in a canonical doc:

- From `9b9ce274`: all 11 files under
  `docs/reviews/fedos_validation_program_v1/` (or wherever that commit
  places them — verify path at merge time).
- From `09140dd5`: all files under
  `docs/reviews/fedos_original_vision_expected_behavior_v2/`.
- From `8e730f25`: `docs/reviews/desktop_beta_external_security_audit_preparation_v1/00_audit_preparation_package.md`.
- From `6873d24f`: `docs/reviews/desktop_beta_external_security_audit_preparation_v1/01_delta_review_alpha_8041_8120.md`.
- From `dbc1386`: `docs/reviews/public_docs_security_claims_audit_v1/*`
  (already reconciled once; would be a second, now-redundant
  reconciliation).
- From `212b8420` and `3a4dd0bf`: their respective scalability-audit
  files — **partial exception**: `3a4dd0bf`'s Options A-H design-rationale
  section has no home in any canonical doc and is worth preserving
  verbatim somewhere (e.g. as an appendix) rather than deleting outright,
  since `ROADMAP.md` only summarizes its conclusion, not its reasoning.
- From `17c6cef6`: all 7 files under
  `docs/reviews/architecture_conformance_secure_runtime_v1/` — **note**:
  do not delete without first re-verifying which findings are stale
  (this review predates the Alpha 7961-8040 master-landing Arc; several
  of its "unmerged lineage" findings no longer apply, as documented in
  `ARCHITECTURE.md`'s own "Historical note on this document's sources"
  section).
- From `9c238a11`: `docs/secure_runtime_desktop_beta_ux_acceptance_review.md`
  — **caution**: this review is now substantially stale (most of its
  findings describe UI gaps that have since shipped); do not treat its
  deletion as confirmation the underlying gaps are closed without a
  direct re-verification pass first (see `ROADMAP.md`'s own UX section).
- From `d760c95f` and `72598a6e`: their respective files under
  `docs/reviews/desktop_beta_release_claims_patch_plan_v1/` and wherever
  `72598a6e` places its single 516-line file.

## What was explicitly NOT touched by this consolidation

- `docs/desktop_beta_user_guide_*.md` (installation, first-run, relay
  setup, invitation and chat, archive and deletion, recovery and
  troubleshooting, device pairing) — these are end-user how-to guides,
  not review documents, out of scope for a review-consolidation pass.
- `SECURITY.md`'s "Reporting a vulnerability" placeholder — untouched;
  filling it requires a real contact channel a human must designate.
- Any review branch not matching one of the nine requested categories
  (there are ~35 other `review/*` branches in this repository covering
  individual protocol/feature design decisions — onion transport,
  private-group-crypto, multi-device identity rotation, and others —
  none were in scope for this request).
- `README.md`'s multi-thousand-line append-only Arc status history —
  read for cross-checking stale claims (one, the code-signing overclaim,
  was found already corrected by a prior Arc) but not restructured;
  that history is this repository's own changelog-of-record, not
  duplicate review content.

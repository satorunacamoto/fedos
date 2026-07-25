# Evidence Index

Every source document this bundle draws from, with exact location. For a
document on a branch never merged into `master`, the location is a
`git show <branch>:<path>` command — run it from any checkout of this
repository, no checkout/branch-switch of your own working tree required.
"Status" records whether that branch is an ancestor of current `master`
(`81305b37`), checked via `git merge-base --is-ancestor <commit> master`.

## Audit Preparation

| Document | Location | Base commit | Status |
|---|---|---|---|
| Audit Preparation Package (20-deliverable base inventory: scope, architecture diagram, trust-boundary map, secret-flow map, crypto/protocol inventories, threat scenarios, ranked risk paths, review order, fuzz targets, dependency list, reproduction instructions, severity rubric, disclosure requirements, evidence checklist) | `git show review/desktop-beta-security-audit-preparation:docs/reviews/desktop_beta_external_security_audit_preparation_v1/00_audit_preparation_package.md` | `97f26f0f` | **Not merged** into `master` — inlined in this bundle (§1, §01_architecture, §03_review_order) |
| Its Alpha 8041-8120 delta (new `window.fedosApp` attack surface, 34 channels, XSS-vector grep, input-validation matrix, dual-bridge exposure finding) | `git show review/desktop-beta-security-audit-delta-8041-8120:docs/reviews/desktop_beta_external_security_audit_preparation_v1/01_delta_review_alpha_8041_8120.md` | `7337759` | **Not merged** into `master` — inlined in this bundle |
| Its own Alpha 8121-8200 delta (references the two docs above by name; this one IS on `master`) | `docs/secure_runtime_alpha_8121_8200_external_audit_prep_delta_v1.md` | `739fb3e8` | Merged (on `master` today) — but cites the two unmerged docs above as required reading, a real reachability gap this bundle closes by inlining their content |
| Closed Beta Operations and Independent Security Audit Readiness V1 (45-item pilot-ops + audit-prep + release-governance package, 19 documents) | `git show review/fedos-closed-beta-operations-audit-readiness-v1:docs/reviews/fedos_closed_beta_operations_audit_readiness_v1/00_index.md` (and `01_...md` through `18_normative_summary.md` in the same directory) | `739fb3e8` | **Not merged** into `master` — its 45-item matrix inlined in `06_disclosure_policy.md` of this bundle |

## Security Review

| Document | Location | Base commit | Status |
|---|---|---|---|
| Public Documentation and Security-Claims Audit v1 (10 documents; taxonomy ACCURATE/STALE/OVERCLAIM/UNDERCLAIM; the code-signing contradiction; the WASM-precondition overclaim) | `git show review/public-docs-security-claims-audit:docs/reviews/public_docs_security_claims_audit_v1/index.md` (and `01_...md` through `10_incident_response_requirements.md`) | `81b5f0d1` | **Not merged** into `master` — its sharpest findings inlined in `05_known_issues.md` |
| Release Readiness Review Alpha 7161-7240 (canonical packaged app never enables new crypto/routing flags; Archive bypasses retention authority; recovery-required dead end) | `git show review/release-readiness-alpha7161-7240:docs/reviews/release_readiness_alpha_7161_7240/00_release_readiness_review.md` | `b4fa2d7f` | Not merged — historical findings, several since superseded (see Known Issues for current status of each) |
| Electron End-User Workflow Review Alpha 7241-7320 (11-workflow reachability trace; 15 total IPC channels; NIP-17 misrouting is silent) | `git show review/electron-e2e-alpha7241-7320:docs/reviews/electron_e2e_review_alpha_7241_7320/00_electron_end_user_review.md` | `10b02cbf` | Not merged — largely superseded by Alpha 8041-8120's UI shell; re-verify before citing |
| Archive/Retention/Deletion Audit at 194dc448 (Envelope/Payload collection unlinked; metadata survives export unconditionally) | `git show review/archive-retention-deletion-audit-194dc448:docs/reviews/archive_retention_deletion_audit_194dc448/00_archive_retention_deletion_audit.md` | `194dc448` | Not merged — the Envelope half of this gap was closed at Arc 7481-7560 (see Known Issues) |
| Desktop Beta UX Acceptance Review (real shipped UI was 4 screens; `fedosAcceptance` bridge zero-consumer finding; recovery dead end) | `git show review/desktop-beta-ux-acceptance:docs/secure_runtime_desktop_beta_ux_acceptance_review.md` | `81b5f0d1` | Not merged — reachability finding superseded by Alpha 8041-8120; dual-bridge finding still current |
| Desktop Beta External Security Audit Preparation (base + delta) | *(see Audit Preparation section above)* | | |
| Architecture Conformance Review (see Architecture section below) | | | |
| Technical Debt / Performance Audit V1 (append-only O(T) pattern, ~52/53 backends; Device Relay Sync zero production wiring; append-only crash-brick behavior) | `git show review/fedos-technical-debt-performance-v1:docs/reviews/fedos_technical_debt_performance_v1/00_index.md` | `739fb3e8` | Not merged — inlined in `05_known_issues.md` |
| Dead Runtime Production Path V1 (Track A dead-code confirmation, recommendations against deletion) | `git show review/fedos-dead-runtime-production-path-v1:docs/reviews/fedos_dead_runtime_production_path_v1/00_index.md` | `739fb3e8` | Not merged — findings reconciled into `docs/secure_runtime_alpha_8201_8280_deferred_findings_roadmap.md` on `master` |
| Original Vision / Expected-Behavior Validation V2 (Sender-Key prototype nuance; README vision-section gap) | `git show review/fedos-original-vision-expected-behavior-v2:docs/reviews/fedos_original_vision_expected_behavior_v2/00_index.md` | `739fb3e8` | Not merged — findings reconciled into `master`'s README rewrite and known-limitations doc (Alpha 8201-8280) |

## Validation

| Document | Location | Base commit | Status |
|---|---|---|---|
| Validation Program V1 (master feature matrix across 7 sections; final architecture scorecard across 10 dimensions; verbatim go/no-go recommendation) | `git show review/fedos-validation-program-v1:docs/reviews/fedos_validation_program_v1/index.md` (`01_master_feature_matrix.md`, `09_final_architecture_scorecard.md`, `10_go_no_go_recommendation.md` in the same directory) | `739fb3e8` | **Not merged** into `master` — its verdicts inlined in `00_audit_package.md` of this bundle; its 9 claims independently re-verified twice since (by the Closed Beta Operations review and the Technical Debt review), 8/9 or 5/6 respectively still hold |

## Architecture

| Document | Location | Base commit | Status |
|---|---|---|---|
| Architecture Conformance Review (14-subsystem conformance report, missing-features matrix, unexpected-improvements list, priority-ordered recommendations) | `git show review/architecture-conformance-secure-runtime:docs/reviews/architecture_conformance_secure_runtime_v1/00_index.md` (`01_architecture_conformance_report.md`, `03_missing_features_matrix.md`, `04_unexpected_improvements.md`, `06_recommendations.md`) | `3eb9eadd` (Alpha 2581-2620 — the oldest base of any document cited in this bundle) | Not merged — **its "8 of 14 subsystems absent from master" scope framing is stale**; the underlying bug-history and design-conformance findings remain valid historical evidence |
| Secure Runtime master merge strategy (confirms 5401-7320 is one converged, fast-forward-eligible lineage) | `git show review/secure-runtime-merge-strategy-post-7320:<doc path>` | `10b02cbf` | Not merged — background/mechanics reference only |

## Threat Model

| Document | Location | Base commit | Status |
|---|---|---|---|
| FedOS Threat Model (the one dedicated top-level threat model: LIVE/GATED/UNBUILT taxonomy, 13-adversary catalog, explicit non-goals, fail-closed convention citations) | `git show arc/fedos-security-goals-threat-model:docs/fedos_threat_model.md` | `3eb9eadd` | **Not merged** into `master` — inlined in full substance in `02_threat_model.md` of this bundle |
| Runtime/Worker crypto activation threat model | `docs/runtime_crypto_threat_model.md` | — | Merged (on `master`) |
| Alpha 144 Recovery & Threat Model Decision (Master Seed recoverability contract, leak-impact table) | `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md` | — | Merged (on `master`) |
| Alpha 6361-6440 Threat Scenario Matrix (16 scenarios, real tests) | `docs/secure_runtime_alpha_6361_6440_threat_matrix.md` | — | Merged (on `master`) |
| Alpha 6681-6760 Threat-Scenario Acceptance Report (24 scenarios against a real packaged build) | `docs/secure_runtime_alpha_6681_6760_threat_scenario_report.md` | — | Merged (on `master`) |
| Alpha 7721-7800 Threat and Trust Model (Archive Suppression same-account Device-trust reasoning) | `docs/secure_runtime_alpha_7721_7800_threat_and_trust_model.md` | — | Merged (on `master`) |

## Known Issues / Disclosure

| Document | Location | Status |
|---|---|---|
| `SECURITY.md` | `SECURITY.md` | Merged, current |
| Known Limitations (20 items, reconciled against 4 parallel reviews as of Alpha 8201-8280) | `docs/desktop_beta_known_limitations.md` | Merged, current |
| Deferred Findings Roadmap (everything NOT folded into the two docs above, explicitly future work) | `docs/secure_runtime_alpha_8201_8280_deferred_findings_roadmap.md` | Merged, current |
| Closed Pilot Runbook (SEV-1..4 vocabulary, exit criteria) | `docs/secure_runtime_alpha_8121_8200_closed_pilot_runbook.md` | Merged, current |
| Cargo.lock Policy Decision | `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md` | Merged, current |

## How to independently verify any claim in this bundle

```
git merge-base --is-ancestor <commit-hash> master   # true/false: is this commit on master today?
git show <branch>:<path>                            # read a file from an unmerged branch, no checkout
git log --all --oneline --grep="<Alpha NNNN-NNNN>"  # find the real commit for a named Arc/range
```

Master lags behind the highest-numbered Arc referenced anywhere in this
repository's own documentation as a matter of routine convention — always
re-run `git merge-base --is-ancestor` before treating any specific
line-level claim above as still true of current `master`, especially for
the two oldest-based documents in this index (Architecture Conformance
Review, base `3eb9eadd`; the FedOS Threat Model itself, same base).

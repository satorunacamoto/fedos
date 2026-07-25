# Secure Runtime Alpha 8441-8520 — Closed Pilot vs. Public Beta Decision Matrix

Two separate decisions, evaluated independently. Statuses: **PASS** /
**FAIL** / **BLOCKED — HUMAN INPUT** / **BLOCKED — EXTERNAL PROCESS** /
**PILOT LIMITATION** / **INTENTIONALLY UNSUPPORTED**. Internal readiness
documents (including this one) cannot turn an external-audit requirement
into PASS — see the External Audit Bundle item below.

Cross-checked against two independent read-only reviews reached the same
session: the FedOS License and Third-Party Compliance Review V1
(`90936d5b`) and the FedOS Public Beta Go/No-Go Validation v2
(`d6cb95d0`) — both corroborate the verdicts below independently.

## CLOSED PILOT

| Item | Status | Evidence |
|---|---|---|
| Code readiness | **PASS** | `npm run typecheck` clean (baseline-only pre-existing errors); `cargo test --release` 639/1 known pre-existing; real visible-control acceptance tests pass, including this Arc's own new Settings-save regression test. |
| Artifacts | **PASS** | Real NSIS installer + portable ZIP built this Arc from this exact final commit, checksummed, `unsigned: true` honestly recorded (see below for the exact build). |
| Known limitations disclosed | **PASS** | `KNOWN_LIMITATIONS.md` (29 items), `docs/fedos_desktop_beta_known_issues.md`, in-app Safety Center all current and cross-verified this Arc. |
| Pilot contact channel | **BLOCKED — HUMAN INPUT** | `SECURITY.md`'s contact is a structured placeholder; ordinary feedback channel (`docs/desktop_beta_feedback_guide.md`) is also a placeholder. **Does not block a Closed Pilot** if the pilot coordinator provides a real, separate, human-controlled channel outside this repository, as `SECURITY.md` itself now explicitly states is sufficient. |
| Backup instructions | **PASS** | `docs/desktop_beta_user_guide_backup.md` exists, honestly hedges the one unverified fact (exact profile folder name) rather than asserting it. |
| Incident stop-use path | **PASS** | `SECURITY.md`'s new "Emergency stop-use criteria" section (Phase E). |
| Unsigned disclosure | **PASS** | Independently verified via `Get-AuthenticodeSignature` (`NotSigned`), disclosed in `SECURITY.md`, `KNOWN_LIMITATIONS.md`, the Welcome screen's own first-launch Security Notice, and `docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`. |
| Participant consent | **PASS** | The Terms draft's own "informed pilot consent" section (Phase H) — a real, sufficient basis for a small, directly-recruited Closed Beta cohort; does not require the Terms/Privacy drafts to be finalized first. |

**CLOSED PILOT VERDICT: CONDITIONAL GO.** The only blocking item is
naming a real pilot contact channel — a human, five-minute decision,
not a technical gap. Every technical and documentation item this Arc
could verify or fix is PASS.

## PUBLIC BETA

| Item | Status | Evidence |
|---|---|---|
| Independent audit completed | **BLOCKED — EXTERNAL PROCESS** | No independent third party has reviewed this codebase. The External Audit Bundle (landed this Arc, Phase F) is preparation material FOR such an engagement — it is explicitly not, and cannot substitute for, the audit itself. |
| Security contact live | **BLOCKED — HUMAN INPUT** | Same gap as the Closed Pilot item, but Public Beta (anonymous, self-serve distribution) has no pilot-coordinator fallback to substitute for it. |
| Project license chosen | **BLOCKED — HUMAN INPUT** | `LICENSE_STATUS.md` (Phase D): no license selected; default copyright means all-rights-reserved. |
| Redistribution rights documented | **BLOCKED — HUMAN INPUT** | Direct consequence of the above — cannot document rights that don't yet exist. `THIRD_PARTY_NOTICES.md` documents dependency rights (all permissive, no forced copyleft found), but this project's OWN redistribution rights remain unresolved. |
| Privacy/Terms approved | **BLOCKED — HUMAN INPUT** | Both are real, good-faith, factually-verified drafts (Phase H) but explicitly not legally reviewed or adopted; the app makes no false acceptance claim (verified, guard-tested). |
| Signing decision approved | **BLOCKED — HUMAN INPUT** | `docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`'s own three-option table (unsigned/signed/defer) — no option chosen by this Arc, per its own explicit prohibition on purchasing/using a certificate. |
| Public support policy | **BLOCKED — HUMAN INPUT** | No SLA, no versioned support policy beyond "single active Beta line" exists; `SECURITY.md`'s own acknowledgement-time field is explicitly marked HUMAN INPUT REQUIRED. |
| External-audit findings remediated | **BLOCKED — EXTERNAL PROCESS** | Cannot remediate findings from an audit that has not occurred. Chained blocker on the first row. |
| Artifact approval | **BLOCKED — HUMAN INPUT** | No named approver/process exists for declaring a specific build "the" Public Beta release; `CONTRIBUTING.md`'s own landing conventions cover technical merge criteria, not a release-approval authority. |

**PUBLIC BETA VERDICT: NO-GO.** Every blocking item is either an
external process this Arc cannot perform (the audit itself) or an
explicit human decision this Arc's own mission forbids it from making
(license, contact identity, signing, legal approval, release approval).
**No internal readiness work — including everything this Arc did —
changes this verdict; that is the correct, intended outcome, not a
shortfall of this Arc's own effort.**

## What changed this Arc that moves the needle for a FUTURE Public Beta decision (not a PASS today)

- A real external-audit-preparation package now exists, landed and
  revalidated (Phase F) — meaningfully shortens whatever an actual
  independent audit engagement would need to spend on onboarding.
- A real, deterministic dependency-license inventory exists
  (`THIRD_PARTY_NOTICES.md`) — removes one sub-task from "redistribution
  rights documented" (dependency side is now done; only this project's
  OWN license remains a human decision).
- `SECURITY.md` now has a complete structure ready to receive a real
  contact identity — filling in one placeholder, not writing the section
  from scratch, is what's left.
- The signing-readiness tooling (`signing_readiness.mjs`) already
  exists and works — obtaining and configuring a real certificate is
  the only remaining step on that path, if that's the option chosen.

## Recommended single next action

Run the Closed Beta pilot (once a real contact channel is named) while
completing independent audit, license selection, security-contact
activation, legal approval, and signing decision.

# FedOS Beta — Human Publication Checklist

Coordinator review, written after the sealed Final RC (source CandidateHead `883e115b`,
EvidenceHead `c4dfb6e7`, technical decision **GO**). This is a read-mostly publication-readiness
pass, not a code review — see `docs/reviews/fedos_final_rc_seal/01_FINAL_RC_REPORT.md` for the
technical seal. Two static publication-config files were corrected as part of this pass (see
Section 3 below and `08_FINAL_PUBLICATION_SIGNOFF.md`); no runtime/application source was touched,
and no new source CandidateHead was created.

Method: three independent read-only forks (R1 security/claim truthfulness, R2 first-run/recovery/
user-safety, R3 release/distribution/operator UX) plus the Coordinator's own independent
verification (artifact hash recomputation, Authenticode check, direct source/doc reads). Every
finding below was corroborated by at least the Coordinator directly reading the cited file.

==================================================
1. RC FREEZE (independently re-verified)
==================================================

```
git status --short:              clean (before this pass's own doc edits)
git rev-parse HEAD:               c4dfb6e71cf097dc11cefac9fc081eeb81db8d8e
git merge-base --is-ancestor 883e115b HEAD:  PASS
git diff --name-only 883e115b..HEAD:  docs/reviews/fedos_final_rc_seal/01_FINAL_RC_REPORT.md only
```
No source-changing commit exists after `883e115b`. This publication review applies to the sealed
RC exactly as built.

==================================================
2. EXACT ARTIFACT FREEZE (independently recomputed, not trusted)
==================================================

```
Installer: FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe
Recomputed SHA256: a1c32889173a0ae9105724d8b708abaa9456f15a054085a20c29ccde3de6dee0  (MATCH)

ZIP: FedOS Desktop Beta-0.1.0-beta.1-win.zip
Recomputed SHA256: 9aa0f584fee09aa7341ec76624cdbaa1a85df05c10662526c2194391075df8a5  (MATCH)
```
Both values independently recomputed by the Coordinator and by fork R1 (via a separate PowerShell
`Get-FileHash` invocation) — both match `release-manifest.v1.json`, `SHA256SUMS.txt`, and
`publication-bundle.json` exactly. **No rebuild was needed; artifact identity is established.**

Note: `release-manifest.v1.json` and `publication-bundle.json` record `gitCommit:
0425f0f257c5908ec1ccf8dcffd3f85ca5ad64d4` — the prior EvidenceHead, one docs-only commit below the
current EvidenceHead `c4dfb6e7` and one docs-only commit above source CandidateHead `883e115b`.
This is benign (the build stamps whatever HEAD was checked out at build time, and the diff between
all three commits is docs-only — independently verified 3x across this arc), but is noted here as a
release-engineering observation, not a publication defect.

==================================================
3. PUBLICATION-SURFACE INVENTORY AND CLAIM CLASSIFICATION
==================================================

Surfaces read in full: root `README.md`, `SECURITY.md`, `KNOWN_LIMITATIONS.md`,
`docs/desktop_beta_known_limitations.md`, `docs/fedos_desktop_beta_known_issues.md`, and the entire
`packages/fedos-desktop-electron-spike/release-staging/` bundle (`RELEASE_NOTES.md`,
`KNOWN_LIMITATIONS.md`, `INSTALL_WINDOWS.md`, `SECURITY_NOTICE.md`, `RELEASE_ANNOUNCEMENT.md`,
`VERIFY_DOWNLOAD.md`, `publication-bundle.json`), plus `.github/ISSUE_TEMPLATE/` and
`CONTRIBUTING.md`.

| # | Claim / area | Classification | Detail |
|---|---|---|---|
| 1 | "14-real-gate release pipeline" (`release-staging/RELEASE_NOTES.md`) | **STALE_FALSE** | Real gate count is 13 (`build_release.mjs` step() calls). Root-caused to `src/os/messenger/desktop/beta/fedos_desktop_beta_capability_manifest.ts:378`'s `coarseLimitation` string for the `packaged-application` capability — the doc is auto-generated from this field. **This is a source-level defect** (a single descriptive string, non-security, non-behavioral) that will regenerate wrong on every future build until fixed in source. Not fixed under this mandate (fixing it would touch runtime source and require a new CandidateHead) — escalated as a follow-up engineering item. |
| 2 | Capability manifest "available" vs "available-development-only" statuses | **TRUE** | No capability anywhere is marked `"blocked"`. `RELEASE_NOTES.md`'s "not yet reachable" list matches the manifest's `available-development-only` set 1:1 (both generated from the same source). |
| 3 | Tor / anonymity | **SAFE_LIMITATION_DISCLOSURE** | No publication doc claims Tor support or anonymity at all. `README.md` explicitly and correctly states "No anonymity and no onion routing." No overclaim found. (Tor strict-transport exists at a lower, non-publication-facing engineering level with its own internal evidence that is equally careful never to say "anonymity.") |
| 4 | "Verified" / identity | **TRUE / SAFE_LIMITATION_DISCLOSURE** | `README.md` precisely scopes what a "verified FedOS Official signature" means (an entitlement claim, not legal identity) and explicitly disclaims a universal root of trust. No global verified boolean or safety number exists or is claimed anywhere. |
| 5 | Forward secrecy | **AMBIGUOUS (disclosure gap, not falsehood)** | `README.md`/`SECURITY.md` correctly state the Ratchet/forward-secrecy path is not the default for Direct conversations. The root "canonical" `KNOWN_LIMITATIONS.md` does not restate this specific fact, and the entire `release-staging` bundle (the docs that actually ship beside the installer) never mentions Double Ratchet or forward secrecy at all. **Remediated in this pass** — see `04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md`. |
| 6 | Signed installer | **TRUE** | Every doc that mentions distribution states "unsigned" plainly; independently reconfirmed via `Get-AuthenticodeSignature` → `NotSigned`. Best-disclosed item in the whole audit — no gap anywhere. |
| 7 | Artifact filenames / SHA-256 values | **TRUE** | Exact match everywhere, independently reconfirmed. One cosmetic placeholder (`VERIFY_DOWNLOAD.md`'s command example uses `<version>` instead of the literal version string) — P2, not a real mismatch. |
| 8 | Install/uninstall steps | **TRUE, incomplete** | `INSTALL_WINDOWS.md`'s GUI-path steps are accurate and cross-check correctly against `electron_builder.beta.config.json` (`perMachine: false`, `deleteAppDataOnUninstall: false`). It does not document the silent/scripted `/S /D=<dir>` path — a completeness gap (P2, not needed for a normal human user), not a truthfulness defect. |
| 9 | Recovery capability | **UNVERIFIED / undisclosed** | A real, tested, packaged-app-reachable Recovery Bundle backup/restore feature (Settings → "Export Backup…", Welcome → "Restore from a backup") exists, has accurate in-app copy about what it excludes (Direct Ratchet sessions, device trust/registry), but is **not tracked as a capability in the manifest and is entirely absent from the release-staging publication bundle** — a user only learns about it, and its safety-relevant exclusions, after they are already mid-flow inside the app. **Remediated in this pass** — see `05_RECOVERY_AND_BACKUP_GUIDE.md`. |
| 10 | Commerce | **TRUE where disclosed, absent from release-staging bundle** | `README.md` accurately scopes Commerce (TEST/LOCAL payment simulator only, no real money, reputation/persona is design-only). Not mentioned anywhere in the release-staging bundle or the capability manifest's closed vocabulary. Addressed by explicit scoping language in `04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md`. |
| 11 | Support/bug-report route | **Broken links, now fixed** | `.github/ISSUE_TEMPLATE/config.yml` had literal `OWNER/REPO` placeholders in 3 URLs where the real repo (`satorunacamoto/fedos`, confirmed via `git remote -v`) belonged; same placeholder in `SECURITY.md`'s fallback URL. **Fixed in this pass** (see Section 8 / `08_FINAL_PUBLICATION_SIGNOFF.md`). GitHub Private Vulnerability Reporting itself is separately, honestly disclosed in `SECURITY.md` as **not yet enabled** in repository Settings — a genuine human action, not a doc defect (already correctly disclosed, not hidden). |
| 12 | Distribution/download target | **Undecided — human decision required** | `publication-bundle.json`'s `canonicalHostPolicy` is `"local-only"`; `RELEASE_ANNOUNCEMENT.md`'s own "Download:" line is a literal unfilled placeholder. See `07_RELEASE_DISTRIBUTION_PLAN.md`. |
| 13 | Unsigned-installer operator UX | **TRUE, no security-bypass instruction found** | No doc instructs disabling SmartScreen/Defender/antivirus/UAC or any OS security control. `SECURITY_NOTICE.md`/`INSTALL_WINDOWS.md` explain the warning is expected and say to verify the checksum first; neither gives the literal SmartScreen click sequence — minor completeness nit, not a security-bypass instruction. |

No claim found anywhere meets the mandate's PUBLICATION P0 bar (materially false security/privacy
claim, hash mismatch, security-bypass instruction, "secrets are safe to share" claim, or wrong
artifact published). See `08_FINAL_PUBLICATION_SIGNOFF.md` for the full severity tally.

==================================================
4-19. USER JOURNEY, RECOVERY, SUPPORT, DISTRIBUTION
==================================================

Detailed per-topic guidance is in the dedicated documents (02-07) rather than duplicated here.
Summary verdicts:

```
Download/verify journey (Section 4):        PASS — usable PowerShell Get-FileHash example exists
Unsigned installer UX (Section 5):           PASS — honest, no security-bypass instruction
First-run journey (Section 6):               PASS — passphrase warning gated by required checkbox
                                              in the real UI (fedos_electron_beta_page.html),
                                              Create-profile button disabled until acknowledged
Recovery/backup publication UX (Section 7):  WAS A GAP, remediated this pass (doc 05)
Beta data-safety warning (Section 8):        PASS — no "risk-free"/"fully secure" language found
                                              anywhere in the 11-document publication surface
Security claims truth table (Section 9):     see 04_KNOWN_LIMITATIONS_FOR_BETA_USERS.md
Tor wording (Section 10):                    PASS — correctly silent/negative, no overclaim
Commerce wording (Section 11):               PASS where present (README.md); scoped explicitly
                                              in doc 04 for the release-staging gap
Known limitations, human version (Section 12): doc 04
Support/bug-report path (Section 13):        real GitHub repo + template exist; broken placeholder
                                              links fixed this pass; doc 06
Privacy-safe diagnostics (Section 14):       doc 06 (built from the existing, already-thorough
                                              bug_report.yml safety checklist)
Rollback/uninstall guidance (Section 15):    PASS — INSTALL_WINDOWS.md cross-checks correctly
                                              against electron_builder.beta.config.json
Release distribution plan (Section 16):      doc 07
Download source/trust boundary (Section 17): doc 07 — DISTRIBUTION TARGET: HUMAN DECISION REQUIRED
Checksum publication model (Section 18):     doc 03 — honestly states no signature channel exists
Human tabletop (Section 19):                 doc 08
```

==================================================
20. MINI RED TEAM
==================================================

Three read-only forks (R1, R2, R3) ran in parallel, strictly read-only (no edits, no commits, no
sub-agents, no publication/upload — verified via `git status --short` showing no changes during
their runs). Findings are folded into the classification table above and into docs 02-08. The
Coordinator independently re-verified every P0/P1-level claim directly (artifact hashes,
Authenticode, `git remote -v`, direct source reads of the capability manifest and the Recovery
Bundle exclusion list) rather than accepting any fork's self-report alone.

See `08_FINAL_PUBLICATION_SIGNOFF.md` for the final severity tally and sign-off.

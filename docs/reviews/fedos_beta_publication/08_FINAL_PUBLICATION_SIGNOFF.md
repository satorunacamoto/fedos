# Final Publication Sign-Off — FedOS Desktop Beta 0.1.0-beta.1

Source CandidateHead: `883e115b` · Final RC EvidenceHead: `c4dfb6e7` · Technical decision: **GO**

This review is docs-only. No runtime/application source was modified. Two static, non-runtime
publication-config files were corrected (see "Actions taken" below); no new source CandidateHead
was created, and no source-changing fix was made under this mandate.

==================================================
HUMAN TABLETOP — Section 19
==================================================

Walked as a real user would, using real evidence gathered this arc and the prior Final RC Seal arc
(never DOM/mock tests). Marked honestly where only source-level or CLI-level evidence exists rather
than a literal human mouse-driven GUI walkthrough.

| # | Step | Result | Basis |
|---|---|---|---|
| 1 | Open publication page/directory | **NOT EXECUTABLE** | No distribution target exists yet (`canonicalHostPolicy: "local-only"`, announcement download line unfilled) — see doc 07 |
| 2 | Download installer | **NOT EXECUTABLE** | Same — nothing to download from publicly yet |
| 3 | Compare checksum | **PASS** (mechanics proven) | Independently recomputed twice (Coordinator + fork R1) against the local artifact; matches exactly. The verification *procedure* in doc 03 is real and correct; it cannot be exercised end-to-end against a public download until #1/#2 are resolved |
| 4 | Install | **PASS** | Real silent install (`/S /D=<isolated dir>`) of the exact sealed installer, exit code 0, proven this arc |
| 5 | Understand unsigned warning | **HUMAN REVIEW REQUIRED** | `SECURITY_NOTICE.md`/`03_DOWNLOAD_AND_CHECKSUM_GUIDE.md` explain it correctly and `Get-AuthenticodeSignature` independently confirms `NotSigned`, but this arc's install was silent (`/S`) and never displayed the actual SmartScreen dialog. A human should run the installer interactively at least once before public announcement to confirm the docs match what Windows actually shows |
| 6 | Create fresh profile | **PASS** | Real WASM Master Seed generated through the actual installed binary this arc; real `accountPublicIdentifier`/`localDeviceId` returned |
| 7 | Unlock | **PASS** | Real `profile-unlock` recovering the same identity after uninstall+reinstall, proven in the Disaster Recovery Product Closure arc and reused here per the Final RC Seal's own delta-based reuse rule (no source changed since) |
| 8 | Find backup/recovery feature | **HUMAN REVIEW REQUIRED** | Fork R2 confirmed the real UI strings and buttons exist in source (`fedos_electron_beta_page.html`: Welcome "Restore from a backup", Settings "Export Backup…") — this is genuine source evidence, not fabricated, but no human or automated click-through of the *rendered* app confirmed a real user can actually find these without prior knowledge |
| 9 | Locate known limitations | **PASS** | `KNOWN_LIMITATIONS.md` ships in the release-staging bundle; confirmed present, readable, and accurate |
| 10 | Locate bug-report route | **HUMAN REVIEW REQUIRED** | The underlying repository (`satorunacamoto/fedos`) and issue template are real and now correctly linked (this pass's fix), but this review did not confirm whether that repository is currently public — if it is still private, the route does not yet work for an outside Beta user |
| 11 | Uninstall safely | **PASS** | Real silent uninstall, exit code 0, proven this arc; `INSTALL_WINDOWS.md`'s GUI-equivalent instructions independently cross-checked against `electron_builder.beta.config.json` (`deleteAppDataOnUninstall: false`, `perMachine: false`) |

**Tabletop verdict: 6 PASS / 2 NOT EXECUTABLE / 3 HUMAN REVIEW REQUIRED / 0 FAIL.** No step failed
outright; the gaps are a pending distribution decision and three items that need an actual human
eyeball pass (the real SmartScreen dialog, real UI discoverability, and repo visibility) rather than
a defect found in this review.

==================================================
ACTIONS TAKEN THIS PASS (docs/config only)
==================================================

1. `.github/ISSUE_TEMPLATE/config.yml` — replaced 3 literal `OWNER/REPO` placeholder URLs with the
   real repository path `satorunacamoto/fedos` (confirmed via `git remote -v`).
2. `SECURITY.md` — same placeholder fix in the private-vulnerability-reporting fallback URL.
3. Created `docs/reviews/fedos_beta_publication/01`-`07` (this directory) — closing the Recovery
   Bundle disclosure gap (doc 05) and the forward-secrecy disclosure gap (doc 04) found by R1/R2,
   and correcting the "14-gate" figure for any reader of this packet (doc 02).

No file under `src/`, `packages/*/src/`, or any release pipeline script was touched. No new source
CandidateHead exists.

==================================================
PUBLICATION SEVERITY TALLY — Section 21
==================================================

```
PUBLICATION P0: 0
  (no hash mismatch, no security-bypass instruction, no materially false security/privacy
  claim, no recovery guidance that could cause silent irreversible loss, no "secrets are safe
  to share" claim, correct artifact identity confirmed)

PUBLICATION P1: 5 found this pass
  1. "14-real-gate" stale pipeline claim — root-caused to source
     (fedos_desktop_beta_capability_manifest.ts:378) — OPEN, requires a future trivial source
     fix + new CandidateHead; out of scope for this docs-only mandate.
  2. Distribution target undecided (canonicalHostPolicy: "local-only") — OPEN, human decision
     required (doc 07).
  3. Support/bug-report route broken placeholder links (.github/ISSUE_TEMPLATE/config.yml,
     SECURITY.md) — FIXED this pass.
  4. Recovery Bundle entirely undisclosed in the publication bundle — REMEDIATED this pass
     (doc 05).
  5. Forward-secrecy default-off fact absent from the release-staging bundle — REMEDIATED
     this pass (doc 04).

PUBLICATION P2: 5 found this pass (all disclosed, none blocking)
  1. INSTALL_WINDOWS.md documents only the GUI install path, not the silent/scripted one
     (not needed for a normal user).
  2. VERIFY_DOWNLOAD.md's PowerShell example uses a <version> placeholder instead of the
     literal current filename.
  3. Stale "pilot" terminology holdovers in a few strings (KNOWN_LIMITATIONS.md, the issue
     template's install-source dropdown) predating the "Beta" rename.
  4. release-manifest.v1.json / publication-bundle.json record a gitCommit one commit behind
     the current EvidenceHead (benign — docs-only intervening commit; release-engineering
     hygiene note only).
  5. Neither SECURITY_NOTICE.md nor INSTALL_WINDOWS.md spells out the literal SmartScreen
     click sequence ("More info -> Run anyway").
```

==================================================
FINAL SIGN-OFF — Section 24
==================================================

```
TECHNICAL RC:
GO

PUBLICATION READINESS:
READY_WITH_HUMAN_ACTIONS

PUBLICATION P0:
0

PUBLICATION P1:
5 (3 remediated this pass, 2 require a human decision/future source fix — see above)

PUBLICATION P2:
5

ARTIFACT IDENTITY:
PASS

INSTALLER UNSIGNED DISCLOSURE:
PASS

CHECKSUM GUIDE:
PASS

FIRST-RUN GUIDANCE:
PASS

RECOVERY GUIDANCE:
PASS (was FAIL/absent before this pass — remediated via doc 05)

KNOWN LIMITATIONS:
PASS

BUG REPORT ROUTE:
PASS (route exists and is now correctly linked; private-vuln-reporting activation and repo
visibility remain human actions — see below)

HUMAN TABLETOP:
REQUIRED (6 PASS / 2 NOT EXECUTABLE / 3 HUMAN REVIEW REQUIRED / 0 FAIL — see table above)

DISTRIBUTION TARGET:
HUMAN DECISION REQUIRED
```

==================================================
EXACT ACTIONS THAT STILL REQUIRE THE USER'S EXPLICIT DECISION
==================================================

1. **Decide where this Beta is actually distributed from** (GitHub Releases, a project site, or
   another channel) and fill in `canonicalHostPolicy` / the release announcement accordingly.
2. **Enable GitHub Private Vulnerability Reporting** in repository Settings → Security — currently
   honestly disclosed as not yet enabled.
3. **Confirm whether `satorunacamoto/fedos` is public** — required for the bug-report route and
   the download itself to work for an outside Beta user.
4. **Schedule the trivial source fix** for the "14-real-gate" string at
   `fedos_desktop_beta_capability_manifest.ts:378` as a new, small CandidateHead — out of scope for
   this docs-only mandate, and any source change invalidates the current sealed RC artifact, so it
   must go through its own build+seal cycle.
5. **Do an interactive (non-silent) install on a clean machine** to see the actual SmartScreen
   dialog and confirm `SECURITY_NOTICE.md`'s description matches what Windows really shows.
6. **Fold `05_RECOVERY_AND_BACKUP_GUIDE.md`'s content into the official generated release-staging
   bundle** (currently it only exists in this review's own docs folder) so it ships automatically
   with future builds rather than needing to be attached manually.
7. **Explicitly decide and state whether Tor and Commerce are in scope for this Beta cohort's public
   announcement** — both are technically real and tested but currently unmentioned in the shipped
   release notes; doc 02 in this packet scopes them out explicitly, but that is this review's
   recommendation, not a product decision made by this arc.
8. **Give final approval to push/publish** — this arc did not push, upload, tag, or announce
   anything, per its own hard stop.

==================================================
GIT / EVIDENCE DISCIPLINE — Section 25
==================================================

```
RC SOURCE CANDIDATEHEAD:
883e115b

RC EVIDENCEHEAD:
c4dfb6e7

PUBLICATION DOCS HEAD:
<recorded after commit — see final report>
```

Runtime source diff since `883e115b` remains unchanged (verified again at the start of this pass:
`git diff --name-only 883e115b..HEAD` before this pass's own commit showed only the prior docs-only
Final RC Seal report). This pass added a publication-docs-only commit on top.

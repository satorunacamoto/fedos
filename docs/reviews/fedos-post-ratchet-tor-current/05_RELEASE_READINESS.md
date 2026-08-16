# FedOS Release/Product Readiness Audit — Agent C

**Scope:** Areas 1–12 per assignment. Repo: `C:/wt/fedos-installed-startup-root-cause`, branch `arc/fedos-installed-startup-root-cause`.
**HEAD at audit time:** `b886a17644c6ebf239fac80666c5cd270fe13dd6` ("docs: Phase A architecture decision -- Direct Ratchet identity-space unification (Option A)").
**Working tree at audit time:** one unstaged modification (`src/os/messenger/conversations/peer_device/fedos_local_peer_device_announcement_identity.ts`, made by a concurrent agent, not touched by this audit).
**Method:** direct reading of current source/tests/docs, plus fast read-only verification (`npx vitest run` on one targeted structural-guard test, one targeted regression-guard test, and `npm run typecheck` / `npm run typecheck:electron`). No build/package pipeline was run. No files were edited.

## Summary table

| # | Area | Verdict | One-line reason |
|---|------|---------|------------------|
| 1 | First-run / profile creation | CLEAN | Passphrase-ack checkbox gates submit, show/hide wired, validation real; confirmed in current file content. |
| 2 | Unlock/recovery | CLEAN | Corrupt-vs-interrupted distinction is real, independently re-verified at each reset call, guards are mutually exclusive by construction. |
| 3 | Security State UI (6-axis evaluator) | CLEAN | No forbidden-claim regressions found; 8/8 structural guard tests pass. |
| 4 | Device Trust / Peer Device TOFU | CLEAN | `computeFedosPeerDeviceKnowledgeState` is real and is actually consumed end-to-end into Axis 4, not just declared. |
| 5 | Commerce E2E happy path | CLEAN | Covers publish→discover→order→pay(sim)→fulfill→deliver(ack)→complete→receipt(QR+verify)+messenger regression; reflects current UI selectors (price-as-decimal-string, create-pass-ack). Not executed (real-artifact-gated, self-skips). |
| 6 | Release integrity pipeline | CLEAN | `build_release.mjs` wires 13 real steps incl. dependency closure (step 7) and beta gate (step 12); `Cargo.lock` is tracked. |
| 7 | Dependency closure | **P1** | `verify_packaged_dependency_closure.mjs` is wired and its runtime behavior is genuinely correct (9/9 live regression tests pass against real artifacts) — but its own companion hand-written type declaration (`scripts/lib/packaged_dependency_closure.d.mts`) is stale, missing 2 of 8 exported functions, so `npm run typecheck:electron` currently fails on this branch. |
| 8 | Package/NSIS/checksums | CLEAN | `electron_builder.beta.config.json` present; build_release.mjs calls electron-builder, checksum generation, and re-derived checksum verification. |
| 9 | Unsigned-binary UX | CLEAN | `generate_release_staging.mjs` produces SECURITY_NOTICE.md/RELEASE_NOTES.md/INSTALL/VERIFY_DOWNLOAD docs that honestly disclose unsigned state, SmartScreen behavior, and checksum-does-not-prove-publisher limits. |
| 10 | Operator docs | CLEAN | `docs/pilot/INSTALLATION.md` is current, matches real artifact filenames, cross-references real sibling docs (all exist), and its `npm run release:electron-beta` command resolves to a real script. |
| 11 | Beta gate | **P1** | Wired into `build_release.mjs` step 12 with real, mechanically re-derived gates — but the single most behaviorally meaningful gate (`beta-acceptance-journey-passed`) is hardcoded `true` in the script's own `main()` rather than derived from any check performed during that invocation, so it can never actually catch a regression in the create→unlock→relock→relaunch journey at release time. |
| 12 | Artifact naming consistency | CLEAN | `productName`/`artifactName` in `electron_builder.beta.config.json` are internally consistent with what `generate_release_manifest.mjs`, `generate_public_beta_gate.mjs`, and `docs/pilot/INSTALLATION.md` all expect. |
| — | (out-of-scope context) | **P1** | `npm run typecheck:core` currently fails on this branch (2 unrelated pre-existing errors in `test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts` and `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`), which means the chained `npm run typecheck` short-circuits before ever reaching `typecheck:electron` — a second, independent reason the full typecheck gate is not currently green. |

**Totals: 0 P0, 3 P1, 0 P2.**

---

## 1. First-run / profile creation — CLEAN

Read the current `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html` (lines 166–179) and `fedos_electron_beta_renderer.ts` directly (not from doc claims).

- HTML confirms the create screen has: profile label, passphrase, confirm passphrase, a `#create-pass-show-hide` show/hide button, a `#create-pass-ack` checkbox with copy "I understand this cannot be recovered if I lose it.", and `#create-submit` marked `disabled` by default (`fedos_electron_beta_page.html:175-178`).
- `refreshCreateSubmitEnabled()` (`fedos_electron_beta_renderer.ts:110-112`) ties `#create-submit`'s disabled state directly to `#create-pass-ack`'s checked state, wired via a `change` listener (`fedos_electron_beta_renderer.ts:5267`).
- `onCreateSubmit()` (`fedos_electron_beta_renderer.ts:4842-4891`) validates non-empty label, non-empty passphrase, matching confirm, clears the ack checkbox and both password fields after either success or failure, and resets password visibility — real, not decorative.
- `git log --oneline -5` on both files confirms this landed in the current "Direct Ratchet P1 arc" / "P0 Closure" commits on this branch (`8b077419`, `4aef5d1a`), i.e. genuinely recent and present at HEAD, not a stale doc claim.

## 2. Unlock/recovery — CLEAN

Read `src/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.ts` in full (1162 lines).

- `detectProfileState()` (lines 356-442) distinguishes three `recovery-required` shapes: a corrupt/absent descriptor with no ready state (`recoveryReason = "interrupted"`), and a `ready` descriptor whose sealed Master Seed envelope is structurally missing/corrupt (`recoveryReason = "corrupt"`) — the corrupt check is explicitly documented as structural-only, never a passphrase-dependent judgment (lines 394-424).
- `unlockProfile()` (lines 580-681) independently re-derives the corrupt/interrupted split at unlock time too (defense-in-depth against a TOCTOU race with `detectProfileState()`), and a wrong-passphrase retry is explicitly proven never to touch the sealed file, so it always keeps failing safe rather than tripping the corrupt path.
- `resetInterruptedProfile()` (lines 753-785) and `resetCorruptReadyProfile()` (lines 832-878) are mutually exclusive by construction (one refuses any `ready` descriptor, the other requires one plus an independent fresh re-read proving the seal is genuinely gone) and each deletes only the two files this profile's own persistence ports point at.
- HTML wiring confirmed: `#screen-recovery` has two distinct action blocks — `#recovery-actions` (interrupted, "Start over") and `#recovery-actions-corrupt` (corrupt, hidden by default, with its own distinct copy: "no passphrase will ever unlock it again") — `fedos_electron_beta_page.html:205-214`.
- Renderer wiring confirmed present (`recovery-start-over-btn`, `recovery-start-over-corrupt-btn` both referenced in `fedos_electron_beta_renderer.ts`, per grep).

## 3. Messenger/Security UI (6-axis evaluator) — CLEAN

Read `fedos_conversation_security_state.ts` (323 lines) in full.

- No global "verified"/"secure" boolean exists anywhere in the file; the header explicitly documents why ("FedOS has no safety number... no cryptographic identity-verification flow") and every evaluator function is exhaustive over its own closed vocabulary with no "default to good" fallthrough.
- Axis 3 (forward secrecy) is deliberately kept separate from Axis 2 (encryption) — an active ratchet session alone never implies `forwardSecrecy: good` (confirmed at `fedos_conversation_security_state_controller.ts:113-116`: requires both `ratchetStatus === "active"` AND the runtime-wide `messageDeliveryRemoteDeviceRef` to exactly match the chosen device).
- Ran the structural guard test directly:
  ```
  npx vitest run --config vitest.electron-spike.config.ts packages/fedos-desktop-electron-spike/test/verified_secure_session_ui_structural_guards.test.ts
  ```
  Result: **8/8 tests passed.**

## 4. Device Trust / Peer Device Discovery TOFU — CLEAN

- `fedos_peer_device_announcement_knowledge_state.ts` (67 lines) is real: `computeFedosPeerDeviceKnowledgeState()` derives `"first-seen" | "continuity-established" | "stale" | "conflicting-rejected" | "unknown"` purely from the append-only observation log plus the live Registry binding, never a new stored flag.
- Traced the wiring end-to-end (not just import statements):
  - `fedos_peer_device_announcement_runtime.ts:140` — `listObservedPeerDevices()` calls `computeFedosPeerDeviceKnowledgeState(subjectObservations, binding)` for real, per device.
  - `fedos_desktop_application_shell.ts:1173-1178` — `peerDeviceAnnouncementListObserved()` returns that live list unmodified.
  - `fedos_conversation_security_state_controller.ts:142` — `observedPeerDeviceKnowledgeStates: observedForCounterparty.map((d) => d.knowledgeState)` feeds the real computed values into Axis 4's facts.
  - `fedos_conversation_security_state.ts:240-246` — `evaluateDeviceKnowledge()` actually branches on `"conflicting-rejected"` (→ attention) and `"first-seen"`-only (→ good, but with a distinct reason code `observed-devices-trusted-first-seen-only` rather than implying independent verification).
- This is a genuine, complete wire from raw observation log to UI-facing axis, not a stub.

## 5. Commerce E2E full happy path — CLEAN

Read `commerce_e2e_full_happy_path_real_electron.test.ts` (275 lines) in full (did not execute — it self-gates on `CAN_RUN_REAL`, requiring real WASM pkg/, its manifest, and the real Electron binary, per the task's own instruction not to run the packaging pipeline).

Confirmed the scripted DOM-driven flow covers, in order: create profile (with the same `#create-pass-ack` checkbox from Area 1) → merchant creates+publishes a product → customer discovers it in the real catalog → order create → order submit → merchant accept → customer pays via the TEST/LOCAL simulator → merchant fulfills → customer acknowledges receipt (`#commerce-order-acknowledge-receipt-btn`, the only thing that can mark delivered) → order completes → a real signed+QR-encoded Trust receipt is issued and independently verified `"VALID"` → a final messenger-regression check that Conversations is still reachable. Assertions check real status-text transitions at each step, not just "no exception thrown." The price field is asserted as a decimal-dollar string (`"25.00"`), matching the current renderer's real price-UX (not stale copy-pasted from an older cents-based convention).

## 6. Release integrity (`build_release.mjs`) — CLEAN

Read the full current 125-line script. It performs, in order: (1) node_modules junction/symlink guard, (2) clean-tree verification, (3) package allowlist verification, (4) root beta-runtime build, (5) Electron package build, (6) electron-builder NSIS+ZIP, (7) packaged runtime dependency closure verification, (8) release manifest generation, (9) checksum generation, (10) checksum re-verification, (11) release-staging bundle generation, (12) public Beta gate report + hard enforcement of its verdict, (13) secret scan of staging inputs, (14) final artifact summary print. Steps 7 and 12 are explicitly called out in the script's own header as *previously dead code paths that existed but were never actually wired into a release build* — now genuinely wired.

`Cargo.lock` is tracked: `git ls-files packages/fedos-core-rust/Cargo.lock` returned the path.

## 7. Dependency closure — P1

`verify_packaged_dependency_closure.mjs` is genuinely called from `build_release.mjs` (step 7, line 100) and its own logic (`scripts/lib/packaged_dependency_closure.mjs`, 261 lines) is real: it statically walks the actual compiled require/import graph (not a hand-maintained list) to derive both an npm-package closure and a package-local sibling-file closure, then checks presence in both the `app.asar` listing and the `extraFiles`-copied `dist/node_modules` tree.

**Finding:** `scripts/lib/packaged_dependency_closure.d.mts` (the hand-written type declaration this `.mjs` module requires, since this package's `tsconfig` doesn't enable `allowJs`) is stale — it declares only 6 of the module's 8 exported functions, missing `derivePackageLocalFileClosure` and `checkLocalFileClosurePresentInAsarListing` (both added by the current "Installed Startup Root-Cause pass" work per the `.mjs`'s own doc comment, `packaged_dependency_closure.mjs:182-228`). This causes `npm run typecheck:electron` to fail with 4 real TS errors in `test/packaged_binary_dependency_closure_guard.test.ts`:
```
test/packaged_binary_dependency_closure_guard.test.ts(165,32): error TS2339: Property 'derivePackageLocalFileClosure' does not exist ...
test/packaged_binary_dependency_closure_guard.test.ts(184,31): error TS2551: Property 'checkLocalFileClosurePresentInAsarListing' does not exist ...
test/packaged_binary_dependency_closure_guard.test.ts(203,31): error TS2551: ...
test/packaged_binary_dependency_closure_guard.test.ts(209,35): error TS2551: ...
```
Importantly, the **runtime behavior is correct** — vitest doesn't type-check, and running the actual regression-guard test live confirmed all 9 tests pass, including negative-proof tests that repack a copy of the real `app.asar`/`dist/node_modules` with a file stripped out and verify the checker correctly reports it missing:
```
npx vitest run --config vitest.electron-spike.config.ts packages/fedos-desktop-electron-spike/test/packaged_binary_dependency_closure_guard.test.ts
→ 9 passed (9)
```
So this is not a security/correctness defect in the shipped guard itself — it is a genuine, current gap in the *typecheck* verification gate `build_release.mjs`'s own header documents as a required separate step ("Root/Electron typecheck ... are run SEPARATELY (this Arc's own VERIFICATION sequence)"). Classified **P1**: real, currently-reproducible, blocks a documented release-verification step, but does not itself ship anything false to an end user.

## 8. Package/NSIS/checksums — CLEAN

`electron_builder.beta.config.json` exists (`packages/fedos-desktop-electron-spike/electron_builder.beta.config.json`, 69 lines): `productName: "FedOS Desktop Beta"`, NSIS target with `oneClick: false`, `perMachine: false`, `allowElevation: false`, `deleteAppDataOnUninstall: false`, `artifactName: "FedOS-Desktop-Beta-Setup-${version}.${ext}"`.

`build_release.mjs` step 6 calls `run_electron_builder_package_beta.mjs`, which invokes the real electron-builder CLI with `--config electron_builder.beta.config.json --win` (confirmed this correctly lets the config's own `win.target: ["nsis","zip"]` be the sole target authority — the script's own header documents a previously-real bug where a hardcoded `--dir` CLI flag silently overrode this).

`generate_release_checksums.mjs` (48 lines) writes `SHA256SUMS.txt` covering every real file staged in `release/`. `verify_release_checksums.mjs` (96 lines) **re-derives** every hash from real bytes on disk (never trusts the stored value) and fails closed on a missing file, an extra unlisted file, a malformed line, or a hash mismatch.

## 9. Unsigned-binary UX — CLEAN

`generate_release_staging.mjs` (274 lines) generates `SECURITY_NOTICE.md`, `RELEASE_NOTES.md`, `INSTALL_WINDOWS.md` (via `bundle.installationGuideFilename`), `VERIFY_DOWNLOAD.md`, and `RELEASE_ANNOUNCEMENT.md` from real, already-checksummed `release/` output.

Content is honest and specific, not boilerplate: `generateSecurityNotice()` (lines 170-184) states plainly "No code-signing certificate is currently configured for this project," explains SmartScreen will likely trigger and why that's expected, and explicitly notes "A checksum match does not prove publisher identity." `generateFedosBetaReleaseNotes()` (lines 55-107) discloses no-automatic-update, no-recovery-service, and schema-compatibility limits on in-place upgrades. None of this overclaims security posture.

## 10. Operator docs — CLEAN

`docs/pilot/INSTALLATION.md` (138 lines) is current and accurate:
- Artifact filenames referenced (`FedOS-Desktop-Beta-Setup-<version>.exe`, `FedOS Desktop Beta-<version>-win.zip`) match `electron_builder.beta.config.json`'s real `artifactName`/`productName` exactly.
- Cross-referenced docs (`KNOWN_RISKS.md`, `FEEDBACK.md`, `BUILDING.md`) all exist on disk (checked via `ls docs/pilot/` and `ls BUILDING.md`).
- The documented build command `npm run release:electron-beta` resolves through the real chain: root `package.json:32` → `npm run release:beta --prefix packages/fedos-desktop-electron-spike` → `packages/fedos-desktop-electron-spike/package.json:34` → `node scripts/build_release.mjs` (the exact script audited in Area 6).
- Correctly warns against extracting to a OneDrive-synced folder (this is independently corroborated by this session's own environment: the repo checkout itself is under OneDrive).

## 11. Beta gate — P1

`generate_public_beta_gate.mjs` (111 lines) is wired into `build_release.mjs` step 12 and enforces its verdict (non-zero exit on `verdict !== "ready-for-human-publication"`).

Most gates are genuinely mechanical and re-derived every run: clean-tree, installer/zip/manifest/checksums-present (via real `existsSync` checks against expected filenames), staging-bundle verification, secret-scan-passed, release-notes/known-limitations/security-notice/canonical-host-policy present, manual-publication-plan-complete, signing-policy-recorded.

**Finding:** `main()` (lines 93-106) calls `generateFedosPublicBetaGateReport()` with:
```js
attestedEvidence: {
  betaAcceptanceJourneyPassed: true, // real, evidenced this session and the two immediately-prior Arcs (see the completion declaration)
}
```
This is a **hardcoded literal `true`**, not a value derived from anything the current invocation of `build_release.mjs` itself checks or re-verifies. The gate function's own docstring (lines 32-40) is explicit that `attestedEvidence` fields "carry the facts this Arc's own reconciliation report/completion declaration establish by REAL testing but which cannot be mechanically re-derived... a caller must explicitly supply `true`/real evidence, never silently assumed" — but the one caller that actually exists in this codebase supplies `true` unconditionally, sourced from a past session's claim rather than anything checked at gate-run time. Every other gate on this list is either mechanically re-derived from disk or explicitly downgraded to `"accepted-limitation"` (never silently `"met"`) when no attested evidence is supplied — this is the one exception, and it is exactly the gate meant to catch "does the actual create→unlock→relock→relaunch journey still work," i.e. the single most behaviorally meaningful gate in the list. A regression in that journey introduced after the cited prior sessions would not be caught by a fresh run of this gate. Classified **P1**: this is a real, disclosed-in-code but not disclosed-in-output limitation (the JSON report shows `"attested"` with no timestamp or provenance beyond the inline comment) — not a P0 because the gate report is an internal build artifact, not something shown to end users as a safety claim, but it does weaken the one release gate specifically designed to catch exactly this class of regression.

## 12. Artifact naming / installer startup — CLEAN

Cross-checked `electron_builder.beta.config.json`'s `productName`/`artifactName` against every consumer:
- `generate_release_manifest.mjs` uses regex-based `findOneArtifact(/\.exe$/i, ...)` / `/\.zip$/i` (never hardcodes the name), so it is naming-agnostic and cannot drift.
- `generate_public_beta_gate.mjs:53-54` hardcodes the expected filenames as `FedOS-Desktop-Beta-Setup-${expectedProductVersion}.exe` and `FedOS Desktop Beta-${expectedProductVersion}-win.zip` — these match the config's `artifactName` template and electron-builder's own default zip-naming convention for a `productName` containing a space, respectively.
- `docs/pilot/INSTALLATION.md` quotes the identical two filenames (with `<version>` placeholders) verbatim.
No naming drift found across any of these four independent consumers.

---

## Notes on prior-arc claims

This audit did not find anything that contradicts a specific prior arc's stated "COMPLETE"/"PASS" verdict for any of the 12 areas above as of their own completion point — Areas 1, 2, 6, 8, 9, 10, 12 genuinely match what the "Direct Ratchet P1 arc" / "P0 Closure" commit messages claim to have landed, and Areas 3/4 (Security State UI, Peer Device TOFU) pass their own structural guard tests live. The two P1 findings in Areas 7 and 11 are gaps introduced or left behind by the *same* very-recent work that this audit was asked to freshly verify (the `.d.mts` staleness is a direct byproduct of `derivePackageLocalFileClosure`/`checkLocalFileClosurePresentInAsarListing` being added this arc without updating their companion declaration file; the hardcoded beta-gate attestation is unchanged from the older Alpha 5321-5400 arc that first added it, so it was already latent, not freshly introduced) — neither was flagged as a P0/P1 in the commit messages that landed alongside them, so to the extent any prior doc characterized "release integrity" or "beta gate" as fully closed, these two findings would be new information for that characterization, not a full contradiction of it.

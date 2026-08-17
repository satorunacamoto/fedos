# Current Release Truth (as of CandidateHead 8712add7 / EvidenceHead f57812a0)

## Artifact traceability

- Cargo.lock now exists and is tracked — resolved-dependency-graph reproducibility gap
  from the original audit is closed.
- WASM glue-file integrity gap remains: `importGlue()` executes the glue module before
  any hash check, and the manifest schema has no field to hash it at all even if checked
  later. Reachability from real app boot is now definitively confirmed (previously
  unconfirmed) — this makes the gap more concretely actionable, not merely theoretical.
- Tor strict-transport packaging (the historical files-allowlist P0 that caused a
  crash-on-every-launch) is fixed and re-verified complete; no similar gap found
  elsewhere on the real packaged path.

## Checksum / install docs

Fixed. `docs/pilot/INSTALLATION.md` now names the real artifact files
(`FedOS-Desktop-Beta-Setup-<version>.exe`, `SHA256SUMS.txt`) exactly as produced by
`electron_builder.beta.config.json` / `generate_release_checksums.mjs`.

## Install / upgrade / uninstall

Still NOT TESTED. `generate_public_beta_gate.mjs` continues to self-score
`install-uninstall-tested`, `profile-preservation-tested`, and `same-schema-upgrade-tested`
as `"accepted-limitation"` — nothing in the repo has ever set these to `true`. This
remains the single largest untested real-world release path.

## CI vs. local release pipeline

Two distinct things, correctly separated this pass:
- **Remote CI** (`.github/workflows/ci.yml`): thin — ~10% of test files gated, no Rust/
  WASM build, no packaging, typecheck explicitly ungated. Gap is real but honestly
  self-documented in the workflow file itself, not hidden.
- **Local release pipeline** (`build_release.mjs`, documented in `BUILDING.md`): a real
  14-step sequence including packaged dependency-closure verification, checksum
  generation + independent re-verification, and the beta-readiness gate script running
  as a hard-fail step. This is load-bearing and genuinely strong.

Net: thin remote CI + strong local gate is a real but bounded risk (a merge to `main`
could regress the Rust/WASM/packaging layer without CI catching it, but the actual
release-cutting process itself is well-gated when a human runs it locally). P1, not P0.

## Documentation accuracy

- Commerce disclosure in README.md is accurate and up to date for this lineage.
- Tor/onion-routing disclosure is now stale in the "we don't have this" direction — see
  `04_CURRENT_SECURITY_TRUTH.md`. P2, recommend a doc update before any release that
  might expose the (currently disabled-by-default) Tor path.
- Forward-secrecy-default disclosure was not independently re-verified this pass against
  current pilot docs (out of scope for the 4 reconciliation agents); the underlying
  architecture fact (legacy NIP-17 remains the ordinary-launch default) is unchanged
  from the original audit.

## Full release gates — actually executed (post-fix, at CandidateHead 5b0d85ff)

All of the following were run for real (not simulated) against the fixed source, in a
fresh `npm ci` (junction-free, satisfying `guard_no_junctioned_node_modules`) worktree:

- `npm run test:current` (the exact suite CI gates): **191/191 test files, 2808/2814
  tests passed** (6 pre-existing WASM-gated skips), 0 regressions.
- `npm run typecheck:electron`: **0 errors.**
- `npx tsc --noEmit -p tsconfig.json` (core): 998 pre-existing errors (unchanged in kind
  from the known `@types/node` environment artifact), 0 new errors in any touched file.
- `cargo test --locked` (Rust crypto core): **652/653 passed**, 1 pre-existing
  STALE_COUNT_GUARD failure (`cargo_toml_has_exactly_ten_production_dependencies...`,
  hardcoded to 10 but 11 real deps exist since `wasm-bindgen` was adopted directly —
  confirmed via `git log` to be untouched by this arc, not a regression).
- `npm run build:wasm` (real release-profile Rust→WASM build + wasm-bindgen glue):
  **succeeded**, real `pkg/fedos_core_rust_bg.wasm` (389,224 bytes) +
  `fedos_core_rust.js` glue produced; manifest generated with real SHA-256
  (`083d13f3ac898d80b173358b2f4da0b9fababf0dfaf2a1ed8fc3d91c10a27e65`).
- **Real Electron packaging + NSIS build caught a genuine regression** the test suite
  couldn't: `tsconfig.browser-scripts.json` compiles this window's renderer alongside
  the legacy unlock window's identically-named global interfaces (intentional
  declaration-merge reuse, per that file's own header), which silently broke once the
  P1-5 fix added a field to only one side. Fixed by un-merging
  `FedosProfileBridge`/`FedosProfileCommandResult` into beta-specific names
  (`FedosBetaProfileBridge`/`FedosBetaProfileCommandResult`) — see commit `5b0d85ff`.
  This is a structural gap in `typecheck:electron` itself (it excludes this renderer
  file, a previously-known, separately-documented blind spot) — full release gates are
  the only thing that actually exercises this file's real compiled output.
- `npm run release:beta` (the full, real 14-step authoritative pipeline —
  `build_release.mjs`) — **completed end-to-end: `[build-release] OK`.** Real
  installer (`FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`, 110,480,674 bytes,
  sha256 `5edad037bd1c5c31e7a0816e8213fb6a09a8196cd030c9c21885e10bb71c2b12`) and portable
  ZIP produced and checksum-verified; packaged runtime dependency closure verified (5
  real packages); secret scan of 959 staged files: **0 findings**. Public beta gate
  verdict: **`"ready-for-human-publication"`, zero blocking gate IDs.** The same three
  gates already known to be genuinely untested remain `"accepted-limitation"`
  (install-uninstall-tested, profile-preservation-tested, same-schema-upgrade-tested) —
  honestly disclosed as such by the gate script itself, not silently passed.
- Packaged-binary real installed-process tests (against the actual built
  `dist-package-beta/win-unpacked` binary, after `ensure-electron-binary` supplied the
  dev-mode Electron runtime the vitest harness itself needs to spawn processes):
  - `packaged_binary_dependency_closure_guard.test.ts`: **PASS.**
  - `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`: **12/12
    PASS** — a real two-independent-process, real-NIP-17-relay end-to-end proof:
    device announcement, Direct Ratchet session establishment, bidirectional encrypted
    delivery, restart durability (including replay-safety of an already-accepted
    session-init), corruption fail-closed behavior, and a second full round-trip after
    further restarts. **Independently re-confirms P1-6** (silent legacy-route downgrade)
    with materially stronger evidence than before: against a session already proven
    genuinely `"active"` via a real round-2 exchange, an ordinary send (no test-only env
    var) still silently routes via the legacy non-forward-secret path — source-traced
    to `FedosConversationDirectMessagingCoordinator.sendDirectMessage()` branching
    solely on constructor-injected dependencies, never on live session state.
  - `verified_secure_session_ui_packaged_binary_real_electron.test.ts`: **PASS.**
  - One pre-existing, unrelated test failure found:
    `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` asserts
    `package.json`'s `dependencies` field is `undefined`, but 5 real runtime
    dependencies have legitimately been committed there for some time (confirmed via
    `git show HEAD:...package.json`, untouched by this arc) — a stale assumption in the
    test, not a regression.

## Not evaluated this pass

- Live INTERACTIVE NSIS installer GUI install/upgrade/uninstall (genuinely infeasible
  in this non-interactive environment — matches the gate script's own honest
  "accepted-limitation" disclosure, not silently assumed passing).
- Fresh Commerce and Secrets red-team passes at this exact final CandidateHead (out of
  scope for the 4 reconciliation agents; recommended as follow-up before a real public
  cut, given Commerce did not exist at all in the previously-audited stale lineage).

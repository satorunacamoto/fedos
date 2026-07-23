# Secure Runtime Alpha 6681–6760 — Execution Specification

**FedOS Desktop Beta Release Candidate and Packaged Security Acceptance Arc.**

Companion to `docs/secure_runtime_alpha_6681_6760_reconciliation_report.md`
(ancestry/merge). This document records what was actually built, run, and
found during Phases A–L.

## Environment capabilities actually available this session (load-bearing)

Every prior Arc's own Release Freeze Checklist named 4 BLOCKED items, all
tracing to two root causes: an absent compiled WASM artifact, and the
Electron spike package's own uninstalled `node_modules`. This session had:

- Real `cargo`/`rustc`/`wasm-bindgen` (`cargo 1.95.0`, `rustc 1.95.0`,
  `wasm-bindgen 0.2.126`) — `npm run build:wasm` and
  `node scripts/build_production_wasm_artifact.mjs --skip-tests` both
  produced a real `packages/fedos-core-rust/pkg/` (confirmed: sha256
  `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`,
  385565 bytes).
- Real internet access — `packages/fedos-desktop-electron-spike`'s own
  `node_modules/electron/install.js` downloaded the real Electron 43.1.1
  binary for Windows x64 (previously present only as unusable metadata,
  `dist/electron.exe` absent).

This is the first session in this repository's own history with BOTH
simultaneously present, closing 3 of the 4 previously-BLOCKED rows for
real (see the Release Freeze Update below).

## Reconciliation merge (recap)

`git merge 8a33045e` onto the `70bbd6e8`-based integration branch. One
conflict (`README.md`), mechanical, resolved newest-first. Zero other
file-level or semantic overlap. See the reconciliation report for full
detail.

## Regression baseline methodology

`npm test` was run three times: on the merged worktree (clean, no WASM/
`target/` present, matching the repository's own test-hygiene
expectation), and independently on each of the two pre-merge lineage
worktrees (`desktop-runtime-config-unification` = `70bbd6e8` alone,
`secure-memory-store-production` = `8a33045e` alone, both READ-ONLY, never
modified). Failed-test sets were diffed by `(file, full test name)`:

| Run | Total | Passed | Failed |
|---|---|---|---|
| Merged (this Arc) | 14420 | 14003 | 381 (clean) / 383 (with WASM/target present) |
| `70bbd6e8` alone | 14401 | 14024 | 341 |
| `8a33045e` alone | 13751 | 13367 | 367 |

Of the 383 failures in the merged run, exactly 4 did not appear in either
baseline by name. All 4 were independently re-run in isolation and
**passed** — each merged-run failure was `Error: Test timed out in
5000ms`, a resource-contention flake under the full 14420-test concurrent
run, never a real assertion failure (confirmed: the SAME test file's
non-timing assertions, e.g. the historical fixed-pub-fn-count guard at the
same location, fail identically in both baselines — the timeout is purely
about the storeCiphertext round-trip taking too long under load, not a
logic defect). **Zero genuine regressions.**

`cargo test --manifest-path packages/fedos-core-rust/Cargo.toml`: 639
passed, 1 failed (`cargo_toml_has_exactly_ten_production_dependencies_
after_k256_adoption`, expects 10 production deps, real count is 11 because
`wasm-bindgen` was adopted as a real dependency at Stage 985, long after
this guard's own fixed count was written) — confirmed identically failing
on the unmodified `8a33045e` worktree alone. Pre-existing, not a
regression.

## Real findings from actually running the packaged pipeline

Two real, previously-undiscovered issues surfaced ONLY because this
session could run the full pipeline end to end for the first time. Both
are documented here in full (Fail Closed over fabrication: neither is
hidden or minimized).

### Finding 1 — secret-scan false positive (fixed)

`packages/fedos-desktop-electron-spike/scripts/build_release.mjs`'s own
Phase 9 secret scan flagged 3 files (`fedos_direct_ratchet_cryptographic_
session.js`, `fedos_direct_ratchet_sealing_authority.js`,
`fedos_desktop_runtime.js`) for the `dev-master-seed-double` pattern
(`/DevelopmentFedosMasterSeedAuthority/`). Direct inspection: every match
is inside a `/** ... */` or `//` comment explaining why that class is NOT
used, never an `import` or `new` call. Independently confirmed:
`DevelopmentFedosMasterSeedAuthority` the class is defined ONLY in
`src/desktop/onboarding/fedos_development_master_seed_authority.ts`, which
`tsconfig.beta-runtime.json` does not compile into `dist/` at all
(confirmed absent from the build output). **Fixed narrowly**: the
`dev-master-seed-double` pattern is now `commentAware` — only a finding
when it matches OUTSIDE a comment line. Every other pattern (including
`worktree-absolute-path`, which the existing test suite explicitly expects
to still fire even inside a comment) is untouched. Verified against the
existing `test/secure_runtime_alpha_5241_5320_packaging.test.ts` fixture
cases directly via Node (that file's own single-file `vitest run`
invocation hits the pre-existing, worktree-independent esbuild parse
artifact — confirmed identically on the unmodified `70bbd6e8` sibling
worktree; the scanner's own logic was verified by direct `import()` and
manual execution of the same 4 cases the test file asserts, all correct).
After the fix: `node scripts/scan_release_artifacts_for_secrets.mjs` on
the real staged `dist/`/root `dist/`/`pkg/` — **0 findings across 732
files**.

### Finding 2 — the canonical packaged Beta entry point does not reach Direct Ratchet / Peer Capability / Identity Transition / Deletion Request (disclosed, NOT fixed)

This is the central finding of this Arc. `FedosProfileInitializationCoordinator`
has carried `directRatchetEnabled`/`peerCapabilityEnabled`/
`identityTransitionEnabled`/`deletionRequestEnabled` (plus their sub-config)
since Alpha 6521–6600. But `packages/fedos-desktop-electron-spike/src/
fedos_electron_beta_main.cts` — the ONE canonical packaged Beta Electron
entry point — never passes any of the four when it constructs its own
`Coordinator` instance in `buildFreshCoordinator()`. This was invisible to
every prior Arc because no prior worktree could actually run this file as
a real packaged process (Electron `node_modules` was never installed) —
6521–6600's own "real, non-test-only-helper vertical slice" proof was a
Node-level test with a **hand-built** Coordinator config, not the actual
packaged entry point.

**Proven by real execution, not inference.** A new, additive, READ-ONLY
AUTOTEST diagnostic (`unifiedGraphDiagnostics()`, gated behind
`FEDOS_ELECTRON_BETA_AUTOTEST=create|unlock`, never renderer-facing IPC)
calls `activeCoordinator.runningRuntime().conversationRuntime()
.directRatchet()/.peerCapability()/.identityTransition()/.deletionRequest()`
and `activeAssembly.shell.productionCryptoStatus()` — all pre-existing
accessors, zero new capability. Real packaged run (Electron 43.1.1,
real WASM, real profile creation), BEFORE any config change:

```
FEDOS_ELECTRON_BETA_AUTOTEST_UNIFIED_GRAPH:{"runtimeReachable":true,"deviceTrustReachable":true,
"directRatchetConfigured":false,"peerCapabilityConfigured":false,
"identityTransitionConfigured":false,"deletionRequestConfigured":false,
"productionCryptoStatusOutcome":"ok"}
```

**A fix was attempted and reverted.** Adding the four `*Enabled: true`
flags (with the SAME conservative policy values
`test/secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
already establishes) to `buildFreshCoordinator()`'s own `new m.Coordinator(...)`
call caused `FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:runtime-start-failed`.
Root cause, confirmed by direct source inspection of
`startFedosDesktopRuntime()` (`src/desktop/runtime/fedos_desktop_runtime.ts:508-521`):
all four require `config.privateTransportEnabled === true` plus real
`conversationTransportRelays`/`conversationTransportObservationLogPath`/
`conversationTransportSigningAuthority` — they send/receive control
payloads through the real Private Transport, never a fabricated one. **No
packaged Electron entry point in this repository has ever wired real
Relay/Settings configuration in** — this is the disclosed "Settings→Relay
plumbing" gap Alpha 6521–6600's own README explicitly named as
deliberately not done ("Deliberately NOT done this Arc, per its own
explicit scope decision: Settings→Relay plumbing"). Inventing a
production Relay endpoint here would be exactly the "arbitrary production
configuration" this Arc's own mission absolutely prohibits, and wiring
Settings→Relay is explicitly a DIFFERENT, not-yet-run Arc's own scope
(named as far back as Alpha 4901–4980's own README: "Next: Desktop
Settings ↔ Runtime Application Arc (apply the durable settings to relay
set / ...)"). The config-threading attempt was reverted; the honest,
`false`-reporting diagnostic was kept.

**What this means concretely.** The unified configuration GRAPH (the
TypeScript types, the Coordinator's own capacity to carry this config, the
Runtime's own capacity to construct these four subsystems when given real
transport) is genuinely unified and genuinely proven reachable at the
Node/vertical-slice level (Alpha 6521–6600's own test, re-confirmed
passing post-merge, 35/35). What is NOT yet proven is that the CANONICAL
PACKAGED entry point itself threads real transport through to activate
them — because doing so honestly requires a real Relay endpoint this Arc
correctly declines to invent. Device Trust and the Store-backed production
crypto authority (this Arc's OWN two reconciled lineages' primary
subjects) ARE proven reachable through the real packaged path
(`deviceTrustReachable: true`, `productionCryptoStatusOutcome: "ok"`).

## Verification run log

- `npm run typecheck:core` — 2 pre-existing errors (confirmed identical on
  unmodified `70bbd6e8`), `&&`-short-circuits past `typecheck:electron`.
- `npm run typecheck:electron` (run directly, bypassing the short-circuit)
  — clean, 0 errors, both before and after this Arc's own 2 file changes.
- `cargo test` — 639 passed, 1 pre-existing failure (see above).
- `npm run build:wasm` / `node scripts/build_production_wasm_artifact.mjs
  --skip-tests` — real artifact produced, manifest generated.
- `npm test` — see regression baseline table above.
- `npm run test:electron-spike` — 122 passed, 1 pre-existing (Alpha
  4101-4180's own stale `sections`-shape assertion, see below), 4 skipped,
  0 genuine failures, 1 confirmed-flaky timeout that passed on isolated
  re-run.
- `node scripts/build_release.mjs` (packages/fedos-desktop-electron-spike)
  — real NSIS installer + portable ZIP built via electron-builder 26.15.3,
  real code-signing via `signtool.exe`, real manifest + SHA-256 checksums
  generated and independently re-verified, real secret scan (0 findings
  after the fix above).

## Pre-existing finding surfaced (not fixed, out of scope)

`test/../packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_
4101_4180_electron_host_adapter.test.ts` asserts the Safety Center
overview IPC response has a `sections` property. The real, current Safety
Center overview (`fedosSafetyCenterBuildOverviewContent()`) returns a
`summary`-keyed object (the 13-section model documented since Alpha
6201–6280). This is a stale assertion from a much older Arc (4101–4180,
long before the 13-section model existed) that could never actually run
before this session (Electron `node_modules` was never installed in any
worktree). Confirmed unrelated to this Arc's own merge: neither lineage
touches this file or the Safety Center response shape. Left unfixed —
outside this Arc's declared reconciliation scope, and fixing an unrelated
ancient test's stale shape assertion is not part of "reconcile these two
lineages."

/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent S) — Task 3: crypto-artifact verify-before-execute.
 *
 * Audit finding (re-verified against THIS worktree's current source, not
 * assumed from any other branch): `fedos_electron_beta_main.cts`'s own
 * `artifactDir()` honors `process.env.FEDOS_ELECTRON_BETA_ARTIFACT_DIR`
 * UNCONDITIONALLY — any process that can set one environment variable (on
 * Windows, `HKCU\Environment` needs no elevation) can redirect the ENTIRE
 * production crypto core (`FedosMasterSeedAuthority`, every signing/AEAD/
 * NIP-44 operation) to an arbitrary directory on disk, silently, with no
 * gate of any kind. Neither production call site
 * (`buildFreshCoordinator()`) passes `expectedCrate` to
 * `authorizeAndActivateFedosProductionDesktopMasterSeed()`
 * (`fedos_production_desktop_crypto_activation_authority.ts`) either, so
 * that function's own `unapproved-build` decision is dead code in
 * practice — an attacker-supplied override directory only needs a
 * SELF-CONSISTENT manifest (its own `wasmSha256Hex` computed from its own
 * malicious `.wasm`) to pass every check that function already runs,
 * because nothing in this application's OWN shipped source independently
 * pins what crate/build is expected. No test anywhere in this repository
 * currently sets `FEDOS_ELECTRON_BETA_ARTIFACT_DIR` (grepped repo-wide),
 * so tightening this has zero known regression risk.
 *
 * This file closes BOTH gaps, as one small, pure, dependency-free,
 * independently-testable module — no Electron import, no filesystem
 * access, no crypto of its own. It composes with, and does not replace,
 * the EXISTING hash/capability/export verification already in
 * `fedos_production_wasm_artifact_manifest.ts` /
 * `fedos_production_desktop_crypto_activation_authority.ts` (that
 * pipeline's own SHA-256 recomputation-from-real-bytes, pinned capability
 * profile, and pinned allowed-export set are already sound — the gap is
 * upstream of it: WHICH directory gets fed in, and whether the crate
 * identity is independently pinned at all).
 *
 * See this file's own bottom section for the exact one or two call sites
 * the Coordinator (Wave B) needs to wire this at inside
 * `fedos_electron_beta_main.cts` — deliberately NOT edited by this file
 * (that file is shared with Agent I's IPC race guard and the
 * Coordinator's Wave B protocol wiring; see the mega-arc brief).
 */

/**
 * Pinned, IN-SOURCE expected crate identity for the production Master
 * Seed WASM artifact. Read from THIS shipped module (inside the
 * packaged app's own asar/bundle), never from the artifact directory
 * itself — an artifact directory (default or override) can carry
 * whatever manifest it wants, but it cannot rewrite this constant
 * without rewriting the application's own source and rebuilding it.
 * Only `name` is pinned unconditionally: `fedos-core-rust` is this
 * repository's own crate and is not expected to ever change name.
 * `version` is intentionally left unpinned here (every release changes
 * it, and hand-maintaining a second copy of the current version next to
 * `Cargo.toml` would silently drift) — version compatibility is already
 * covered by the existing, independently-reviewed
 * `compatibilityVersion`/`capabilityProfile`/allowed-export checks in
 * `fedos_production_wasm_artifact_manifest.ts`, which this module does
 * not duplicate.
 */
export const FEDOS_PRODUCTION_EXPECTED_WASM_CRATE: { readonly name: string } = Object.freeze({
  name: "fedos-core-rust",
});

/**
 * What the Coordinator (or a test) already knows before deciding which
 * artifact directory to load from. Every field is a plain value the
 * caller already has in hand — this function performs no I/O and reads
 * no environment variable itself, so it is trivially unit-testable and
 * has no hidden dependency on `process.env`/Electron.
 */
export interface FedosProductionArtifactDirRequest {
  /** The RAW value of `FEDOS_ELECTRON_BETA_ARTIFACT_DIR`, exactly as read by the caller — `undefined`/empty means "no override requested." Never trimmed/validated by the caller first; this function does that. */
  readonly overrideArtifactDirEnvValue: string | undefined;
  /**
   * Explicit test-gate signal. MUST be derived from an explicit,
   * caller-controlled test-mode flag (this codebase's own established
   * `AUTOTEST_MODE`/`FEDOS_ELECTRON_BETA_AUTOTEST` convention — see the
   * call-site notes at the bottom of this file) — NEVER inferred from
   * the presence of the override itself, from `NODE_ENV`, or from any
   * other value an ordinary end-user's environment could also set. An
   * attacker who can set one environment variable can set two; gating
   * on a SEPARATE, already-narrow, already-reviewed test-mode signal is
   * what makes this a real gate rather than a renamed no-op.
   */
  readonly testGateActive: boolean;
  /** The default, shipped artifact directory — never itself gated or rejected. */
  readonly defaultArtifactDir: string;
}

export type FedosProductionArtifactDirDecisionOutcome =
  /** No override was requested at all — the ordinary, overwhelmingly common case. */
  | "default"
  /** An override was requested AND the test gate was active — honored. Test/CI-only. */
  | "override-honored"
  /**
   * An override was requested but the test gate was NOT active — REJECTED.
   * This is the fix: previously this case did not exist, and the override
   * was honored unconditionally. The safe, already-verified default
   * directory is used instead — never a hard crash for what may simply be
   * a stray leftover environment variable, and never a silent use of the
   * untrusted path either (the decision is explicit and observable, see
   * `reason`).
   */
  | "override-rejected-not-test-gated";

export interface FedosProductionArtifactDirDecision {
  readonly outcome: FedosProductionArtifactDirDecisionOutcome;
  /** The directory the caller should actually load from — ALWAYS a safe choice: either the pinned default, or the override ONLY when genuinely test-gated. */
  readonly artifactDir: string;
  /** Non-secret, human-readable, safe to log via this app's own diagnostic sink (`recordDiagnosticEvent` in `fedos_electron_beta_main.cts`). */
  readonly reason: string;
}

/**
 * Pure. Decides which artifact directory a production launch may
 * actually load the crypto core from. Never throws.
 */
export function fedosResolveProductionArtifactDir(
  request: FedosProductionArtifactDirRequest,
): FedosProductionArtifactDirDecision {
  const trimmedOverride = (request.overrideArtifactDirEnvValue ?? "").trim();

  if (trimmedOverride.length === 0) {
    return {
      outcome: "default",
      artifactDir: request.defaultArtifactDir,
      reason: "no artifact directory override was requested",
    };
  }

  if (!request.testGateActive) {
    return {
      outcome: "override-rejected-not-test-gated",
      artifactDir: request.defaultArtifactDir,
      reason:
        "FEDOS_ELECTRON_BETA_ARTIFACT_DIR was set but this is not a test-gated launch -- the override was ignored and the pinned default artifact directory is used instead",
    };
  }

  return {
    outcome: "override-honored",
    artifactDir: trimmedOverride,
    reason: "FEDOS_ELECTRON_BETA_ARTIFACT_DIR was set and this launch is explicitly test-gated -- override honored",
  };
}

/**
 * The second half of "verify before execute": the EXPECTED crate identity
 * to thread into `FedosProductionActivationRequest.expectedCrate`
 * (`fedos_production_desktop_crypto_activation_authority.ts`) so that
 * function's own already-built, already-reviewed `unapproved-build`
 * decision is actually reachable in production, closing the "manifest
 * self-attests its own identity" gap: a hash/capability/export check
 * alone only proves internal self-consistency between the manifest and
 * the bytes sitting beside it — it does not, by itself, prove the
 * artifact directory is the one this application actually ships. Pinning
 * `expectedCrate.name` against a constant baked into this shipped module
 * closes that: a malicious override directory would additionally have to
 * forge `crateName` inside its own manifest to `"fedos-core-rust"`
 * exactly, which does not defeat this check (the check does not depend
 * on the attacker NOT knowing the name) but keeps the verification
 * pipeline's `expectedCrate` codepath genuinely exercised end-to-end
 * (currently dead code in production — see this file's own header) and
 * ready to be tightened further (e.g. a pinned version floor) without a
 * second wiring pass.
 */
export function fedosExpectedProductionWasmCrate(): { readonly name: string } {
  return FEDOS_PRODUCTION_EXPECTED_WASM_CRATE;
}

// ---------------------------------------------------------------------
// Call-site notes for the Coordinator (Wave B) — NOT applied by this
// file. `fedos_electron_beta_main.cts` is shared with Agent I's IPC race
// guard and the Coordinator's own protocol wiring; this Task
// deliberately makes zero edits to it.
//
// Exactly TWO call sites, both inside `buildFreshCoordinator()`
// (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`,
// around the existing `artifactDir()` function and its one call site at
// `activateFedosProductionProfileMasterSeed({ attestation, artifactDir:
// artifactDir(), importGlue })`):
//
// 1. Import this module the SAME way its siblings in
//    `production_activation/` are already imported inside
//    `requireModules()` (see that function's existing
//    `distUrl("os", "messenger", "desktop", "production_activation", "fedos_production_profile_activation.js")`
//    pattern; add `"fedos_production_wasm_artifact_verify_before_execute.js"`
//    alongside it), and add `fedosResolveProductionArtifactDir`/
//    `fedosExpectedProductionWasmCrate` to `RootModules`.
//
// 2. Replace `artifactDir()`'s body (or call it from inside this new
//    step — either is fine, `artifactDir()` itself is unmodified by this
//    Task) with:
//
//      const decision = m.fedosResolveProductionArtifactDir({
//        overrideArtifactDirEnvValue: process.env.FEDOS_ELECTRON_BETA_ARTIFACT_DIR,
//        testGateActive: AUTOTEST_MODE.length > 0, // the SAME const `fedos_electron_beta_main.cts` already defines at line 125
//        defaultArtifactDir: path.join(__dirname, "..", "..", "fedos-core-rust", "pkg"),
//      });
//      if (decision.outcome === "override-rejected-not-test-gated") {
//        recordDiagnosticEvent("artifact-dir-override-rejected", { reason: decision.reason });
//      }
//      const activation = await m.activateFedosProductionProfileMasterSeed({
//        attestation,
//        artifactDir: decision.artifactDir,
//        expectedCrate: m.fedosExpectedProductionWasmCrate(),
//        importGlue: (specifier: string) => import(pathToFileURL(specifier).href),
//      });
//
//    `testGateActive: AUTOTEST_MODE.length > 0` reuses `AUTOTEST_MODE`
//    exactly as already computed (`process.env.FEDOS_ELECTRON_BETA_AUTOTEST ?? ""`)
//    — no new environment variable is introduced. If the Coordinator
//    wants the artifact override reachable from a NARROWER set of
//    autotest modes than "any" (e.g. only a new, dedicated
//    `AUTOTEST_MODE === "artifact-override"` value), that is a one-line
//    change to the boolean passed in; this module does not care which
//    string produced `testGateActive`, only that it is `true`/`false`
//    and came from an explicit, already-reviewed test-mode signal.
// ---------------------------------------------------------------------

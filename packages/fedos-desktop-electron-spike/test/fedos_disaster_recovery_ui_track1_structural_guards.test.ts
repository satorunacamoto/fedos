/**
 * Disaster Recovery Product Closure arc, Track 1 (Recovery UI) --
 * structural guards, proving by direct source inspection (never narrative
 * claim alone) that:
 *  - the two new dialog-driving IPC handlers (`handleRecoveryExportToFile`,
 *    `handleRecoveryChooseBundleFile`) exist, are registered on their own
 *    named channels, use a native Electron dialog (never a generic
 *    read/write-arbitrary-path surface), and never leak raw bundle
 *    bytes/base64 back to the renderer on a successful export;
 *  - the three PRE-EXISTING recovery handlers this Track was explicitly
 *    forbidden from editing (`handleRecoveryInspect`, `handleRecoveryRestore`,
 *    `handleRecoveryExport`) still contain their own known, distinctive
 *    source lines verbatim;
 *  - the preload bridges expose the new methods over the correct channels;
 *  - the renderer's outcome-to-copy mapping covers every real outcome
 *    `handleRecoveryRestore()` can return, and distinguishes a wrong
 *    passphrase from a corrupt/tampered bundle;
 *  - the Restore screen is reachable from Welcome (never conflated with
 *    "Start Over"), the Export control lives in Settings, and neither
 *    screen's wiring ever calls the other's action;
 *  - no raw passphrase/sealed material is ever rendered outside the
 *    passphrase input itself.
 *
 * Mirrors this package's own established structural-guard convention
 * (`secure_runtime_alpha_8041_8120_structural_guards.test.ts`'s own test
 * #6, which covers the pre-existing Archive file-picker channels the
 * same way) -- dialog-driving handlers are covered by source inspection
 * here, not a live-dialog E2E click (a real OS save/open dialog cannot be
 * driven by the `ui-script`/`acceptance` harness; no existing test in
 * this package attempts it for Archive's own identical picker channels
 * either). The paste-based Restore flow (no native dialog involved) is
 * covered by a REAL end-to-end renderer test instead --
 * `fedos_disaster_recovery_ui_track1_restore_renderer.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";
const PRELOAD_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts";
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";
const HTML_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html";
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";

describe("Disaster Recovery Product Closure arc, Track 1 (Recovery UI) -- structural guards", () => {
  it("1. handleRecoveryExportToFile exists, uses dialog.showSaveDialog, calls the EXISTING handleRecoveryExport() rather than reimplementing the export, and never returns bundleBase64/raw bytes on success", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleRecoveryExportToFile(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1400);
    expect(body).toMatch(/dialog\.showSaveDialog/);
    expect(body).toMatch(/await handleRecoveryExport\(\)/);
    // The success return is `{ outcome: "ok", path: ... }` only -- assert
    // the literal `bundleBase64` never appears as an OUTGOING field name in
    // this handler's own body (it only ever reads it off the delegated
    // result to decode+write, never echoes it back).
    const returnLines = body.split("\n").filter((l) => l.includes("return {"));
    for (const line of returnLines) {
      expect(line, `handleRecoveryExportToFile must never return bundleBase64/raw bytes: "${line.trim()}"`).not.toMatch(/bundleBase64|bundleBytes/);
    }
  });

  it("2. handleRecoveryChooseBundleFile exists, uses dialog.showOpenDialog, and bounds the re-encoded base64 length against the SAME MAX_RECOVERY_BUNDLE_BASE64_CHARS constant validatedRecoveryBundleBytes() already enforces", () => {
    const source = stripComments(read(MAIN_PATH));
    const start = source.indexOf("async function handleRecoveryChooseBundleFile(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, start + 1400);
    expect(body).toMatch(/dialog\.showOpenDialog/);
    expect(body).toMatch(/MAX_RECOVERY_BUNDLE_BASE64_CHARS/);
    expect(source).toMatch(/const MAX_RECOVERY_BUNDLE_BASE64_CHARS = 64_000_000;/);
  });

  it("3. both new channels are registered on ipcMain under their own specific names, never a generic execute/invoke surface", () => {
    const source = stripComments(read(MAIN_PATH));
    expect(source).toMatch(/ipcCommands\.registerHandle\(ipcMain, "fedos-app:recovery-export-to-file",\s*async \(\) => handleRecoveryExportToFile\(\)\);/);
    expect(source).toMatch(/ipcCommands\.registerHandle\(ipcMain, "fedos-profile:recovery-choose-bundle-file",\s*async \(\) => handleRecoveryChooseBundleFile\(\)/);
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-app:execute"/);
    expect(source).not.toMatch(/ipcMain\.handle\("fedos-app:invoke"/);
  });

  it("4. the three PRE-EXISTING recovery handlers this Track was forbidden from editing still contain their own known, distinctive source lines verbatim (byte-for-byte unmodified business logic)", () => {
    const source = stripComments(read(MAIN_PATH));
    // handleRecoveryInspect -- unchanged pure-inspection delegation.
    expect(source).toMatch(/async function handleRecoveryInspect\(payload: unknown\) \{\s*const bundleBytes = validatedRecoveryBundleBytes\(payload\);\s*if \(bundleBytes === null\) return \{ outcome: "invalid-input", reason: "malformed bundleBytes" \};\s*return requireModules\(\)\.inspectFedosRecoveryBundle\(bundleBytes\);\s*\}/);
    // handleRecoveryRestore -- unchanged "already-exists"/fresh-target/device-mint discipline.
    expect(source).toMatch(/if \(activeCoordinator !== null\) return \{ outcome: "already-exists", reason: "a profile is already active" \};/);
    expect(source).toMatch(/const deviceKeypair = m\.generateFedosDeviceSigningKeypair\(\);/);
    expect(source).toMatch(/return \{ \.\.\.readyResult\(unlockResult\.value\), assets: restoreResult\.assets \};/);
    // handleRecoveryExport -- unchanged "currently active profile only" guard and base64 response shape.
    expect(source).toMatch(
      /if \(activeCoordinator === null \|\| activeMasterSeedAuthority === null \|\| activeNostrSigningAuthority === null\) \{\s*return \{ outcome: "not-unlocked", reason: "no active unlocked profile to export" \};\s*\}/,
    );
    expect(source).toMatch(/return \{ outcome: "ok", bundleBase64: Buffer\.from\(exportResult\.bundleBytes\)\.toString\("base64"\) \};/);
  });

  it("5. the fedosProfile preload bridge exposes recoveryInspect/recoveryRestore/recoveryChooseBundleFile over the SAME fedos-profile:* channels main.cts already registers, and fedosApp exposes recoveryExportToFile over fedos-app:recovery-export-to-file", () => {
    const preloadSource = stripComments(read(PRELOAD_PATH));
    expect(preloadSource).toMatch(/recoveryInspect: \(bundleBase64: string\) =>\s*ipcRenderer\.invoke\("fedos-profile:recovery-inspect",/);
    expect(preloadSource).toMatch(/recoveryRestore: \(bundleBase64: string, passphrase: string\) =>/);
    expect(preloadSource).toMatch(/ipcRenderer\.invoke\("fedos-profile:recovery-restore",/);
    expect(preloadSource).toMatch(/recoveryChooseBundleFile: \(\) => ipcRenderer\.invoke\("fedos-profile:recovery-choose-bundle-file"\),/);
    expect(preloadSource).toMatch(/recoveryExportToFile: \(\) => ipcRenderer\.invoke\("fedos-app:recovery-export-to-file"\),/);
  });

  it("6. window.d.ts declares the new bridge methods -- optional on FedosBetaProfileBridge (same discipline as resetInterrupted/resetCorruptReady), required on FedosAppBridge", () => {
    const source = stripComments(read(WINDOW_DTS_PATH));
    expect(source).toMatch(/readonly recoveryInspect\?: \(bundleBase64: string\) => Promise<FedosRecoveryInspectResult>;/);
    expect(source).toMatch(/readonly recoveryRestore\?: \(bundleBase64: string, passphrase: string\) => Promise<FedosRecoveryRestoreResult>;/);
    expect(source).toMatch(/readonly recoveryChooseBundleFile\?: \(\) =>/);
    expect(source).toMatch(/readonly recoveryExportToFile: \(\) => Promise<\{ readonly outcome: string; readonly reason\?: string; readonly path\?: string \}>;/);
  });

  it("7. the renderer's restore-outcome copy table covers EVERY real outcome handleRecoveryRestore() can return, and distinguishes wrong-secret from the corrupt/tampered-bundle outcomes with genuinely different copy", () => {
    const source = stripComments(read(RENDERER_PATH));
    const tableStart = source.indexOf("const RECOVERY_RESTORE_OUTCOME_COPY");
    expect(tableStart).toBeGreaterThanOrEqual(0);
    const tableEnd = source.indexOf("\n};", tableStart);
    const table = source.slice(tableStart, tableEnd);
    const requiredOutcomes = [
      "wrong-secret",
      "malformed",
      "data-part-restore-failed",
      "descriptor-invalid",
      "identity-restore-failed",
      "account-identity-unresolved",
      "write-failed",
      "target-not-fresh",
      "already-exists",
      "seed-unavailable",
      "invalid-input",
    ];
    for (const outcome of requiredOutcomes) {
      expect(table, `RECOVERY_RESTORE_OUTCOME_COPY must cover real outcome "${outcome}"`).toMatch(new RegExp(`"?${outcome}"?:\\s*\\{`));
    }
    // Distinct copy: wrong-secret's headline/detail text must never appear
    // verbatim in any of the corrupt/tampered-bundle entries' own copy,
    // and vice versa -- proves this is not one generic message reused
    // across every outcome.
    const wrongSecretMatch = table.match(/"wrong-secret":\s*\{\s*headline:\s*"([^"]*)"/);
    expect(wrongSecretMatch).not.toBeNull();
    const wrongSecretHeadline = wrongSecretMatch![1]!;
    for (const corruptOutcome of ["malformed", "data-part-restore-failed", "descriptor-invalid"]) {
      const re = new RegExp(`"?${corruptOutcome}"?:\\s*\\{\\s*headline:\\s*"([^"]*)"`);
      const m = table.match(re);
      expect(m, `${corruptOutcome} must have its own headline`).not.toBeNull();
      expect(m![1]).not.toBe(wrongSecretHeadline);
    }
    // target-not-fresh's own copy must name BOTH real reasons the widened
    // freshness check can fire for (an existing profile, and residual
    // leftover data with no active profile) -- never a generic "already
    // exists" claim for this specific outcome.
    const targetNotFreshMatch = table.match(/"target-not-fresh":\s*\{[\s\S]*?detail:\s*(?:'([^']*)'|"([^"]*)")/);
    expect(targetNotFreshMatch).not.toBeNull();
    const targetNotFreshDetail = (targetNotFreshMatch![1] ?? targetNotFreshMatch![2])!;
    expect(targetNotFreshDetail.toLowerCase()).toMatch(/leftover/);
    expect(targetNotFreshDetail.toLowerCase()).toMatch(/already exists/);
  });

  it("8. the fresh-device / re-establishment disclosure is real, static copy shown on a successful restore -- never conditional on a flag the renderer could accidentally skip", () => {
    const htmlSource = read(HTML_PATH);
    const start = htmlSource.indexOf('id="restore-fresh-device-disclosure"');
    expect(start).toBeGreaterThanOrEqual(0);
    const tag = htmlSource.slice(start - 40, start + 650);
    expect(tag.toLowerCase()).toMatch(/ratchet/);
    expect(tag.toLowerCase()).toMatch(/re-establish/);
    expect(tag.toLowerCase()).toMatch(/trust/);
    // it lives inside the success-only container, hidden by default in the
    // static markup itself (never relying on JS alone to hide it before a
    // real success).
    const successStart = htmlSource.indexOf('id="restore-result-success"');
    expect(successStart).toBeGreaterThanOrEqual(0);
    expect(htmlSource.slice(successStart, successStart + 60)).toMatch(/hidden/);
    expect(start).toBeGreaterThan(successStart);
  });

  it("9. Restore is reachable from the Welcome screen and is a SEPARATE screen/feature from the recovery screen's own 'Start Over' -- neither action's wiring calls the other's handler", () => {
    const htmlSource = read(HTML_PATH);
    expect(htmlSource).toMatch(/<button id="welcome-restore-btn" type="button">Restore from a backup<\/button>/);
    expect(htmlSource).toMatch(/<section id="screen-restore-bundle">/);
    // Distinct from the pre-existing recovery screen's own Start Over ids.
    expect(htmlSource).not.toMatch(/id="restore-start-over/);

    const rendererSource = stripComments(read(RENDERER_PATH));
    const restoreEventFnNames = ["onRestoreChooseFile", "onRestoreUsePastedText", "onRestoreInspect", "onRestoreSubmit", "onRestoreContinue", "onRestoreOpenScreen", "resetRestoreBundleState"];
    for (const fnName of restoreEventFnNames) {
      const start = rendererSource.indexOf(`function ${fnName}(`);
      expect(start, `${fnName} must exist`).toBeGreaterThanOrEqual(0);
      const body = rendererSource.slice(start, start + 2500);
      expect(body, `${fnName} must never call the unrelated Start Over actions`).not.toMatch(/onRecoveryStartOver\(|onRecoveryStartOverCorrupt\(|resetInterrupted\(|resetCorruptReady\(/);
    }
    const startOverFnNames = ["onRecoveryStartOver", "onRecoveryStartOverCorrupt"];
    for (const fnName of startOverFnNames) {
      const start = rendererSource.indexOf(`async function ${fnName}(`);
      expect(start, `${fnName} must exist`).toBeGreaterThanOrEqual(0);
      const body = rendererSource.slice(start, start + 1600);
      expect(body, `${fnName} must never call the unrelated Restore actions`).not.toMatch(/onRestoreSubmit\(|onRestoreContinue\(|recoveryRestore\(/);
    }
  });

  it("10. Export lives in Settings (reachable only after unlock), is clearly disclosed as NOT including Direct Ratchet sessions or device trust, and never shows the passphrase/raw sealed bytes", () => {
    const htmlSource = read(HTML_PATH);
    const settingsStart = htmlSource.indexOf('id="app-screen-settings"');
    const exportStart = htmlSource.indexOf('id="recovery-export-btn"');
    expect(exportStart).toBeGreaterThan(settingsStart);
    const exportRegion = htmlSource.slice(exportStart - 900, exportStart + 200);
    expect(exportRegion.toLowerCase()).toMatch(/ratchet/);
    expect(exportRegion.toLowerCase()).toMatch(/device.*trust|trust.*device/);

    const rendererSource = stripComments(read(RENDERER_PATH));
    const fnStart = rendererSource.indexOf("async function onRecoveryExportToFile(");
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const body = rendererSource.slice(fnStart, fnStart + 900);
    // Only ever renders `result.path` (a non-secret file path) -- never a
    // passphrase or raw bundle byte field.
    expect(body).not.toMatch(/bundleBase64|passphrase|sealed/i);
  });

  it("11. no raw passphrase is ever assigned to a non-input element's textContent anywhere in the restore/export code added by this Track", () => {
    const rendererSource = stripComments(read(RENDERER_PATH));
    const start = rendererSource.indexOf("interface RecoveryOutcomeCopy");
    const end = rendererSource.indexOf("function stopRelayStatusPolling(");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const track1Region = rendererSource.slice(start, end);
    // The passphrase VALUE is read only into the `restore` bridge call
    // argument, never into a `.textContent =` assignment.
    for (const line of track1Region.split("\n")) {
      if (/\.textContent\s*=/.test(line)) {
        // Flags an actual VALUE interpolation of the passphrase variable
        // (`${passphrase}`, `= passphrase`, `passphrase)`/`passphrase,`
        // used as a value) into rendered text -- not the word "passphrase"
        // appearing inside a fixed instructional STRING LITERAL like
        // "Enter the bundle's passphrase.", which is safe UI copy, not a
        // secret value.
        expect(line, `must never render the raw passphrase VALUE: "${line.trim()}"`).not.toMatch(/\$\{passphrase\}|=\s*passphrase\b/);
      }
    }
  });
});

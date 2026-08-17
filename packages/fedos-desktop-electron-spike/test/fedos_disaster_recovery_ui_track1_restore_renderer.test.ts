/**
 * Disaster Recovery Product Closure arc, Track 1 (Recovery UI) -- REAL
 * end-to-end proof that the Restore screen this Track added actually
 * works when driven only through visible DOM controls, exactly like
 * `fedos_tor_security_ui_renderer.test.ts`'s own established pattern:
 * real DOM clicks/fills -> the real `fedos_electron_beta_renderer.ts`
 * event listeners -> the real `window.fedosProfile` preload bridge ->
 * the real `fedos-profile:recovery-inspect`/`recovery-restore` IPC
 * channels -> the real, already-proven backend
 * (`inspectFedosRecoveryBundle()`/`restoreFedosRecoveryBundle()`,
 * unmodified by this Track).
 *
 * Machine A (spawned in `AUTOTEST_MODE=acceptance`, exactly like
 * `fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`) creates
 * a real profile and exports a real bundle purely to obtain real base64
 * bundle bytes to paste. Machine B (a completely separate, fresh temp
 * `dataDir`, spawned in `AUTOTEST_MODE=ui-script`) then drives the REAL
 * rendered Welcome -> Restore screen this Track built, covering the three
 * things the arc's own review explicitly asked for:
 *   1. the inspect-BEFORE-restore plan preview (never skipped, never
 *      requires a passphrase);
 *   2. wrong-passphrase (`wrong-secret`) copy is genuinely DIFFERENT from
 *      malformed-bundle (`malformed`) copy -- never one generic message;
 *   3. the fresh-device / re-establishment disclosure is actually visible
 *      on screen after a real successful restore, alongside the real
 *      per-asset outcome list the backend returned.
 *
 * The "choose bundle file" native-dialog path and the Settings "Export
 * Backup" native-dialog path are deliberately NOT driven here (a real OS
 * save/open dialog cannot be driven by this harness -- confirmed: no
 * existing test in this package drives the pre-existing, identically-
 * shaped Archive file-picker buttons live either); those two are covered
 * by `fedos_disaster_recovery_ui_track1_structural_guards.test.ts` instead.
 * This test exercises the paste-based path, which needs no native dialog.
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath);
const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log("fedos_disaster_recovery_ui_track1_restore_renderer: SKIPPED -- real pkg/ WASM artifact, electron.exe, or dist/ build output is absent.");
}

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-recovery-ui-track1-${label}-`));
  tmpRoots.push(dir);
  return dir;
}
afterAll(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

// ---------------------------------------------------------------------
// Acceptance-mode runner (Machine A) -- verbatim pattern from
// `fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`, used
// ONLY to obtain a real exported bundle's base64 bytes to paste on
// Machine B below.
// ---------------------------------------------------------------------

interface AcceptanceStep {
  readonly command: string;
  readonly result: Record<string, unknown>;
}
interface AcceptanceRun {
  readonly output: string;
  readonly steps: readonly AcceptanceStep[];
}

async function runBetaAcceptance(dataDir: string, script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }>): Promise<AcceptanceRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance",
      FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 60000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: AcceptanceStep[] = [];
  for (const line of output.split("\n")) {
    const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    const command = rest.slice(firstColon + 1, secondColon);
    const resultJson = rest.slice(secondColon + 1);
    steps.push({ command, result: JSON.parse(resultJson) as Record<string, unknown> });
  }
  return { output, steps };
}

function stepFor(run: AcceptanceRun, command: string): Record<string, unknown> {
  const step = run.steps.find((s) => s.command === command);
  expect(step, `${run.output}\n--- expected a "${command}" step ---`).toBeDefined();
  return step!.result;
}

// ---------------------------------------------------------------------
// ui-script runner (Machine B) -- verbatim pattern from
// `fedos_tor_security_ui_renderer.test.ts`.
// ---------------------------------------------------------------------

type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" }
  | { readonly action: "wait"; readonly ms: number };

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}
interface UiRun {
  readonly output: string;
  readonly steps: readonly UiStepResult[];
}

async function runBetaUiScript(dataDir: string, script: readonly UiStep[]): Promise<UiRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
      FEDOS_BETA_UI_SCRIPT: JSON.stringify(script),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 60000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: UiStepResult[] = [];
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const parsed = JSON.parse(line.slice(marker.length)) as UiStepResult;
    steps.push(parsed);
  }
  return { output, steps };
}

/** Reads the Nth `"read"` step result for a given selector -- occurrence-based (never positional index) because this script deliberately reads the SAME selector more than once (e.g. `#restore-result-headline` after the wrong-passphrase attempt, then again after the correct one). */
function readTextAt(run: UiRun, selector: string, occurrence = 0): string {
  const matches = run.steps.filter((s) => s.action === "read" && s.selector === selector);
  const step = matches[occurrence];
  expect(step, `${run.output}\n--- expected "read" step #${occurrence} for ${selector} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

realSuite("Disaster Recovery Product Closure arc, Track 1 (Recovery UI) -- REAL rendered Welcome/Restore screen, driven only through visible DOM controls", () => {
  it(
    "inspect-before-restore plan preview, wrong-passphrase vs malformed-bundle copy distinction, and the fresh-device disclosure + real per-asset outcomes after a genuine successful restore",
    async () => {
      // ---- Machine A: create a real profile, export a real bundle (acceptance mode, exactly like the pre-existing IPC test). ----
      const machineADir = makeTmpRoot("machine-a");
      const passphrase = "correct horse battery staple track1 recovery ui renderer";
      const aRun = await runBetaAcceptance(machineADir, [
        { command: "profile-create", payload: { label: "Track1Renderer", secret: passphrase } },
        { command: "profile-recovery-export" },
      ]);
      const aExport = stepFor(aRun, "profile-recovery-export");
      expect(aExport.outcome, aRun.output).toBe("ok");
      const bundleBase64 = aExport.bundleBase64 as string;
      expect(typeof bundleBase64).toBe("string");
      expect(bundleBase64.length).toBeGreaterThan(0);

      // ---- Machine B: drive the REAL Welcome -> Restore screen. ----
      const machineBDir = makeTmpRoot("machine-b");
      const run = await runBetaUiScript(machineBDir, [
        { action: "wait", ms: 300 },
        { action: "click", selector: "#welcome-restore-btn" },
        { action: "wait", ms: 150 },

        // 1. A MALFORMED bundle -- inspect must refuse it BEFORE any passphrase is asked for, with copy distinct from a wrong-passphrase failure.
        { action: "fill", selector: "#restore-bundle-paste", value: "this is not a real fedos recovery bundle at all" },
        { action: "click", selector: "#restore-paste-use-btn" },
        { action: "click", selector: "#restore-inspect-btn" },
        { action: "wait", ms: 300 },
        { action: "read", selector: "#restore-inspect-error" },
        { action: "read", selector: "#restore-passphrase", as: "value" },

        // 2. The REAL bundle -- inspect must show a real plan preview, with NO mutation and NO passphrase yet.
        { action: "fill", selector: "#restore-bundle-paste", value: bundleBase64 },
        { action: "click", selector: "#restore-paste-use-btn" },
        { action: "click", selector: "#restore-inspect-btn" },
        { action: "wait", ms: 300 },
        { action: "read", selector: "#restore-plan-summary" },
        { action: "read", selector: "#restore-plan-staleness" },

        // 3. WRONG passphrase against the REAL bundle -- must fail with wrong-passphrase copy, inviting a retry with the SAME file.
        { action: "fill", selector: "#restore-passphrase", value: "the wrong passphrase entirely" },
        { action: "click", selector: "#restore-submit-btn" },
        { action: "wait", ms: 500 },
        { action: "read", selector: "#restore-result-headline" },
        { action: "read", selector: "#restore-result-detail" },

        // 4. The CORRECT passphrase against the SAME bundle -- must now succeed for real.
        { action: "fill", selector: "#restore-passphrase", value: passphrase },
        { action: "click", selector: "#restore-submit-btn" },
        { action: "wait", ms: 800 },
        { action: "read", selector: "#restore-result-headline" },
        { action: "read", selector: "#restore-fresh-device-disclosure" },
        { action: "read", selector: "#restore-assets-list" },
        { action: "read", selector: "#current-screen" },
      ]);

      // -- 1. Malformed bundle: inspect refuses it, no passphrase was ever accepted/required at that point. --
      const malformedInspectError = readTextAt(run, "#restore-inspect-error", 0);
      expect(malformedInspectError, run.output).toMatch(/not a valid FedOS Recovery Bundle|corrupted/);
      expect(readTextAt(run, "#restore-passphrase", 0), "the passphrase field must still be empty/disabled after a failed inspect").toBe("");

      // -- 2. Real bundle: a genuine plan preview appeared, distinct from the malformed-bundle error text. --
      const planSummary = readTextAt(run, "#restore-plan-summary", 0);
      expect(planSummary, run.output).toMatch(/account identity/);
      const stalenessWarning = readTextAt(run, "#restore-plan-staleness", 0);
      expect(stalenessWarning.length, run.output).toBeGreaterThan(0);

      // -- 3. Wrong passphrase: distinct copy from the malformed-bundle copy above, inviting a SAME-file retry. --
      const wrongPassHeadline = readTextAt(run, "#restore-result-headline", 0);
      const wrongPassDetail = readTextAt(run, "#restore-result-detail", 0);
      expect(wrongPassHeadline, run.output).toBe("Wrong passphrase.");
      expect(wrongPassHeadline).not.toBe(malformedInspectError);
      expect(wrongPassDetail.toLowerCase(), run.output).toMatch(/same bundle file/);

      // -- 4. Correct passphrase: a genuine successful restore. --
      const successHeadline = readTextAt(run, "#restore-result-headline", 1);
      expect(successHeadline, run.output).toBe("Restore complete.");
      expect(successHeadline).not.toBe(wrongPassHeadline);

      // The fresh-device / re-establishment disclosure is REALLY visible (not merely present-but-hidden) after this real success.
      const disclosure = readTextAt(run, "#restore-fresh-device-disclosure", 0);
      expect(disclosure.toLowerCase(), run.output).toMatch(/ratchet/);
      expect(disclosure.toLowerCase(), run.output).toMatch(/re-establish/);
      expect(disclosure.toLowerCase(), run.output).toMatch(/trust/);

      // The REAL per-asset outcome list the backend returned is actually rendered.
      const assetsListText = readTextAt(run, "#restore-assets-list", 0);
      expect(assetsListText.length, run.output).toBeGreaterThan(0);
      expect(assetsListText, run.output).toMatch(/profile-descriptor/);
      expect(assetsListText, run.output).toMatch(/Recovered/);
      // The excluded-by-design fields (Direct Ratchet/Device Registry) are
      // always reported as "re-establishes on its own", never silently
      // omitted from the list.
      expect(assetsListText, run.output).toMatch(/re-establishes on its own/);

      // The renderer never auto-jumped away from the Restore screen on success -- the user is still looking at the outcome they need to read.
      expect(readTextAt(run, "#current-screen", 0), run.output).toBe("restore-bundle");
    },
    120000,
  );
});

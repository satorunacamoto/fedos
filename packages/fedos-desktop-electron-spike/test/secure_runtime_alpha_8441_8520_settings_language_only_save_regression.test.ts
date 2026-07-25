import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 8441-8520 (FedOS Public Beta Governance, Audit
 * Handoff, and Final Technical Closure Arc) — Phase I focused regression
 * test for a real, previously-undiscovered display bug found by an
 * independent Go/No-Go revalidation review (commit `d6cb95d0`, "FedOS
 * Public Beta Go/No-Go Validation v2") and confirmed here by direct
 * source reading before being fixed:
 *
 * `FedosDesktopSettingsApplicationCoordinator` returns outcome
 * `"persisted-but-blocked"` (`fedos_desktop_settings_application_coordinator.ts:333`)
 * when a save touches ONLY a field with no accepted application boundary
 * (today: `language`, `autoStart`, `autoLockTimeoutMinutes`). The real
 * shipped renderer's own `onSettingsSave()` had no branch for this
 * outcome, so it fell to the generic `describeOutcome(report.outcome)`
 * error branch — showing "Something went wrong. Please try again." for a
 * save that genuinely SUCCEEDED. A prior Arc (Alpha 8361-8440, `bc8482d2`,
 * reconciled into this Arc's own branch at Phase A) attempted to fix
 * exactly this bug but only added its `languageNote` text inside the TWO
 * SUCCESS branches — never reaching the actual branch this specific
 * outcome hits — so the bug survived that fix. This test drives the real
 * rendered Settings screen through a real click, exactly the way a pilot
 * user would trigger it, and proves the fix (a new, dedicated
 * `"persisted-but-blocked"` branch) actually closes it.
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath);
const realSuite = CAN_RUN_REAL ? describe : describe.skip;

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-8441-lang-${label}-`));
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

type UiStep = { readonly action: "fill" | "click" | "read"; readonly selector: string; readonly value?: string; readonly as?: "text" | "value" } | { readonly action: "wait"; readonly ms: number };

interface UiStepResult {
  readonly index: number;
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
    env: { ...process.env, FEDOS_ELECTRON_BETA_DATA_DIR: dataDir, FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script", FEDOS_BETA_UI_SCRIPT: JSON.stringify(script) },
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
    steps.push(JSON.parse(line.slice(marker.length)));
  }
  return { output, steps };
}

function readAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

realSuite("Alpha 8441-8520 -- Settings language-only save no longer shows a false error", () => {
  it(
    "saving ONLY a non-English language preference shows a real success message, never 'Something went wrong'",
    async () => {
      const dir = makeTmpRoot("main");
      const run = await runBetaUiScript(dir, [
        { action: "wait", ms: 300 },
        { action: "fill", selector: "#create-label", value: "Alice" },
        { action: "fill", selector: "#create-pass", value: "correct horse battery staple 8441 lang" },
        { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple 8441 lang" },
        { action: "click", selector: "#create-submit" },
        { action: "wait", ms: 700 },
        { action: "click", selector: "#nav-settings" },
        { action: "wait", ms: 300 },
        // Touch ONLY the language field -- theme/relay/notifications/sync stay at their real defaults, so this is a genuine language-only save.
        { action: "fill", selector: "#settings-language", value: "ja" },
        { action: "click", selector: "#settings-save" },
        { action: "wait", ms: 500 },
        { action: "read", selector: "#settings-report" }, // 11
        { action: "read", selector: "#settings-error" }, // 12
      ]);

      const reportText = readAt(run, 11);
      const errorText = readAt(run, 12);
      expect(errorText).toBe(""); // the old bug wrote here: "Something went wrong. Please try again."
      expect(reportText).toContain("Saved");
      expect(reportText).not.toMatch(/something went wrong/i);
      expect(reportText).toMatch(/no part of this Beta currently reads or applies it yet/i);
    },
    30000,
  );
});

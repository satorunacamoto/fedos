import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent S) — Task 1: old-key continuity auto-accept VISIBILITY recovery.
 *
 * Two layers, matching this package's own established conventions:
 *
 * 1. Structural guards (always run, no build artifact required) — direct
 *    source inspection proving the shipping renderer
 *    (`fedos_electron_beta_renderer.ts`) actually wires the new
 *    `silentlyAutoAcceptedWithoutAsking` field into real, visible DOM
 *    output, mirrors `secure_runtime_alpha_8041_8120_structural_guards.test.ts`'s
 *    own "prove by source inspection, never narrative claim alone" style.
 *
 * 2. A REAL, VISIBLE-CONTROL Electron DOM acceptance test
 *    (`AUTOTEST_MODE=ui-script`), mirroring
 *    `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`
 *    and `secure_runtime_alpha_8201_8280_device_pairing_visible_control.test.ts`.
 *    Deliberately scoped to what a SINGLE fresh profile can prove without a
 *    live Relay or a second party: the new Safety Center STANDING warning
 *    (`identity-replacement-old-key-continuity-is-auto-accepted-by-default`)
 *    is always shown, regardless of whether any transition has ever
 *    happened -- so this proves the real shipping renderer really renders
 *    Task 1's new disclosure text, through the real DOM, the real preload
 *    bridge, and the real IPC channel, without needing a full two-party
 *    identity-replacement scenario (that scenario IS covered, at the
 *    Boundary/Renderer level with real crypto, by
 *    `test/fedos_commerce_media_sync_security_recovery_agent_s_task1_identity_transition_silent_autoaccept_visibility.test.ts`
 *    in the repo root `test/` directory).
 *    Skips itself with a clear message if the real `pkg/` artifact or the
 *    real Electron binary are absent (mirrors this package's own established
 *    convention -- these are NOT flaky skips, they are honest build-state
 *    facts; see `project_worktree_missing_wasm_artifact` precedent).
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const RENDERER_PATH = `${packageDir}/src/fedos_electron_beta_renderer.ts`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const REAL_ARTIFACT_PRESENT = existsSync(pkgWasmPath);
const ELECTRON_PRESENT = existsSync(electronBinPath);
const CAN_RUN_REAL = REAL_ARTIFACT_PRESENT && ELECTRON_PRESENT && existsSync(mainCjsPath);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Task 1 -- structural guards: the shipping renderer really wires the auto-accept visibility fix", () => {
  const source = stripComments(readFileSync(RENDERER_PATH, "utf8"));

  it("the Identity Transition inbox list renders a distinct, real user-visible marker for a silently-auto-accepted item", () => {
    expect(source).toMatch(/silentlyAutoAcceptedWithoutAsking/);
    expect(source).toMatch(/accepted automatically, you were not asked/);
  });

  it("the Identity Transition detail screen renders a dedicated, honest warning paragraph for the same fact", () => {
    expect(source).toMatch(/identity-transition-auto-accepted-warning/);
    expect(source).toMatch(/nobody was asked to confirm it first/);
  });

  it("the Safety Center screen (already real DOM, `#safety-sections`) needs NO renderer change -- it already renders every section's `reason` and every standing warning's `text` verbatim, which is how Task 1's new identity-section reason and new standing warning reach the screen", () => {
    // Guards against a future refactor silently dropping either loop --
    // if this ever fails, Task 1's Safety Center surfacing requires a
    // renderer change it does not have today.
    expect(source).toMatch(/byId\("safety-sections"\)/);
    expect(source).toMatch(/overview\.summary\.sections/);
    expect(source).toMatch(/overview\.standingWarnings/);
  });
});

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-task1-autoaccept-${label}-`));
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

type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string }
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
      FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS: "50",
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
    steps.push(JSON.parse(line.slice(marker.length)) as UiStepResult);
  }
  return { output, steps };
}

function readAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Task 1 -- REAL Electron DOM: Safety Center discloses the auto-accept default policy through the real shipping renderer", () => {
  it("a fresh profile's real Safety Center screen shows the new standing disclosure, through real DOM -> real preload -> real IPC -> real Shell/Controller", async () => {
    const dataDir = makeTmpRoot("solo");
    const run = await runBetaUiScript(dataDir, [
      { action: "wait", ms: 300 },
      { action: "fill", selector: "#create-label", value: "SoloTask1" },
      { action: "fill", selector: "#create-pass", value: "correct horse battery staple task1 solo" },
      { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple task1 solo" },
      { action: "click", selector: "#create-submit" },
      { action: "wait", ms: 700 },
      { action: "read", selector: "#current-screen" },
      { action: "click", selector: "#nav-safety" },
      { action: "wait", ms: 1200 },
      { action: "read", selector: "#safety-sections" },
    ]);
    expect(readAt(run, 6)).toBe("ready");
    const safetyText = readAt(run, 9);
    // The section itself, honestly shown (a fresh profile has no
    // transitions, so "ready" is the truthful state).
    expect(safetyText).toMatch(/identity-replacement/);
    // Task 1's own new STANDING warning -- shown unconditionally, never
    // gated on a transition actually existing.
    expect(safetyText).toMatch(/accepts an identity replacement signed with a contact's previous key without asking you first/);
  });
});

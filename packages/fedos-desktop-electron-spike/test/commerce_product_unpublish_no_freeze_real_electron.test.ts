/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (post-final-report
 * follow-up fix) — the LIVE regression test for the real, reproducible,
 * app-freezing Unpublish bug an independent usability run found on the
 * packaged Beta app.
 *
 * THE BUG: `onCommercePublishAction()` confirmed an unpublish with
 * `window.confirm()`. A native JS dialog suspends the renderer's ENTIRE JS
 * main thread for as long as it is open, so the app stopped responding to
 * anything at all — reproduced live three times against `2a21ef17` in
 * production mode on a fresh profile, where a bare
 * `Runtime.evaluate("1+1")` over CDP never returned inside a 100s budget
 * while the browser process answered normally, and the unpublish itself
 * never committed (the product was still `"active"` after a force-kill).
 * `armDevicePairingApproveConfirm()` in the renderer had already
 * documented this exact hazard for Device Pairing (Secure Runtime Alpha
 * 8201-8280); the fix generalises that same "real inline confirmation,
 * never a native dialog" posture into one shared `confirmInPage()` helper.
 *
 * WHY THIS TEST CATCHES IT: every action in the `AUTOTEST_MODE=ui-script`
 * harness is a `webContents.executeJavaScript()` round-trip into the
 * renderer. With the bug present, the Unpublish click's own step NEVER
 * resolves — the run stalls until the harness's kill timer fires and no
 * step marker after that click is ever emitted, so every assertion below
 * that point fails loudly with the full captured output. It is therefore a
 * genuine freeze detector, not merely a check that the button works.
 *
 * The structural half of the guard (no `window.confirm(`/`alert(`/
 * `prompt(` anywhere in the renderer, plus the dialog markup) lives in
 * `commerce_real_two_party_ux_p0_p1_closure_agent_s_structural_guards.test.ts`
 * items 15/15b/15c and runs in any environment; this file proves the real
 * behaviour end-to-end in a real Electron process.
 *
 * Skips itself with a clear message if the real `pkg/` WASM artifact, its
 * manifest, the compiled root `dist/` graph, or the real Electron binary
 * are absent — mirrors every other real-launch test in this package.
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
const pkgManifestPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`;
const commerceDistPath = `${repoRoot}/dist/os/commerce/index.js`;

const CAN_RUN_REAL =
  existsSync(pkgWasmPath) &&
  existsSync(pkgManifestPath) &&
  existsSync(electronBinPath) &&
  existsSync(mainCjsPath) &&
  existsSync(commerceDistPath);

const tmpRoots: string[] = [];
afterAll(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}

async function runBetaUiScript(dataDir: string, script: readonly Record<string, unknown>[]): Promise<{ output: string; steps: UiStepResult[] }> {
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
  }, 120000);
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

function readAt(run: { output: string; steps: UiStepResult[] }, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(
    step,
    `${run.output}\n--- expected a UI step at index ${index}; its ABSENCE after the Unpublish click is exactly what the renderer-freeze bug looks like (the click's executeJavaScript round-trip never returns) ---`,
  ).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

const NORTHLIGHT_MERCHANT = "a".repeat(64);
const ROW = "#commerce-merchant-products-list li:last-child";

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_product_unpublish_no_freeze_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce, or the real Electron binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite("Unpublish a live listing -- REAL Beta Electron process, driven only through visible DOM controls, must never freeze the renderer", () => {
  it(
    "Unpublish opens a real in-page confirmation (the app keeps running), Cancel leaves the listing active, Confirm really archives it, and the listing can be published again afterwards",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-unpublish-no-freeze-"));
      tmpRoots.push(dataDir);
      const run = await runBetaUiScript(dataDir, [
        { action: "wait", ms: 400 }, // 0
        { action: "fill", selector: "#create-label", value: "Unpublish Freeze Regression Profile" }, // 1
        { action: "fill", selector: "#create-pass", value: "unpublish freeze regression passphrase" }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: "unpublish freeze regression passphrase" }, // 3
        { action: "click", selector: "#create-submit" }, // 4
        { action: "wait", ms: 3000 }, // 5 -- real Argon2 unlock + real WASM master seed generation
        { action: "read", selector: "#current-screen" }, // 6 -- expect "ready"

        { action: "click", selector: "#nav-commerce-merchant" }, // 7
        { action: "wait", ms: 400 }, // 8
        { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 9
        { action: "wait", ms: 300 }, // 10
        { action: "fill", selector: "#commerce-merchant-create-title", value: "Unpublish Freeze Regression" }, // 11
        { action: "fill", selector: "#commerce-merchant-create-description", value: "A live listing that must be unpublishable without freezing the app." }, // 12
        { action: "fill", selector: "#commerce-merchant-create-price", value: "9.50" }, // 13
        { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 14
        { action: "click", selector: "#commerce-merchant-create-submit" }, // 15
        { action: "wait", ms: 900 }, // 16

        { action: "click", selector: `${ROW} button.commerce-btn-publish` }, // 17
        { action: "wait", ms: 1500 }, // 18
        { action: "read", selector: ROW }, // 19 -- expect "— active"

        // ---- THE REGRESSION POINT: with window.confirm() present, this
        // click's own executeJavaScript round-trip NEVER returns and every
        // step below is simply never emitted. ----
        { action: "click", selector: `${ROW} button.commerce-btn-unpublish` }, // 20
        { action: "wait", ms: 700 }, // 21
        { action: "read", selector: "#app-confirm-body" }, // 22 -- the real in-page dialog is open, and the page is still executing
        { action: "read", selector: ROW }, // 23 -- still active: nothing commits before the user answers

        { action: "click", selector: "#app-confirm-cancel" }, // 24
        { action: "wait", ms: 900 }, // 25
        { action: "read", selector: ROW }, // 26 -- STILL active: Cancel really cancels

        { action: "click", selector: `${ROW} button.commerce-btn-unpublish` }, // 27
        { action: "wait", ms: 500 }, // 28
        { action: "click", selector: "#app-confirm-accept" }, // 29
        { action: "wait", ms: 2000 }, // 30
        { action: "read", selector: ROW }, // 31 -- expect "— archived"
        { action: "read", selector: "#commerce-merchant-products-error" }, // 32 -- expect ""

        { action: "click", selector: `${ROW} button.commerce-btn-publish` }, // 33
        { action: "wait", ms: 1800 }, // 34
        { action: "read", selector: ROW }, // 35 -- expect "— active" again
        { action: "read", selector: "#current-screen" }, // 36 -- the app is still alive at the very end
      ]);

      expect(readAt(run, 6)).toBe("ready");
      expect(readAt(run, 19)).toContain("Unpublish Freeze Regression — active");

      // The confirmation really opened, in the page, with the real copy --
      // and the renderer answered the very next scripted step, which the
      // frozen build could not do at all.
      expect(readAt(run, 22), run.output).toContain("stop appearing in the Shop catalog");
      expect(readAt(run, 23)).toContain("— active");

      // Cancel is a real cancel, not a delayed unpublish.
      expect(readAt(run, 26)).toContain("— active");

      // Confirm really commits the unpublish.
      expect(readAt(run, 31), run.output).toContain("Unpublish Freeze Regression — archived");
      expect(readAt(run, 32), run.output).toBe("");

      // ...and the seller can put it back up afterwards.
      expect(readAt(run, 35), run.output).toContain("Unpublish Freeze Regression — active");
      expect(readAt(run, 36)).toBe("ready");
    },
    150000,
  );
});

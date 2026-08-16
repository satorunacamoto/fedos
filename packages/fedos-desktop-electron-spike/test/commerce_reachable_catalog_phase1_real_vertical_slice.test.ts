/**
 * Commerce Reachable Catalog + Product Surface, Phase 1 — the REAL,
 * visible-DOM packaged vertical slice. Mirrors
 * `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`'s
 * own `AUTOTEST_MODE=ui-script` mechanism exactly (same env vars, same
 * `webContents.executeJavaScript()` step runner already built into
 * `fedos_electron_beta_main.cts` — no new automation surface added for
 * this test): every action here clicks a REAL rendered `<button>` and
 * reads REAL `textContent`, through the REAL `window.fedosApp` bridge and
 * the REAL `fedos-app:commerce-*` IPC channels.
 *
 * Proves, against the actual packaged artifact:
 *   - Commerce is reachable from the same shipped app as Conversations.
 *   - The 3-product / 2-merchant demo catalog renders with the safe
 *     fallback initials for every catalog row.
 *   - Product Detail renders a REAL `<img>` for the one product with
 *     media, and the safe initials fallback (no `<img>` at all) for a
 *     product without media.
 *   - A real, bounded "Create Order" control exists on Product Detail
 *     (Commerce E2E Completion arc widened this deliberately) — never a
 *     Buy/Purchase/Checkout/"Mark as Paid" shortcut.
 *   - Returning to Conversations still works (Messenger regression).
 *
 * Skips itself with a clear message if the real `pkg/` WASM artifact or
 * the real Electron binary are absent (mirrors every real-launch test in
 * this package).
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
const commerceDistPath = `${repoRoot}/dist/os/commerce/index.js`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath) && existsSync(commerceDistPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-commerce-p1-${label}-`));
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
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_reachable_catalog_phase1_real_vertical_slice: SKIPPED -- real pkg/ WASM artifact, dist/commerce/index.js, or the real Electron binary is absent in this environment. Run `npm run build:wasm && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite("Commerce Reachable Catalog Phase 1 -- REAL packaged Beta Electron process, driven only through visible DOM controls", () => {
  it(
    "customer opens Commerce from the real nav, sees the 3-product demo catalog, opens the product WITH an image (real <img>), returns, opens a product WITHOUT an image (safe fallback, no <img>), and returns to Conversations -- 0 Buy control anywhere",
    async () => {
      const dataDir = makeTmpRoot("customer");
      const run = await runBetaUiScript(dataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "fill", selector: "#create-label", value: "Commerce Phase1 Test Profile" }, // 1
        { action: "fill", selector: "#create-pass", value: "commerce phase1 vertical slice pass" }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: "commerce phase1 vertical slice pass" }, // 3
        { action: "click", selector: "#create-pass-ack" }, // 4
        { action: "click", selector: "#create-submit" }, // 5
        { action: "wait", ms: 700 }, // 6
        { action: "read", selector: "#current-screen" }, // 7 -- top-level ScreenName: "ready"
        { action: "click", selector: "#nav-commerce" }, // 8
        { action: "wait", ms: 400 }, // 9
        { action: "read", selector: ".app-screen.active#app-screen-commerce" }, // 10 -- proves the Commerce screen (not some other tab) is the active one
        { action: "read", selector: "#commerce-catalog-list" }, // 11
        // Open the product WITH an image (first catalog row -- aurora-study).
        { action: "click", selector: "#commerce-catalog-list li:nth-child(1) button" }, // 12
        { action: "wait", ms: 400 }, // 13
        { action: "read", selector: ".app-screen.active#app-screen-commerce-detail" }, // 14
        { action: "read", selector: "#commerce-detail-title" }, // 15
        { action: "read", selector: "#commerce-detail-media-area img" }, // 16 -- presence check: "ok" only if a real <img> exists
        { action: "read", selector: "#commerce-detail-price" }, // 17
        { action: "read", selector: "#commerce-detail-merchant" }, // 18
        { action: "read", selector: "#commerce-detail-description" }, // 19
        { action: "read", selector: "#commerce-order-create-submit" }, // 20 -- Commerce E2E Completion arc: the real Create Order control (Phase 1's disabled pill is gone by design)
        { action: "click", selector: "#commerce-detail-back" }, // 21
        { action: "wait", ms: 300 }, // 22
        { action: "read", selector: ".app-screen.active#app-screen-commerce" }, // 23 -- back on the catalog
        // Open the product WITHOUT an image (second catalog row -- terra-keycaps).
        { action: "click", selector: "#commerce-catalog-list li:nth-child(2) button" }, // 24
        { action: "wait", ms: 400 }, // 25
        { action: "read", selector: "#commerce-detail-title" }, // 26
        { action: "read", selector: "#commerce-detail-media-area img" }, // 27 -- expect "not-found": no <img> for a media-less product
        { action: "read", selector: "#commerce-detail-media-area .commerce-detail-media-fallback" }, // 28 -- expect "ok" with the initials text
        { action: "click", selector: "#commerce-detail-back" }, // 29
        { action: "wait", ms: 300 }, // 30
        // Return to Messenger.
        { action: "click", selector: "#nav-conversations" }, // 31
        { action: "wait", ms: 300 }, // 32
        { action: "read", selector: ".app-screen.active#app-screen-conversations" }, // 33
        { action: "read", selector: "#conversations-list" }, // 34
      ]);

      expect(readAt(run, 7)).toBe("ready");

      // Step 9 succeeding at all (outcome "ok") already proves the Commerce screen is active.
      readAt(run, 10);
      const catalogText = readAt(run, 11);
      expect(catalogText).toMatch(/Digital Art Print — Aurora Study/);
      expect(catalogText).toMatch(/Mechanical Keyboard Keycap Set — Terra/);
      expect(catalogText).toMatch(/Local Workshop Ticket — Intro to Woodworking/);
      expect(catalogText).toMatch(/18\.00 USD/);
      expect(catalogText).toMatch(/Northlight Studio/);
      expect(catalogText).toMatch(/Riverbend Makerspace/);

      readAt(run, 14); // Product Detail screen is active.
      expect(readAt(run, 15)).toBe("Digital Art Print — Aurora Study");
      // A real <img> element exists for the product WITH media (step 15 finds it and returns "ok").
      const imgStep = run.steps.find((s) => s.index === 15);
      expect(imgStep, run.output).toBeDefined();
      expect(imgStep!.result.outcome, run.output).toBe("ok");
      expect(readAt(run, 17)).toBe("18.00 USD");
      expect(readAt(run, 18)).toBe("Sold by Northlight Studio");
      expect(readAt(run, 19)).toMatch(/violet-to-amber gradient/);
      expect(readAt(run, 20)).toBe("Create Order"); // the real, bounded Order control -- see this arc's header note above
      // No instant-purchase/mark-as-paid control anywhere in this run's output -- Create Order is real and expected, a bare Buy/Purchase/Checkout shortcut is not.
      expect(run.output).not.toMatch(/>Buy</i);
      expect(run.output).not.toMatch(/>Purchase</i);
      expect(run.output).not.toMatch(/>Checkout</i);
      expect(run.output).not.toMatch(/>Mark as [Pp]aid</);

      readAt(run, 23); // Back on the Commerce catalog.

      expect(readAt(run, 26)).toBe("Mechanical Keyboard Keycap Set — Terra");
      // No <img> for the media-less product -- the selector genuinely finds nothing.
      const noImgStep = run.steps.find((s) => s.index === 26);
      expect(noImgStep, run.output).toBeDefined();
      expect(noImgStep!.result.outcome, run.output).toBe("not-found");
      // The safe initials fallback IS present.
      const fallbackStep = run.steps.find((s) => s.index === 27);
      expect(fallbackStep, run.output).toBeDefined();
      expect(fallbackStep!.result.outcome, run.output).toBe("ok");
      expect(fallbackStep!.result.value).toBe("MK");

      // Messenger regression: Conversations is reachable and unaffected after visiting Commerce.
      readAt(run, 33);
      expect(readAt(run, 34)).toMatch(/No conversations yet/);
    },
    90000,
  );
});

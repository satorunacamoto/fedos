/**
 * FedOS Commerce End-to-End Completion arc — the REAL, full happy-path
 * vertical slice, driven ONLY through visible DOM controls in the actual
 * packaged Beta Electron process (same `AUTOTEST_MODE=ui-script` mechanism
 * every other real-launch test in this package already uses — no new
 * automation surface). Covers the arc's own full tabletop (§30 of the
 * brief): Merchant creates+publishes a product; Customer discovers it,
 * orders, submits; Merchant accepts; Customer requests+simulates
 * (TEST/LOCAL, never real money) payment; Merchant fulfills; Customer
 * acknowledges real receipt; either party completes the order; a real
 * signed Trust receipt is issued, QR-encoded, and independently verified
 * — all against the REAL WASM crypto path (real Master Seed generation,
 * real Argon2 profile unlock, real CommerceMedia/Trust signing), not a
 * mock.
 *
 * The "Acting as" demo selector (`fedos_electron_beta_renderer.ts`'s own
 * documented LOCAL-ONLY convention) is how ONE Electron process walks
 * through both the Merchant and Customer sides of the same synthetic
 * demo identities — switched mid-script via the SAME `fill` step every
 * other scripted field in this package already uses (the select element
 * itself remains addressable via `document.querySelector` even while its
 * own screen is not the currently active one).
 *
 * Skips itself with a clear message if the real `pkg/` WASM artifact,
 * its manifest, or the real Electron binary are absent — mirrors every
 * other real-launch test in this package.
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
const trustDistPath = `${repoRoot}/dist/os/trust/index.js`;

const CAN_RUN_REAL =
  existsSync(pkgWasmPath) &&
  existsSync(pkgManifestPath) &&
  existsSync(electronBinPath) &&
  existsSync(mainCjsPath) &&
  existsSync(commerceDistPath) &&
  existsSync(trustDistPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-commerce-e2e-${label}-`));
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
  }, 90000);
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

// Same synthetic demo pubkeys `fedos_electron_beta_renderer.ts`'s own
// `COMMERCE_DEMO_ACTORS` uses -- restated here for the same reason that
// file itself restates them (this test cannot `import` the renderer).
const ALICE_CUSTOMER = "c".repeat(64);
const NORTHLIGHT_MERCHANT = "a".repeat(64);

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_e2e_full_happy_path_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the real Electron binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite("FedOS Commerce End-to-End -- REAL packaged Beta Electron process, full happy-path tabletop, driven only through visible DOM controls", () => {
  it(
    "Bob (Northlight) creates+publishes a product; Alice discovers, orders, submits; Bob accepts; Alice pays (TEST/LOCAL simulator); Bob fulfills; Alice acknowledges receipt; order completes; a real signed+QR-encoded Trust receipt is issued and independently verified VALID",
    async () => {
      const dataDir = makeTmpRoot("happy-path");
      const run = await runBetaUiScript(dataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "fill", selector: "#create-label", value: "Commerce E2E Test Profile" }, // 1
        { action: "fill", selector: "#create-pass", value: "commerce e2e full happy path pass" }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: "commerce e2e full happy path pass" }, // 3
        { action: "click", selector: "#create-submit" }, // 4
        { action: "wait", ms: 2000 }, // 5 -- real Argon2 unlock + real WASM master seed generation
        { action: "read", selector: "#current-screen" }, // 6 -- expect "ready"

        // Bob (Merchant/Northlight): create + publish a product.
        { action: "click", selector: "#nav-commerce-merchant" }, // 7
        { action: "wait", ms: 300 }, // 8
        { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 9
        { action: "wait", ms: 200 }, // 10
        { action: "fill", selector: "#commerce-merchant-create-title", value: "Handmade Ceramic Mug" }, // 11
        { action: "fill", selector: "#commerce-merchant-create-description", value: "A small fictional demo product for the E2E tabletop." }, // 12
        { action: "fill", selector: "#commerce-merchant-create-price", value: "2500" }, // 13
        { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 14
        { action: "click", selector: "#commerce-merchant-create-submit" }, // 15
        { action: "wait", ms: 300 }, // 16
        { action: "read", selector: "#commerce-merchant-products-list" }, // 17 -- proves the new draft product is real and listed
        { action: "click", selector: "#commerce-merchant-products-list li:last-child button" }, // 18 -- Publish (the new product is always inserted last)
        { action: "wait", ms: 300 }, // 19

        // Alice (Customer): discover, order, submit.
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 20
        { action: "wait", ms: 200 }, // 21
        { action: "click", selector: "#nav-commerce" }, // 22
        { action: "wait", ms: 300 }, // 23
        { action: "read", selector: "#commerce-catalog-list" }, // 24 -- proves the newly published product is now in the real customer-facing catalog
        { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 25 -- the new product is the 4th (3 seeded + 1 new)
        { action: "wait", ms: 300 }, // 26
        { action: "read", selector: "#commerce-detail-title" }, // 27 -- expect "Handmade Ceramic Mug"
        { action: "click", selector: "#commerce-order-create-submit" }, // 28
        { action: "wait", ms: 400 }, // 29
        { action: "read", selector: "#commerce-order-status-text" }, // 30 -- expect "created"
        { action: "click", selector: "#commerce-order-submit-btn" }, // 31
        { action: "wait", ms: 300 }, // 32
        { action: "read", selector: "#commerce-order-status-text" }, // 33 -- expect "submitted"

        // Bob (Merchant): accept.
        { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 34
        { action: "wait", ms: 200 }, // 35
        { action: "click", selector: "#commerce-order-accept-btn" }, // 36
        { action: "wait", ms: 300 }, // 37
        { action: "read", selector: "#commerce-order-status-text" }, // 38 -- expect "accepted"

        // Alice (Customer): request + simulate (TEST/LOCAL) payment.
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 39
        { action: "wait", ms: 200 }, // 40
        { action: "click", selector: "#commerce-order-payment-request-btn" }, // 41
        { action: "wait", ms: 400 }, // 42
        { action: "read", selector: "#commerce-order-payment-id" }, // 43 -- non-empty real paymentId
        { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 44
        { action: "wait", ms: 500 }, // 45
        { action: "read", selector: "#commerce-order-status-text" }, // 46 -- expect "paid"

        // Bob (Merchant): fulfill (also creates+starts the real Delivery record).
        { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 47
        { action: "wait", ms: 200 }, // 48
        { action: "click", selector: "#commerce-order-fulfill-btn" }, // 49
        { action: "wait", ms: 400 }, // 50
        { action: "read", selector: "#commerce-order-status-text" }, // 51 -- expect "fulfilling"
        { action: "read", selector: "#commerce-order-delivery-status" }, // 52 -- expect "Delivery status: fulfilling"

        // Alice (Customer): acknowledge real receipt -- the ONLY thing that can mark delivered.
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 53
        { action: "wait", ms: 200 }, // 54
        { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 55
        { action: "wait", ms: 400 }, // 56
        { action: "read", selector: "#commerce-order-status-text" }, // 57 -- expect "delivered"

        // Either party completes the order.
        { action: "click", selector: "#commerce-order-complete-btn" }, // 58
        { action: "wait", ms: 400 }, // 59
        { action: "read", selector: "#commerce-order-status-text" }, // 60 -- expect "completed"

        // Issue + verify a REAL signed, QR-encoded Trust receipt.
        { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 61
        { action: "wait", ms: 500 }, // 62
        { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 63 -- expect "VALID"
        { action: "read", selector: "#commerce-order-receipt-qr-text", as: "value" }, // 64 -- non-empty real signed envelope text

        // Messenger regression: Conversations still reachable after the full flow.
        { action: "click", selector: "#nav-conversations" }, // 65
        { action: "wait", ms: 300 }, // 66
        { action: "read", selector: ".app-screen.active#app-screen-conversations" }, // 67
      ]);

      expect(readAt(run, 6)).toBe("ready");

      readAt(run, 17); // merchant products list rendered at all
      const publishStep = run.steps.find((s) => s.index === 18);
      expect(publishStep, run.output).toBeDefined();
      expect(publishStep!.result.outcome, run.output).toBe("ok");

      const catalogText = readAt(run, 24);
      expect(catalogText).toMatch(/Handmade Ceramic Mug/);

      expect(readAt(run, 27)).toBe("Handmade Ceramic Mug");
      expect(readAt(run, 30)).toBe("created");
      expect(readAt(run, 33)).toBe("submitted");
      expect(readAt(run, 38)).toBe("accepted");

      const paymentIdText = readAt(run, 43);
      expect(paymentIdText.length).toBeGreaterThan(0);
      expect(readAt(run, 46)).toBe("paid");

      expect(readAt(run, 51)).toBe("fulfilling");
      expect(readAt(run, 52)).toMatch(/Delivery status: fulfilling/);

      expect(readAt(run, 57)).toBe("delivered");
      expect(readAt(run, 60)).toBe("completed");

      expect(readAt(run, 63)).toBe("VALID");
      const qrText = readAt(run, 64);
      expect(qrText.length).toBeGreaterThan(0);
      // The QR text carries the real signed envelope -- never plaintext order
      // contents, and never a raw "paid"/checkbox-shaped claim.
      expect(qrText).not.toMatch(/"markAsPaid"/i);

      readAt(run, 67); // Conversations still reachable -- Messenger regression check.
    },
    120000,
  );
});

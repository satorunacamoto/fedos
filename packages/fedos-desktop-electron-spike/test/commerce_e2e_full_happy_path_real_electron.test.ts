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
        { action: "click", selector: "#create-pass-ack" }, // 4
        { action: "click", selector: "#create-submit" }, // 5
        { action: "wait", ms: 2000 }, // 6 -- real Argon2 unlock + real WASM master seed generation
        { action: "read", selector: "#current-screen" }, // 7 -- expect "ready"

        // Bob (Merchant/Northlight): create + publish a product.
        { action: "click", selector: "#nav-commerce-merchant" }, // 8
        { action: "wait", ms: 300 }, // 9
        { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 10
        { action: "wait", ms: 200 }, // 11
        { action: "fill", selector: "#commerce-merchant-create-title", value: "Handmade Ceramic Mug" }, // 12
        { action: "fill", selector: "#commerce-merchant-create-description", value: "A small fictional demo product for the E2E tabletop." }, // 13
        // Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- price
        // field is now a decimal-dollars string (friction ledger row #18;
        // "2500" would now mean $2,500.00, not $25.00), and the row now has
        // Preview/Edit/Publish buttons, so the Publish click targets its own
        // class rather than "the only button" -- same $25.00 real product
        // price as before this arc, unchanged for every downstream assertion.
        { action: "fill", selector: "#commerce-merchant-create-price", value: "25.00" }, // 14
        { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 15
        { action: "click", selector: "#commerce-merchant-create-submit" }, // 16
        { action: "wait", ms: 300 }, // 17
        { action: "read", selector: "#commerce-merchant-products-list" }, // 18 -- proves the new draft product is real and listed
        { action: "click", selector: "#commerce-merchant-products-list li:last-child button.commerce-btn-publish" }, // 19 -- Publish (the new product is always inserted last)
        { action: "wait", ms: 300 }, // 20

        // Alice (Customer): discover, order, submit.
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 21
        { action: "wait", ms: 200 }, // 22
        { action: "click", selector: "#nav-commerce" }, // 23
        { action: "wait", ms: 300 }, // 24
        { action: "read", selector: "#commerce-catalog-list" }, // 25 -- proves the newly published product is now in the real customer-facing catalog
        { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 26 -- the new product is the 4th (3 seeded + 1 new)
        { action: "wait", ms: 300 }, // 27
        { action: "read", selector: "#commerce-detail-title" }, // 28 -- expect "Handmade Ceramic Mug"
        { action: "click", selector: "#commerce-order-create-submit" }, // 29
        { action: "wait", ms: 400 }, // 30
        { action: "read", selector: "#commerce-order-status-text" }, // 31 -- expect "created"
        { action: "click", selector: "#commerce-order-submit-btn" }, // 32
        { action: "wait", ms: 300 }, // 33
        { action: "read", selector: "#commerce-order-status-text" }, // 34 -- expect "submitted"

        // Bob (Merchant): accept.
        { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 35
        { action: "wait", ms: 200 }, // 36
        { action: "click", selector: "#commerce-order-accept-btn" }, // 37
        { action: "wait", ms: 300 }, // 38
        { action: "read", selector: "#commerce-order-status-text" }, // 39 -- expect "accepted"

        // Alice (Customer): request + simulate (TEST/LOCAL) payment.
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 40
        { action: "wait", ms: 200 }, // 41
        { action: "click", selector: "#commerce-order-payment-request-btn" }, // 42
        { action: "wait", ms: 400 }, // 43
        { action: "read", selector: "#commerce-order-payment-id" }, // 44 -- non-empty real paymentId
        { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 45
        { action: "wait", ms: 500 }, // 46
        { action: "read", selector: "#commerce-order-status-text" }, // 47 -- expect "paid"

        // Bob (Merchant): fulfill (also creates+starts the real Delivery record).
        { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 48
        { action: "wait", ms: 200 }, // 49
        { action: "click", selector: "#commerce-order-fulfill-btn" }, // 50
        { action: "wait", ms: 400 }, // 51
        { action: "read", selector: "#commerce-order-status-text" }, // 52 -- expect "fulfilling"
        { action: "read", selector: "#commerce-order-delivery-status" }, // 53 -- expect "Delivery status: fulfilling"

        // Alice (Customer): acknowledge real receipt -- the ONLY thing that can mark delivered.
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 54
        { action: "wait", ms: 200 }, // 55
        { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 56
        { action: "wait", ms: 400 }, // 57
        { action: "read", selector: "#commerce-order-status-text" }, // 58 -- expect "delivered"

        // Either party completes the order.
        { action: "click", selector: "#commerce-order-complete-btn" }, // 59
        { action: "wait", ms: 400 }, // 60
        { action: "read", selector: "#commerce-order-status-text" }, // 61 -- expect "completed"

        // Issue + verify a REAL signed, QR-encoded Trust receipt.
        { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 62
        { action: "wait", ms: 500 }, // 63
        { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 64 -- expect "VALID"
        { action: "read", selector: "#commerce-order-receipt-qr-text", as: "value" }, // 65 -- non-empty real signed envelope text

        // Messenger regression: Conversations still reachable after the full flow.
        { action: "click", selector: "#nav-conversations" }, // 66
        { action: "wait", ms: 300 }, // 67
        { action: "read", selector: ".app-screen.active#app-screen-conversations" }, // 68
      ]);

      expect(readAt(run, 7)).toBe("ready");

      readAt(run, 18); // merchant products list rendered at all
      const publishStep = run.steps.find((s) => s.index === 19);
      expect(publishStep, run.output).toBeDefined();
      expect(publishStep!.result.outcome, run.output).toBe("ok");

      const catalogText = readAt(run, 25);
      expect(catalogText).toMatch(/Handmade Ceramic Mug/);

      expect(readAt(run, 28)).toBe("Handmade Ceramic Mug");
      expect(readAt(run, 31)).toBe("created");
      expect(readAt(run, 34)).toBe("submitted");
      expect(readAt(run, 39)).toBe("accepted");

      const paymentIdText = readAt(run, 44);
      expect(paymentIdText.length).toBeGreaterThan(0);
      expect(readAt(run, 47)).toBe("paid");

      expect(readAt(run, 52)).toBe("fulfilling");
      expect(readAt(run, 53)).toMatch(/Delivery status: fulfilling/);

      expect(readAt(run, 58)).toBe("delivered");
      expect(readAt(run, 61)).toBe("completed");

      expect(readAt(run, 64)).toBe("VALID");
      const qrText = readAt(run, 65);
      expect(qrText.length).toBeGreaterThan(0);
      // The QR text carries the real signed envelope -- never plaintext order
      // contents, and never a raw "paid"/checkbox-shaped claim.
      expect(qrText).not.toMatch(/"markAsPaid"/i);

      readAt(run, 68); // Conversations still reachable -- Messenger regression check.
    },
    120000,
  );
});

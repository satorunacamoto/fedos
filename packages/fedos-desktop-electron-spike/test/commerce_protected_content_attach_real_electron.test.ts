/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Coordinator
 * validation-gate phase) — the LIVE regression test for this arc's own
 * P0-2 core deliverable: attaching a real protected purchased file to a
 * real product, in the REAL Beta Electron process, with real WASM crypto
 * and a real unlocked profile, driven ONLY through the visible DOM
 * controls a seller actually uses.
 *
 * WHY THIS TEST HAD TO EXIST: the bug it guards was 100% reproducible in
 * the real app ("protected content storage failed: failed", every single
 * attempt) while EVERY targeted test for the same code passed — because
 * every one of those tests either injected a fake `ProductMediaEncryptionPort`
 * or asserted on source text, and none of them could populate an
 * `<input type="file">` at all. The real defect lived precisely in the
 * layer no test crossed: `WasmProductMediaEncryption`'s DEFAULT dependency
 * resolution, which reached the dev-only, `NODE_ENV=development`-gated
 * `FedosWasmLoader` chain and therefore returned `null` unconditionally in
 * any real launch (see that adapter's own header, "PRODUCTION BRIDGE
 * FIRST", for the captured live gate state). This test crosses that layer:
 * it uses the SAME `AUTOTEST_MODE=ui-script` harness every other
 * real-launch test in this package uses, plus that harness's `attachFile`
 * action, which builds a genuine `File` and installs it through the page's
 * own `DataTransfer`/`FileList` API exactly as a real OS file picker does.
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
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

/** A real, 1024-byte PDF with a genuine `%PDF-1.4` header -- the exact fixture shape this arc's own usability tester used when the bug was first reproduced. */
function realSmallPdfBase64(): string {
  const bytes = Buffer.alloc(1024, 0x20);
  Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1").copy(bytes, 0);
  Buffer.from("\n%%EOF\n", "latin1").copy(bytes, 1024 - 7);
  return bytes.toString("base64");
}

/** A real (empty) ZIP container: a bare end-of-central-directory record. */
const REAL_EMPTY_ZIP_BASE64 = Buffer.from("504b0506000000000000000000000000000000000000", "hex").toString("base64");

const NORTHLIGHT_MERCHANT = "a".repeat(64);
const ROW = "#commerce-merchant-products-list li:last-child";

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_protected_content_attach_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce, or the real Electron binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite("Protected purchased-file attach -- REAL Beta Electron process, real WASM, real unlocked profile, driven only through visible DOM controls", () => {
  it(
    "a seller attaches a real 1KB %PDF-1.4 file to their own product and it genuinely succeeds (no error, and the plain-language summary lists it as buyers-only); a real ZIP reported with Windows' own application/x-zip-compressed MIME type is accepted too",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-protected-attach-"));
      tmpRoots.push(dataDir);
      const run = await runBetaUiScript(dataDir, [
        { action: "wait", ms: 400 }, // 0
        { action: "fill", selector: "#create-label", value: "Protected Attach Regression Profile" }, // 1
        { action: "fill", selector: "#create-pass", value: "protected attach regression passphrase" }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: "protected attach regression passphrase" }, // 3
        { action: "click", selector: "#create-pass-ack" }, // 4
        { action: "click", selector: "#create-submit" }, // 5
        { action: "wait", ms: 3000 }, // 6 -- real Argon2 unlock + real WASM master seed generation
        { action: "read", selector: "#current-screen" }, // 7 -- expect "ready"

        { action: "click", selector: "#nav-commerce-merchant" }, // 8
        { action: "wait", ms: 400 }, // 9
        { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 10
        { action: "wait", ms: 300 }, // 11
        { action: "fill", selector: "#commerce-merchant-create-title", value: "Protected Content Regression" }, // 12
        { action: "fill", selector: "#commerce-merchant-create-description", value: "A product whose purchased file must genuinely attach." }, // 13
        { action: "fill", selector: "#commerce-merchant-create-price", value: "10.00" }, // 14
        { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 15
        { action: "click", selector: "#commerce-merchant-create-submit" }, // 16
        { action: "wait", ms: 700 }, // 17

        // --- the real PDF attach, through the real file picker surface ---
        { action: "fill", selector: `${ROW} .commerce-product-content-attach input[type="text"]`, value: "Full guide (PDF)" }, // 18
        { action: "attachFile", selector: `${ROW} .commerce-product-content-attach input[type="file"]`, value: realSmallPdfBase64(), fileName: "guide.pdf", fileType: "application/pdf" }, // 19
        { action: "click", selector: `${ROW} .commerce-product-content-attach button` }, // 20
        { action: "wait", ms: 2500 }, // 21
        { action: "read", selector: `${ROW} .commerce-product-content-attach .error` }, // 22 -- expect "" (the bug produced "protected content storage failed: failed" here)
        { action: "read", selector: `${ROW} .commerce-product-media-summary` }, // 23 -- expect the file listed as buyers-only

        // --- a real ZIP, reported with Windows' own MIME spelling ---
        { action: "fill", selector: `${ROW} .commerce-product-content-attach input[type="text"]`, value: "Pro pack (ZIP)" }, // 24
        { action: "attachFile", selector: `${ROW} .commerce-product-content-attach input[type="file"]`, value: REAL_EMPTY_ZIP_BASE64, fileName: "pack.zip", fileType: "application/x-zip-compressed" }, // 25
        { action: "click", selector: `${ROW} .commerce-product-content-attach button` }, // 26
        { action: "wait", ms: 2500 }, // 27
        { action: "read", selector: `${ROW} .commerce-product-content-attach .error` }, // 28 -- expect ""
        { action: "read", selector: `${ROW} .commerce-product-media-summary` }, // 29 -- expect BOTH files
      ]);

      expect(readAt(run, 7)).toBe("ready");

      // The real file genuinely reached the page as a real File object.
      expect(readAt(run, 19)).toBe("1:1024:application/pdf");

      // THE REGRESSION: this was "protected content storage failed: failed", 100% of the time.
      expect(readAt(run, 22), run.output).toBe("");
      const afterPdf = readAt(run, 23);
      expect(afterPdf).toMatch(/Buyers only \(unlocked after purchase\)/);
      expect(afterPdf).toMatch(/Full guide \(PDF\)/);
      // Seller language only -- the summary must never leak an internal term.
      expect(afterPdf).not.toMatch(/ciphertext|classification|CID|AEAD/i);

      // Windows reports `.zip` as `application/x-zip-compressed`; that must not be a rejection.
      expect(readAt(run, 25)).toBe("1:22:application/x-zip-compressed");
      expect(readAt(run, 28), run.output).toBe("");
      const afterZip = readAt(run, 29);
      expect(afterZip).toMatch(/Full guide \(PDF\)/);
      expect(afterZip).toMatch(/Pro pack \(ZIP\)/);
    },
    150000,
  );
});

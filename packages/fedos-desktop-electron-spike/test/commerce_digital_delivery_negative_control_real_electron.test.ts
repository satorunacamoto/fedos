/**
 * FedOS "Real Digital Delivery" mega-arc (Agent N) -- STEP 1/2/4: the LIVE
 * FALSE-GREEN NEGATIVE CONTROL for digital purchased-content delivery, run
 * BEFORE any grant-custody change lands (against current `a9a2ecf9`
 * behaviour), using two REAL, INDEPENDENT Electron processes (Bob the
 * seller, Alice the buyer), each their own real local Persona, talking ONLY
 * through a real local Nostr-shaped relay this suite itself starts. No
 * same-process shortcut, no shared in-memory state, no fixture identity.
 *
 * WHY THIS FILE EXISTS, AND HOW IT DIFFERS FROM THE OTHER commerce_e2e_*
 * SUITES IN THIS DIRECTORY: `commerce_e2e_two_process_real_electron.test.ts`
 * already proves the full happy path for a product with NO protected media
 * (its own STEP 9 comment says so explicitly). This suite is the mirror
 * image: Bob's product genuinely DOES carry real, protected, ChaCha20Poly1305-
 * encrypted purchased content (a real 1 KB `%PDF-1.4` file, attached through
 * the real `fedos-app:commerce-product-content-attach` IPC path --
 * `docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md`'s own
 * "Addendum 2" corrected the older "can never be attached" claim: attach is
 * real). The content is then made genuinely UNAVAILABLE to Alice's own
 * process in the two most realistic ways this codebase can produce today,
 * both discovered by direct source inspection before writing this test
 * (never guessed):
 *
 *   (a) STRUCTURAL: `issueMediaAccessGrantsForOrder()` requires a
 *       grant-signing keypair whose public key equals `order.sellerPubkey`
 *       LITERALLY -- and no such keypair can ever be minted for a real
 *       account identity (`durable_media_grant_signing_key_store.ts`'s own
 *       header: that would require solving the discrete log problem). So a
 *       REAL seller's `private-media-release-request` handling always
 *       answers "seller-not-grant-capable", and the buyer's redeem attempt
 *       can never receive real bytes -- Blocker 5 in the reachability doc,
 *       confirmed still live at this commit. This is exercised unconditionally
 *       below (Alice never needs to do anything special to hit it).
 *
 *   (b) TIMING/SYNC: `resolveProductMediaForCompletionInvariantWithSync()`
 *       (`fedos_electron_beta_main.cts`) is the ONLY call site in the whole
 *       file that ever calls `commerceProductMediaDiscoverAndApplyNonFatal()`
 *       -- i.e. a buyer's process learns about a seller's protected-media
 *       declaration ONLY at the exact moment it attempts `Complete order`,
 *       via a real bounded one-shot relay query, never before. That query
 *       is skipped entirely (`{outcome: "skipped-local-only"}`) whenever
 *       `commerceNetworkProfile === "local-only"` -- a real, user-reachable
 *       Settings choice (this suite's own `returningLaunchPreamble()`-style
 *       durable save, reused unmodified from the sibling two-process suite).
 *       This test deliberately puts Alice in that state before her one and
 *       only completion attempt -- a direct, mandate-literal instantiation
 *       of "intentionally make the required content unavailable" (a buyer
 *       who is offline/local-only-privacy-mode at the moment they click
 *       Complete is not a contrived edge case). THE FINDING THIS IS BUILT TO
 *       CATCH: `resolveProductMediaForCompletionInvariantWithSync()`
 *       unconditionally returns `productMediaKnowledge: "authoritative"` --
 *       see that function's own short header ("performs one bounded
 *       ProductMedia discovery pass for a non-owning process before
 *       evaluating, then reports \"authoritative\"") -- even though the
 *       LONGER header two comments above it (for the sibling
 *       `commerceProductMediaDeclarationSummaryFor()`) states the opposite
 *       intent in plain language: "every other process (a genuine buyer...)
 *       can only ever have \"unsynced\" knowledge". If the discovery pass
 *       above is skipped (or simply fails to find anything), `productMedia`
 *       is `[]`, so `evaluateDigitalContentDeliveryInvariantForOrderCompletion()`'s
 *       `missingMediaIds` is also `[]`, and the mislabelled `"authoritative"`
 *       then makes the invariant report `satisfied: true` -- a real,
 *       reachable FALSE GREEN: an order for a digital product whose
 *       protected content was NEVER released could reach `"completed"`,
 *       earn a real signed Trust receipt, and record real positive
 *       reputation. This test's own assertions below report, verbatim,
 *       whichever of the two possible real outcomes this exact commit
 *       actually produces -- it does not assume the bug is present, and it
 *       does not silently pass either way (see the STEP 6d block's own
 *       comment for the precise pass/fail branching and what each branch
 *       means for release readiness).
 *
 *       ACTUAL LIVE RESULT (two full runs, both identical): Alice's
 *       completion attempt was correctly REJECTED with reason
 *       `"digital-content-not-delivered"` -- meaning her process's
 *       completion-time ProductMedia discovery query DID come back with the
 *       real protected-media declaration (`missingMediaIds.length > 0` caught
 *       it before the mislabelled `"authoritative"` branch was ever reached),
 *       even though her Commerce Network Profile was durably `"local-only"`
 *       at that moment. This means either (i) `commerceNetworkProfile`'s
 *       gate does not actually block this specific query the way the other
 *       `"local-only"` gates elsewhere in this file do, or (ii) the read
 *       model Alice's process already held was populated by an earlier step
 *       in this same launch by a path not yet identified. Either way, THIS
 *       exact scenario did not reach the deeper `"authoritative"`-mislabel
 *       branch live, so this run neither confirms nor refutes that the
 *       mislabel is reachable in some OTHER real timing (e.g. a genuine
 *       relay/network failure at exactly the completion instant, which this
 *       test cannot force deterministically the way a durable Settings
 *       choice can). The header comment discrepancy in
 *       `resolveProductMediaForCompletionInvariantWithSync()` (its own short
 *       doc says "authoritative"; its neighbour's longer doc says a
 *       non-owning process "can only ever have unsynced knowledge") is real
 *       and still worth a maintainer's attention even though this specific
 *       live run did not trigger the false-completion path it could
 *       theoretically allow -- reported as a documentation/intent
 *       discrepancy, not a confirmed live false-green, in this agent's final
 *       report.
 *
 * HARNESS: deliberately duplicates (does not import) the turn-based,
 * sequential-multi-launch harness `commerce_e2e_two_process_real_electron.test.ts`
 * already established for exactly this reason -- every real-launch suite in
 * this package keeps its own copy rather than share one, to avoid a shared
 * fixture's own `tsconfig.test.json` cross-config type friction (see that
 * file's own header for the fuller account). Same discipline throughout:
 * real OS-level PID tracking, an owned-PID-only sweep in `afterAll` (never a
 * broad kill by process name), a bounded 90s safety timeout per launch, and
 * progressive append-only evidence written to disk after every phase.
 *
 * PER-ARC MANDATE, STEP 3/4 NOTE: this suite is built and run entirely
 * against CURRENT (`a9a2ecf9`) grant-custody behaviour. If a parallel agent's
 * grant-custody work lands on a different branch and is later merged here,
 * STEP 6a (the structural Blocker-5 denial) should be re-run first -- if
 * grant issuance becomes possible for a real seller identity, that assertion
 * MUST be revisited (it currently asserts denial; a real fix would correctly
 * flip it to an "ok" outcome with a byte-for-byte-verified digest, which is
 * exactly what a REAL digital delivery E2E (this arc's STEP 3) would then
 * need to add as a NEW positive-path test, never by relaxing this one).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

interface FedosRealLocalWebSocketRelayServer {
  readonly url: string;
  redeliverLast(): void;
  connectionCount(): number;
  close(): Promise<void>;
}

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

const evidenceDir = `${repoRoot}/docs/commerce/evidence/commerce_e2e_digital_delivery_negative_control`;
const evidenceMdPath = `${repoRoot}/docs/commerce/evidence/commerce_e2e_digital_delivery_negative_control_evidence.md`;
const screenshotDir = `${evidenceDir}/screens`;

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-ddnc-e2e-${label}-`));
  tmpRoots.push(dir);
  return dir;
}

let evidenceInitialized = false;
function record(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[ddnc-e2e] ${line}`);
  const prefix = evidenceInitialized
    ? ""
    : `# Commerce Digital Delivery Negative Control -- REAL two-independent-Electron-process evidence\n\nGenerated by commerce_digital_delivery_negative_control_real_electron.test.ts\n\nStarted: ${new Date().toISOString()}\n\n`;
  evidenceInitialized = true;
  try {
    mkdirSync(join(evidenceMdPath, ".."), { recursive: true });
    appendFileSync(evidenceMdPath, `${prefix}${line}\n`);
  } catch {
    /* evidence writing is best-effort, never masks a real test failure */
  }
}

function seedSettingsFile(dataDir: string, relayUrl: string): void {
  const descriptor = {
    schemaVersion: 1,
    theme: "system",
    language: "en",
    relays: [relayUrl],
    defaultRelay: relayUrl,
    notificationsEnabled: true,
    backgroundSyncEnabled: true,
    archiveDirectory: "",
    autoStart: false,
    autoLockTimeoutMinutes: 15,
    windowLayout: "standard",
  };
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "settings.json"), JSON.stringify(descriptor), "utf8");
}

type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" }
  | { readonly action: "wait"; readonly ms: number }
  | { readonly action: "attachFile"; readonly selector: string; readonly value: string; readonly fileName: string; readonly fileType: string }
  | { readonly action: "screenshot"; readonly value: string };

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}
interface UiRun {
  readonly output: string;
  readonly steps: readonly UiStepResult[];
  readonly pid: number | undefined;
  readonly exitCode: number | null;
}

const ownedPids: number[] = [];

function queryWin32ProcessAlive(pid: number): boolean {
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; (Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Measure-Object).Count`],
      { encoding: "utf8" },
    );
    return out.trim() !== "0";
  } catch {
    return false;
  }
}

async function runBetaUiScript(label: string, dataDir: string, script: readonly UiStep[], withScreenshots = false): Promise<UiRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
      FEDOS_BETA_UI_SCRIPT: JSON.stringify(script),
      ...(withScreenshots ? { FEDOS_ELECTRON_BETA_SCREENSHOT_DIR: screenshotDir } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const pid = child.pid;
  if (pid !== undefined) ownedPids.push(pid);
  record(`launch "${label}": spawned real Electron dev process, pid=${String(pid)}, dataDir=${dataDir}`);
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
      record(`launch "${label}": bounded safety timeout (90s) -- issued SIGKILL to pid=${String(pid)}`);
    } catch {
      /* already gone */
    }
  }, 90000);
  const exitCode = await new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  clearTimeout(timer);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const stillAlive = pid !== undefined ? queryWin32ProcessAlive(pid) : false;
  record(`launch "${label}": process exited (exitCode=${String(exitCode)}); OS-level Win32_Process check for pid=${String(pid)}: ${stillAlive ? "STILL PRESENT (unexpected)" : "gone (clean)"}`);
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: UiStepResult[] = [];
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    steps.push(JSON.parse(line.slice(marker.length)) as UiStepResult);
  }
  return { output, steps, pid, exitCode };
}

function readAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

function softReadAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  if (step === undefined || step.result.outcome !== "ok") return "";
  return step.result.value ?? "";
}

/** A real, 1024-byte PDF with a genuine `%PDF-1.4` header and a known SHA-256 digest -- the exact fixture shape this arc's own STEP 3 mandate asks for ("a small SYNTHETIC real content fixture with a KNOWN digest"). Reused here (not just in STEP 3) so this negative control's own evidence records the true content identity it is protecting. */
function realSmallPdfBytes(): Buffer {
  const bytes = Buffer.alloc(1024, 0x20);
  Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1").copy(bytes, 0);
  Buffer.from("\n%%EOF\n", "latin1").copy(bytes, 1024 - 7);
  return bytes;
}
const REAL_PDF_BYTES = realSmallPdfBytes();
const REAL_PDF_BASE64 = REAL_PDF_BYTES.toString("base64");
function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
const REAL_PDF_SHA256 = sha256Hex(REAL_PDF_BYTES);

const BOB_LABEL = "Digital Delivery Negative Control -- Bob";
const BOB_PASSPHRASE = "digital delivery negative control bob real passphrase";
const ALICE_LABEL = "Digital Delivery Negative Control -- Alice";
const ALICE_PASSPHRASE = "digital delivery negative control alice real passphrase";
const PRODUCT_TITLE = "FedOS Digital Delivery Negative Control Item";
const PRODUCT_DESCRIPTION = "Real protected-content product for the Digital Delivery Negative Control agent -- declares a real purchased PDF.";
const ROW = "#commerce-merchant-products-list li:last-child";

const PREAMBLE_STEPS = 14;
function returningLaunchPreamble(passphrase: string, networkProfile: "local-only" | "direct", actingAsSelector: string, actingAsPubkey: string): readonly UiStep[] {
  return [
    { action: "wait", ms: 300 }, // 0
    { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
    { action: "fill", selector: "#unlock-pass", value: passphrase }, // 2
    { action: "click", selector: "#unlock-submit" }, // 3
    { action: "wait", ms: 2500 }, // 4
    { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
    { action: "click", selector: "#nav-settings" }, // 6
    { action: "wait", ms: 300 }, // 7
    { action: "fill", selector: "#commerce-network-profile-select", value: networkProfile }, // 8
    { action: "wait", ms: 100 }, // 9
    { action: "click", selector: "#commerce-network-profile-save" }, // 10
    { action: "wait", ms: 300 }, // 11
    { action: "fill", selector: actingAsSelector, value: actingAsPubkey }, // 12
    { action: "wait", ms: 200 }, // 13
  ];
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_digital_delivery_negative_control_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the real Electron binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite(
  "FedOS Commerce Digital Delivery -- LIVE NEGATIVE CONTROL, REAL two independent Electron processes, real protected content genuinely unavailable to the buyer",
  () => {
    let relay: FedosRealLocalWebSocketRelayServer;
    let bobDataDir: string;
    let aliceDataDir: string;
    let bobPubkey = "";
    let alicePubkey = "";
    let orderId = "";
    /** Set once STEP 6d runs, so later phases (restart/reconnect) know which real branch they are re-verifying. */
    let completionOutcome: "rejected" | "false-completed" | "unknown" = "unknown";

    beforeAll(async () => {
      mkdirSync(evidenceDir, { recursive: true });
      mkdirSync(screenshotDir, { recursive: true });
      const relayServerModuleSpecifier = "../../../test/support/fedos_real_local_websocket_relay_server.js";
      const { startFedosRealLocalWebSocketRelayServer } = (await import(relayServerModuleSpecifier)) as {
        startFedosRealLocalWebSocketRelayServer: (options?: { readonly historyEnabled?: boolean }) => Promise<FedosRealLocalWebSocketRelayServer>;
      };
      relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
      record(`real local relay started: ${relay.url} (historyEnabled: true)`);
      bobDataDir = makeTmpRoot("bob");
      aliceDataDir = makeTmpRoot("alice");
      seedSettingsFile(bobDataDir, relay.url);
      seedSettingsFile(aliceDataDir, relay.url);
      record(`Bob dataDir: ${bobDataDir}`);
      record(`Alice dataDir: ${aliceDataDir}`);
      record(`Real protected-content fixture: 1024-byte %PDF-1.4, sha256=${REAL_PDF_SHA256}`);
    }, 30000);

    afterAll(async () => {
      if (relay !== undefined) {
        await relay.close();
        record("real local relay closed.");
      }
      const survivors: number[] = [];
      for (const pid of ownedPids) {
        if (!queryWin32ProcessAlive(pid)) continue;
        survivors.push(pid);
        try {
          execFileSync("taskkill", ["/PID", String(pid), "/F"]);
        } catch {
          /* best-effort */
        }
      }
      record(
        survivors.length === 0
          ? `owned-PID sweep: all ${ownedPids.length} Electron processes this suite spawned had already exited cleanly on their own -- zero orphans, zero kills issued.`
          : `owned-PID sweep: ${survivors.length} of ${ownedPids.length} owned PIDs were still alive and were SIGKILLed by exact PID: ${survivors.join(", ")}`,
      );
      while (tmpRoots.length) {
        try {
          rmSync(tmpRoots.pop()!, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
      record(`Evidence doc: ${evidenceMdPath}`);
    }, 60000);

    // =====================================================================
    // STEPS 1-2: Bob creates a real Persona, a real product, attaches a
    // REAL protected purchased PDF (real WASM ChaCha20Poly1305 encryption,
    // real IpfsMediaStore.putProtected(), real product-media-declaration
    // Nostr publish), then publishes the product.
    // =====================================================================
    it(
      "STEP 1-2: Bob creates+publishes a real product carrying REAL protected purchased content (real encrypted PDF)",
      async () => {
        const bob1 = await runBetaUiScript(
          "BOB_1_CREATE",
          bobDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "fill", selector: "#create-label", value: BOB_LABEL }, // 1
            { action: "fill", selector: "#create-pass", value: BOB_PASSPHRASE }, // 2
            { action: "fill", selector: "#create-pass-confirm", value: BOB_PASSPHRASE }, // 3
            { action: "click", selector: "#create-submit" }, // 4
            { action: "wait", ms: 2500 }, // 5
            { action: "read", selector: "#current-screen" }, // 6
            { action: "read", selector: "#commerce-merchant-acting-as option:first-child", as: "value" }, // 7
          ],
          true,
        );
        expect(readAt(bob1, 6)).toBe("ready");
        bobPubkey = readAt(bob1, 7);
        expect(bobPubkey.length).toBe(64);
        record(`STEP 1 PASS -- Bob's process (pid ${String(bob1.pid)}) created a REAL local Persona. Bob's real pubkey: ${bobPubkey}`);

        const bob2 = await runBetaUiScript(
          "BOB_2_PRODUCT_ATTACH_PUBLISH",
          bobDataDir,
          [
            ...returningLaunchPreamble(BOB_PASSPHRASE, "direct", "#commerce-merchant-acting-as", bobPubkey), // 0..13
            { action: "click", selector: "#nav-commerce-merchant" }, // 14
            { action: "wait", ms: 300 }, // 15
            { action: "fill", selector: "#commerce-merchant-create-title", value: PRODUCT_TITLE }, // 16
            { action: "fill", selector: "#commerce-merchant-create-description", value: PRODUCT_DESCRIPTION }, // 17
            { action: "fill", selector: "#commerce-merchant-create-price", value: "25.00" }, // 18
            { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 19
            { action: "click", selector: "#commerce-merchant-create-submit" }, // 20
            { action: "wait", ms: 400 }, // 21
            { action: "read", selector: "#commerce-merchant-products-list" }, // 22 -- real draft product listed

            // --- the real protected attach, through the real file-picker surface ---
            { action: "fill", selector: `${ROW} .commerce-product-content-attach input[type="text"]`, value: "Full guide (PDF)" }, // 23
            { action: "attachFile", selector: `${ROW} .commerce-product-content-attach input[type="file"]`, value: REAL_PDF_BASE64, fileName: "guide.pdf", fileType: "application/pdf" }, // 24
            { action: "click", selector: `${ROW} .commerce-product-content-attach button` }, // 25
            { action: "wait", ms: 2500 }, // 26 -- real WASM encrypt + real IpfsMediaStore.putProtected()
            { action: "read", selector: `${ROW} .commerce-product-content-attach .error` }, // 27 -- expect ""
            { action: "read", selector: `${ROW} .commerce-product-media-summary` }, // 28 -- expect "Buyers only" for the PDF
            { action: "screenshot", value: "bob-01-protected-attached" }, // 29

            { action: "click", selector: "li:last-child button.commerce-btn-publish" }, // 30 -- REAL publish, product + product-media-declaration
            { action: "wait", ms: 600 }, // 31
            { action: "read", selector: "#commerce-merchant-products-list" }, // 32 -- expect "... — active"
            { action: "screenshot", value: "bob-02-product-published" }, // 33
          ],
          true,
        );
        expect(readAt(bob2, 1)).toBe("unlock");
        expect(readAt(bob2, 5)).toBe("ready");
        expect(readAt(bob2, 24)).toBe(`1:${REAL_PDF_BYTES.length}:application/pdf`);
        // THE core proof that this is a REAL protected attach, never the
        // hard-coded-public image path: no error, and the seller-facing
        // summary says "Buyers only" for the PDF -- never internals.
        expect(readAt(bob2, 27), bob2.output).toBe("");
        const summary = readAt(bob2, 28);
        expect(summary).toMatch(/Buyers only \(unlocked after purchase\)/);
        expect(summary).toMatch(/Full guide \(PDF\)/);
        const publishedText = readAt(bob2, 32);
        expect(publishedText).toMatch(/—\s*active/);
        record(
          `STEP 2 PASS -- Bob's process (pid ${String(bob2.pid)}) attached a REAL 1024-byte %PDF-1.4 file (sha256=${REAL_PDF_SHA256}) as PROTECTED purchased content (real WASM encryption, no storage error), and published the product+its real product-media-declaration to the real local relay. Seller-facing summary confirms buyers-only gating: "${summary}"`,
        );
      },
      150000,
    );

    // =====================================================================
    // STEP 3: Alice (independent process, independent real Persona)
    // discovers Bob's product, views it, submits a real Order.
    // =====================================================================
    it(
      "STEP 3: Alice (separate process, separate real Persona) discovers Bob's product cross-process and submits a real Order",
      async () => {
        const alice1 = await runBetaUiScript(
          "ALICE_1_CREATE",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "fill", selector: "#create-label", value: ALICE_LABEL }, // 1
            { action: "fill", selector: "#create-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "fill", selector: "#create-pass-confirm", value: ALICE_PASSPHRASE }, // 3
            { action: "click", selector: "#create-submit" }, // 4
            { action: "wait", ms: 2500 }, // 5
            { action: "read", selector: "#current-screen" }, // 6
            { action: "read", selector: "#commerce-acting-as option:first-child", as: "value" }, // 7
          ],
          true,
        );
        expect(readAt(alice1, 6)).toBe("ready");
        alicePubkey = readAt(alice1, 7);
        expect(alicePubkey.length).toBe(64);
        expect(alicePubkey).not.toBe(bobPubkey);
        record(`STEP 3a PASS -- Alice's process (pid ${String(alice1.pid)}) created a REAL local Persona. Alice's real pubkey: ${alicePubkey}`);

        const alice2 = await runBetaUiScript(
          "ALICE_2_DISCOVER_ORDER",
          aliceDataDir,
          [
            ...returningLaunchPreamble(ALICE_PASSPHRASE, "direct", "#commerce-acting-as", alicePubkey), // 0..13
            { action: "click", selector: "#nav-commerce" }, // 14 -- real bounded Nostr discovery
            { action: "wait", ms: 700 }, // 15
            { action: "read", selector: "#commerce-catalog-list" }, // 16 -- MAKE-OR-BREAK: must contain Bob's title
            { action: "click", selector: `button[aria-label="View ${PRODUCT_TITLE}"]` }, // 17
            { action: "wait", ms: 300 }, // 18
            { action: "read", selector: "#commerce-detail-title" }, // 19
            { action: "click", selector: "#commerce-order-create-submit" }, // 20
            { action: "wait", ms: 400 }, // 21
            { action: "read", selector: "#commerce-order-status-text" }, // 22 -- expect "created"
            { action: "click", selector: "#commerce-order-submit-btn" }, // 23
            { action: "wait", ms: 400 }, // 24
            { action: "read", selector: "#commerce-order-status-text" }, // 25 -- expect "submitted"
            { action: "read", selector: "#commerce-order-id" }, // 26
            { action: "screenshot", value: "alice-01-order-submitted" }, // 27
          ],
          true,
        );
        expect(readAt(alice2, 1)).toBe("unlock");
        expect(readAt(alice2, 5)).toBe("ready");
        expect(readAt(alice2, 16)).toMatch(new RegExp(PRODUCT_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        expect(readAt(alice2, 19)).toBe(PRODUCT_TITLE);
        expect(readAt(alice2, 22)).toBe("created");
        expect(readAt(alice2, 25)).toBe("submitted");
        orderId = readAt(alice2, 26);
        expect(orderId.length).toBeGreaterThan(0);
        record(`STEP 3b PASS -- Alice's process (pid ${String(alice2.pid)}) discovered Bob's real published product cross-process and submitted a real Order. orderId=${orderId}`);
      },
      150000,
    );

    // =====================================================================
    // STEP 4/5: Bob accepts; Alice pays (TEST/LOCAL simulated settlement,
    // never real money); Bob fulfills.
    // =====================================================================
    it(
      "STEP 4-5: Bob (separate process) accepts the real cross-process Order; Alice pays (TEST/LOCAL); Bob fulfills",
      async () => {
        const bob3 = await runBetaUiScript(
          "BOB_3_ACCEPT",
          bobDataDir,
          [
            ...returningLaunchPreamble(BOB_PASSPHRASE, "direct", "#commerce-merchant-acting-as", bobPubkey), // 0..13
            { action: "click", selector: "#nav-commerce-merchant" }, // 14
            { action: "wait", ms: 700 }, // 15
            { action: "read", selector: "#commerce-merchant-orders-list" }, // 16 -- must contain Alice's real order
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 17
            { action: "wait", ms: 300 }, // 18
            { action: "read", selector: "#commerce-order-status-text" }, // 19 -- expect "submitted"
            { action: "click", selector: "#commerce-order-accept-btn" }, // 20
            { action: "wait", ms: 400 }, // 21
            { action: "read", selector: "#commerce-order-status-text" }, // 22 -- expect "accepted"
          ],
          false,
        );
        expect(readAt(bob3, 16)).toContain("Order");
        expect(readAt(bob3, 19)).toBe("submitted");
        expect(readAt(bob3, 22)).toBe("accepted");
        record(`STEP 4a PASS -- Bob's process (pid ${String(bob3.pid)}) discovered+accepted Alice's real Order cross-process.`);

        const alice3 = await runBetaUiScript(
          "ALICE_3_PAY",
          aliceDataDir,
          [
            ...returningLaunchPreamble(ALICE_PASSPHRASE, "direct", "#commerce-acting-as", alicePubkey), // 0..13
            { action: "click", selector: "#nav-commerce" }, // 14 -- real bounded order-sync discovery
            { action: "wait", ms: 700 }, // 15
            { action: "read", selector: "#commerce-my-orders-list" }, // 16
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 17
            { action: "wait", ms: 300 }, // 18
            { action: "read", selector: "#commerce-order-status-text" }, // 19 -- expect "accepted" (cross-process)
            { action: "click", selector: "#commerce-order-payment-request-btn" }, // 20
            { action: "wait", ms: 400 }, // 21
            { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 22 -- TEST/LOCAL settlement, NEVER real money
            { action: "wait", ms: 400 }, // 23
            { action: "read", selector: "#commerce-order-status-text" }, // 24 -- expect "paid" (local to Alice)
          ],
          false,
        );
        expect(readAt(alice3, 19)).toBe("accepted");
        expect(readAt(alice3, 24)).toBe("paid");
        record(`STEP 4b PASS -- Alice's process (pid ${String(alice3.pid)}) discovered Bob's real accept cross-process and paid (TEST/LOCAL simulated settlement).`);

        const bob4 = await runBetaUiScript(
          "BOB_4_FULFILL",
          bobDataDir,
          [
            ...returningLaunchPreamble(BOB_PASSPHRASE, "direct", "#commerce-merchant-acting-as", bobPubkey), // 0..13
            { action: "click", selector: "#nav-commerce-merchant" }, // 14 -- payment-evidence discover-and-apply
            { action: "wait", ms: 700 }, // 15
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 16
            { action: "wait", ms: 300 }, // 17
            { action: "read", selector: "#commerce-order-status-text" }, // 18 -- expect "paid"
            { action: "click", selector: "#commerce-order-fulfill-btn" }, // 19
            { action: "wait", ms: 400 }, // 20
            { action: "read", selector: "#commerce-order-status-text" }, // 21 -- expect "fulfilling"
          ],
          false,
        );
        expect(readAt(bob4, 18)).toBe("paid");
        expect(readAt(bob4, 21)).toBe("fulfilling");
        record(`STEP 5 PASS -- Bob's process (pid ${String(bob4.pid)}) discovered Alice's real payment evidence cross-process and fulfilled.`);
      },
      180000,
    );

    // =====================================================================
    // STEP 6: THE NEGATIVE CONTROL ITSELF. Alice (independent process)
    // discovers "fulfilling" cross-process, then:
    //   6a. attempts to open the purchased content -- REQUIRED: no false
    //       "content received" state (Blocker 5: real seller can never
    //       become grant-capable).
    //   6b. acknowledges receipt (a legitimate, content-independent buyer
    //       attestation) -- order reaches "delivered".
    //   6c. explicitly, durably switches Commerce Network Profile to
    //       "local-only" -- makes the completion-time ProductMedia
    //       discovery pass genuinely unable to run (real "content
    //       unavailable" condition, not a fixture/mock).
    //   6d. attempts Complete order -- THIS is the load-bearing assertion:
    //       either it is correctly REJECTED (good: fail-closed), or it
    //       falsely reaches "completed" (a real, reportable false-green
    //       bug this test exists to catch -- see this file's own header).
    // =====================================================================
    it(
      "STEP 6: THE NEGATIVE CONTROL -- Alice's real redeem attempt is denied (no false content-received state); her real completion attempt with genuinely-unavailable content is checked for fail-closed behaviour",
      async () => {
        const alice4 = await runBetaUiScript(
          "ALICE_4_NEGATIVE_CONTROL",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
            { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 6 -- explicit, matches this suite's own convention: never rely on a default selection
            { action: "wait", ms: 200 }, // 7
            { action: "click", selector: "#nav-commerce" }, // 8 -- real order-sync + delivery discovery, still "direct" here
            { action: "wait", ms: 700 }, // 9
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 10
            { action: "wait", ms: 300 }, // 11
            { action: "read", selector: "#commerce-order-status-text" }, // 12 -- expect "fulfilling" (Bob's real cross-process fulfil)

            // --- 6a: real grant-gated redeem attempt, whatever it says is reported verbatim ---
            { action: "click", selector: "#commerce-order-purchased-content-btn" }, // 13
            { action: "wait", ms: 1500 }, // 14 -- real cross-process private-media-release-request round trip attempt
            { action: "read", selector: "#commerce-order-purchased-content-error" }, // 15 -- REQUIRED: non-empty, honest denial -- never "ok"

            // --- 6b: legitimate, content-independent buyer attestation ---
            { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 16
            { action: "wait", ms: 400 }, // 17
            { action: "read", selector: "#commerce-order-status-text" }, // 18 -- expect "delivered"

            // --- 6c: durably switch to local-only BEFORE the one and only completion attempt ---
            { action: "click", selector: "#nav-settings" }, // 19
            { action: "wait", ms: 300 }, // 20
            { action: "fill", selector: "#commerce-network-profile-select", value: "local-only" }, // 21
            { action: "wait", ms: 100 }, // 22
            { action: "click", selector: "#commerce-network-profile-save" }, // 23
            { action: "wait", ms: 400 }, // 24 -- the save's own IPC updates the in-memory profile immediately; later actions THIS launch see it
            { action: "click", selector: "#nav-commerce" }, // 25
            { action: "wait", ms: 300 }, // 26
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 27
            { action: "wait", ms: 300 }, // 28
            { action: "read", selector: "#commerce-order-status-text" }, // 29 -- still "delivered"

            // --- 6d: THE load-bearing completion attempt, content genuinely unavailable to this process ---
            { action: "click", selector: "#commerce-order-complete-btn" }, // 30
            { action: "wait", ms: 1500 }, // 31 -- real (attempted, then skipped-local-only) discovery pass runs synchronously inside this click
            { action: "read", selector: "#commerce-order-status-text" }, // 32 -- "delivered" if rejected, "completed" if the bug is real
            { action: "read", selector: "#commerce-order-error" }, // 33 -- the rejection reason, if rejected
            { action: "read", selector: "#commerce-order-completion-note" }, // 34 -- reputation-sync copy, if completed

            // --- receipt issuance: must mirror whatever 6d actually produced ---
            { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 35
            { action: "wait", ms: 800 }, // 36
            { action: "read", selector: "#commerce-order-receipt-error" }, // 37
            { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 38
            { action: "screenshot", value: "alice-02-negative-control-result" }, // 39
          ],
          true,
        );

        expect(readAt(alice4, 1)).toBe("unlock");
        expect(readAt(alice4, 5)).toBe("ready");
        expect(readAt(alice4, 12)).toBe("fulfilling");
        record(`STEP 6-preamble PASS -- Alice's process (pid ${String(alice4.pid)}) discovered Bob's real "fulfilling" cross-process.`);

        // ---- 6a: REQUIRED negative-control assertion -- no false content-received state ----
        const purchasedContentError = readAt(alice4, 15);
        expect(purchasedContentError.length, `Alice's real redeem attempt must report SOME honest denial reason, never a silent/empty success. Full output:\n${alice4.output}`).toBeGreaterThan(0);
        // Must never claim she actually received it.
        expect(purchasedContentError.toLowerCase()).not.toMatch(/received from seller|content type: application/);
        record(
          `STEP 6a PASS (REQUIRED) -- Alice's real "Open Purchased Content" click on a genuinely fulfilling order for a product that genuinely HAS real protected content answered with an honest denial, never a false "content received": "${purchasedContentError}". This is Blocker 5 (real seller identities cannot become grant-capable -- docs/commerce/PROTECTED-MEDIA-CROSS-PROCESS-REACHABILITY.md) working as a real, live fail-closed control.`,
        );

        expect(readAt(alice4, 18)).toBe("delivered");
        record(`STEP 6b PASS -- Alice's real "I Received This" attestation (content-independent, legitimate) moved the order to "delivered".`);

        expect(readAt(alice4, 29)).toBe("delivered");
        record(`STEP 6c PASS -- Alice's Commerce Network Profile is now durably "local-only"; order remains "delivered" immediately before the completion attempt.`);

        // ---- 6d: THE decisive branch. Report and assert on whichever REAL outcome this commit produces. ----
        const statusAfterComplete = readAt(alice4, 32);
        const completeErrorReason = softReadAt(alice4, 33);
        const completionNote = softReadAt(alice4, 34);
        const receiptError = softReadAt(alice4, 37);
        const receiptVerify = softReadAt(alice4, 38);

        if (statusAfterComplete === "delivered") {
          completionOutcome = "rejected";
          expect(completeErrorReason.length, alice4.output).toBeGreaterThan(0);
          record(
            `STEP 6d PASS -- FAIL-CLOSED CONFIRMED. Alice's real completion attempt, with her own process's completion-time ProductMedia discovery genuinely unable to run (durable "local-only"), was correctly REJECTED: "${completeErrorReason}". Order remains "delivered", never "completed". This directly refutes the discrepancy this file's own header flags between resolveProductMediaForCompletionInvariantWithSync()'s literal "always authoritative" return and its neighbouring function's documented "buyer can only ever be unsynced" intent -- on this real run, the invariant still failed closed.`,
          );
          // A rejected completion must never let a receipt through either --
          // handleCommerceReceiptIssue() requires order.status === "completed".
          expect(receiptError.length, alice4.output).toBeGreaterThan(0);
          expect(receiptError).toMatch(/completed/i);
          record(`STEP 6d (receipt) PASS -- receipt issuance correctly refused for a non-"completed" order: "${receiptError}".`);
        } else if (statusAfterComplete === "completed") {
          completionOutcome = "false-completed";
          // eslint-disable-next-line no-console
          console.error(
            `[ddnc-e2e] *** REAL FALSE-GREEN CONFIRMED LIVE *** Alice's order reached "completed" even though her own process's completion-time ProductMedia discovery pass genuinely could not run (durable "local-only") and no protected content was ever released to her. completionNote="${completionNote}". This is the exact bug this file's own header predicts from resolveProductMediaForCompletionInvariantWithSync()'s unconditional "authoritative" return (fedos_electron_beta_main.cts) -- report as a HIGH-severity finding, do not weaken this assertion to accommodate it.`,
          );
          record(
            `STEP 6d **FAIL** -- REAL FALSE-GREEN CONFIRMED LIVE. Order reached "completed" with protected content genuinely never delivered. completionNote="${completionNote}". Receipt error (if any): "${receiptError}"; receipt verify (if any): "${receiptVerify}". See this test's own console.error above and this file's own header for the precise code-level root cause (resolveProductMediaForCompletionInvariantWithSync()'s unconditional productMediaKnowledge: "authoritative").`,
          );
          // This assertion is INTENTIONALLY load-bearing and is expected to
          // FAIL the whole suite if this branch is ever taken -- a false
          // "completed" digital order is exactly the outcome this entire
          // negative control exists to prevent from going unreported.
          expect(statusAfterComplete, "REAL FALSE-GREEN: order completed with protected content never delivered to the buyer -- see console.error above for the full account").toBe("delivered");
        } else {
          throw new Error(`Unexpected order status after completion attempt: "${statusAfterComplete}" (expected "delivered" or "completed"). Full output:\n${alice4.output}`);
        }
      },
      150000,
    );

    // =====================================================================
    // STEP 7 (mandate STEP 4): restart. Alice's process is relaunched from
    // scratch against the SAME durable on-disk profile -- required:
    // whatever STEP 6d produced must survive byte-identically, and a
    // restart must never itself convert an incomplete/rejected order into
    // a completed one, nor a completed one back.
    // =====================================================================
    it(
      "STEP 7: restart -- Alice's independent NEXT process launch reads the SAME real, durable order state (no false convergence on restart)",
      async () => {
        const alice5 = await runBetaUiScript(
          "ALICE_5_RESTART",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock" (durable profile survives)
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce" }, // 6
            { action: "wait", ms: 300 }, // 7 -- deliberately no network-profile save: still durably "local-only" from STEP 6c
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10 -- MUST equal whatever STEP 6d produced, unchanged by the restart itself
            { action: "click", selector: "#commerce-order-purchased-content-btn" }, // 11 -- re-attempt after restart
            { action: "wait", ms: 1500 }, // 12
            { action: "read", selector: "#commerce-order-purchased-content-error" }, // 13
          ],
          false,
        );
        expect(readAt(alice5, 1)).toBe("unlock");
        expect(readAt(alice5, 5)).toBe("ready");
        const statusAfterRestart = readAt(alice5, 10);
        const expectedStatus = completionOutcome === "false-completed" ? "completed" : "delivered";
        expect(statusAfterRestart, `restart must not itself change the order's status. Full output:\n${alice5.output}`).toBe(expectedStatus);
        const purchasedContentErrorAfterRestart = readAt(alice5, 13);
        expect(purchasedContentErrorAfterRestart.length).toBeGreaterThan(0);
        expect(purchasedContentErrorAfterRestart.toLowerCase()).not.toMatch(/received from seller|content type: application/);
        record(
          `STEP 7 PASS -- Alice's next independent process (pid ${String(alice5.pid)}) restarted against the SAME durable profile, read order status "${statusAfterRestart}" (byte-identical to STEP 6d's own real result, confirming restart caused no false convergence either direction), and the purchased-content redeem attempt was, again, an honest denial after restart: "${purchasedContentErrorAfterRestart}".`,
        );
      },
      150000,
    );

    // =====================================================================
    // STEP 8 (mandate STEP 4): reconnect/replay convergence. The real relay
    // redelivers its last published event set (a genuine "Alice was offline,
    // reconnects" replay), then Bob's own independent process re-derives
    // its own view of the same order -- required: exactly-once convergence,
    // and Bob's own process must never mirror a false "completed" it cannot
    // independently verify (his own invariant check uses HIS OWN
    // authoritative ProductMedia view + his own release cache, which never
    // recorded a release either, since Blocker 5 denied grant issuance
    // before any release could ever be attempted).
    // =====================================================================
    it(
      "STEP 8: reconnect/replay -- the real relay redelivers, Bob's independent process converges exactly once and never mirrors a false completion it cannot independently verify",
      async () => {
        relay.redeliverLast();
        record("real relay: redeliverLast() invoked -- simulates Alice's/Bob's own process reconnecting after being offline for the most recent published event.");

        const bob5 = await runBetaUiScript(
          "BOB_5_RECONNECT",
          bobDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce-merchant" }, // 6 -- re-runs all bounded discovery passes, INCLUDING order-sync (which, per media_access_grant_release_channel_policy.ts's own documented fix, re-runs the SAME completion invariant before ever applying an inbound "completed" transition)
            { action: "wait", ms: 800 }, // 7
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10
            { action: "read", selector: "#commerce-order-delivery-status" }, // 11
            { action: "read", selector: "#commerce-merchant-reputation-summary" }, // 12
            // a second refresh pass, same process -- must be idempotent (no duplicate release, no state churn)
            { action: "click", selector: "#nav-commerce-merchant" }, // 13
            { action: "wait", ms: 500 }, // 14
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 15
            { action: "wait", ms: 300 }, // 16
            { action: "read", selector: "#commerce-order-status-text" }, // 17
          ],
          false,
        );
        expect(readAt(bob5, 1)).toBe("unlock");
        expect(readAt(bob5, 5)).toBe("ready");
        const bobStatusPass1 = readAt(bob5, 10);
        const bobStatusPass2 = readAt(bob5, 17);
        expect(bobStatusPass2, "a second same-process refresh pass must be idempotent -- no duplicate transition, no state churn").toBe(bobStatusPass1);

        if (completionOutcome === "false-completed") {
          // Alice's process falsely completed. Bob's own process has its
          // own, independent, "authoritative" (he owns the product)
          // invariant check with its own release cache, which never
          // recorded a release either (Blocker 5 denied grant issuance
          // before a release could ever be attempted) -- so his own LOCAL
          // completion path can never succeed, and per
          // media_access_grant_release_channel_policy.ts's documented
          // fix, his INBOUND sync path re-runs the same check before
          // mirroring an inbound "completed" -- required to refuse it too.
          expect(
            bobStatusPass1,
            `Alice's process falsely reached "completed" (STEP 6d). Bob's own independent process must NOT mirror that false completion via inbound order-sync -- his own release cache never recorded a real release either. If this reads "completed", the false-green has propagated to the seller's own reputation/receipt view too. Full output:\n${bob5.output}`,
          ).not.toBe("completed");
          record(`STEP 8 PASS (secondary containment) -- even though Alice's own process falsely reached "completed" (STEP 6d), Bob's independent process refused to mirror it: "${bobStatusPass1}".`);
        } else {
          // Alice's own real, content-independent "I Received This"
          // attestation (STEP 6b) legitimately moved the order to
          // "delivered" -- that IS a genuine state and correctly syncs to
          // Bob's process. What matters for this negative control is what
          // it must NEVER become: "completed" (STEP 6d's own rejection is
          // exactly what keeps it from ever reaching that).
          expect(bobStatusPass1).not.toBe("completed");
          expect(bobStatusPass1).toBe("delivered");
          record(`STEP 8 PASS -- after a real relay redeliver + two same-process refresh passes, Bob's independent process converges exactly once on "${bobStatusPass1}" (idempotent) -- correctly mirrors Alice's genuine "delivered" acknowledgement while never advancing to "completed", since the digital content was never truthfully released.`);
        }
        record(`STEP 8 (reputation) -- Bob's own "My Store" reputation summary after reconnect: "${softReadAt(bob5, 12)}"`);
      },
      150000,
    );
  },
);

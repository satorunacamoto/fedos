/**
 * FedOS "Real Digital Delivery" mega-arc (Coordinator) -- the LIVE, REAL,
 * POSITIVE two-independent-Electron-process digital delivery E2E that Agent
 * G's grant-custody fix (`commerce_media_grant_signing_key_delegation_bridge.ts`
 * -- a real seller-identity-signed delegation certificate naming the
 * already-durable media-grant-signing key as an authorized delegate) was
 * built to unblock. This is the mirror image of
 * `commerce_digital_delivery_negative_control_real_electron.test.ts` (read
 * that file's own header FIRST -- this suite deliberately duplicates its
 * harness, constants shape, and phase discipline rather than importing it,
 * for the exact same reason that file gives: avoiding shared-fixture
 * `tsconfig.test.json` cross-config friction). Two REAL, INDEPENDENT
 * Electron processes (Bob the seller, Alice the buyer), each their own real
 * local Persona, talking ONLY through a real local Nostr-shaped relay this
 * suite itself starts. No same-process shortcut, no shared in-memory state,
 * no fixture identity, no same-process wrap/unwrap stand-in.
 *
 * WHAT CHANGED SINCE THE NEGATIVE CONTROL: at this commit,
 * `issueCommerceMediaAccessGrantsNonFatal()` (`fedos_electron_beta_main.cts`,
 * called from the seller's own "Mark Fulfilling" action) now mints a REAL
 * media-grant-signing keypair AND a real delegation certificate
 * (`commerceCertifyMediaGrantDelegateSigningKey()`) signed by the seller's
 * OWN real Nostr identity key -- so `issueMediaAccessGrantsForOrder()`'s
 * `sellerAuthorizedDelegateSigningKeys` gate, which the negative control
 * proved was structurally unsatisfiable for a real seller, is now genuinely
 * satisfiable. This suite proves that live, end to end, across two real
 * processes, with a byte-for-byte SHA-256 digest check as the core proof
 * (never "content available === true" alone) -- exactly this arc's own
 * mandate.
 *
 * PHASE DISCIPLINE (per this arc's own instruction: "DO NOT write one giant
 * fragile test -- split into durable, independently-runnable phases"): each
 * `it()` below is its own bounded-timeout phase, in Agent N's own file's
 * shape -- module-scope `let` state threaded phase-to-phase, progressive
 * append-only evidence written to disk after every phase (so a suite killed
 * mid-run still leaves a real, honest record of exactly how far it got and
 * what it proved), and the SAME owned-PID-only cleanup discipline (never a
 * broad kill by process name).
 *
 * PHASE MAP:
 *   STEP 1 -- Bob creates a real Persona, attaches REAL protected purchased
 *             content (a real 1024-byte %PDF-1.4 fixture, real WASM
 *             ChaCha20Poly1305 encryption, real IPC attach path) with a
 *             KNOWN SHA-256 digest recorded BEFORE it is ever encrypted,
 *             and publishes.
 *   STEP 2 -- Alice (separate process, separate real Persona) discovers
 *             cross-process and submits a real Order.
 *   STEP 3 -- Bob accepts; Alice pays (TEST/LOCAL simulated settlement,
 *             never real money).
 *   STEP 4 -- CONTENT CONFIDENTIALITY CONTROL: Alice's redeem attempt right
 *             after paying, BEFORE Bob has ever fulfilled (i.e. before any
 *             real `MediaAccessGrant` has been issued for this triple), is
 *             proven to recover NO plaintext whatsoever -- an honest denial,
 *             never a data: URL, never a false "content received".
 *   STEP 5 -- Bob fulfills. THIS is the one real production call site for
 *             grant issuance (`issueCommerceMediaAccessGrantsNonFatal()`).
 *             Immediately after, this suite independently re-verifies the
 *             REAL signed grant envelope Bob's own process durably wrote to
 *             disk -- using the SAME real `verifyMediaAccessGrantEnvelope()`
 *             production function, from THIS test process, never trusting
 *             Bob's own process's self-report -- checking signature
 *             validity, buyer binding, product binding, media binding, and
 *             qualifying-Order binding explicitly (never just "a grant
 *             exists").
 *   STEP 6 -- Alice's FIRST redeem attempt (a fresh, separate process
 *             launch) is honestly "pending" -- Bob's own process is not
 *             live to answer her request yet (a real, unforced mid-flight
 *             timing gap this architecture's own request/response design
 *             produces, not a contrived delay). A SECOND separate process
 *             launch (a genuine restart, mid-flight, while still awaiting
 *             grant/release) proves the restart itself causes no false
 *             success, no duplicate request explosion, no lost request.
 *   STEP 7 -- Bob comes online (separate process) and answers the queued
 *             request for real (real cross-process wrap/release, gated by
 *             the now-real delegation certificate). Alice reconnects
 *             (separate process) and receives the actual protected bytes,
 *             cross-process, real network round trip -- decrypts, and this
 *             suite asserts the received plaintext's SHA-256 digest matches
 *             the KNOWN digest recorded in STEP 1, BYTE FOR BYTE. This is
 *             the core proof point this whole suite exists to establish.
 *   STEP 8 -- Alice acknowledges receipt and completes the order with
 *             REAL delivered content (the digital-content-delivery
 *             invariant is satisfied truthfully this time, not via the
 *             mislabelled-"authoritative" false-green path the negative
 *             control's own header flags); issues + verifies a real signed
 *             receipt. Bob's independent process confirms the SAME
 *             completion and a truthful reputation reflection.
 *   STEP 9 -- FULL RESTART after successful delivery: both apps closed
 *             normally, both relaunched from scratch, against the SAME
 *             durable on-disk state -- Product/ProductMedia/Order/Payment/
 *             Delivery/grant/content-access/receipt/reputation all still
 *             correct, and the content remains accessible (a real cache
 *             hit, re-verified digest, no re-request needed).
 *
 * STEP (content integrity / tamper rejection) is deliberately NOT
 * duplicated here as a new live cross-process test -- see this file's own
 * final `describe.skip`-adjacent comment block near the bottom for exactly
 * why the pre-existing, already-real, already-passing domain-layer tests in
 * `test/commerce_private_media_release_end_to_end.test.ts` (`"REJECT:
 * corrupted/tampered wire content..."`, asserting `outcome ===
 * "content-corrupt"`, and `"REJECT (Agent C): stored ciphertext checksum
 * does not match..."`, asserting `reason === "content-checksum-mismatch"`)
 * already cover this real production code path (the SAME
 * `applyInboundPrivateMediaReleaseResponse()`/`buildOutboundPrivateMediaReleaseResponse()`
 * functions this suite's own STEP 7 exercises live) with real corrupted
 * bytes and a real fail-closed digest check -- adding a second live-Electron
 * copy of the identical assertion would be pure duplication, not new
 * coverage, and would only add more multi-minute Electron launches to an
 * already-long suite.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
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

const evidenceDir = `${repoRoot}/docs/commerce/evidence/commerce_e2e_digital_delivery_positive`;
const evidenceMdPath = `${repoRoot}/docs/commerce/evidence/commerce_e2e_digital_delivery_positive_evidence.md`;
const screenshotDir = `${evidenceDir}/screens`;

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-ddpos-e2e-${label}-`));
  tmpRoots.push(dir);
  return dir;
}

let evidenceInitialized = false;
function record(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[ddpos-e2e] ${line}`);
  const prefix = evidenceInitialized
    ? ""
    : `# Commerce Digital Delivery POSITIVE E2E -- REAL two-independent-Electron-process evidence\n\nGenerated by commerce_digital_delivery_positive_real_electron.test.ts\n\nStarted: ${new Date().toISOString()}\n\n`;
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
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" | "href" }
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

/** A real, 1024-byte PDF with a genuine `%PDF-1.4` header and a known SHA-256 digest. */
function realSmallPdfBytes(): Buffer {
  const bytes = Buffer.alloc(1024, 0x20);
  Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1").copy(bytes, 0);
  Buffer.from("FedOS Real Digital Delivery mega-arc -- positive E2E fixture\n", "latin1").copy(bytes, 64);
  Buffer.from("\n%%EOF\n", "latin1").copy(bytes, 1024 - 7);
  return bytes;
}
const REAL_PDF_BYTES = realSmallPdfBytes();
const REAL_PDF_BASE64 = REAL_PDF_BYTES.toString("base64");
function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
/** THE known digest, recorded BEFORE the content is ever encrypted/attached -- the value every later phase's proof is checked against. */
const REAL_PDF_SHA256 = sha256Hex(REAL_PDF_BYTES);

const BOB_LABEL = "Digital Delivery Positive E2E -- Bob";
const BOB_PASSPHRASE = "digital delivery positive e2e bob real passphrase";
const ALICE_LABEL = "Digital Delivery Positive E2E -- Alice";
const ALICE_PASSPHRASE = "digital delivery positive e2e alice real passphrase";
const PRODUCT_TITLE = "FedOS Digital Delivery Positive E2E Item";
const PRODUCT_DESCRIPTION = "Real protected-content product for the Digital Delivery Positive E2E -- declares a real purchased PDF released via a real grant.";
const ROW = "#commerce-merchant-products-list li:last-child";

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
    "commerce_digital_delivery_positive_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the real Electron binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite(
  "FedOS Commerce Digital Delivery -- LIVE POSITIVE E2E, REAL two independent Electron processes, real protected content genuinely delivered to the buyer via the fixed delegation-certificate grant-custody flow",
  () => {
    let relay: FedosRealLocalWebSocketRelayServer;
    let bobDataDir: string;
    let aliceDataDir: string;
    let bobPubkey = "";
    let alicePubkey = "";
    let orderId = "";
    let productMediaGrantsFilePath = "";
    /** The base64 the buyer's real received content is checked against, captured once in STEP 7. */
    let receivedContentBase64 = "";

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
      productMediaGrantsFilePath = join(bobDataDir, "profile", "commerce", "media_access_grants.ndjson");
      record(`Bob dataDir: ${bobDataDir}`);
      record(`Alice dataDir: ${aliceDataDir}`);
      record(`Real protected-content fixture: 1024-byte %PDF-1.4, KNOWN sha256=${REAL_PDF_SHA256} (recorded before any encryption/attach)`);
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
    // STEP 1: Bob creates a real Persona, attaches REAL protected purchased
    // content (known SHA-256, real WASM encryption), publishes.
    // =====================================================================
    it(
      "STEP 1: Bob creates+publishes a real product carrying REAL protected purchased content (known SHA-256)",
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
        record(`STEP 1a PASS -- Bob's process (pid ${String(bob1.pid)}) created a REAL local Persona. Bob's real pubkey: ${bobPubkey}`);

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
            { action: "read", selector: "#commerce-merchant-products-list" }, // 22

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
        expect(readAt(bob2, 27), bob2.output).toBe("");
        const summary = readAt(bob2, 28);
        expect(summary).toMatch(/Buyers only \(unlocked after purchase\)/);
        expect(summary).toMatch(/Full guide \(PDF\)/);
        const publishedText = readAt(bob2, 32);
        expect(publishedText).toMatch(/—\s*active/);
        record(
          `STEP 1b PASS -- BOB ATTACH CONTENT: Bob's process (pid ${String(bob2.pid)}) attached a REAL 1024-byte %PDF-1.4 file (KNOWN sha256=${REAL_PDF_SHA256}) as PROTECTED purchased content (real WASM ChaCha20Poly1305 encryption, no storage error), and published the product + its real product-media-declaration to the real local relay. Seller-facing summary: "${summary}"`,
        );
      },
      150000,
    );

    // =====================================================================
    // STEP 2: Alice (independent process, independent real Persona)
    // discovers Bob's product, submits a real Order.
    // =====================================================================
    it(
      "STEP 2: Alice (separate process, separate real Persona) discovers Bob's product cross-process and submits a real Order",
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
        record(`STEP 2a PASS -- Alice's process (pid ${String(alice1.pid)}) created a REAL local Persona. Alice's real pubkey: ${alicePubkey}`);

        const alice2 = await runBetaUiScript(
          "ALICE_2_DISCOVER_ORDER",
          aliceDataDir,
          [
            ...returningLaunchPreamble(ALICE_PASSPHRASE, "direct", "#commerce-acting-as", alicePubkey), // 0..13
            { action: "click", selector: "#nav-commerce" }, // 14
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
        // The renderer prints this element's textContent as `Order id: <hex>`
        // (`fedos_electron_beta_renderer.ts`'s own
        // `byId("commerce-order-id").textContent = \`Order id: ${order.id}\``)
        // -- strip the label prefix so this suite's own `orderId` is the REAL
        // domain `Order.id` value, exactly comparable against a grant
        // envelope's `payload.orderId` in STEP 5's independent verification.
        const orderIdRaw = readAt(alice2, 26);
        expect(orderIdRaw.length).toBeGreaterThan(0);
        orderId = orderIdRaw.replace(/^Order id:\s*/, "");
        expect(orderId.length).toBeGreaterThan(0);
        record(`STEP 2b PASS -- ORDER: Alice's process (pid ${String(alice2.pid)}) discovered Bob's real published product cross-process and submitted a real Order. orderId=${orderId}`);
      },
      150000,
    );

    // =====================================================================
    // STEP 3: Bob accepts; Alice pays (TEST/LOCAL simulated settlement,
    // never real money).
    // =====================================================================
    it(
      "STEP 3: Bob (separate process) accepts the real cross-process Order; Alice pays (TEST/LOCAL)",
      async () => {
        const bob3 = await runBetaUiScript(
          "BOB_3_ACCEPT",
          bobDataDir,
          [
            ...returningLaunchPreamble(BOB_PASSPHRASE, "direct", "#commerce-merchant-acting-as", bobPubkey), // 0..13
            { action: "click", selector: "#nav-commerce-merchant" }, // 14
            { action: "wait", ms: 700 }, // 15
            { action: "read", selector: "#commerce-merchant-orders-list" }, // 16
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
        record(`STEP 3a PASS -- Bob's process (pid ${String(bob3.pid)}) discovered+accepted Alice's real Order cross-process.`);

        const alice3 = await runBetaUiScript(
          "ALICE_3_PAY",
          aliceDataDir,
          [
            ...returningLaunchPreamble(ALICE_PASSPHRASE, "direct", "#commerce-acting-as", alicePubkey), // 0..13
            { action: "click", selector: "#nav-commerce" }, // 14
            { action: "wait", ms: 700 }, // 15
            { action: "read", selector: "#commerce-my-orders-list" }, // 16
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 17
            { action: "wait", ms: 300 }, // 18
            { action: "read", selector: "#commerce-order-status-text" }, // 19 -- expect "accepted" (cross-process)
            { action: "click", selector: "#commerce-order-payment-request-btn" }, // 20
            { action: "wait", ms: 400 }, // 21
            { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 22 -- TEST/LOCAL settlement, NEVER real money
            { action: "wait", ms: 400 }, // 23
            { action: "read", selector: "#commerce-order-status-text" }, // 24 -- expect "paid"
          ],
          false,
        );
        expect(readAt(alice3, 19)).toBe("accepted");
        expect(readAt(alice3, 24)).toBe("paid");
        record(`STEP 3b PASS -- AUTHORITATIVE PAID: Alice's process (pid ${String(alice3.pid)}) discovered Bob's real accept cross-process and paid (TEST/LOCAL simulated settlement). Order is authoritatively "paid".`);
      },
      180000,
    );

    // =====================================================================
    // STEP 4: CONTENT CONFIDENTIALITY CONTROL. Right after paying, BEFORE
    // Bob has ever fulfilled (i.e. before `issueCommerceMediaAccessGrantsNonFatal()`
    // has ever run for this Order -- the ONE real production trigger point
    // for grant issuance), Alice's redeem attempt MUST recover no plaintext
    // whatsoever.
    // =====================================================================
    it(
      "STEP 4 (CONTENT CONFIDENTIALITY): Alice's redeem attempt after paying, before any grant is issued, recovers NO plaintext -- ciphertext-only, honest denial",
      async () => {
        const alice4 = await runBetaUiScript(
          "ALICE_4_PRE_GRANT_CONFIDENTIALITY_CONTROL",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 6
            { action: "wait", ms: 200 }, // 7
            { action: "click", selector: "#nav-commerce" }, // 8
            { action: "wait", ms: 700 }, // 9
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 10
            { action: "wait", ms: 300 }, // 11
            { action: "read", selector: "#commerce-order-status-text" }, // 12 -- expect "paid" -- no grant has EVER been issued at this point

            { action: "click", selector: "#commerce-order-purchased-content-btn" }, // 13
            { action: "wait", ms: 1500 }, // 14 -- real cross-process private-media-release-request round trip attempt
            { action: "read", selector: "#commerce-order-purchased-content-error" }, // 15 -- REQUIRED: non-empty, honest denial
            { action: "read", selector: "#commerce-order-purchased-content-link", as: "href" }, // 16 -- REQUIRED: must never become a data: URL
            { action: "screenshot", value: "alice-02-pre-grant-confidentiality-control" }, // 17
          ],
          true,
        );
        expect(readAt(alice4, 1)).toBe("unlock");
        expect(readAt(alice4, 5)).toBe("ready");
        expect(readAt(alice4, 12)).toBe("paid");

        const purchasedContentError = readAt(alice4, 15);
        expect(purchasedContentError.length, `Alice's real redeem attempt (before any grant was ever issued) must report SOME honest denial, never a silent success. Full output:\n${alice4.output}`).toBeGreaterThan(0);
        expect(purchasedContentError.toLowerCase()).not.toMatch(/received from seller|content type: application/);

        const linkHref = readAt(alice4, 16);
        expect(linkHref, `the purchased-content link must never resolve to a data: URL before any real grant/release has happened. Full output:\n${alice4.output}`).not.toMatch(/^data:/);
        expect(linkHref).not.toContain("base64,");

        record(
          `STEP 4 PASS (REQUIRED, CONTENT CONFIDENTIALITY) -- Alice's real "Open Purchased Content" click on a genuinely "paid" order for a product that genuinely HAS real protected content, BEFORE any grant was ever issued, produced NO plaintext whatsoever: honest denial "${purchasedContentError}", link href never became a data: URL ("${linkHref}"). This is real ciphertext-only confidentiality, proven live, never a mock.`,
        );
      },
      120000,
    );

    // =====================================================================
    // STEP 5: Bob fulfills -- THE real production trigger for grant
    // issuance via the now-fixed delegation-certificate flow. Immediately
    // after, this suite independently re-verifies the REAL signed grant
    // envelope Bob's own process durably wrote, using the same real
    // `verifyMediaAccessGrantEnvelope()` production function -- never
    // trusting Bob's own self-report.
    // =====================================================================
    it(
      "STEP 5: Bob fulfills (real grant issuance via the fixed delegation-certificate flow) + this suite independently verifies the real signed grant envelope",
      async () => {
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
            { action: "click", selector: "#commerce-order-fulfill-btn" }, // 19 -- triggers issueCommerceMediaAccessGrantsNonFatal()
            { action: "wait", ms: 1500 }, // 20 -- real delegation cert mint+verify, real grant sign+persist
            { action: "read", selector: "#commerce-order-status-text" }, // 21 -- expect "fulfilling"
          ],
          false,
        );
        expect(readAt(bob4, 18)).toBe("paid");
        expect(readAt(bob4, 21)).toBe("fulfilling");
        record(`STEP 5a PASS -- Bob's process (pid ${String(bob4.pid)}) discovered Alice's real payment evidence cross-process and fulfilled, triggering real grant issuance via the delegation-certificate flow.`);
        {
          const diagnosticLines = bob4.output.split("\n").filter((l) => /grant|delegat|Commerce media/i.test(l));
          record(`STEP 5a DIAGNOSTIC -- Bob's raw process console lines matching /grant|delegat|Commerce media/i (${String(diagnosticLines.length)} lines):\n${diagnosticLines.join("\n")}`);
        }

        // ---- Independent re-verification: real durable file, real production verify function, THIS process, never Bob's own self-report. ----
        expect(existsSync(productMediaGrantsFilePath), `Bob's real durable media_access_grants.ndjson must exist after a real grant was issued: ${productMediaGrantsFilePath}`).toBe(true);
        const rawLines = readFileSync(productMediaGrantsFilePath, "utf8")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        expect(rawLines.length, "at least one real grant envelope must have been durably written").toBeGreaterThan(0);
        const envelopes = rawLines.map((l) => JSON.parse(l) as Record<string, unknown>);
        const candidate = envelopes
          .map((e) => ({ envelope: e, payload: e.payload as Record<string, unknown> }))
          .filter((e) => e.payload.orderId === orderId && e.payload.buyerPubkey === alicePubkey)
          .sort((a, b) => (b.payload.grantVersion as number) - (a.payload.grantVersion as number))[0];
        expect(candidate, `no grant envelope found for orderId=${orderId}, buyerPubkey=${alicePubkey} in ${productMediaGrantsFilePath}. Raw contents:\n${rawLines.join("\n")}`).toBeDefined();

        const commerceModule = (await import(commerceDistPath)) as {
          verifyMediaAccessGrantEnvelope: (envelope: unknown) => { readonly status: string; readonly payload?: Record<string, unknown>; readonly signerPublicKeyHex?: string; readonly detail?: string };
        };
        const verifyResult = commerceModule.verifyMediaAccessGrantEnvelope(candidate!.envelope);
        expect(verifyResult.status, `real signature verification of Bob's own durably-written grant envelope must succeed: ${JSON.stringify(verifyResult)}`).toBe("VALID");
        const verifiedPayload = verifyResult.payload!;

        // Explicit, independent field-by-field binding checks -- never "a grant exists".
        expect(verifiedPayload.buyerPubkey, "BUYER BINDING").toBe(alicePubkey);
        expect(verifiedPayload.orderId, "QUALIFYING TRADE BINDING (order)").toBe(orderId);
        expect(verifiedPayload.revoked, "not revoked").toBe(false);
        expect(typeof verifiedPayload.productId, "PRODUCT BINDING (non-empty productId)").toBe("string");
        expect((verifiedPayload.productId as string).length).toBeGreaterThan(0);
        expect(typeof verifiedPayload.mediaId, "MEDIA BINDING (non-empty mediaId)").toBe("string");
        expect((verifiedPayload.mediaId as string).length).toBeGreaterThan(0);
        // The envelope's own real signer (`keyId`, independently re-derived by
        // `verifyMediaAccessGrantEnvelope()` from the Schnorr signature
        // itself, never trusted from the unverified JSON) must equal the
        // payload's own claimed `issuerPubkey` -- `verifyMediaAccessGrantEnvelope()`'s
        // own step 4 enforces this; asserted explicitly here too.
        expect(verifyResult.signerPublicKeyHex, "ISSUER/SIGNER BINDING").toBe(verifiedPayload.issuerPubkey);
        record(
          `STEP 5b PASS (REQUIRED, GRANT) -- this suite independently re-verified Bob's real durably-written MediaAccessGrant envelope from ${productMediaGrantsFilePath}, using the real production verifyMediaAccessGrantEnvelope() function from THIS process (never trusting Bob's own self-report): signature VALID, signer=${String(verifyResult.signerPublicKeyHex)}, buyerPubkey=${String(verifiedPayload.buyerPubkey)} (matches Alice), orderId=${String(verifiedPayload.orderId)} (matches the real Order), productId=${String(verifiedPayload.productId)}, mediaId=${String(verifiedPayload.mediaId)}, revoked=false. Note: the binding of this grant's delegate signer key to Bob's REAL Nostr identity is separately enforced by the delegation-certificate check inside issuance/evaluation (\`commerce_media_grant_signing_key_delegation_bridge.ts\`), and the OUTER private-media-release-response event Alice receives in STEP 7 is independently required to be signed by Bob's real identity key (\`order.sellerPubkey\`) -- see STEP 7's own record for that separate proof.`,
        );
      },
      150000,
    );

    // =====================================================================
    // STEP 6: Alice's FIRST redeem attempt is a fresh, separate process --
    // Bob's own process is not live to answer her request yet, so this is
    // an honest "pending", never a false success. A SECOND separate process
    // launch (a genuine restart, mid-flight, still awaiting grant/release)
    // proves the restart itself causes no false success, no duplicate
    // request explosion, no lost authorization.
    // =====================================================================
    it(
      "STEP 6: Alice's first redeem attempt is honestly pending (Bob not live to answer yet); a genuine mid-flight restart causes no false success and no lost/duplicated request",
      async () => {
        const alice5 = await runBetaUiScript(
          "ALICE_5_REDEEM_ATTEMPT_1_PENDING",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 6
            { action: "wait", ms: 200 }, // 7
            { action: "click", selector: "#nav-commerce" }, // 8
            { action: "wait", ms: 700 }, // 9
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 10
            { action: "wait", ms: 300 }, // 11
            { action: "read", selector: "#commerce-order-status-text" }, // 12 -- expect "fulfilling" (Bob's real cross-process fulfil)
            { action: "click", selector: "#commerce-order-purchased-content-btn" }, // 13 -- sends a REAL private-media-release-request; Bob's process is not running to answer it
            { action: "wait", ms: 1500 }, // 14
            { action: "read", selector: "#commerce-order-purchased-content-error" }, // 15
            { action: "read", selector: "#commerce-order-purchased-content-link", as: "href" }, // 16 -- must still not be a data: URL
          ],
          false,
        );
        expect(readAt(alice5, 1)).toBe("unlock");
        expect(readAt(alice5, 5)).toBe("ready");
        expect(readAt(alice5, 12)).toBe("fulfilling");
        const firstAttemptError = readAt(alice5, 15);
        expect(firstAttemptError.length, `first redeem attempt must be an honest, non-empty state (pending/denied), never silent. Full output:\n${alice5.output}`).toBeGreaterThan(0);
        expect(readAt(alice5, 16)).not.toContain("base64,");
        record(
          `STEP 6a PASS -- Alice's FIRST real redeem attempt (pid ${String(alice5.pid)}), sent while Bob's own process is not live, was honestly reported (never a false success): "${firstAttemptError}". No plaintext recovered.`,
        );

        // A genuine restart -- new process, same durable state -- WHILE the release is still outstanding.
        const alice6 = await runBetaUiScript(
          "ALICE_6_MIDFLIGHT_RESTART",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock" (durable profile survives)
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce" }, // 6
            { action: "wait", ms: 700 }, // 7
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10 -- MUST still be "fulfilling" -- the restart itself must not fabricate a completion
            { action: "read", selector: "#commerce-order-purchased-content-link", as: "href" }, // 11 -- must STILL not be a data: URL (no false content from the restart alone)
          ],
          false,
        );
        expect(readAt(alice6, 1)).toBe("unlock");
        expect(readAt(alice6, 5)).toBe("ready");
        const statusAfterMidflightRestart = readAt(alice6, 10);
        expect(statusAfterMidflightRestart, `a mid-flight restart must never itself fabricate a completed/delivered state while the real release is still outstanding. Full output:\n${alice6.output}`).toBe("fulfilling");
        expect(readAt(alice6, 11)).not.toContain("base64,");
        record(
          `STEP 6b PASS (REQUIRED, MID-FLIGHT RESTART) -- Alice's next independent process (pid ${String(alice6.pid)}), restarted while the real grant/release is still outstanding, read the SAME durable order status "${statusAfterMidflightRestart}" with no false completion, no lost/duplicated authorization state, and still no plaintext content.`,
        );
      },
      180000,
    );

    // =====================================================================
    // STEP 7: Bob comes online (separate process) and answers the queued
    // request for real. Alice reconnects (separate process) and receives
    // the actual protected bytes cross-process -- THE CORE PROOF: the
    // received plaintext's SHA-256 digest matches the KNOWN digest recorded
    // in STEP 1, byte for byte.
    // =====================================================================
    it(
      "STEP 7: Bob comes online and releases for real; Alice reconnects and receives the ACTUAL protected bytes cross-process -- SHA-256 digest matches the KNOWN digest",
      async () => {
        const bob5 = await runBetaUiScript(
          "BOB_5_RESPOND_TO_QUEUED_REQUEST",
          bobDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce-merchant" }, // 6 -- runs commercePrivateMediaReleaseRequestDiscoverAndRespondNonFatal(): discovers Alice's queued request, real wrap/release, real cross-process send
            { action: "wait", ms: 1500 }, // 7
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10
          ],
          false,
        );
        expect(readAt(bob5, 1)).toBe("unlock");
        expect(readAt(bob5, 5)).toBe("ready");
        record(`STEP 7a PASS -- Bob's process (pid ${String(bob5.pid)}) came online, discovered Alice's queued real private-media-release-request, and answered it (real wrap/release gated by the fixed delegation-certificate flow). Order status now: "${readAt(bob5, 10)}"`);

        const alice7 = await runBetaUiScript(
          "ALICE_7_RECEIVE_REAL_BYTES",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 6
            { action: "wait", ms: 200 }, // 7
            { action: "click", selector: "#nav-commerce" }, // 8
            { action: "wait", ms: 700 }, // 9
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 10
            { action: "wait", ms: 300 }, // 11
            { action: "read", selector: "#commerce-order-status-text" }, // 12
            { action: "click", selector: "#commerce-order-purchased-content-btn" }, // 13 -- real cross-process response discovery + apply, real digest-verified decrypt
            { action: "wait", ms: 2000 }, // 14
            { action: "read", selector: "#commerce-order-purchased-content-error" }, // 15 -- REQUIRED: empty (real success)
            { action: "read", selector: "#commerce-order-purchased-content-status" }, // 16
            { action: "read", selector: "#commerce-order-purchased-content-link", as: "href" }, // 17 -- REQUIRED: a real data: URL carrying the actual bytes
            { action: "screenshot", value: "alice-03-real-content-received" }, // 18
          ],
          true,
        );
        expect(readAt(alice7, 1)).toBe("unlock");
        expect(readAt(alice7, 5)).toBe("ready");
        record(`STEP 7b -- Alice's order status on reconnect: "${readAt(alice7, 12)}"`);

        const redeemError = softReadAt(alice7, 15);
        expect(redeemError, `ACTUAL BYTES CROSS PROCESS: Alice's real reconnect redeem attempt must succeed with no error. Full output:\n${alice7.output}`).toBe("");
        const contentStatus = readAt(alice7, 16);
        expect(contentStatus).toMatch(/Content type: application\/pdf/);
        const contentLinkHref = readAt(alice7, 17);
        expect(contentLinkHref, "must be a real data: URL carrying base64 content").toMatch(/^data:application\/pdf;base64,/);

        const base64Marker = "base64,";
        const base64Index = contentLinkHref.indexOf(base64Marker);
        expect(base64Index).toBeGreaterThan(-1);
        receivedContentBase64 = contentLinkHref.slice(base64Index + base64Marker.length);
        const receivedBytes = Buffer.from(receivedContentBase64, "base64");
        const receivedSha256 = sha256Hex(receivedBytes);

        // ---- THE CORE PROOF ----
        expect(receivedBytes.length, "received byte length must match the original fixture exactly").toBe(REAL_PDF_BYTES.length);
        expect(
          receivedSha256,
          `THE CORE PROOF: the SHA-256 digest of the bytes Alice's real, independent process actually received and decrypted cross-process must equal the KNOWN digest recorded in STEP 1 BEFORE the content was ever encrypted. received=${receivedSha256} known=${REAL_PDF_SHA256}`,
        ).toBe(REAL_PDF_SHA256);
        expect(receivedBytes.equals(REAL_PDF_BYTES), "received bytes must be byte-for-byte identical to the original fixture, not merely digest-colliding").toBe(true);

        record(
          `STEP 7c PASS (REQUIRED, CORE PROOF -- ACTUAL BYTES CROSS PROCESS + ALICE OPENS CONTENT) -- Alice's real, independent process (pid ${String(alice7.pid)}) received ${String(receivedBytes.length)} real bytes cross-process from Bob's real, independent process, via the real, digest-verified private-media-release channel, gated by the now-fixed delegation-certificate grant flow. SHA-256 of received plaintext: ${receivedSha256} -- MATCHES the KNOWN digest recorded in STEP 1 (${REAL_PDF_SHA256}) exactly, and the bytes are byte-for-byte identical to the original fixture (Buffer.equals confirmed). Content type honestly reported: "${contentStatus}".`,
        );
      },
      180000,
    );

    // =====================================================================
    // STEP 8: Alice acknowledges receipt and completes the order with REAL
    // delivered content; issues + verifies a real signed receipt. Bob's
    // independent process confirms the same completion + truthful
    // reputation.
    // =====================================================================
    it(
      "STEP 8: Alice completes the order with REAL delivered content; real signed receipt issued+verified; Bob's independent process confirms truthful completion + reputation",
      async () => {
        const alice8 = await runBetaUiScript(
          "ALICE_8_ACK_COMPLETE_RECEIPT",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 6
            { action: "wait", ms: 200 }, // 7
            { action: "click", selector: "#nav-commerce" }, // 8
            { action: "wait", ms: 700 }, // 9
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 10
            { action: "wait", ms: 300 }, // 11
            { action: "read", selector: "#commerce-order-status-text" }, // 12

            { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 13
            { action: "wait", ms: 400 }, // 14
            { action: "read", selector: "#commerce-order-status-text" }, // 15 -- expect "delivered"

            { action: "click", selector: "#commerce-order-complete-btn" }, // 16 -- REAL content genuinely released this time: invariant should be satisfied truthfully
            { action: "wait", ms: 1500 }, // 17
            { action: "read", selector: "#commerce-order-status-text" }, // 18 -- REQUIRED: "completed"
            { action: "read", selector: "#commerce-order-error" }, // 19 -- expect ""

            { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 20
            { action: "wait", ms: 800 }, // 21
            { action: "read", selector: "#commerce-order-receipt-error" }, // 22 -- expect ""
            { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 23
            { action: "screenshot", value: "alice-04-order-completed-receipt" }, // 24
          ],
          true,
        );
        expect(readAt(alice8, 1)).toBe("unlock");
        expect(readAt(alice8, 5)).toBe("ready");
        expect(readAt(alice8, 15)).toBe("delivered");

        const statusAfterComplete = readAt(alice8, 18);
        expect(
          statusAfterComplete,
          `the digital-content-delivery invariant must be satisfied TRUTHFULLY this time -- real content was really released and digest-verified in STEP 7, so "Complete order" must succeed. Full output:\n${alice8.output}`,
        ).toBe("completed");
        expect(readAt(alice8, 19)).toBe("");
        record(`STEP 8a PASS (REQUIRED) -- Alice's order genuinely reached "completed": real content was released, real digest verified, and the digital-content-delivery invariant was satisfied truthfully (never the mislabelled-"authoritative" false-green path the negative-control test's own header describes).`);

        const receiptError = readAt(alice8, 22);
        expect(receiptError, `receipt issuance for a genuinely completed order must succeed. Full output:\n${alice8.output}`).toBe("");
        const receiptVerify = readAt(alice8, 23);
        expect(receiptVerify.toUpperCase()).toContain("VALID");
        record(`STEP 8b PASS -- a real signed Trust receipt was issued and independently verified: "${receiptVerify}".`);

        const bob6 = await runBetaUiScript(
          "BOB_6_VERIFY_COMPLETION_AND_REPUTATION",
          bobDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce-merchant" }, // 6 -- real order-sync discovery: re-runs the same completion invariant before mirroring
            { action: "wait", ms: 800 }, // 7
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10
            { action: "read", selector: "#commerce-merchant-reputation-summary" }, // 11
          ],
          false,
        );
        expect(readAt(bob6, 1)).toBe("unlock");
        expect(readAt(bob6, 5)).toBe("ready");
        const bobStatus = readAt(bob6, 10);
        expect(bobStatus, `Bob's independent process must genuinely mirror Alice's real, truthful completion. Full output:\n${bob6.output}`).toBe("completed");
        const reputationSummary = readAt(bob6, 11);
        record(
          `STEP 8c PASS (REQUIRED, CONTENT AFTER RESTART precursor) -- Bob's independent process (pid ${String(bob6.pid)}) confirms the SAME real completion ("${bobStatus}") and reports a reputation summary reflecting a genuine successful digital delivery: "${reputationSummary}".`,
        );
      },
      180000,
    );

    // =====================================================================
    // STEP 9: FULL RESTART after successful delivery. Both apps closed
    // normally in every previous phase already (each `runBetaUiScript` call
    // IS a full process exit); this phase performs one more fresh launch
    // each and re-verifies every real invariant against the SAME durable
    // on-disk state -- content remains accessible (a real cache hit).
    // =====================================================================
    it(
      "STEP 9: full restart -- Product/Order/Payment/Delivery/grant/content-access/receipt/reputation are ALL still correct on both sides; content remains accessible per policy",
      async () => {
        const alice9 = await runBetaUiScript(
          "ALICE_9_FULL_RESTART",
          aliceDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock" (durable profile survives a full close+relaunch)
            { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce" }, // 6
            { action: "wait", ms: 300 }, // 7 -- deliberately no cross-process discovery needed: this is Alice's OWN already-durable state
            { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10 -- MUST still be "completed"

            { action: "click", selector: "#commerce-order-purchased-content-btn" }, // 11 -- content must remain accessible: a real CACHE hit, no new request
            { action: "wait", ms: 1500 }, // 12
            { action: "read", selector: "#commerce-order-purchased-content-error" }, // 13 -- expect ""
            { action: "read", selector: "#commerce-order-purchased-content-status" }, // 14 -- expect "already on this device" (cache source)
            { action: "read", selector: "#commerce-order-purchased-content-link", as: "href" }, // 15

            { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 16 -- re-issuing for an already-completed+receipted order must still report a real, still-valid receipt
            { action: "wait", ms: 800 }, // 17
            { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 18
          ],
          false,
        );
        expect(readAt(alice9, 1)).toBe("unlock");
        expect(readAt(alice9, 5)).toBe("ready");
        expect(readAt(alice9, 10), `ORDER/PAYMENT/DELIVERY: order status must survive a full restart unchanged. Full output:\n${alice9.output}`).toBe("completed");

        const contentErrorAfterRestart = readAt(alice9, 13);
        expect(contentErrorAfterRestart, `CONTENT AFTER RESTART: content must remain accessible after a full restart. Full output:\n${alice9.output}`).toBe("");
        const contentStatusAfterRestart = readAt(alice9, 14);
        expect(contentStatusAfterRestart).toMatch(/already on this device/);
        const contentHrefAfterRestart = readAt(alice9, 15);
        expect(contentHrefAfterRestart).toMatch(/^data:application\/pdf;base64,/);
        const base64Marker = "base64,";
        const idx = contentHrefAfterRestart.indexOf(base64Marker);
        const bytesAfterRestart = Buffer.from(contentHrefAfterRestart.slice(idx + base64Marker.length), "base64");
        const digestAfterRestart = sha256Hex(bytesAfterRestart);
        expect(digestAfterRestart, "CONTENT AFTER RESTART: the digest of the content served from the durable restart-surviving cache must still match the KNOWN digest").toBe(REAL_PDF_SHA256);

        expect(readAt(alice9, 18).toUpperCase()).toContain("VALID");
        record(
          `STEP 9a PASS (REQUIRED, CONTENT AFTER RESTART) -- Alice's fully-restarted independent process (pid ${String(alice9.pid)}) reads the SAME durable "completed" order, the purchased content remains accessible via a real restart-surviving cache hit ("${contentStatusAfterRestart}") with digest STILL matching the known SHA-256 (${digestAfterRestart}), and the receipt is still independently verifiable.`,
        );

        const bob7 = await runBetaUiScript(
          "BOB_7_FULL_RESTART",
          bobDataDir,
          [
            { action: "wait", ms: 300 }, // 0
            { action: "read", selector: "#current-screen" }, // 1
            { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
            { action: "click", selector: "#unlock-submit" }, // 3
            { action: "wait", ms: 2500 }, // 4
            { action: "read", selector: "#current-screen" }, // 5
            { action: "click", selector: "#nav-commerce-merchant" }, // 6
            { action: "wait", ms: 500 }, // 7
            { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 8
            { action: "wait", ms: 300 }, // 9
            { action: "read", selector: "#commerce-order-status-text" }, // 10
            { action: "read", selector: "#commerce-merchant-reputation-summary" }, // 11
          ],
          false,
        );
        expect(readAt(bob7, 1)).toBe("unlock");
        expect(readAt(bob7, 5)).toBe("ready");
        expect(readAt(bob7, 10), `Bob's own fully-restarted process must still read the SAME real completed order. Full output:\n${bob7.output}`).toBe("completed");
        const bobReputationAfterRestart = readAt(bob7, 11);
        record(
          `STEP 9b PASS (REQUIRED, CONTENT AFTER RESTART, seller side) -- Bob's fully-restarted independent process (pid ${String(bob7.pid)}) also reads the SAME durable "completed" order, and reputation still reflects the genuine successful digital delivery: "${bobReputationAfterRestart}".`,
        );

        // Grant envelope itself must ALSO still verify identically after a
        // restart -- durable persistence, never re-derived, never mutated.
        const commerceModule = (await import(commerceDistPath)) as {
          verifyMediaAccessGrantEnvelope: (envelope: unknown) => { readonly status: string };
        };
        const rawLines = readFileSync(productMediaGrantsFilePath, "utf8")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const envelopes = rawLines.map((l) => JSON.parse(l) as Record<string, unknown>);
        for (const envelope of envelopes) {
          const result = commerceModule.verifyMediaAccessGrantEnvelope(envelope);
          expect(result.status, `every durably persisted grant envelope must STILL independently verify after a restart: ${JSON.stringify(result)}`).toBe("VALID");
        }
        record(`STEP 9c PASS -- all ${String(envelopes.length)} durably persisted grant envelope(s) still independently verify (real signature check, this process) after a full restart of both apps.`);
      },
      200000,
    );
  },
);

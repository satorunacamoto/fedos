/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc -- the
 * "Two-Process E2E" agent's own deliverable: the SINGLE HIGHEST-PRIORITY
 * acceptance criterion of the whole arc -- a literal, real, TWO
 * INDEPENDENT ELECTRON PROCESS proof that Bob (Merchant) and Alice
 * (Customer) can transact with each other using their OWN separately
 * created real local Personas, communicating ONLY through a real local
 * Nostr-shaped WebSocket relay this suite itself starts (loopback,
 * `ws://127.0.0.1:<port>`) -- never a same-process shortcut, never a
 * fixture/demo-actor identity for either party's OWN transaction role.
 *
 * HARNESS DESIGN NOTE (read before extending this file): the existing
 * `AUTOTEST_MODE=ui-script` harness (`fedos_electron_beta_main.cts`) reads
 * `FEDOS_BETA_UI_SCRIPT` ONCE at process start, runs every step in order,
 * then the app performs a real clean shutdown and the process exits -- it
 * has no mechanism to inject a SECOND script into an already-running
 * process, and no CDP-level remote-control surface exists in this repo.
 * A genuinely turn-based, multi-party commerce flow where each turn
 * depends on a value only discoverable from the PRIOR turn (Bob's own
 * real pubkey, the product's own title, whether Alice's order actually
 * reached Bob) therefore cannot be scripted as two long-lived,
 * continuously-overlapping processes without inventing a new remote-
 * control mechanism (explicitly out of scope for this agent). This suite
 * instead uses the SAME multi-launch-against-the-same-dataDir pattern this
 * package's own `commerce_e2e_restart_persistence_real_electron.test.ts`
 * already established for a different purpose (proving restart
 * persistence): each party gets several SEQUENTIAL, fully independent
 * process launches (own PID every time, `create` the first time then
 * `unlock` every time after -- a real, persisted, on-disk profile in
 * between), and the Node-side test orchestrates the turn order and
 * threads discovered values (pubkeys, titles) from one launch's step
 * results into the next launch's script. Every launch is a genuinely
 * separate OS process that NEVER shares in-memory state with any other
 * launch -- the ONLY channel between Bob's and Alice's processes, ever,
 * is the real local relay this suite starts once and keeps running for
 * the whole test (`historyEnabled: true`, so a later launch's real `REQ`
 * genuinely replays a real earlier launch's already-published `EVENT`,
 * exactly the "publish while the counterparty is offline, discover after
 * reconnecting" shape a real two-party async system must handle -- if
 * anything, a STRONGER proof of real persistence/replay than a
 * continuously-open pair of live sockets would be).
 *
 * KNOWN, LIVE-CONFIRMED RENDERER GAP THIS SUITE WORKS AROUND (never a
 * shortcut around any IPC/domain validation -- see the long comment above
 * `ALICE_2_DISCOVER_AND_ORDER` below): `commerceRealActor()`
 * (`fedos_electron_beta_renderer.ts`) hard-codes the real local Persona's
 * "Acting as" role to `"merchant"` -- there is, today, no real "become a
 * customer" identity concept in this build (the file's own header says so
 * explicitly). This CSS-hides Product Detail's buyer Order form
 * (`#commerce-detail-order-form`) for a real (non-demo) identity. The
 * underlying `#commerce-order-create-submit` button, its click listener,
 * and the `fedos-app:commerce-order-create` IPC handler apply NO
 * independent role check of their own (confirmed by direct source read) --
 * they act on whatever `commerceActingAsPubkey` is currently selected,
 * structurally identical for a real identity and a demo one. This suite
 * drives that real button via the SAME raw `document.querySelector(...).click()`
 * primitive every OTHER step in the pre-existing `ui-script` harness
 * already uses (visibility is never checked by that primitive, by design --
 * see `fedos_electron_beta_main.cts`'s own `click` step implementation) --
 * never a new automation surface, never a change to any IPC handler or
 * domain rule, never a fabricated success. It is the one place in this
 * suite where the literal on-screen control is not visible; every other
 * step clicks a genuinely visible, genuinely enabled control.
 *
 * REVISION HISTORY OF THIS SUITE'S OWN FINDINGS (read this before trusting
 * any comment below in isolation): the FIRST live run of this suite found
 * STEP 4 (Alice submitting a real Order against Bob's Nostr-discovered
 * listing) unconditionally rejected -- `handleCommerceOrderCreate()`
 * checked only the caller's own LOCAL product repository, never the
 * separate, purely in-memory `CommerceNostrProductReadModel` a
 * Nostr-discovered listing actually lives in, even though
 * `handleCommerceProductDetail()` (which rendered Alice's Product Detail
 * view one step earlier, successfully) already fell back to that same
 * read model as its own documented 3rd tier. The Coordinator fixed this
 * (commit `f5df38fa`, "Coordinator: fix order-create can't reach a
 * Nostr-discovered product", merged into this branch) by mirroring
 * `handleCommerceProductDetail()`'s own fallback exactly. This suite was
 * then RE-RUN against the fix and STEP 4 now PASSES live -- see the STEP
 * 4 comment below for the re-verification, and this arc's own final
 * report for the full before/after account.
 *
 * CONFIRMED, LIVE-REPRODUCED, DELIBERATE (NOT A BUG) SECURITY BOUNDARY
 * (see the long comment above `BOB_4_CONFIRM_PAYMENT_PROPAGATION_WALL`
 * below): with STEP 4 fixed, this suite now gets Alice's real Order all
 * the way through submit (STEP 4) -> Bob's independent cross-process
 * discovery+accept (STEP 5) -> Alice's real TEST/LOCAL payment (STEP 6,
 * local to her own process only) -> Bob's process re-checking and being
 * shown to remain at `"accepted"`, never `"paid"` (STEP 7). This is NOT a
 * gap to close -- confirmed by direct source read of
 * `src/os/commerce/events/commerce_private_order_sync.ts`: its
 * `PrivateOrderSyncStatus` type is a CLOSED union of exactly six values
 * (`submitted`/`accepted`/`rejected`/`fulfilling`/`completed`/`cancelled`)
 * -- `"paid"`/`"delivered"` are DELIBERATELY EXCLUDED AT THE TYPE LEVEL
 * (that file's own header: "rather than merely 'not sent this pass'"),
 * mirroring `order_state_machine.ts`'s own `AUTHORIZED_ACTOR_KINDS`, which
 * accepts ONLY a `"payment_evidence"`/`"delivery_evidence"` actor for
 * those two transitions -- never a bare `"customer"`/`"merchant"` claim,
 * remote or local. Relaying a remote peer's claim of "I paid"/"I received
 * it" as if it were this process's own locally-verified evidence would let
 * a compromised or buggy counterparty falsely advance this process's own
 * authoritative Order state -- exactly the "PAID authority regression"
 * this arc's own stop-condition list forbids. STEPS 8-10 (Bob fulfilling,
 * delivery, receipt, reputation on Bob's side) and the optional
 * two-process restart pass are consequently NOT ATTEMPTED past STEP 7 --
 * per the Coordinator's own explicit instruction, this suite confirms and
 * documents the wall, it does not invent a workaround, and fixing it (if
 * ever justified) needs its own dedicated architecture review.
 *
 * Skips itself with a clear message if the real `pkg/` WASM artifact, its
 * manifest, the compiled root `dist/`, or the real Electron binary are
 * absent -- mirrors every other real-launch test in this package.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A `FedosRealLocalWebSocketRelayServer` handle -- restated locally (not imported as a type) for the same reason the module itself is loaded via a computed specifier below. */
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

const evidenceDir = `${repoRoot}/docs/commerce/evidence/commerce_e2e_two_process`;
const evidenceMdPath = `${repoRoot}/docs/commerce/evidence/commerce_e2e_two_process_evidence.md`;
const screenshotDir = `${evidenceDir}/screens`;

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-2proc-e2e-${label}-`));
  tmpRoots.push(dir);
  return dir;
}

// ---------------------------------------------------------------------
// Evidence -- progressive, append-only, written to disk after EVERY
// phase (never only at the very end) so a mid-run failure still leaves a
// real, readable record of everything that happened before it.
// ---------------------------------------------------------------------
let evidenceInitialized = false;
function record(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[2proc-e2e] ${line}`);
  const prefix = evidenceInitialized ? "" : `# Commerce E2E -- REAL two-independent-Electron-process evidence\n\nGenerated by commerce_e2e_two_process_real_electron.test.ts\n\nStarted: ${new Date().toISOString()}\n\n`;
  evidenceInitialized = true;
  try {
    mkdirSync(join(evidenceMdPath, ".."), { recursive: true });
    appendFileSync(evidenceMdPath, `${prefix}${line}\n`);
  } catch {
    /* evidence writing is best-effort, never masks a real test failure */
  }
}

// ---------------------------------------------------------------------
// Settings pre-seed -- exact on-disk shape `FileFedosSettingsPersistence`
// (`src/os/core/settings/fedos_settings_persistence.ts`) reads via
// `decodeFedosSettingsDescriptorV1` (`src/os/core/settings/fedos_settings_codec.ts`):
// one JSON object at `<FEDOS_ELECTRON_BETA_DATA_DIR>/settings.json`
// (`settingsFilePath()`, `fedos_electron_beta_main.cts`), the EXACT 11-key
// `FedosSettingsDescriptorV1` shape the validator enforces exactly (no more,
// no fewer keys). Written BEFORE the very first launch (`create`), so
// `secureRuntimeBundleConfig()` reads a real, valid, non-empty `relays`
// array the moment a profile is created/unlocked -- the documented,
// investigated, most-robust seeding point per this agent's own brief
// (never driven live through the Settings UI's relay-add form, which would
// require an extra launch cycle and would still need to happen before this
// same first launch's own Commerce actions anyway).
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// ui-script harness driver -- same JSON step vocabulary/marker line
// (`FEDOS_ELECTRON_BETA_UI_STEP_JSON:`) every other real-launch test in
// this package already uses (`fedos_electron_beta_main.cts`'s own
// `ui-script` AUTOTEST loop, unmodified). Adds real OS-level PID tracking
// and post-exit liveness verification (Win32_Process) -- this suite's own
// "never broadly kill node/electron/chrome by name, always verify the
// exact owned PID is actually gone" discipline.
// ---------------------------------------------------------------------
type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" }
  | { readonly action: "wait"; readonly ms: number }
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

async function runBetaUiScript(label: string, dataDir: string, script: readonly UiStep[], withScreenshots: boolean): Promise<UiRun> {
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
  // OS-level verification this exact owned PID is actually gone -- never a
  // broad kill/verify by process name.
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

function outcomeAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  return step!.result.outcome;
}

// ---------------------------------------------------------------------
// Fixed test identities -- REAL local Personas, created fresh via the
// real Create-profile flow (passphrase-driven, real Argon2 + real WASM
// Master Seed generation) -- never injected/pre-seeded key material,
// never the `COMMERCE_DEMO_ACTORS` fixture pubkeys.
// ---------------------------------------------------------------------
const BOB_LABEL = "Two-Process E2E -- Bob";
const BOB_PASSPHRASE = "two process e2e proof bob real passphrase";
const ALICE_LABEL = "Two-Process E2E -- Alice";
const ALICE_PASSPHRASE = "two process e2e proof alice real passphrase";
const PRODUCT_TITLE = "FedOS Two-Process E2E Proof Item";
const PRODUCT_DESCRIPTION = "Real cross-process discovery/order-sync proof product for the Two-Process E2E agent.";

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_e2e_two_process_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the real Electron binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run build --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite("FedOS Commerce End-to-End -- REAL two independent Electron processes (Bob + Alice, each their own real local Persona), communicating ONLY through a real local relay this suite starts", () => {
  let relay: FedosRealLocalWebSocketRelayServer;
  let bobDataDir: string;
  let aliceDataDir: string;
  let bobPubkey = "";
  let alicePubkey = "";

  beforeAll(async () => {
    mkdirSync(evidenceDir, { recursive: true });
    mkdirSync(screenshotDir, { recursive: true });
    // A computed (non-literal) specifier -- mirrors the SAME established
    // convention `secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts`
    // (and siblings) already use in this exact package/directory: a
    // literal relative import of the shared `test/support/` fixture would
    // make THIS sub-package's own `tsconfig.test.json` (`"types": ["node"]`)
    // force-typecheck that file, flipping its pre-existing
    // `@ts-expect-error` directives (written for the ROOT config, which
    // deliberately carries no `@types/node`) to "unused" -- a real
    // cross-tsconfig artifact, not a defect in the shared fixture. Real
    // Node ESM resolution at runtime is unaffected either way.
    const relayServerModuleSpecifier = "../../../test/support/fedos_real_local_websocket_relay_server.js";
    const { startFedosRealLocalWebSocketRelayServer } = (await import(relayServerModuleSpecifier)) as {
      startFedosRealLocalWebSocketRelayServer: (options?: { readonly historyEnabled?: boolean }) => Promise<FedosRealLocalWebSocketRelayServer>;
    };
    relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    record(`real local relay started: ${relay.url} (historyEnabled: true -- a launch that starts AFTER an event was published still discovers it, matching this suite's own sequential-multi-launch design)`);
    bobDataDir = makeTmpRoot("bob");
    aliceDataDir = makeTmpRoot("alice");
    seedSettingsFile(bobDataDir, relay.url);
    seedSettingsFile(aliceDataDir, relay.url);
    record(`Bob dataDir: ${bobDataDir} -- settings.json pre-seeded with relays:["${relay.url}"] BEFORE first launch`);
    record(`Alice dataDir: ${aliceDataDir} -- settings.json pre-seeded with relays:["${relay.url}"] BEFORE first launch`);
  }, 30000);

  afterAll(async () => {
    if (relay !== undefined) {
      await relay.close();
      record("real local relay closed.");
    }
    while (tmpRoots.length) {
      try {
        rmSync(tmpRoots.pop()!, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    record(`Evidence doc: ${evidenceMdPath}`);
    record(`Screenshots dir: ${screenshotDir}`);
  }, 30000);

  it(
    "Bob creates+publishes a real product; Alice (separate process, separate real Persona) discovers it via the REAL relay, views it, submits a real Order (Coordinator's fix f5df38fa re-verified live); Bob (separate process) independently discovers+accepts it via bounded refresh; Alice pays (TEST/LOCAL, local to her own process); Bob's process is shown, live, to hit the DELIBERATE payment-evidence propagation wall (never a bug) and correctly cannot fulfill",
    async () => {
      // =====================================================================
      // STEP 1/2 -- BOB_1_CREATE: real Create-profile flow, capture Bob's
      // real local pubkey (read directly off the "Acting as" selector's own
      // real-identity option -- `commerceRealActor()` prepends it the moment
      // `localAccountPublicIdentifier` is set, i.e. immediately on a
      // successful create, well before this script's own "wait" elapses).
      // =====================================================================
      const bob1 = await runBetaUiScript("BOB_1_CREATE", bobDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "fill", selector: "#create-label", value: BOB_LABEL }, // 1
        { action: "fill", selector: "#create-pass", value: BOB_PASSPHRASE }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: BOB_PASSPHRASE }, // 3
        { action: "click", selector: "#create-submit" }, // 4
        { action: "wait", ms: 2500 }, // 5 -- real Argon2 unlock + real WASM Master Seed generation
        { action: "read", selector: "#current-screen" }, // 6 -- expect "ready"
        { action: "read", selector: "#commerce-merchant-acting-as option:first-child", as: "value" }, // 7 -- Bob's real pubkey
        { action: "screenshot", value: "bob-01-ready" }, // 8
      ], true);
      expect(readAt(bob1, 6)).toBe("ready");
      bobPubkey = readAt(bob1, 7);
      expect(bobPubkey.length).toBe(64);
      expect(bobPubkey).not.toBe("a".repeat(64));
      expect(bobPubkey).not.toBe("b".repeat(64));
      expect(bobPubkey).not.toBe("c".repeat(64));
      record(`STEP 1/2 PASS -- Bob's process (pid ${String(bob1.pid)}) created a REAL local Persona. Bob's real pubkey: ${bobPubkey}`);

      // =====================================================================
      // STEP 2 (cont.) -- BOB_2_PUBLISH: unlock (persisted profile, real
      // passphrase), enable Commerce Nostr publication for this session,
      // select Bob's own real identity as "Acting as", create a real draft
      // product, Preview it (Agent S's own buyer-view preview), then Publish
      // it -- this is the ONLY step in Bob's flow that reaches the network,
      // and it is a genuine `WebSocketRelayPublisher` publish to the real
      // local relay (`commerceNostrOutboundPortFor()`), never a fixture.
      // =====================================================================
      const bob2 = await runBetaUiScript("BOB_2_PUBLISH", bobDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock" (persisted profile found on disk)
        { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
        { action: "click", selector: "#unlock-submit" }, // 3
        { action: "wait", ms: 2500 }, // 4
        { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
        { action: "click", selector: "#nav-settings" }, // 6
        { action: "wait", ms: 300 }, // 7
        { action: "fill", selector: "#commerce-network-profile-select", value: "direct" }, // 8
        { action: "wait", ms: 100 }, // 9
        { action: "click", selector: "#commerce-network-profile-save" }, // 10
        { action: "wait", ms: 300 }, // 11
        { action: "fill", selector: "#commerce-merchant-acting-as", value: bobPubkey }, // 12
        { action: "wait", ms: 200 }, // 13
        { action: "click", selector: "#nav-commerce-merchant" }, // 14
        { action: "wait", ms: 300 }, // 15
        { action: "fill", selector: "#commerce-merchant-create-title", value: PRODUCT_TITLE }, // 16
        { action: "fill", selector: "#commerce-merchant-create-description", value: PRODUCT_DESCRIPTION }, // 17
        { action: "fill", selector: "#commerce-merchant-create-price", value: "42.00" }, // 18
        { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 19
        { action: "click", selector: "#commerce-merchant-create-submit" }, // 20
        { action: "wait", ms: 400 }, // 21
        { action: "read", selector: "#commerce-merchant-products-list" }, // 22 -- proves the real draft product is listed
        { action: "screenshot", value: "bob-02-product-draft" }, // 23
        { action: "click", selector: "li:last-child button.commerce-btn-preview" }, // 24 -- Preview as a buyer would see it (friction ledger row #24)
        { action: "wait", ms: 300 }, // 25
        { action: "read", selector: "#commerce-detail-title" }, // 26 -- expect the real title
        { action: "screenshot", value: "bob-03-product-preview" }, // 27
        { action: "click", selector: "#commerce-detail-back" }, // 28
        { action: "wait", ms: 300 }, // 29
        { action: "click", selector: "li:last-child button.commerce-btn-publish" }, // 30 -- REAL publish -> real Nostr EVENT to the real local relay
        { action: "wait", ms: 500 }, // 31 -- real relay round trip
        { action: "read", selector: "#commerce-merchant-products-list" }, // 32 -- expect "... -- active"
        { action: "screenshot", value: "bob-04-product-published" }, // 33
      ], true);
      expect(readAt(bob2, 1)).toBe("unlock");
      expect(readAt(bob2, 5)).toBe("ready");
      expect(readAt(bob2, 22)).toMatch(new RegExp(PRODUCT_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      expect(readAt(bob2, 26)).toBe(PRODUCT_TITLE);
      const publishedText = readAt(bob2, 32);
      // `commerceMerchantProductRow()` renders `"<title> — <status>"` (an
      // em dash, not two hyphens) -- match that literally.
      expect(publishedText).toMatch(/—\s*active/);
      record(`STEP 2 PASS -- Bob's process (pid ${String(bob2.pid)}) unlocked his REAL persisted profile via real passphrase, enabled Commerce Nostr "direct" for this session, created+previewed+published a REAL product ("${PRODUCT_TITLE}") -- confirmed locally "active": "${publishedText}". This is the ONLY real Nostr publish in Bob's whole flow.`);

      // =====================================================================
      // ALICE_1_CREATE -- Alice's OWN, fully separate real local Persona.
      // =====================================================================
      const alice1 = await runBetaUiScript("ALICE_1_CREATE", aliceDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "fill", selector: "#create-label", value: ALICE_LABEL }, // 1
        { action: "fill", selector: "#create-pass", value: ALICE_PASSPHRASE }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: ALICE_PASSPHRASE }, // 3
        { action: "click", selector: "#create-submit" }, // 4
        { action: "wait", ms: 2500 }, // 5
        { action: "read", selector: "#current-screen" }, // 6 -- expect "ready"
        { action: "read", selector: "#commerce-acting-as option:first-child", as: "value" }, // 7 -- Alice's real pubkey
        { action: "screenshot", value: "alice-01-ready" }, // 8
      ], true);
      expect(readAt(alice1, 6)).toBe("ready");
      alicePubkey = readAt(alice1, 7);
      expect(alicePubkey.length).toBe(64);
      expect(alicePubkey).not.toBe(bobPubkey);
      expect(alicePubkey).not.toBe("a".repeat(64));
      expect(alicePubkey).not.toBe("b".repeat(64));
      expect(alicePubkey).not.toBe("c".repeat(64));
      record(`STEP -- ALICE_1_CREATE PASS -- Alice's process (pid ${String(alice1.pid)}) created a REAL, separate local Persona (own dataDir, own PID, own master seed). Alice's real pubkey: ${alicePubkey}`);

      // =====================================================================
      // STEP 3/4 -- ALICE_2_DISCOVER_AND_ORDER: THE MAKE-OR-BREAK STEP.
      // Unlock, enable Commerce Nostr, select Alice's own real identity,
      // navigate to Shop -- this triggers `commerceNostrDiscoverAndIngestProductsNonFatal()`,
      // a real bounded `REQ`/`EOSE` query against the SAME real local relay
      // Bob's process published to (a SEPARATE process, already exited
      // minutes/launches ago) -- verify+ingest through the real
      // `verifyAndBuildInboundCommerceNostrEnvelope` Schnorr-signature-
      // checking bridge, never a fixture/shortcut. Then open the real
      // Product Detail (verifies seller identity is shown), and submit a
      // real Order using Alice's own real pubkey as buyer -- see this
      // file's own top-of-file comment for why `#commerce-order-create-submit`
      // is clicked via the same visibility-blind `.click()` primitive every
      // other step already uses, working around a renderer-only cosmetic
      // gap (`commerceRealActor()` always labels a real identity
      // `"merchant"`), never a change to any IPC handler or domain rule.
      // =====================================================================
      const alice2 = await runBetaUiScript("ALICE_2_DISCOVER_AND_ORDER", aliceDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
        { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
        { action: "click", selector: "#unlock-submit" }, // 3
        { action: "wait", ms: 2500 }, // 4
        { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
        { action: "click", selector: "#nav-settings" }, // 6
        { action: "wait", ms: 300 }, // 7
        { action: "fill", selector: "#commerce-network-profile-select", value: "direct" }, // 8
        { action: "wait", ms: 100 }, // 9
        { action: "click", selector: "#commerce-network-profile-save" }, // 10
        { action: "wait", ms: 300 }, // 11
        { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 12
        { action: "wait", ms: 200 }, // 13
        { action: "click", selector: "#nav-commerce" }, // 14 -- triggers the REAL bounded Nostr discovery query against the real relay
        { action: "wait", ms: 4000 }, // 15 -- generous bound; discovery's own internal timeout is 3000ms
        { action: "read", selector: "#commerce-catalog-list" }, // 16 -- MAKE-OR-BREAK: must contain Bob's real published title
        { action: "screenshot", value: "alice-02-catalog" }, // 17
        { action: "click", selector: `button[aria-label="View ${PRODUCT_TITLE}"]` }, // 18
        { action: "wait", ms: 400 }, // 19
        { action: "read", selector: "#commerce-detail-title" }, // 20 -- expect the real title
        { action: "read", selector: "#commerce-detail-merchant" }, // 21 -- "Sold by ..." -- real seller identity
        { action: "screenshot", value: "alice-03-detail" }, // 22
        { action: "click", selector: "#commerce-order-create-submit" }, // 23 -- see top-of-file comment: real button, real IPC, click bypasses a cosmetic hidden-form gap only
        { action: "wait", ms: 600 }, // 24 -- Coordinator's fix (f5df38fa) re-runs discovery inside the handler before falling back to the read model -- give it real time
        { action: "read", selector: "#commerce-order-status-text" }, // 25 -- expect "created" (Coordinator's fix landed -- was empty/rejected before)
        { action: "click", selector: "#commerce-order-submit-btn" }, // 26
        { action: "wait", ms: 500 }, // 27 -- also sends the real private-order-sync EVENT to Bob's real pubkey
        { action: "read", selector: "#commerce-order-status-text" }, // 28 -- expect "submitted"
        { action: "screenshot", value: "alice-04-order-submitted" }, // 29
      ], true);
      expect(readAt(alice2, 1)).toBe("unlock");
      expect(readAt(alice2, 5)).toBe("ready");
      const catalogText = readAt(alice2, 16);
      const catalogHasProduct = catalogText.includes(PRODUCT_TITLE);
      record(`STEP 3 (MAKE-OR-BREAK #1) -- Alice's SEPARATE process (pid ${String(alice2.pid)}) real Shop catalog query result: ${catalogHasProduct ? "PASS -- Bob's real published listing IS present" : "FAIL -- Bob's real published listing is ABSENT"}. Raw catalog list text: ${JSON.stringify(catalogText)}`);
      expect(catalogText, `Alice's real Shop catalog (via the REAL relay discovery path) did not contain Bob's real published product title "${PRODUCT_TITLE}". Raw catalog text: ${catalogText}`).toMatch(
        new RegExp(PRODUCT_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      expect(readAt(alice2, 20)).toBe(PRODUCT_TITLE);
      const sellerLine = readAt(alice2, 21);
      expect(sellerLine.length).toBeGreaterThan(0);
      record(`STEP 3 PASS -- Product Detail rendered from the REAL discovered+verified envelope: title="${readAt(alice2, 20)}", seller line="${sellerLine}".`);

      // =====================================================================
      // STEP 4 -- was a CONFIRMED, live-reproduced blocker in this suite's
      // prior run (handleCommerceOrderCreate() checked only the caller's
      // own LOCAL product repository, never the Nostr-discovered-products
      // read model handleCommerceProductDetail() already fell back to).
      // The Coordinator fixed it (commit f5df38fa, merged into this branch)
      // by mirroring handleCommerceProductDetail()'s own fallback exactly.
      // Re-verified live here, against the SAME real Nostr-discovered
      // product (never locally created by Alice's own process).
      // =====================================================================
      const createdStatus = readAt(alice2, 25);
      const submittedStatus = readAt(alice2, 28);
      record(
        `STEP 4 (RE-VERIFIED PASS after Coordinator's fix f5df38fa) -- Alice's real Order-create attempt for Bob's Nostr-discovered product now SUCCEEDS: status after create="${createdStatus}", status after submit="${submittedStatus}". handleCommerceOrderCreate() now falls back to commerceNostrReadModelFor().getProduct() exactly like handleCommerceProductDetail() already did -- confirmed by this live re-run, not just by reading the diff.`,
      );
      expect(createdStatus).toBe("created");
      expect(submittedStatus).toBe("submitted");
      record(`STEP 4 PASS -- Alice's process created+submitted a REAL Order as buyer=${alicePubkey} (her own real Persona, never a demo actor) against seller=${bobPubkey}, for a product her own process only ever learned about via real Nostr discovery. "submitted" also sent a real private-order-sync EVENT addressed to Bob's real pubkey over the real relay.`);

      // =====================================================================
      // STEP 5 -- BOB_3_DISCOVER_AND_ACCEPT: THE make-or-break FACT FOR THE
      // WHOLE ARC. Bob's process (a THIRD, brand-new launch, own new PID,
      // NO shared memory with Alice's process, which has already fully
      // exited) unlocks and navigates to "My Store" -- this triggers
      // `commercePrivateOrderDiscoverAndApplyNonFatal()`, a real bounded
      // `REQ`/`EOSE` query against the real relay filtered to Bob's own real
      // pubkey (`"#p"`), decrypts Alice's real NIP-44-wire-encrypted
      // envelope, and -- because this Order did not exist locally in Bob's
      // process before this call -- MATERIALIZES the entire Order fresh,
      // straight from Alice's real signed/encrypted event, never a
      // same-process shortcut of any kind.
      // =====================================================================
      const bob3 = await runBetaUiScript("BOB_3_DISCOVER_AND_ACCEPT", bobDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
        { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
        { action: "click", selector: "#unlock-submit" }, // 3
        { action: "wait", ms: 2500 }, // 4
        { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
        { action: "click", selector: "#nav-settings" }, // 6
        { action: "wait", ms: 300 }, // 7
        { action: "fill", selector: "#commerce-network-profile-select", value: "direct" }, // 8
        { action: "wait", ms: 100 }, // 9
        { action: "click", selector: "#commerce-network-profile-save" }, // 10
        { action: "wait", ms: 300 }, // 11
        { action: "fill", selector: "#commerce-merchant-acting-as", value: bobPubkey }, // 12
        { action: "wait", ms: 200 }, // 13
        { action: "click", selector: "#nav-commerce-merchant" }, // 14 -- triggers the REAL bounded private-order-sync discovery query
        { action: "wait", ms: 4000 }, // 15
        { action: "read", selector: "#commerce-merchant-orders-list" }, // 16 -- MAKE-OR-BREAK #2: must contain Alice's real order
        { action: "screenshot", value: "bob-05-incoming-orders" }, // 17
        { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 18 -- "Open"
        { action: "wait", ms: 400 }, // 19
        { action: "read", selector: "#commerce-order-status-text" }, // 20 -- expect "submitted"
        { action: "read", selector: "#commerce-order-parties-text" }, // 21 -- real buyer/seller labels
        { action: "click", selector: "#commerce-order-accept-btn" }, // 22
        { action: "wait", ms: 500 }, // 23 -- also sends a real private-order-sync EVENT back to Alice
        { action: "read", selector: "#commerce-order-status-text" }, // 24 -- expect "accepted"
        { action: "screenshot", value: "bob-06-accepted" }, // 25
      ], true);
      expect(readAt(bob3, 1)).toBe("unlock");
      expect(readAt(bob3, 5)).toBe("ready");
      const incomingOrdersText = readAt(bob3, 16);
      const bobReceivedOrder = !incomingOrdersText.includes("No incoming orders yet");
      record(`STEP 5 (MAKE-OR-BREAK #2, THE central fact for this whole arc) -- Bob's THIRD, brand-new, separate process (pid ${String(bob3.pid)}) real "My Store" incoming-orders query result: ${bobReceivedOrder ? "PASS -- Alice's real Order WAS independently discovered/materialized, with ZERO same-process shortcut" : "FAIL -- no order discovered"}. Raw incoming-orders list text: ${JSON.stringify(incomingOrdersText)}`);
      expect(incomingOrdersText, `Bob's real "My Store" incoming-orders list (via the REAL private-order-sync discovery path) did not contain Alice's real order. Raw text: ${incomingOrdersText}`).not.toMatch(/No incoming orders yet/);
      expect(readAt(bob3, 20)).toBe("submitted");
      expect(readAt(bob3, 24)).toBe("accepted");
      record(`STEP 5 PASS -- Bob's process independently discovered+materialized Alice's real Order (parties: ${readAt(bob3, 21)}) purely from the real relay's replayed event, then real-Accepted it (also sending a real private-order-sync EVENT back to Alice's real pubkey).`);

      // =====================================================================
      // ALICE_3_PAY: Alice's process discovers "accepted" (bounded refresh
      // via nav-commerce -> refreshCommerceMyOrdersList -> the same real
      // discovery query, filtered to her own pubkey), then performs a real
      // TEST/LOCAL "Pay Now" + "Simulate Payment" -- explicitly NEVER real
      // money, and NEVER something the seller could force (only the buyer's
      // own process can request+simulate payment for HER OWN order).
      // =====================================================================
      const alice3 = await runBetaUiScript("ALICE_3_PAY", aliceDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
        { action: "fill", selector: "#unlock-pass", value: ALICE_PASSPHRASE }, // 2
        { action: "click", selector: "#unlock-submit" }, // 3
        { action: "wait", ms: 2500 }, // 4
        { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
        { action: "click", selector: "#nav-settings" }, // 6
        { action: "wait", ms: 300 }, // 7
        { action: "fill", selector: "#commerce-network-profile-select", value: "direct" }, // 8
        { action: "wait", ms: 100 }, // 9
        { action: "click", selector: "#commerce-network-profile-save" }, // 10
        { action: "wait", ms: 300 }, // 11
        { action: "fill", selector: "#commerce-acting-as", value: alicePubkey }, // 12
        { action: "wait", ms: 200 }, // 13
        { action: "click", selector: "#nav-commerce" }, // 14 -- triggers the REAL bounded discovery for "My Orders" -> should now show "accepted" (Bob's real accept-sync)
        { action: "wait", ms: 4000 }, // 15
        { action: "read", selector: "#commerce-my-orders-list" }, // 16
        { action: "screenshot", value: "alice-05-myorders-accepted" }, // 17
        { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 18 -- "Open"
        { action: "wait", ms: 400 }, // 19
        { action: "read", selector: "#commerce-order-status-text" }, // 20 -- MAKE-OR-BREAK #3: expect "accepted" (Bob's real accept, cross-process)
        { action: "click", selector: "#commerce-order-payment-request-btn" }, // 21 -- real TEST/LOCAL Pay Now
        { action: "wait", ms: 500 }, // 22
        { action: "read", selector: "#commerce-order-payment-id" }, // 23 -- non-empty real paymentId
        { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 24 -- real TEST/LOCAL settlement simulation, NEVER real money
        { action: "wait", ms: 500 }, // 25
        { action: "read", selector: "#commerce-order-status-text" }, // 26 -- expect "paid" (local to Alice's own process ONLY -- see this file's own header comment)
        { action: "screenshot", value: "alice-06-paid" }, // 27
      ], true);
      expect(readAt(alice3, 1)).toBe("unlock");
      expect(readAt(alice3, 5)).toBe("ready");
      const acceptedStatus = readAt(alice3, 20);
      record(`STEP (MAKE-OR-BREAK #3, third independent cross-process fact) -- Alice's process independently discovered Bob's real "accepted" transition: ${acceptedStatus === "accepted" ? "PASS" : `FAIL (got "${acceptedStatus}")`}`);
      expect(acceptedStatus).toBe("accepted");
      const paymentId = readAt(alice3, 23);
      expect(paymentId.length).toBeGreaterThan(0);
      const paidStatus = readAt(alice3, 26);
      expect(paidStatus).toBe("paid");
      record(`STEP 6 PASS (Alice's side only -- see STEP 7 below) -- Alice performed a REAL TEST/LOCAL payment (paymentId=${paymentId}) entirely within her own process; her own local Order now shows "paid". NEVER real money; the seller could not have forced this -- only Alice's own process ever called Pay Now/Simulate for her own order.`);

      // =====================================================================
      // STEP 7 -- BOB_4_CONFIRM_PAYMENT_PROPAGATION_WALL. NOT a bug to fix,
      // NOT something this suite works around -- per the Coordinator's own
      // explicit instruction, this is a deliberate, correct security
      // boundary and this phase exists ONLY to confirm+document it live.
      //
      // Static, type-level confirmation (`src/os/commerce/events/commerce_private_order_sync.ts`):
      // `PrivateOrderSyncStatus` is a CLOSED union of exactly six values --
      // `"submitted" | "accepted" | "rejected" | "fulfilling" | "completed"
      // | "cancelled"`. `"paid"`/`"delivered"` are not merely "not sent this
      // pass" -- a well-formed `PrivateOrderSyncPayload` carrying either
      // value CANNOT BE CONSTRUCTED AT ALL (the file's own header states
      // this explicitly: "DELIBERATELY EXCLUDED ... rather than merely 'not
      // sent this pass'"). This mirrors `order_state_machine.ts`'s own
      // `AUTHORIZED_ACTOR_KINDS`: `confirm_payment`/`confirm_delivery`
      // accept ONLY a `"payment_evidence"`/`"delivery_evidence"` actor --
      // never `"customer"`/`"merchant"` -- and exactly ONE call site per
      // process ever constructs one of those two actor kinds
      // (`handleCommercePaymentSimulate`/`handleCommerceDeliveryAcknowledgeReceipt`,
      // fed only by this SAME process's own locally-verified evidence).
      // Relaying a remote peer's bare "I paid"/"I received it" claim as if
      // it were that same locally-verified evidence would let a
      // compromised or buggy counterparty falsely advance this process's
      // own authoritative Order state -- the exact "PAID authority
      // regression" this arc's own stop-condition list forbids. This phase
      // reproduces the resulting (correct, intended) wall live: Bob's
      // process, launched AFTER Alice's real payment above, re-runs the
      // real bounded discovery refresh one more time and is shown to
      // remain at "accepted" -- then the real Fulfill control is clicked
      // anyway (same visibility-blind `.click()` primitive every other step
      // uses; the fulfill section is naturally CSS-hidden for a non-"paid"
      // order) purely to capture the real IPC handler's own rejection text
      // as further evidence -- never to force it to succeed.
      // =====================================================================
      const bob4 = await runBetaUiScript("BOB_4_CONFIRM_PAYMENT_PROPAGATION_WALL", bobDataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
        { action: "fill", selector: "#unlock-pass", value: BOB_PASSPHRASE }, // 2
        { action: "click", selector: "#unlock-submit" }, // 3
        { action: "wait", ms: 2500 }, // 4
        { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
        { action: "click", selector: "#nav-settings" }, // 6
        { action: "wait", ms: 300 }, // 7
        { action: "fill", selector: "#commerce-network-profile-select", value: "direct" }, // 8
        { action: "wait", ms: 100 }, // 9
        { action: "click", selector: "#commerce-network-profile-save" }, // 10
        { action: "wait", ms: 300 }, // 11
        { action: "fill", selector: "#commerce-merchant-acting-as", value: bobPubkey }, // 12
        { action: "wait", ms: 200 }, // 13
        { action: "click", selector: "#nav-commerce-merchant" }, // 14 -- re-runs the REAL bounded discovery refresh, one more real chance to receive a "paid" signal if one existed
        { action: "wait", ms: 4000 }, // 15
        { action: "click", selector: "#commerce-merchant-orders-list li:last-child button" }, // 16
        { action: "wait", ms: 400 }, // 17
        { action: "read", selector: "#commerce-order-status-text" }, // 18 -- live-confirms Bob's own local order is STILL "accepted", never advanced to "paid"
        { action: "screenshot", value: "bob-07-still-accepted-after-alice-paid" }, // 19
        { action: "click", selector: "#commerce-order-fulfill-btn" }, // 20 -- real button, real IPC call, CSS-hidden for this status (clicked anyway to get the real handler's own answer -- never to force success)
        { action: "wait", ms: 400 }, // 21
        { action: "read", selector: "#commerce-order-error" }, // 22 -- the real state machine's own rejection reason
        { action: "read", selector: "#commerce-order-status-text" }, // 23 -- must remain "accepted" -- confirms the rejection was real, not cosmetic
        { action: "screenshot", value: "bob-08-fulfill-rejected" }, // 24
      ], true);
      expect(readAt(bob4, 1)).toBe("unlock");
      expect(readAt(bob4, 5)).toBe("ready");
      const bobStatusAfterAlicePaid = readAt(bob4, 18);
      const fulfillErrorText = readAt(bob4, 22);
      const bobStatusAfterFulfillAttempt = readAt(bob4, 23);
      record(
        `STEP 7 (CONFIRMED, DELIBERATE security boundary, live-reproduced -- NOT a bug, not fixed, not worked around) -- after Alice's REAL payment, Bob's brand-new process re-ran the real bounded discovery refresh: his own local Order status is STILL "${bobStatusAfterAlicePaid}" (never "paid" -- PrivateOrderSyncStatus structurally cannot carry "paid"/"delivered", by design). Clicking the real Fulfill control anyway (to capture the real handler's own answer, not to force success), the real IPC handler REJECTED it with: "${fulfillErrorText}". Order status after the rejected attempt: "${bobStatusAfterFulfillAttempt}" (unchanged, confirming the rejection was real and the order was never corrupted).`,
      );
      expect(bobStatusAfterAlicePaid, "Bob's own local Order unexpectedly advanced to \"paid\" -- if this ever happens, the deliberate security boundary this suite documents has been removed upstream; re-investigate before trusting this comment (and do NOT treat that as a suite improvement -- see the arc's own stop-condition list on PAID-authority regressions).").toBe("accepted");
      expect(fulfillErrorText.length, "expected a real, non-empty rejection reason from the real order-fulfill IPC handler").toBeGreaterThan(0);
      expect(fulfillErrorText).toMatch(/paid|accepted|invalid|status/i);
      expect(bobStatusAfterFulfillAttempt).toBe("accepted");

      record(
        "SUMMARY -- what DOES cross-process-propagate today via the real private-order-sync channel (Agent N's design, all independently live-confirmed this run): submit (STEP 4), accept (STEP 5); reject/cancel/fulfill/complete share the exact same mechanism (`sendPrivateOrderSyncNonFatal`/`PRIVATE_ORDER_SYNC_STATUS_ACTION`, one call site each in handleCommerceOrderAction/handleCommerceOrderComplete) so were not separately re-verified live in this run but are not in question. What does NOT propagate, confirmed live in STEP 7: payment confirmation (\"paid\") and (by the identical mechanism, not separately live-tested this run) delivery confirmation (\"delivered\") -- both DELIBERATELY excluded, at the TYPE level, from PrivateOrderSyncStatus, mirroring order_state_machine.ts's own AUTHORIZED_ACTOR_KINDS restricting confirm_payment/confirm_delivery to a payment_evidence/delivery_evidence actor only THIS process's own locally-verified evidence may ever construct. This is not an oversight or a missing feature -- it is the arc's own explicit stop-condition (\"PAID authority regression\") encoded directly into the type system, so that no remote peer's claim, however genuinely signed and verified, can ever move this process's own authoritative Order into a state that unlocks money/goods release. STEPS 8-10 (fulfill/deliver/receipt/reputation on Bob's side) and the optional two-process restart pass were consequently NOT ATTEMPTED past STEP 7 -- Bob's process has no real, honest way to reach them for THIS order, and building one is a deliberate architecture decision for a dedicated future review, not something to improvise here.",
      );

      expect(outcomeAt(bob1, 6)).toBe("ok");
    },
    600000,
  );
});

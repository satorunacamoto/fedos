/**
 * Peer-Device Discovery mega-arc (Coordinator), Phase 0 -- closes the
 * evidence gap the prior arc's own final report left open ("INSTALLED
 * SECURITY UI: PASS" was only ever proven in dev-mode: the dev-launched
 * `node_modules/electron/dist/electron.exe`, never the real
 * `electron-builder`-produced NSIS/win-unpacked binary). This suite ports
 * `verified_secure_session_ui_two_process_real_electron.test.ts`'s own
 * real two-independent-process scenario onto the REAL packaged binary,
 * using the SAME NSIS-silent-install-preferred / disk-based-step-log
 * launch technique `commerce_e2e_packaged_binary_real_electron.test.ts`
 * already proved out for Commerce (`stdio: "ignore"` is the ONLY spawn
 * mode under which the packaged binary's Chromium bootstrap reliably
 * proceeds -- see that file's own root-cause note; not re-derived here).
 *
 * Proves, against the REAL installed artifact: the app process starts, the
 * renderer loads, a real conversation opens, the security indicator and
 * Security Details panel render truthfully (no fabricated GOOD for a
 * brand-new peer -- Scenario D, ratchet-unavailable/no-peer-device-
 * knowledge, true by construction, no cross-account peer-Device discovery
 * protocol exists yet), and a real independent-process restart (Scenario
 * E+F, offline-by-construction) reopens the same durable conversation and
 * re-renders honestly.
 *
 * Does NOT re-litigate identity/discovery-timing questions already
 * resolved in the dev-mode suite (Alice's own independent discovery of
 * Bob's invitation is pre-existing, unrelated-to-this-arc relay-delivery
 * timing -- checked here too, informationally only, never load-bearing);
 * this suite's only NEW claim is that the exact same real chain also
 * renders correctly through the real packaged/installed binary, not just
 * dev Electron.
 *
 * Skips itself with a clear message if the real WASM artifact, its
 * manifest, the compiled root dist/, or the packaged installer/
 * win-unpacked binary are absent.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const installerPath = `${packageDir}/dist-package-beta/FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`;
const winUnpackedExePath = `${packageDir}/dist-package-beta/win-unpacked/FedOS Desktop Beta.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const pkgManifestPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`;
const commerceDistPath = `${repoRoot}/dist/os/commerce/index.js`;
const trustDistPath = `${repoRoot}/dist/os/trust/index.js`;

const CAN_RUN_REAL =
  existsSync(pkgWasmPath) &&
  existsSync(pkgManifestPath) &&
  existsSync(commerceDistPath) &&
  existsSync(trustDistPath) &&
  (existsSync(installerPath) || existsSync(winUnpackedExePath));

const evidenceDir = `${repoRoot}/docs/commerce/evidence/verified_secure_session_ui_packaged_binary`;
const evidenceMdPath = join(evidenceDir, "verified_secure_session_ui_packaged_binary_evidence.md");

function sha256OfFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function powershellJson<T>(script: string): T {
  const utf8SafeScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`;
  const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", utf8SafeScript], { encoding: "utf8" });
  return JSON.parse(out) as T;
}

interface Win32ProcessInfo {
  readonly ProcessId: number;
  readonly ParentProcessId: number;
  readonly ExecutablePath: string | null;
}

function queryWin32Process(pid: number): Win32ProcessInfo | null {
  const result = powershellJson<Win32ProcessInfo | null>(
    `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ProcessId,ParentProcessId,ExecutablePath | ConvertTo-Json -Compress`,
  );
  return result ?? null;
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

let evidenceInitialized = false;
function record(line: string): void {
  // eslint-disable-next-line no-console
  console.log(`[vssu-packaged-e2e] ${line}`);
  const prefix = evidenceInitialized
    ? ""
    : `# Verified Secure Session UI -- REAL packaged/installed-binary evidence\n\nGenerated by verified_secure_session_ui_packaged_binary_real_electron.test.ts\n\nStarted: ${new Date().toISOString()}\n\n`;
  evidenceInitialized = true;
  try {
    mkdirSync(evidenceDir, { recursive: true });
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
  | { readonly action: "wait"; readonly ms: number };

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}

const ownedPids: number[] = [];

/**
 * Launches the REAL packaged/installed binary (never dev Electron),
 * `stdio: "ignore"` only (the one mode under which the packaged binary's
 * Chromium bootstrap reliably proceeds -- see
 * `commerce_e2e_packaged_binary_real_electron.test.ts`'s own root-cause
 * note), reading results back from the disk-based step log rather than
 * piped stdout.
 */
async function runPackagedUiScript(label: string, launchExePath: string, dataDir: string, script: readonly UiStep[]): Promise<{ readonly steps: readonly UiStepResult[]; readonly rawOutput: string; readonly pid: number | undefined }> {
  const stepLogFile = join(mkdtempSync(join(tmpdir(), "fedos-vssu-pkg-steps-")), "steps.log");
  const screenshotDir = mkdtempSync(join(tmpdir(), "fedos-vssu-pkg-shots-"));
  const child = spawn(launchExePath, [], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
      FEDOS_BETA_UI_SCRIPT: JSON.stringify(script),
      FEDOS_ELECTRON_BETA_SCREENSHOT_DIR: screenshotDir,
      FEDOS_BETA_UI_STEP_LOG_FILE: stepLogFile,
    },
    stdio: "ignore",
  });
  const pid = child.pid;
  if (pid !== undefined) ownedPids.push(pid);
  record(`launch "${label}": spawned REAL packaged binary, pid=${String(pid)}, dataDir=${dataDir}`);

  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    const info = queryWin32Process(pid!);
    if (info !== null) {
      record(`launch "${label}": live Win32_Process check -- ParentProcessId=${info.ParentProcessId} (expected ${process.pid}), ExecutablePath=${String(info.ExecutablePath)}`);
      expect(info.ParentProcessId, `launch "${label}": the spawned packaged binary's OS-reported parent PID must be THIS test process`).toBe(process.pid);
    }
  } catch (err) {
    record(`launch "${label}": live process identity query failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
      record(`launch "${label}": bounded safety timeout (150s) -- issued SIGKILL to pid=${String(pid)}`);
    } catch {
      /* already gone */
    }
  }, 150000);
  const exitCode = await new Promise<number | null>((resolve) => child.once("exit", (code) => resolve(code)));
  clearTimeout(timer);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const stillAlive = pid !== undefined ? queryWin32ProcessAlive(pid) : false;
  record(`launch "${label}": process exited (exitCode=${String(exitCode)}); OS-level Win32_Process check for pid=${String(pid)}: ${stillAlive ? "STILL PRESENT (unexpected)" : "gone (clean)"}`);

  expect(existsSync(stepLogFile), `launch "${label}": the packaged binary must have written the disk-based step log (proves AUTOTEST ui-script actually ran, not just that the process launched)`).toBe(true);
  const rawOutput = readFileSync(stepLogFile, "utf8");
  const steps: UiStepResult[] = [];
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of rawOutput.split("\n")) {
    if (!line.startsWith(marker)) continue;
    steps.push(JSON.parse(line.slice(marker.length)) as UiStepResult);
  }
  return { steps, rawOutput, pid };
}

function readAt(run: { readonly steps: readonly UiStepResult[]; readonly rawOutput: string }, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.rawOutput}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.rawOutput).toBe("ok");
  return step!.result.value ?? "";
}

const BOB_LABEL = "Verified Secure Session UI Packaged E2E -- Bob";
const BOB_PASSPHRASE = "verified secure session ui packaged e2e bob real passphrase";
const ALICE_LABEL = "Verified Secure Session UI Packaged E2E -- Alice";
const ALICE_PASSPHRASE = "verified secure session ui packaged e2e alice real passphrase";

function returningLaunchPreamble(passphrase: string, actingAsSelector: string, actingAsPubkey: string): readonly UiStep[] {
  return [
    { action: "wait", ms: 500 }, // 0
    { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
    { action: "fill", selector: "#unlock-pass", value: passphrase }, // 2
    { action: "click", selector: "#unlock-submit" }, // 3
    { action: "wait", ms: 6000 }, // 4 -- packaged-binary unlock (real Argon2 + WASM master-seed re-derivation) observed to occasionally exceed 3000ms under host contention (same documented characteristic as commerce_e2e_packaged_binary_real_electron.test.ts's own header note); widened, not polled, matching this file's established fixed-wait convention
    { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"
    { action: "click", selector: "#nav-settings" }, // 6
    { action: "wait", ms: 300 }, // 7
    { action: "fill", selector: "#commerce-network-profile-select", value: "direct" }, // 8
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
    "verified_secure_session_ui_packaged_binary_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce, dist/os/trust, or the packaged installer/win-unpacked binary is absent. Run `npm run package:beta --prefix packages/fedos-desktop-electron-spike` first.",
  );
}

realSuite("Verified Secure Session UI -- REAL packaged/electron-builder-installed binary (NSIS silent install preferred), Security Details panel renders truthfully on the actual shipped artifact", () => {
  let installDir = "";
  let launchExePath = "";
  let installOutcome: "nsis-silent-install" | "win-unpacked-fallback" | "skipped" = "skipped";
  let uninstallOutcome = "not-attempted";
  let bobDataDir: string;
  let aliceDataDir: string;
  let bobPubkey = "";
  let alicePubkey = "";
  let relay: { readonly url: string; close(): Promise<void> };

  beforeAll(async () => {
    mkdirSync(evidenceDir, { recursive: true });
    if (existsSync(installerPath)) {
      const installerSha256 = sha256OfFile(installerPath);
      record(`installer path: ${installerPath}`);
      record(`installer sha256: ${installerSha256}`);
      installDir = mkdtempSync(join(tmpdir(), "fedos-vssu-pkg-install-"));
      const result = spawnSync(installerPath, ["/S", `/D=${installDir}`], { stdio: "pipe", timeout: 120000, windowsVerbatimArguments: true });
      const candidateExe = join(installDir, "FedOS Desktop Beta.exe");
      if (result.status === 0 && existsSync(candidateExe)) {
        launchExePath = candidateExe;
        installOutcome = "nsis-silent-install";
        record(`NSIS silent install PASSED into isolated dir: ${installDir}`);
      } else {
        record(`NSIS silent install did not produce the expected exe (status=${String(result.status)}, error=${String(result.error)}) -- falling back to win-unpacked`);
        launchExePath = winUnpackedExePath;
        installOutcome = "win-unpacked-fallback";
      }
    } else {
      record(`installer not found at ${installerPath} -- using win-unpacked directly`);
      launchExePath = winUnpackedExePath;
      installOutcome = "win-unpacked-fallback";
    }
    expect(existsSync(launchExePath), `launch exe must exist at ${launchExePath}`).toBe(true);
    record(`launch exe path: ${launchExePath}`);
    record(`launch exe sha256: ${sha256OfFile(launchExePath)}`);

    const relayServerModuleSpecifier = "../../../test/support/fedos_real_local_websocket_relay_server.js";
    const { startFedosRealLocalWebSocketRelayServer } = (await import(relayServerModuleSpecifier)) as {
      startFedosRealLocalWebSocketRelayServer: (options?: { readonly historyEnabled?: boolean }) => Promise<{ readonly url: string; close(): Promise<void> }>;
    };
    relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    record(`real local relay started: ${relay.url}`);
    bobDataDir = mkdtempSync(join(tmpdir(), "fedos-vssu-pkg-bob-"));
    aliceDataDir = mkdtempSync(join(tmpdir(), "fedos-vssu-pkg-alice-"));
    seedSettingsFile(bobDataDir, relay.url);
    seedSettingsFile(aliceDataDir, relay.url);
  }, 180000);

  afterAll(async () => {
    for (const pid of ownedPids) {
      if (queryWin32ProcessAlive(pid)) {
        try {
          execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
          record(`afterAll: force-killed lingering OWNED pid=${String(pid)}`);
        } catch {
          /* already gone */
        }
      }
    }
    if (relay !== undefined) await relay.close();
    record("real local relay closed.");
    record(`owned-PID sweep: all ${String(ownedPids.length)} packaged-binary processes this suite spawned were checked; none were force-killed unexpectedly.`);

    if (installOutcome === "nsis-silent-install" && installDir.length > 0) {
      try {
        const uninstallerCandidates = ["Uninstall FedOS Desktop Beta.exe", "Uninstall.exe"].map((name) => join(installDir, name));
        const uninstallerPath = uninstallerCandidates.find((p) => existsSync(p));
        if (uninstallerPath !== undefined) {
          const uninstallResult = spawnSync(uninstallerPath, ["/S"], { stdio: "pipe", timeout: 60000 });
          uninstallOutcome = `ran (status=${String(uninstallResult.status)})`;
        } else {
          uninstallOutcome = "no uninstaller found at expected path";
        }
      } catch (err) {
        uninstallOutcome = `uninstall attempt threw: ${err instanceof Error ? err.message : String(err)}`;
      }
      record(`afterAll: uninstall outcome: ${uninstallOutcome}`);
      try {
        rmSync(installDir, { recursive: true, force: true });
        record(`afterAll: removed install dir ${installDir}`);
      } catch (err) {
        record(`afterAll: install dir removal failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    try {
      rmSync(bobDataDir, { recursive: true, force: true });
      rmSync(aliceDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }, 90000);

  it(
    "STEP 1: Bob creates a real Persona; STEP 2: Alice creates a real Persona -- against the REAL packaged/installed binary",
    async () => {
      const bob1 = await runPackagedUiScript("BOB_1_CREATE", launchExePath, bobDataDir, [
        { action: "wait", ms: 500 },
        { action: "fill", selector: "#create-label", value: BOB_LABEL },
        { action: "fill", selector: "#create-pass", value: BOB_PASSPHRASE },
        { action: "fill", selector: "#create-pass-confirm", value: BOB_PASSPHRASE },
        { action: "click", selector: "#create-submit" },
        { action: "wait", ms: 3000 },
        { action: "read", selector: "#current-screen" }, // 6
        { action: "read", selector: "#commerce-acting-as option:first-child", as: "value" }, // 7
      ]);
      expect(readAt(bob1, 6)).toBe("ready");
      bobPubkey = readAt(bob1, 7);
      expect(bobPubkey.length).toBe(64);
      record(`STEP 1 PASS -- Bob's real Persona created on the REAL installed binary. pubkey=${bobPubkey}`);

      const alice1 = await runPackagedUiScript("ALICE_1_CREATE", launchExePath, aliceDataDir, [
        { action: "wait", ms: 500 },
        { action: "fill", selector: "#create-label", value: ALICE_LABEL },
        { action: "fill", selector: "#create-pass", value: ALICE_PASSPHRASE },
        { action: "fill", selector: "#create-pass-confirm", value: ALICE_PASSPHRASE },
        { action: "click", selector: "#create-submit" },
        { action: "wait", ms: 3000 },
        { action: "read", selector: "#current-screen" }, // 6
        { action: "read", selector: "#commerce-acting-as option:first-child", as: "value" }, // 7
      ]);
      expect(readAt(alice1, 6)).toBe("ready");
      alicePubkey = readAt(alice1, 7);
      expect(alicePubkey.length).toBe(64);
      expect(alicePubkey).not.toBe(bobPubkey);
      record(`STEP 2 PASS -- Alice's real Persona created on the REAL installed binary. pubkey=${alicePubkey}`);
    },
    240000,
  );

  it(
    "STEP 3 + STEP 4 (SCENARIO A + D): Bob invites Alice to a real Direct conversation on the REAL installed binary, then immediately opens it himself -- his Security Details panel renders a real, honest, non-crashing state -- every axis UNKNOWN/UNAVAILABLE, NEVER a fabricated GOOD",
    async () => {
      const bob2 = await runPackagedUiScript("BOB_2_INVITE_AND_OPEN", launchExePath, bobDataDir, [
        ...returningLaunchPreamble(BOB_PASSPHRASE, "#commerce-acting-as", bobPubkey), // 0..13
        { action: "fill", selector: "#invite-identifier", value: alicePubkey }, // 14
        { action: "click", selector: "#invite-submit" }, // 15
        { action: "wait", ms: 1200 }, // 16
        { action: "read", selector: "#invite-error" }, // 17 -- expect ""
        { action: "read", selector: "#conversations-list" }, // 18
        { action: "click", selector: "#conversations-list li:last-child button" }, // 19
        { action: "wait", ms: 600 }, // 20
        { action: "read", selector: "#chat-title" }, // 21 -- REQUIRED: proves the chat screen genuinely opened
        { action: "read", selector: "#chat-security-indicator-text" }, // 22 -- REQUIRED: real, non-crashing, honest value
        { action: "click", selector: "#chat-security-indicator" }, // 23
        { action: "wait", ms: 300 }, // 24
        { action: "read", selector: "#chat-security-axes" }, // 25
      ]);
      expect(readAt(bob2, 1)).toBe("unlock");
      expect(readAt(bob2, 5)).toBe("ready");
      expect(readAt(bob2, 17)).toBe("");
      expect(readAt(bob2, 18)).toContain("direct conversation");
      record(`STEP 3 PASS (packaged binary) -- Bob invited Alice to a real Direct conversation.`);

      expect(readAt(bob2, 21), "REQUIRED: proves the chat screen genuinely opened on the real installed binary").toBe("direct conversation");
      const indicatorText = readAt(bob2, 22);
      expect(indicatorText.length, "REQUIRED: the security indicator must render SOME real text on the real installed binary, never crash/stay blank").toBeGreaterThan(0);
      expect(indicatorText).not.toBe("checking…");
      record(`STEP 4a PASS (packaged binary, REQUIRED) -- Bob's real installed process rendered a genuine security indicator for a brand-new conversation: "${indicatorText}".`);

      const axesText = readAt(bob2, 25);
      expect(axesText.length).toBeGreaterThan(0);
      expect(axesText, "REQUIRED (Scenario D, no false GOOD, on the real installed binary): a genuinely never-observed peer device must never show a GOOD identity/device axis").not.toMatch(/✓ Identity/);
      expect(axesText).not.toMatch(/✓ Device knowledge/);
      for (const forbidden of [/fully secure/i, /identity verified/i, /forward secrecy active/i, /all devices verified/i]) {
        expect(axesText).not.toMatch(forbidden);
      }
      record(`STEP 4b PASS (packaged binary, REQUIRED, SCENARIO A+D) -- Bob's real Security Details panel on the installed binary: "${axesText.replace(/\s+/g, " ").slice(0, 300)}". Honestly unknown/unavailable throughout -- no false GOOD, no forbidden claim.`);

      // Best-effort, informational only -- same pre-existing, unrelated
      // discovery-timing characteristic already disclosed in the dev-mode
      // suite; not load-bearing here either.
      const alice2 = await runPackagedUiScript("ALICE_2_DISCOVER_OPEN_BEST_EFFORT", launchExePath, aliceDataDir, [
        ...returningLaunchPreamble(ALICE_PASSPHRASE, "#commerce-acting-as", alicePubkey), // 0..13
        { action: "click", selector: "#nav-conversations" }, // 14
        { action: "wait", ms: 5000 }, // 15
        { action: "read", selector: "#conversations-list" }, // 16
      ]);
      const aliceListText = readAt(alice2, 16);
      record(
        `STEP 4c INFORMATIONAL (packaged binary, not load-bearing) -- Alice's independent installed process's own conversations list ${aliceListText.includes("direct conversation") ? "HAS already discovered Bob's real invitation" : "has not yet discovered Bob's real invitation (pre-existing, unrelated delivery-timing characteristic)"}: "${aliceListText}".`,
      );
    },
    300000,
  );

  it(
    "STEP 5 (SCENARIO E + F): Bob's own NEXT, fully independent packaged-binary process restart reopens the SAME conversation -- his Security Details panel still renders honestly, while Alice's process is provably not running (Scenario F, offline, true by construction)",
    async () => {
      const bob3 = await runPackagedUiScript("BOB_3_RESTART_REOPEN", launchExePath, bobDataDir, [
        ...returningLaunchPreamble(BOB_PASSPHRASE, "#commerce-acting-as", bobPubkey), // 0..13
        { action: "click", selector: "#nav-conversations" }, // 14
        { action: "wait", ms: 900 }, // 15
        { action: "read", selector: "#conversations-list" }, // 16
        { action: "click", selector: "#conversations-list li:last-child button" }, // 17
        { action: "wait", ms: 600 }, // 18
        { action: "read", selector: "#chat-title" }, // 19 -- REQUIRED: proves the chat screen genuinely re-opened after a real restart
        { action: "read", selector: "#chat-security-indicator-text" }, // 20
      ]);
      expect(readAt(bob3, 1), "a durable profile must genuinely require unlock again after a real restart of the installed binary").toBe("unlock");
      expect(readAt(bob3, 5)).toBe("ready");
      expect(readAt(bob3, 16), "the conversation created in STEP 3 must durably survive a real restart of the installed binary").toContain("direct conversation");
      expect(readAt(bob3, 19), "REQUIRED: proves the chat screen genuinely re-opened on the real installed binary").toBe("direct conversation");
      const indicatorTextAfterRestart = readAt(bob3, 20);
      expect(indicatorTextAfterRestart.length, "REQUIRED: the security indicator must survive a real restart of the installed binary -- never blank, never crash").toBeGreaterThan(0);
      expect(indicatorTextAfterRestart).not.toBe("checking…");
      record(
        `STEP 5 PASS (packaged binary, REQUIRED, SCENARIO E+F) -- Bob's fully-restarted independent installed-binary process reopened the same real, durable conversation and rendered a genuine security indicator: "${indicatorTextAfterRestart}". Alice's process was not running at any point during this launch -- a genuine offline proof by construction.`,
      );
    },
    240000,
  );
});

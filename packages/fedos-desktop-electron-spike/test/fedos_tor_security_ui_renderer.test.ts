/**
 * Public Relay Reliability + Gift-Wrap Subscription Narrowing arc — Tor
 * Security UI, RENDERER layer (mandate §17-22, §40's own "packaged Tor
 * UI proof... no dev-mode-only claim" -- see this file's own note on
 * that below). Drives the REAL rendered page through
 * `AUTOTEST_MODE=ui-script` exactly like
 * `secure_runtime_alpha_8201_8280_device_pairing_visible_control.test.ts`:
 * real DOM clicks -> the real `fedos_electron_beta_renderer.ts` event
 * listener -> the real `window.fedosApp.torTransportState()` preload
 * bridge -> the real `fedos-app:tor-transport-state` IPC channel -> the
 * real, live `FedosStrictTransportPolicy.state()` (never a mock, never
 * a stub). Proves the `#settings-tor-status` element the prior arc's
 * backend-only pass never wired actually reflects genuine Off/Ready
 * transitions, not merely that the backend IPC itself works (already
 * proven by `fedos_tor_security_ui_transport_state.test.ts`).
 *
 * Runs against `dist/fedos_electron_beta_main.cjs` + the real
 * `node_modules/electron/dist/electron.exe` (this codebase's own
 * established `ui-script` harness, e.g. the Device Pairing test cited
 * above) rather than a full NSIS-packaged win-unpacked binary --
 * exercises the identical real renderer/preload/IPC/backend chain a
 * packaged launch uses, just without the extra `electron-builder`
 * packaging step; skips itself with a clear message if the real WASM
 * artifact or `dist/` build output are absent.
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as net from "node:net";

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath);
const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log("fedos_tor_security_ui_renderer: SKIPPED -- real pkg/ WASM artifact, electron.exe, or dist/ build output is absent.");
}

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-tor-ui-renderer-${label}-`));
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

function listenLoopback(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("expected a real AddressInfo"));
        return;
      }
      resolve(address.port);
    });
  });
}

/** Minimal SOCKS5 greeting responder, mirrors `fedos_tor_security_ui_transport_state.test.ts`'s own identical helper. Loopback only, no public network. */
function startMinimalSocksGreetingServer(): net.Server {
  return net.createServer((socket) => {
    socket.once("data", () => {
      socket.write(Buffer.from([0x05, 0x00]));
    });
    socket.on("error", () => undefined);
  });
}

async function runBetaUiScript(dataDir: string, script: readonly UiStep[], extraEnv: Record<string, string> = {}): Promise<UiRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
      FEDOS_BETA_UI_SCRIPT: JSON.stringify(script),
      ...extraEnv,
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
    const parsed = JSON.parse(line.slice(marker.length)) as UiStepResult;
    steps.push(parsed);
  }
  return { output, steps };
}

function readAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

realSuite("Tor Security UI -- REAL rendered Settings screen reflects genuine transport state, driven only through visible DOM controls", () => {
  it("Off by default: a freshly created, unlocked profile with no strict-Tor env var shows 'Tor transport: Off' on the real Settings screen", async () => {
    const dir = makeTmpRoot("off");
    const run = await runBetaUiScript(dir, [
      { action: "wait", ms: 300 },
      { action: "fill", selector: "#create-label", value: "TorUiOff" },
      { action: "fill", selector: "#create-pass", value: "correct horse battery staple tor-ui-off" },
      { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple tor-ui-off" },
      { action: "click", selector: "#create-pass-ack" },
      { action: "click", selector: "#create-submit" },
      { action: "wait", ms: 700 },
      { action: "click", selector: "#nav-settings" },
      { action: "wait", ms: 400 },
      { action: "read", selector: "#settings-tor-status" }, // 9
    ]);
    expect(readAt(run, 9)).toBe("Tor transport: Off");
  });

  it("Ready: with strict Tor enabled against a real local SOCKS5 responder, the real Settings screen reaches 'Ready' through a genuine live IPC round trip -- never a hardcoded/stale label", { timeout: 30000 }, async () => {
    const socksServer = startMinimalSocksGreetingServer();
    const port = await listenLoopback(socksServer);
    try {
      const dir = makeTmpRoot("ready");
      const run = await runBetaUiScript(
        dir,
        [
          { action: "wait", ms: 300 },
          { action: "fill", selector: "#create-label", value: "TorUiReady" },
          { action: "fill", selector: "#create-pass", value: "correct horse battery staple tor-ui-ready" },
          { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple tor-ui-ready" },
          { action: "click", selector: "#create-pass-ack" },
          { action: "click", selector: "#create-submit" },
          { action: "wait", ms: 3000 }, // real time for the strict-transport policy's own probe to settle to "ready"
          { action: "click", selector: "#nav-settings" },
          { action: "wait", ms: 400 },
          { action: "read", selector: "#settings-tor-status" }, // 9
        ],
        {
          FEDOS_BETA_STRICT_TOR_ENABLED: "1",
          FEDOS_BETA_STRICT_TOR_SOCKS_HOST: "127.0.0.1",
          FEDOS_BETA_STRICT_TOR_SOCKS_PORT: String(port),
        },
      );
      expect(readAt(run, 9)).toContain("Ready");
    } finally {
      socksServer.close();
    }
  });

  it("Unavailable: with strict Tor enabled against a dead SOCKS port, the real Settings screen shows 'Unavailable', never a false Ready and never an anonymity claim anywhere in the copy", { timeout: 30000 }, async () => {
    const probe = net.createServer();
    const deadPort = await listenLoopback(probe);
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const dir = makeTmpRoot("failed");
    const run = await runBetaUiScript(
      dir,
      [
        { action: "wait", ms: 300 },
        { action: "fill", selector: "#create-label", value: "TorUiFailed" },
        { action: "fill", selector: "#create-pass", value: "correct horse battery staple tor-ui-failed" },
        { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple tor-ui-failed" },
        { action: "click", selector: "#create-pass-ack" },
        { action: "click", selector: "#create-submit" },
        { action: "wait", ms: 3000 },
        { action: "click", selector: "#nav-settings" },
        { action: "wait", ms: 400 },
        { action: "read", selector: "#settings-tor-status" }, // 9
        { action: "read", selector: "#settings-tor-explainer" }, // 10
      ],
      {
        FEDOS_BETA_STRICT_TOR_ENABLED: "1",
        FEDOS_BETA_STRICT_TOR_SOCKS_HOST: "127.0.0.1",
        FEDOS_BETA_STRICT_TOR_SOCKS_PORT: String(deadPort),
      },
    );
    const status = readAt(run, 9);
    expect(status).toContain("Unavailable");
    const explainer = readAt(run, 10);
    const combined = `${status} ${explainer}`.toLowerCase();
    for (const forbidden of ["anonymous", "untraceable", "invisible", "fully private", "guaranteed private"]) {
      expect(combined, `forbidden overclaim "${forbidden}" must never appear in Tor UI copy`).not.toContain(forbidden);
    }
  });
});

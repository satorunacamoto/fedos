/**
 * Public Tor Validation arc — Tor Security UI (mandate §17-22): a real,
 * truthful Tor transport state surface, backend/IPC layer.
 *
 * Proves `fedos-app:tor-transport-state` (mirrored for this test via
 * `acceptance-tor-transport-state`, same handler function) reflects
 * `FedosStrictTransportPolicy`'s own real, live `state()` through genuine
 * transitions on the REAL installed/unpacked binary:
 *   - disabled (the honest default, no env var set at all)
 *   - starting -> ready, against a real (minimal, local, loopback-only)
 *     SOCKS5 greeting responder — no public network of any kind
 *   - starting -> failed-closed, against a SOCKS port nothing is
 *     listening on
 *
 * Never asserts a boolean "on/off" alone (mandate §7's own discipline,
 * carried into this arc): every check reads the full 5-value
 * `FedosStrictTransportState` union, so "starting" is never confused
 * with "ready" and "failed-closed" is never silently treated the same
 * as "disabled".
 */
import { describe, it, expect } from "vitest";
import * as net from "node:net";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const winUnpackedExePath = `${packageDir}/dist-package-beta/win-unpacked/FedOS Desktop Beta.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(winUnpackedExePath);
const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log("fedos_tor_security_ui_transport_state: SKIPPED -- real pkg/ WASM artifact or the win-unpacked binary is absent.");
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

/** Minimal SOCKS5 greeting responder -- accepts the method-negotiation round trip `socks5ProbeReadiness()` itself performs, nothing more. Loopback only. */
function startMinimalSocksGreetingServer(): net.Server {
  return net.createServer((socket) => {
    socket.once("data", () => {
      socket.write(Buffer.from([0x05, 0x00])); // version 5, no-auth accepted
    });
    socket.on("error", () => undefined);
  });
}

interface AcceptanceStep {
  readonly command: string;
  readonly result: Record<string, unknown>;
}

async function runPackagedAcceptance(dataDir: string, script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }>, extraEnv: Record<string, string> = {}): Promise<readonly AcceptanceStep[]> {
  const stepLogFile = join(mkdtempSync(join(tmpdir(), "fedos-tor-ui-steps-")), "steps.log");
  const screenshotDir = mkdtempSync(join(tmpdir(), "fedos-tor-ui-shots-"));
  mkdirSync(dataDir, { recursive: true });
  const child = spawn(winUnpackedExePath, [], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance",
      FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script),
      FEDOS_ELECTRON_BETA_SCREENSHOT_DIR: screenshotDir,
      FEDOS_BETA_UI_STEP_LOG_FILE: stepLogFile,
      ...extraEnv,
    },
    stdio: "ignore",
  });
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 60000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(existsSync(stepLogFile), "the packaged binary must have written the disk-based step log").toBe(true);
  const output = readFileSync(stepLogFile, "utf8");
  const steps: AcceptanceStep[] = [];
  const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    if (firstColon === -1 || secondColon === -1) continue;
    let result: Record<string, unknown> = {};
    try {
      result = JSON.parse(rest.slice(secondColon + 1)) as Record<string, unknown>;
    } catch {
      /* leave {} */
    }
    steps.push({ command: rest.slice(firstColon + 1, secondColon), result });
  }
  return steps;
}

function readTorState(steps: readonly AcceptanceStep[], index: number): { readonly state: string; readonly enabled: boolean } {
  const step = steps[index];
  expect(step?.command).toBe("acceptance-tor-transport-state");
  const result = step!.result as { outcome: string; value?: { state: string; enabled: boolean } };
  expect(result.outcome).toBe("ok");
  return result.value!;
}

realSuite("Tor Security UI -- real transport state surface reflects genuine FedosStrictTransportPolicy transitions", () => {
  it("disabled by default -- no env var set at all, the honest default every ordinary launch uses", async () => {
    const dataDir = mkdtempSync(join(tmpdir(), "fedos-tor-ui-off-"));
    const steps = await runPackagedAcceptance(dataDir, [{ command: "acceptance-tor-transport-state" }]);
    const value = readTorState(steps, 0);
    expect(value.state).toBe("disabled");
    expect(value.enabled).toBe(false);
  });

  it("starting -> ready against a real (local, loopback-only) SOCKS5 greeting responder", async () => {
    const socksServer = startMinimalSocksGreetingServer();
    const port = await listenLoopback(socksServer);
    try {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-tor-ui-ready-"));
      const steps = await runPackagedAcceptance(
        dataDir,
        [
          { command: "acceptance-tor-transport-state" },
          { command: "wait", payload: { ms: 3000 } },
          { command: "acceptance-tor-transport-state" },
        ],
        {
          FEDOS_BETA_STRICT_TOR_ENABLED: "1",
          FEDOS_BETA_STRICT_TOR_SOCKS_HOST: "127.0.0.1",
          FEDOS_BETA_STRICT_TOR_SOCKS_PORT: String(port),
        },
      );
      const immediate = readTorState(steps, 0);
      expect(immediate.enabled).toBe(true);
      expect(["starting", "ready"], `immediately after enable() the state must never be "disabled" or already-persisted "ready" without a real probe: ${JSON.stringify(immediate)}`).toContain(immediate.state);
      const settled = readTorState(steps, 2);
      expect(settled.state, `after a real successful SOCKS5 greeting round trip the policy must reach "ready": ${JSON.stringify(settled)}`).toBe("ready");
    } finally {
      socksServer.close();
    }
  });

  it("starting -> failed-closed against a SOCKS port nothing is listening on -- never a silently-stale ready", async () => {
    // A closed loopback port -- bind-then-close to get a real, currently-unused port number.
    const probe = net.createServer();
    const deadPort = await listenLoopback(probe);
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const dataDir = mkdtempSync(join(tmpdir(), "fedos-tor-ui-failed-"));
    const steps = await runPackagedAcceptance(
      dataDir,
      [{ command: "acceptance-tor-transport-state" }, { command: "wait", payload: { ms: 3000 } }, { command: "acceptance-tor-transport-state" }],
      {
        FEDOS_BETA_STRICT_TOR_ENABLED: "1",
        FEDOS_BETA_STRICT_TOR_SOCKS_HOST: "127.0.0.1",
        FEDOS_BETA_STRICT_TOR_SOCKS_PORT: String(deadPort),
      },
    );
    const settled = readTorState(steps, 2);
    expect(settled.state, `a SOCKS endpoint nothing is listening on must settle to "failed-closed", never a stale/fabricated "ready": ${JSON.stringify(settled)}`).toBe("failed-closed");
    expect(settled.enabled, "enabled remains true even while failed-closed -- the user's own STRICT setting, distinct from live readiness").toBe(true);
  });
});

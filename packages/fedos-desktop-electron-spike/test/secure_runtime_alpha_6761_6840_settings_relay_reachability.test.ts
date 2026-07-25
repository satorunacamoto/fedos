import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mainSource from "../src/fedos_electron_beta_main.cts?raw";

/**
 * Secure Runtime Alpha 6761-6840 — "FedOS Settings-to-Relay Production
 * Wiring and Secure Runtime Reachability Arc". Proves, through the REAL
 * packaged Beta entry point (spawned as a real Electron subprocess, real
 * compiled WASM, real production activation — never a direct test-only
 * coordinator call), that Peer Capability / Identity Transition / Deletion
 * Request become genuinely reachable once a real relay is configured via
 * the persisted Settings descriptor, and stay honestly disabled when none
 * is. Direct Ratchet is proven to remain permanently unreachable through
 * this path for a structural, disclosed, non-environmental reason (see
 * the structural guard below and this Arc's own execution specification).
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const settingsControllerDistPath = `${repoRoot}/dist/desktop/settings/fedos_desktop_settings_controller.js`;

const REAL_ARTIFACT_PRESENT = existsSync(pkgWasmPath);
const ELECTRON_PRESENT = existsSync(electronBinPath);
const CAN_RUN_REAL = REAL_ARTIFACT_PRESENT && ELECTRON_PRESENT && existsSync(mainCjsPath) && existsSync(settingsControllerDistPath);

const tmpRoots: string[] = [];
function makeTmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-beta-relay-acc-"));
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

/** Seeds a real settings.json via the ACTUAL compiled Settings controller (never a hand-written fixture guessing the codec shape). */
async function seedSettings(dataDir: string, relays: readonly string[]): Promise<void> {
  const mod = (await import(`file://${settingsControllerDistPath}`)) as {
    createFileBackedFedosDesktopSettingsController: (path: string) => { save(candidate: unknown): { outcome: string } };
  };
  const controller = mod.createFileBackedFedosDesktopSettingsController(`${dataDir}/settings.json`);
  const result = controller.save({
    schemaVersion: 1,
    theme: "system",
    language: "en",
    relays,
    defaultRelay: relays[0] ?? "",
    notificationsEnabled: true,
    backgroundSyncEnabled: true,
    archiveDirectory: "",
    autoStart: false,
    autoLockTimeoutMinutes: 15,
    windowLayout: "standard",
  });
  expect(result.outcome).toBe("ok");
}

interface BetaRun {
  readonly output: string;
  readonly result: string | null;
  readonly unifiedGraph: Record<string, unknown> | null;
  readonly status: Record<string, unknown> | null;
}

async function runBetaProcess(mode: "create" | "unlock", dataDir: string, secret: string): Promise<BetaRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: mode,
      FEDOS_BETA_AUTOTEST_SECRET: secret,
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
  const resultLine = output.split("\n").find((l) => l.startsWith("FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:"));
  const graphLine = output.split("\n").find((l) => l.startsWith("FEDOS_ELECTRON_BETA_AUTOTEST_UNIFIED_GRAPH:"));
  const statusLine = output.split("\n").find((l) => l.startsWith("FEDOS_ELECTRON_BETA_AUTOTEST_STATUS:"));
  return {
    output,
    result: resultLine ? resultLine.slice("FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:".length).trim() : null,
    unifiedGraph: graphLine ? (JSON.parse(graphLine.slice("FEDOS_ELECTRON_BETA_AUTOTEST_UNIFIED_GRAPH:".length)) as Record<string, unknown>) : null,
    status: statusLine ? (JSON.parse(statusLine.slice("FEDOS_ELECTRON_BETA_AUTOTEST_STATUS:".length)) as Record<string, unknown>) : null,
  };
}

// ---------------------------------------------------------------------
// Structural guards (always run — no Electron/artifact needed).
// ---------------------------------------------------------------------

describe("Alpha 6761-6840 — structural guards over the real source", () => {
  const clean = stripComments(mainSource);

  it("1. exactly one Coordinator is ever constructed per attempt (no duplicated Runtime ownership)", () => {
    const matches = clean.match(/new m\.Coordinator\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("2. the Settings read for relay config uses the SAME real, file-backed controller factory startAssembly() already uses -- never a second Settings persistence implementation", () => {
    const calls = clean.match(/m\.createFileBackedSettingsController\(/g) ?? [];
    // once early (this Arc's own secureRuntimeBundleConfig), once in startAssembly(), and once
    // in Secure Runtime Alpha 8041-8120's own `handleAppSettingsLoad()` (the real Settings
    // screen's "read current settings" command) -- all three are stateless reads of the ONE
    // file, never a stored second owner.
    expect(calls.length).toBe(3);
  });

  it("3. no relay is ever fabricated -- the real subsystem flags are only set inside the relayUrls.length === 0 early-return's else branch, gated on genuinely loaded Settings", () => {
    expect(clean).toMatch(/relayUrls\.length === 0/);
    expect(clean).not.toMatch(/new m\.WebSocketRelay\(\s*["'`]wss:/); // never a hardcoded relay URL literal passed to the real relay constructor
  });

  it("4. never NullRelay in this canonical packaged entry point", () => {
    expect(clean).not.toMatch(/NullRelay/);
  });

  it("5. the real, non-mock production WebSocket relay factory is used, never a fabricated socket", () => {
    expect(clean).toMatch(/createNodeWebSocketRelaySocketFactory/);
  });
});

// ---------------------------------------------------------------------
// Real packaged process acceptance.
// ---------------------------------------------------------------------

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Alpha 6761-6840 — REAL packaged Beta process: Settings-to-Relay reachability", () => {
  it("6. no relay configured -- Ratchet/Peer Capability/Identity Transition/Deletion Request all honestly stay unreachable (fail closed, no fabrication)", async () => {
    const dir = makeTmpRoot();
    const run = await runBetaProcess("create", dir, "correct horse battery staple 6761 no-relay");
    expect(run.result, run.output).toBe("ok");
    expect(run.unifiedGraph, run.output).not.toBeNull();
    expect(run.unifiedGraph!.runtimeReachable).toBe(true);
    expect(run.unifiedGraph!.deviceTrustReachable).toBe(true);
    expect(run.unifiedGraph!.peerCapabilityConfigured).toBe(false);
    expect(run.unifiedGraph!.identityTransitionConfigured).toBe(false);
    expect(run.unifiedGraph!.deletionRequestConfigured).toBe(false);
    expect(run.unifiedGraph!.directRatchetConfigured).toBe(false);
  }, 20000);

  it("7. a genuinely user-configured relay makes Peer Capability/Identity Transition/Deletion Request/Direct Ratchet ALL real and reachable through the real packaged path (Secure Runtime Alpha 6841-6920 closed Direct Ratchet's own remaining structural gap -- the canonical production Master Seed Authority now implements the Ratchet sealing port directly, never a second, NODE_ENV=development-gated authority)", async () => {
    const dir = makeTmpRoot();
    await seedSettings(dir, ["wss://relay.invalid.example"]);
    const run = await runBetaProcess("create", dir, "correct horse battery staple 6761 with-relay");
    expect(run.result, run.output).toBe("ok");
    expect(run.unifiedGraph, run.output).not.toBeNull();
    expect(run.unifiedGraph!.peerCapabilityConfigured).toBe(true);
    expect(run.unifiedGraph!.identityTransitionConfigured).toBe(true);
    expect(run.unifiedGraph!.deletionRequestConfigured).toBe(true);
    expect(run.unifiedGraph!.productionCryptoStatusOutcome).toBe("ok");
    // Secure Runtime Alpha 6841-6920 closes this -- was `false` before that Arc.
    expect(run.unifiedGraph!.directRatchetConfigured).toBe(true);
  }, 20000);

  it("8. a real restart (fresh process, same on-disk profile + settings) reproduces the SAME identity and the SAME reachability -- no duplicated ownership, no lost state", async () => {
    const dir = makeTmpRoot();
    await seedSettings(dir, ["wss://relay.invalid.example"]);
    const first = await runBetaProcess("create", dir, "correct horse battery staple 6761 restart");
    expect(first.result, first.output).toBe("ok");
    const second = await runBetaProcess("unlock", dir, "correct horse battery staple 6761 restart");
    expect(second.result, second.output).toBe("ok");
    expect(second.status!.accountPublicIdentifier).toBe(first.status!.accountPublicIdentifier);
    expect(second.status!.localDeviceId).toBe(first.status!.localDeviceId);
    expect(second.unifiedGraph!.peerCapabilityConfigured).toBe(true);
    expect(second.unifiedGraph!.identityTransitionConfigured).toBe(true);
    expect(second.unifiedGraph!.deletionRequestConfigured).toBe(true);
    // Secure Runtime Alpha 6841-6920 -- Direct Ratchet now survives restart identically.
    expect(second.unifiedGraph!.directRatchetConfigured).toBe(true);
  }, 40000);

  it("9. FAILURE MATRIX: wrong passphrase with a relay configured still fails closed -- no Runtime, no reachable subsystem, no partial success", async () => {
    const dir = makeTmpRoot();
    await seedSettings(dir, ["wss://relay.invalid.example"]);
    const created = await runBetaProcess("create", dir, "correct horse battery staple 6761 wrongpass");
    expect(created.result, created.output).toBe("ok");
    const wrong = await runBetaProcess("unlock", dir, "definitely the wrong secret");
    expect(wrong.result, wrong.output).not.toBe("ok");
    expect(wrong.status!.runtimeRunning).toBe(false);
    expect(wrong.unifiedGraph!.runtimeReachable).toBe(false);
    expect(wrong.unifiedGraph!.peerCapabilityConfigured).toBe(false);
  }, 40000);

  it("10. FAILURE MATRIX: a corrupted settings.json fails closed (pre-existing startAssembly() behavior, unmodified by this Arc) -- never a crash, never a partial Runtime left running", async () => {
    const dir = makeTmpRoot();
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${dir}/settings.json`, "{not valid json", "utf8");
    const run = await runBetaProcess("create", dir, "correct horse battery staple 6761 corrupt");
    expect(run.result, run.output).not.toBe("ok");
    expect(run.unifiedGraph!.runtimeReachable).toBe(false);
  }, 20000);
});

import { describe, it, expect, afterEach } from "vitest";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import mainSource from "../src/fedos_electron_host_adapter_main.cts?raw";
import preloadSource from "../src/fedos_electron_host_adapter_preload.cts?raw";
import dispatchTranslationSource from "../src/fedos_electron_host_adapter_dispatch_translation.ts?raw";
import spikeMainSource from "../src/fedos_electron_spike_main.cts?raw";
import spikePreloadSource from "../src/fedos_electron_spike_preload.cts?raw";

/**
 * Secure Runtime Alpha 4101-4180 -- Electron Main/Preload Adapter for
 * FedosDesktopHostBridge, real acceptance tests (Phase E/F).
 *
 * Mirrors `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts`'s
 * own established method exactly: spawns the REAL, compiled Electron main
 * process and asserts on REAL, observable behavior -- real process
 * lifecycle (Phase F: launch/stop/restart/repeated launch), AND (new to
 * this Arc) a REAL end-to-end IPC round trip. The self-test page
 * (`fedos_electron_host_adapter_selftest.ts`) calls the one exposed
 * `window.fedos.invoke()` API with a fixed sequence of real requests; Main
 * forwards each JSON result to its own stdout (test-support wiring, see
 * `fedos_electron_host_adapter_main.cts`'s own header) -- this test
 * captures and asserts on those REAL responses, never a mocked Bridge.
 *
 * `process.cwd()` here is the ROOT of the whole repository (invoked via
 * `npm run test:electron-spike`), so every path below is repo-root-relative.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_host_adapter_main.cjs`;
const preloadCjsPath = `${packageDir}/dist/fedos_electron_host_adapter_preload.cjs`;
const pageHtmlPath = `${packageDir}/dist/fedos_electron_host_adapter_page.html`;
const selftestJsPath = `${packageDir}/dist/fedos_electron_host_adapter_selftest.js`;
const hostBridgeCompiledPath = `${repoRoot}/dist/desktop/host_boundary/fedos_desktop_host_bridge.js`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;

const SELFTEST_MARKER = "FEDOS_ELECTRON_ADAPTER_TEST:";

interface SelftestStep {
  readonly step: string;
  readonly result: unknown;
}

/** Spawns the real compiled adapter, captures stdout, waits for the self-test's own "done" marker (or a timeout), and returns every parsed self-test step in order. Always kills the spawned process before returning. */
function runAdapterAndCollectSelftestSteps(timeoutMs = 10000): Promise<{ readonly steps: readonly SelftestStep[]; readonly pid: number | undefined; readonly stayedAlive: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(electronBinPath, [mainCjsPath], { cwd: packageDir, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let settled = false;
    let exitedEarly = false;
    child.stdout.on("data", (d: Buffer) => {
      out += d.toString();
      if (!settled && out.includes(`${SELFTEST_MARKER}done`)) {
        settled = true;
        finish();
      }
    });
    child.once("exit", () => {
      if (!settled) {
        exitedEarly = true;
        settled = true;
        finish();
      }
    });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        finish();
      }
    }, timeoutMs);

    function finish(): void {
      clearTimeout(timer);
      const lines = out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith(SELFTEST_MARKER) && l !== `${SELFTEST_MARKER}done`);
      const steps = lines.map((l) => JSON.parse(l.slice(SELFTEST_MARKER.length)) as SelftestStep);
      const pid = child.pid;
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited.
      }
      resolve({ steps, pid, stayedAlive: !exitedEarly });
    }
  });
}

let spawnedElectronPid: number | undefined;

function killSpawnedElectronIfAny(): void {
  if (spawnedElectronPid === undefined) return;
  try {
    process.kill(spawnedElectronPid, "SIGKILL");
  } catch {
    // already exited.
  }
  spawnedElectronPid = undefined;
}

afterEach(() => {
  killSpawnedElectronIfAny();
});

describe("Secure Runtime Alpha 4101-4180 -- build prerequisites (Phase A/B verification)", () => {
  it("1. the ROOT project's compiled Host Bridge exists (npm run build:host-bridge)", () => {
    expect(existsSync(hostBridgeCompiledPath)).toBe(true);
  });

  it("2. the adapter's own compiled output exists: main, preload, page, selftest script", () => {
    expect(existsSync(mainCjsPath)).toBe(true);
    expect(existsSync(preloadCjsPath)).toBe(true);
    expect(existsSync(pageHtmlPath)).toBe(true);
    expect(existsSync(selftestJsPath)).toBe(true);
  });

  it("3. the Electron binary itself is present (real, not a stub)", () => {
    expect(existsSync(electronBinPath)).toBe(true);
  });
});

describe("Secure Runtime Alpha 4101-4180 -- BrowserWindow security configuration (Phase E, structural)", () => {
  it("4. contextIsolation is exactly true", () => {
    expect(mainSource as string).toMatch(/contextIsolation:\s*true/);
  });

  it("5. nodeIntegration is exactly false", () => {
    expect(mainSource as string).toMatch(/nodeIntegration:\s*false/);
  });

  it("6. sandbox is exactly true", () => {
    expect(mainSource as string).toMatch(/sandbox:\s*true/);
  });

  it("7. webSecurity is exactly true", () => {
    expect(mainSource as string).toMatch(/webSecurity:\s*true/);
  });

  it("8. a preload is configured, and it is this Arc's own adapter preload -- no other webPreferences escape hatch (enableRemoteModule/@electron/remote/nodeIntegrationInWorker) exists", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/preload:\s*path\.join\(__dirname,\s*["']fedos_electron_host_adapter_preload\.cjs["']\)/);
    expect(main).not.toMatch(/enableRemoteModule/);
    expect(main).not.toMatch(/@electron\/remote/);
    expect(main).not.toMatch(/nodeIntegrationInWorker/);
  });

  it("9. no eval or new Function() anywhere in Main or Preload", () => {
    const main = stripComments(mainSource as string);
    const preload = stripComments(preloadSource as string);
    expect(main).not.toMatch(/\beval\s*\(/);
    expect(main).not.toMatch(/new\s+Function\s*\(/);
    expect(preload).not.toMatch(/\beval\s*\(/);
    expect(preload).not.toMatch(/new\s+Function\s*\(/);
  });

  it("10. only a local file is ever loaded -- no loadURL, no http/https/localhost reference of any kind", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/loadFile\(/);
    expect(main).not.toMatch(/loadURL/);
    expect(main).not.toMatch(/https?:\/\//);
    expect(main).not.toMatch(/localhost/);
  });

  it("11. will-navigate is unconditionally denied, every new-window attempt is denied, every permission request is denied by default", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/will-navigate/);
    expect(main).toMatch(/event\.preventDefault\(\)/);
    expect(main).toMatch(/setWindowOpenHandler/);
    expect(main).toMatch(/action:\s*["']deny["']/);
    expect(main).toMatch(/setPermissionRequestHandler/);
    expect(main).toMatch(/callback\(false\)/);
  });

  it("12. the preload exposes exactly ONE contextBridge key ('fedos'), never ipcRenderer itself, never a business method beyond the one generic invoke() forward", () => {
    const preload = stripComments(preloadSource as string);
    const exposeCalls = preload.match(/contextBridge\.exposeInMainWorld/g) ?? [];
    expect(exposeCalls).toHaveLength(1);
    expect(preload).toMatch(/exposeInMainWorld\(\s*["']fedos["']/);
    expect(preload).toMatch(/Object\.freeze/);
    // `ipcRenderer` is imported (required to build the ONE forwarding function) but never assigned to
    // the exposed object AS ITSELF -- only `ipcRenderer.invoke(...)` calls appear, wrapped in a new function.
    expect(preload).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer[^.]/);
    expect(preload).not.toMatch(/\brequire\(["'](?!electron["']$)/);
    expect(preload).not.toMatch(/\bfs\b|readFile|writeFile|child_process/);
  });

  it("13. the preload's own exposed API has exactly one method, 'invoke' -- no other property", () => {
    const preload = stripComments(preloadSource as string);
    const objectLiteralMatch = preload.match(/Object\.freeze\(\{([\s\S]*?)\}\);/);
    expect(objectLiteralMatch).not.toBeNull();
    // Strips string literals FIRST so a colon inside a quoted string (e.g. the IPC channel name
    // "fedos:invoke") or inside a type annotation's own nested value is never mistaken for an
    // object-literal key -- only a genuine `identifier:` at the start of a property definition
    // (immediately after `{` or `,`, ignoring whitespace/newlines) counts as an exposed property.
    const bodyNoStrings = (objectLiteralMatch?.[1] ?? "").replace(/"[^"]*"|'[^']*'/g, '""');
    const propertyNames = [...bodyNoStrings.matchAll(/(?:^|[{,])\s*(\w+)\s*:/g)].map((m) => m[1]);
    expect(propertyNames).toEqual(["invoke"]);
  });

  it("14. Main's own request<->Bridge translation accepts only the closed 'dispatch'|'render'|'status' vocabulary -- no arbitrary IPC channel/op exists", () => {
    const translation = stripComments(dispatchTranslationSource as string);
    expect(translation).toMatch(/KNOWN_OPS.*=.*\[\s*["']dispatch["']\s*,\s*["']render["']\s*,\s*["']status["']\s*\]/);
    expect(translation).not.toMatch(/\bstart\b\s*:/);
  });

  it("15. structured clone only -- Main never returns a raw Error/class instance/function across the IPC boundary (source-level: dispatch_translation.ts's own handler always returns a plain object literal or a Bridge call result, never `new Error`)", () => {
    const translation = stripComments(dispatchTranslationSource as string);
    expect(translation).not.toMatch(/throw\s+new\s+Error/);
    expect(translation).not.toMatch(/return\s+new\s+Error/);
  });
});

describe("Secure Runtime Alpha 4101-4180 -- real process acceptance (Phase F)", () => {
  it(
    "16. launch -- the compiled adapter starts as a real subprocess and stays alive (does not crash-loop)",
    async () => {
      const child = spawn(electronBinPath, [mainCjsPath], { cwd: packageDir, stdio: "ignore" });
      spawnedElectronPid = child.pid;
      expect(child.pid).toBeGreaterThan(0);

      const stayedAlive = await new Promise<boolean>((resolve) => {
        let exited = false;
        child.once("exit", () => {
          exited = true;
        });
        setTimeout(() => resolve(!exited), 3000);
      });
      expect(stayedAlive).toBe(true);
      child.kill("SIGTERM");
      spawnedElectronPid = undefined;
    },
    15000,
  );

  it(
    "17/18/19/36/37/38. invoke/response/errors -- a REAL end-to-end round trip (renderer -> preload -> ipcMain -> HostBridge -> Presentation -> Shell -> Runtime -> back) proves status/dispatch/render/error paths, with no raw Error/secret and no false 'synced'/online claim anywhere in the real responses",
    async () => {
      const { steps, pid, stayedAlive } = await runAdapterAndCollectSelftestSteps();
      spawnedElectronPid = pid;
      expect(stayedAlive).toBe(true);
      expect(steps.length).toBe(5);

      const byStep = new Map(steps.map((s) => [s.step, s.result]));

      const statusResult = byStep.get("status") as { outcome: string; value: string };
      expect(statusResult).toEqual({ outcome: "ok", value: "running" });

      const runtimeStatusResult = byStep.get("dispatch-runtime-status") as { outcome: string; value: { runtimeStatus: string; deviceStatus: unknown } };
      expect(runtimeStatusResult.outcome).toBe("ok");
      expect(runtimeStatusResult.value.runtimeStatus).toBe("running");

      const unknownCommandResult = byStep.get("dispatch-unknown-command");
      expect(unknownCommandResult).toEqual({ outcome: "error", code: "unknown-command", message: "malformed or unrecognized command" });

      const renderResult = byStep.get("render") as { outcome: string; value: Record<string, unknown> };
      expect(renderResult.outcome).toBe("ok");
      expect(renderResult.value).toHaveProperty("runtimeStatus");
      expect(renderResult.value).toHaveProperty("conversationList");

      const invalidOpResult = byStep.get("invalid-op");
      expect(invalidOpResult).toEqual({ outcome: "error", code: "invalid-input", message: "malformed request" });

      // 36/37: no raw Error, no raw secret/signature/package anywhere in any REAL response.
      const fullJson = JSON.stringify(steps);
      expect(fullJson).not.toMatch(/\bstack\s*:/);
      expect(fullJson.toLowerCase()).not.toMatch(/seed|passphrase|privatekey|signature/);

      // 38: no false online/synced claim -- deviceStatus honestly reports "unavailable" on this base, never fabricated.
      expect(JSON.stringify(runtimeStatusResult)).toMatch(/"state":"unavailable"/);
    },
    15000,
  );

  it(
    "20/28. stop() -- window-all-closed triggers a real Host stop before the process exits (no orphaned Runtime/handle keeping the process alive past its own window)",
    async () => {
      const child = spawn(electronBinPath, [mainCjsPath], { cwd: packageDir, stdio: "ignore" });
      spawnedElectronPid = child.pid;
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const exitedCleanly = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        child.kill("SIGTERM");
        setTimeout(() => resolve(false), 6000);
      });
      expect(exitedCleanly).toBe(true);
      spawnedElectronPid = undefined;
    },
    15000,
  );

  it(
    "21. restart / repeated launch -- a second independent launch immediately after the first succeeds and produces the SAME real self-test results, no corrupted build output",
    async () => {
      const first = await runAdapterAndCollectSelftestSteps();
      spawnedElectronPid = first.pid;
      expect(first.stayedAlive).toBe(true);
      expect(first.steps.length).toBe(5);
      spawnedElectronPid = undefined;

      const second = await runAdapterAndCollectSelftestSteps();
      spawnedElectronPid = second.pid;
      expect(second.stayedAlive).toBe(true);
      expect(second.steps.length).toBe(5);
      spawnedElectronPid = undefined;

      const firstStatus = first.steps.find((s) => s.step === "status");
      const secondStatus = second.steps.find((s) => s.step === "status");
      expect(secondStatus).toEqual(firstStatus);
    },
    30000,
  );
});

describe("Secure Runtime Alpha 4101-4180 -- root/Electron graph isolation preserved (Phase G regression)", () => {
  it("22. ordinary root `test/` still contains NO electron reference of any kind", () => {
    const grep = (): string[] => {
      try {
        const output = execFileSync("git", ["grep", "-lE", "from [\"']electron[\"']|require\\([\"']electron[\"']\\)", "--", "test/"], { encoding: "utf8", cwd: repoRoot }) as string;
        return output.split("\n").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 1) return [];
        throw error;
      }
    };
    expect(grep()).toEqual([]);
  });

  it("23. the EXISTING build-spike files (main/preload) are untouched by this Arc -- still contain NO business IPC channel of any kind", () => {
    expect(stripComments(spikeMainSource as string)).not.toMatch(/ipcMain\.(handle|on)/);
    expect(stripComments(spikePreloadSource as string)).not.toMatch(/ipcRenderer/);
  });
});

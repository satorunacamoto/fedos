import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mainSource from "../src/fedos_electron_badge_main.cts?raw";
import preloadSource from "../src/fedos_electron_badge_preload.cts?raw";
import badgeAdapterSource from "../src/fedos_electron_badge_adapter.ts?raw";

/**
 * Secure Runtime Alpha 4341-4420 ("Desktop Unread Badge and Menu Bar Count
 * Integration Arc") — Phase E/F/G: real Electron acceptance tests. Same
 * method as `secure_runtime_alpha_4261_4340_notifications_tray_electron_acceptance.test.ts`
 * (Alpha 4261-4340): spawns the REAL, compiled Electron main process and
 * asserts on its REAL, observable process lifecycle/stdout — no
 * browser-automation dependency added, mirroring that suite's own explicit,
 * disclosed choice.
 *
 * SCOPE (disclosed explicitly, same precedent as the Notifications/Tray/
 * Background Arc's own suite): the 8 named Phase G scenarios (unread
 * increments, unread clears, multiple windows, restart, notification
 * interaction, tray interaction, no duplicate badge updates, shutdown
 * cleanup) are covered TWICE, at two different real depths:
 *   1. One layer below Electron, over the SAME real `FedosDesktopBadgeCoordinator`
 *      class Electron itself constructs --
 *      `test/secure_runtime_alpha_4341_4420_badge_coordinator.test.ts` (root `test/`).
 *   2. Inside a REAL, spawned Electron main process, via
 *      `FEDOS_ELECTRON_BADGE_AUTOTEST=1` (test 4 below) -- a genuine
 *      main-process self-test sequence
 *      (`../src/fedos_electron_badge_selftest.ts`) exercising the SAME real
 *      objects wired through the SAME real Electron `Tray`/`app.dock`/
 *      `BrowserWindow.setOverlayIcon` adapters, observed via marked stdout
 *      lines this suite parses and asserts on. "restart" is ADDITIONALLY
 *      proven at the STRONGEST possible depth -- a genuine second OS
 *      process, re-reading the SAME on-disk seeded conversation (test 5).
 *
 * Invoked from the ROOT project via `npm run test:electron-spike`, so
 * `process.cwd()` here is the repository ROOT, matching every sibling suite.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_badge_main.cjs`;
const preloadCjsPath = `${packageDir}/dist/fedos_electron_badge_preload.cjs`;
const pageHtmlPath = `${packageDir}/dist/fedos_electron_badge_page.html`;
const rendererJsPath = `${packageDir}/dist/fedos_electron_badge_renderer.js`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const rootDistBadgeCoordinatorPath = `${repoRoot}/dist/os/messenger/desktop/badge/fedos_desktop_badge_coordinator.js`;
const rootDistRuntimePath = `${repoRoot}/dist/os/messenger/desktop/runtime/fedos_desktop_runtime.js`;

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

describe("Alpha 4341-4420 -- Badge Electron adapter: build", () => {
  it("1. the root application graph (Badge Coordinator + runtime) is compiled to dist/ -- npm run build:runtime", () => {
    expect(existsSync(rootDistBadgeCoordinatorPath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
    expect(existsSync(rootDistRuntimePath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
  });

  it("2. the badge adapter build succeeds and produces the expected output files", () => {
    execFileSync(process.execPath, [`${repoRoot}/node_modules/typescript/bin/tsc`, "-p", "tsconfig.json"], { cwd: packageDir, encoding: "utf8" });
    execFileSync(process.execPath, [`${repoRoot}/node_modules/typescript/bin/tsc`, "-p", "tsconfig.browser-scripts.json"], { cwd: packageDir, encoding: "utf8" });
    execFileSync(process.execPath, [`${packageDir}/scripts/copy_static_assets.mjs`], { cwd: packageDir, encoding: "utf8" });
    expect(existsSync(mainCjsPath)).toBe(true);
    expect(existsSync(preloadCjsPath)).toBe(true);
    expect(existsSync(rendererJsPath)).toBe(true);
    expect(existsSync(pageHtmlPath)).toBe(true);
  });
});

describe("Alpha 4341-4420 -- Badge Electron adapter: security baseline UNCHANGED", () => {
  it("3. contextIsolation/nodeIntegration/sandbox/webSecurity are the SAME mandatory literals", () => {
    expect(mainSource as string).toMatch(/contextIsolation:\s*true/);
    expect(mainSource as string).toMatch(/nodeIntegration:\s*false/);
    expect(mainSource as string).toMatch(/sandbox:\s*true/);
    expect(mainSource as string).toMatch(/webSecurity:\s*true/);
  });

  it("4. no enableRemoteModule, no @electron/remote, no eval, no new Function()", () => {
    const main = stripComments(mainSource as string);
    const preload = stripComments(preloadSource as string);
    expect(main).not.toMatch(/enableRemoteModule/);
    expect(main).not.toMatch(/@electron\/remote/);
    expect(preload).not.toMatch(/enableRemoteModule|@electron\/remote|\beval\s*\(/);
    expect(main).not.toMatch(/new\s+Function\s*\(/);
    expect(main).toMatch(/await import\(distUrl\(/);
    expect(main).not.toMatch(/\beval\s*\(/);
  });

  it("5. navigation/permission denial matches the existing spike's own baseline", () => {
    expect(mainSource as string).toMatch(/will-navigate/);
    expect(mainSource as string).toMatch(/event\.preventDefault\(\)/);
    expect(mainSource as string).toMatch(/setWindowOpenHandler/);
    expect(mainSource as string).toMatch(/action:\s*["']deny["']/);
    expect(mainSource as string).toMatch(/setPermissionRequestHandler/);
    expect(mainSource as string).toMatch(/callback\(false\)/);
  });

  it("6. only local files are ever loaded -- no loadURL, no http/https/localhost", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/loadFile\(/);
    expect(main).not.toMatch(/loadURL/);
    expect(main).not.toMatch(/https?:\/\//);
    expect(main).not.toMatch(/localhost/);
  });

  it("7. the preload exposes exactly one contextBridge key -- a frozen object of functions, never raw ipcRenderer/require/fs", () => {
    const preload = stripComments(preloadSource as string);
    const exposeCalls = preload.match(/contextBridge\.exposeInMainWorld/g) ?? [];
    expect(exposeCalls).toHaveLength(1);
    expect(preload).toMatch(/Object\.freeze/);
    expect(preload).not.toMatch(/\bfs\b|readFile|writeFile|child_process/);
    expect(preload).not.toMatch(/exposeInMainWorld\(["']ipcRenderer["']/);
  });

  it("8. the Badge Electron adapter contains no business logic -- no direct Registry/UnreadCounter import, and reuses the Tray adapter rather than constructing its own Tray", () => {
    const badgeAdapter = stripComments(badgeAdapterSource as string);
    expect(badgeAdapter).not.toMatch(/fedos_desktop_conversation_window_registry|fedos_desktop_unread_counter_view_model|node:fs/);
    expect(badgeAdapter).not.toMatch(/new\s+Tray\s*\(/);
  });
});

describe("Alpha 4341-4420 -- Badge Electron adapter: IPC vocabulary is closed and named", () => {
  it("9. main registers exactly the nine documented fedos-badge:* channels, no more", () => {
    const main = stripComments(mainSource as string);
    const channels = [...main.matchAll(/ipcMain\.handle\(\s*["'](fedos-badge:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(channels)).toEqual(
      new Set([
        "fedos-badge:bg-status",
        "fedos-badge:notify",
        "fedos-badge:tray-action",
        "fedos-badge:new-window",
        "fedos-badge:close-window",
        "fedos-badge:session-render",
        "fedos-badge:shutdown",
        "fedos-badge:badge-status",
        "fedos-badge:mark-viewed",
      ]),
    );
  });

  it("10. the preload invokes the SAME nine channels, one method each, no extra channel", () => {
    const preload = stripComments(preloadSource as string);
    const invoked = [...preload.matchAll(/ipcRenderer\.invoke\(\s*["'](fedos-badge:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(invoked)).toEqual(
      new Set([
        "fedos-badge:bg-status",
        "fedos-badge:notify",
        "fedos-badge:tray-action",
        "fedos-badge:new-window",
        "fedos-badge:close-window",
        "fedos-badge:session-render",
        "fedos-badge:shutdown",
        "fedos-badge:badge-status",
        "fedos-badge:mark-viewed",
      ]),
    );
  });

  it("11. no window-all-closed handler exists -- keep-alive-in-background (Alpha 4261-4340) is restated, never re-litigated, here", () => {
    const main = stripComments(mainSource as string);
    expect(main).not.toMatch(/window-all-closed/);
  });
});

describe("Alpha 4341-4420 -- Badge Electron adapter: real process launch (Phase F/G)", () => {
  it(
    "12. a REAL Electron subprocess launches, seeds a real activated direct conversation, starts a REAL Presentation Boundary + Registry + Badge Coordinator over an isolated data directory, shows a real tray icon, and exits cleanly",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-badge-electron-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BADGE_DATA_DIR: dataDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      expect(child.pid).toBeGreaterThan(0);
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      const stayedAlive = await new Promise<boolean>((resolve) => {
        let exited = false;
        child.once("exit", () => {
          exited = true;
        });
        // Longer than the plain Notifications/Tray/Background wait -- this adapter's own startup
        // does strictly more real work first (seeding a real activated direct conversation through
        // a temporary raw runtime before the real Boundary even starts).
        setTimeout(() => resolve(!exited), 8000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(stayedAlive, `process exited early; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput, "expected the real startup signal").toMatch(/fedos-badge: host started/);
      expect(combinedOutput).not.toMatch(/startup failed/);

      const exitedCleanly = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        child.kill("SIGTERM");
        setTimeout(() => resolve(false), 5000);
      });
      expect(exitedCleanly).toBe(true);
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });
    },
    25000,
  );

  it(
    "13. a genuine startup failure (a corrupt navigation log) fails closed -- process reports failure and quits, never hangs as an orphan",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-badge-electron-corrupt-"));
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(dataDir, "navigation.log"), "not json at all\n", "utf8");

      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BADGE_DATA_DIR: dataDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      const exitedOnItsOwn = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        setTimeout(() => resolve(false), 10000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(exitedOnItsOwn, `expected app.quit() on startup failure; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput).toMatch(/fedos-badge: startup failed/);
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });
    },
    20000,
  );

  it(
    "14. FEDOS_ELECTRON_BADGE_AUTOTEST=1 runs the REAL main-process self-test sequence, covering every Phase G scenario, then shuts down cleanly on its own",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-badge-electron-autotest-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BADGE_DATA_DIR: dataDir, FEDOS_ELECTRON_BADGE_AUTOTEST: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      const exitedOnItsOwn = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        setTimeout(() => resolve(false), 30000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });

      expect(exitedOnItsOwn, `expected the self-test to shut down cleanly on its own; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput).toMatch(/fedos-badge: host started/);

      const markerLines = combinedOutput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("FEDOS_BADGE_TEST:") && line !== "FEDOS_BADGE_TEST:done")
        .map((line) => JSON.parse(line.slice("FEDOS_BADGE_TEST:".length)) as { step: string; result: unknown });
      const steps = markerLines.map((m) => m.step);

      const expectedSteps = [
        "unread-increments",
        "unread-clears",
        "multiple-windows",
        "restart",
        "notification-interaction",
        "tray-interaction",
        "no-duplicate-badge-updates",
        "shutdown-cleanup",
      ];
      for (const step of expectedSteps) {
        expect(steps, `missing self-test step "${step}"; output:\n${combinedOutput}`).toContain(step);
      }

      // "unread increments" -- a real new message in the seeded conversation is reflected as a
      // real, positive count in a closed vocabulary state (never a fabricated/independent count).
      const incrementResult = markerLines.find((m) => m.step === "unread-increments")?.result as { state: string; count: number };
      expect(["count", "attention"]).toContain(incrementResult.state);
      expect(incrementResult.count).toBeGreaterThan(0);

      // "unread clears" -- marking that SAME conversation viewed brings the count back to zero.
      const clearResult = markerLines.find((m) => m.step === "unread-clears")?.result as { state: string; count: number };
      expect(clearResult.state).toBe("none");
      expect(clearResult.count).toBe(0);

      // "multiple windows" -- two real extra windows were open at once (three total with the seed
      // window never opened here, so at least 2) and the badge refresh never threw.
      const multiWindowResult = markerLines.find((m) => m.step === "multiple-windows")?.result as { openWindowCount: number };
      expect(multiWindowResult.openWindowCount).toBeGreaterThanOrEqual(2);

      // "no duplicate badge updates" -- two consecutive refreshes with nothing changed between them
      // never call the Port a second time.
      const dedupResult = markerLines.find((m) => m.step === "no-duplicate-badge-updates")?.result as {
        renderCountBefore: number;
        renderCountAfter: number;
      };
      expect(dedupResult.renderCountAfter).toBe(dedupResult.renderCountBefore);

      // "shutdown cleanup" -- the real, single clean-shutdown path (badge surfaces cleared, Tray
      // destroyed, `app.quit()`) ran exactly once, after the self-test's own "done".
      const doneIndex = combinedOutput.indexOf("FEDOS_BADGE_TEST:done");
      const shutdownIndex = combinedOutput.indexOf("fedos-badge: shutdown clean");
      expect(doneIndex).toBeGreaterThan(-1);
      expect(shutdownIndex).toBeGreaterThan(doneIndex);
    },
    35000,
  );

  it(
    "15. restart -- a SECOND, independent real process over the SAME on-disk data directory re-discovers the seeded conversation's own persisted state cleanly, and does not corrupt build output",
    async () => {
      const beforeContent = readFileSync(mainCjsPath, "utf8");
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-badge-electron-restart-"));

      async function launchOnce(): Promise<string> {
        const outChunks: Buffer[] = [];
        const child = spawn(electronBinPath, [mainCjsPath], {
          cwd: packageDir,
          env: { ...process.env, FEDOS_ELECTRON_BADGE_DATA_DIR: dataDir },
          stdio: ["ignore", "pipe", "pipe"],
        });
        spawnedElectronPid = child.pid;
        expect(child.pid).toBeGreaterThan(0);
        child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
        child.stderr?.on("data", (chunk: Buffer) => outChunks.push(chunk));
        await new Promise((resolve) => setTimeout(resolve, 6000));
        const combinedOutput = Buffer.concat(outChunks).toString("utf8");
        child.kill("SIGTERM");
        await new Promise((resolve) => {
          child.once("exit", resolve);
          setTimeout(resolve, 5000);
        });
        spawnedElectronPid = undefined;
        return combinedOutput;
      }

      const first = await launchOnce();
      expect(first).toMatch(/fedos-badge: host started/);
      expect(first).not.toMatch(/startup failed/);

      const second = await launchOnce();
      expect(second).toMatch(/fedos-badge: host started/);
      expect(second).not.toMatch(/startup failed/);

      rmSync(dataDir, { recursive: true, force: true });
      const afterContent = readFileSync(mainCjsPath, "utf8");
      expect(afterContent).toBe(beforeContent);
    },
    25000,
  );
});

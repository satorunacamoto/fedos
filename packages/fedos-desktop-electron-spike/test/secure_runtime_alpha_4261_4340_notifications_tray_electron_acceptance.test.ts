import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mainSource from "../src/fedos_electron_notifications_tray_main.cts?raw";
import preloadSource from "../src/fedos_electron_notifications_tray_preload.cts?raw";
import notificationAdapterSource from "../src/fedos_electron_notification_adapter.ts?raw";
import trayAdapterSource from "../src/fedos_electron_tray_adapter.ts?raw";

/**
 * Secure Runtime Alpha 4261-4340 ("Desktop Notifications, System Tray, and
 * Background Operation Arc") — Phase E/F/G: real Electron acceptance tests.
 * Same method as `secure_runtime_alpha_4181_4260_navigation_electron_acceptance.test.ts`
 * (Alpha 4181-4260): spawns the REAL, compiled Electron main process and
 * asserts on its REAL, observable process lifecycle/stdout — no
 * browser-automation dependency added, mirroring that suite's own explicit,
 * disclosed choice.
 *
 * SCOPE (disclosed explicitly, same precedent as the Navigation Arc's own
 * suite): the 14 named Phase G scenarios (notification / message
 * notification / archive notification / sync notification / tray open /
 * tray pause / tray resume / tray exit / window close keeps runtime alive /
 * background sync / restart / multiple notifications / shutdown /
 * unexpected command / resource cleanup) are exhaustively covered TWICE,
 * at two different real depths:
 *   1. One layer below Electron, over the SAME real
 *      `FedosDesktopNotificationCoordinator`/`TrayCoordinator`/
 *      `BackgroundLifecycleCoordinator` classes Electron itself constructs
 *      -- `test/secure_runtime_alpha_4261_4340_notification_coordinator.test.ts`,
 *      `..._tray_coordinator.test.ts`,
 *      `..._background_lifecycle_coordinator.test.ts` (root `test/`).
 *   2. Inside a REAL, spawned Electron main process, via
 *      `FEDOS_ELECTRON_BG_AUTOTEST=1` (test 4 below) -- a genuine main-
 *      process self-test sequence
 *      (`../src/fedos_electron_notifications_tray_selftest.ts`) exercising
 *      the SAME real objects wired through the SAME real Electron
 *      `Notification`/`Tray` adapters, observed via marked stdout lines
 *      this suite parses and asserts on.
 *
 * Invoked from the ROOT project via `npm run test:electron-spike`, so
 * `process.cwd()` here is the repository ROOT, matching every sibling suite.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_notifications_tray_main.cjs`;
const preloadCjsPath = `${packageDir}/dist/fedos_electron_notifications_tray_preload.cjs`;
const pageHtmlPath = `${packageDir}/dist/fedos_electron_notifications_tray_page.html`;
const rendererJsPath = `${packageDir}/dist/fedos_electron_notifications_tray_renderer.js`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const rootDistNotificationCoordinatorPath = `${repoRoot}/dist/os/messenger/notifications/fedos_desktop_notification_coordinator.js`;
const rootDistTrayCoordinatorPath = `${repoRoot}/dist/desktop/tray/fedos_desktop_tray_coordinator.js`;
const rootDistBackgroundLifecyclePath = `${repoRoot}/dist/desktop/background/fedos_desktop_background_lifecycle_coordinator.js`;

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

describe("Alpha 4261-4340 -- Notifications/Tray/Background Electron adapter: build", () => {
  it("1. the root application graph (Notification/Tray/Background coordinators) is compiled to dist/ -- npm run build:runtime", () => {
    expect(existsSync(rootDistNotificationCoordinatorPath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
    expect(existsSync(rootDistTrayCoordinatorPath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
    expect(existsSync(rootDistBackgroundLifecyclePath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
  });

  it("2. the notifications/tray adapter build succeeds and produces the expected output files", () => {
    execFileSync(process.execPath, [`${repoRoot}/node_modules/typescript/bin/tsc`, "-p", "tsconfig.json"], { cwd: packageDir, encoding: "utf8" });
    execFileSync(process.execPath, [`${repoRoot}/node_modules/typescript/bin/tsc`, "-p", "tsconfig.browser-scripts.json"], { cwd: packageDir, encoding: "utf8" });
    execFileSync(process.execPath, [`${packageDir}/scripts/copy_static_assets.mjs`], { cwd: packageDir, encoding: "utf8" });
    expect(existsSync(mainCjsPath)).toBe(true);
    expect(existsSync(preloadCjsPath)).toBe(true);
    expect(existsSync(rendererJsPath)).toBe(true);
    expect(existsSync(pageHtmlPath)).toBe(true);
  });
});

describe("Alpha 4261-4340 -- Notifications/Tray/Background Electron adapter: security baseline UNCHANGED", () => {
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

  it("8. Electron adapters contain no business logic -- no direct Registry/DeviceSyncStatus/persistence import in the notification/tray adapter files", () => {
    const notificationAdapter = stripComments(notificationAdapterSource as string);
    const trayAdapter = stripComments(trayAdapterSource as string);
    expect(notificationAdapter).not.toMatch(/fedos_desktop_conversation_window_registry|fedos_desktop_device_sync_status_view_model|node:fs/);
    expect(trayAdapter).not.toMatch(/fedos_desktop_conversation_window_registry|fedos_desktop_device_sync_status_view_model|node:fs/);
  });
});

describe("Alpha 4261-4340 -- Notifications/Tray/Background Electron adapter: IPC vocabulary is closed and named", () => {
  it("9. main registers exactly the seven documented fedos-bg:* channels, no more", () => {
    const main = stripComments(mainSource as string);
    const channels = [...main.matchAll(/ipcMain\.handle\(\s*["'](fedos-bg:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(channels)).toEqual(
      new Set([
        "fedos-bg:status",
        "fedos-bg:notify",
        "fedos-bg:tray-action",
        "fedos-bg:new-window",
        "fedos-bg:close-window",
        "fedos-bg:session-render",
        "fedos-bg:shutdown",
      ]),
    );
  });

  it("10. the preload invokes the SAME seven channels, one method each, no extra channel", () => {
    const preload = stripComments(preloadSource as string);
    const invoked = [...preload.matchAll(/ipcRenderer\.invoke\(\s*["'](fedos-bg:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(invoked)).toEqual(
      new Set([
        "fedos-bg:status",
        "fedos-bg:notify",
        "fedos-bg:tray-action",
        "fedos-bg:new-window",
        "fedos-bg:close-window",
        "fedos-bg:session-render",
        "fedos-bg:shutdown",
      ]),
    );
  });

  it("11. no window-all-closed handler exists -- Phase D 'keep runtime alive' is structural, not incidental", () => {
    const main = stripComments(mainSource as string);
    expect(main).not.toMatch(/window-all-closed/);
  });
});

describe("Alpha 4261-4340 -- Notifications/Tray/Background Electron adapter: real process launch (Phase F/G)", () => {
  it(
    "12. a REAL Electron subprocess launches, starts a REAL Presentation Boundary + Notification/Tray/Background coordinators over an isolated data directory, shows a real tray icon, and exits cleanly",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-bg-electron-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BG_DATA_DIR: dataDir },
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
        // Longer than the Navigation Arc's own equivalent wait (4000ms) -- see this file's own
        // header, "SCOPE" -- this adapter's own startup does strictly more real work.
        setTimeout(() => resolve(!exited), 6000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(stayedAlive, `process exited early; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput, "expected the real startup signal").toMatch(/fedos-bg: host started/);
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
    20000,
  );

  it(
    "13. a genuine startup failure (a corrupt navigation log) fails closed -- process reports failure and quits, never hangs as an orphan",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-bg-electron-corrupt-"));
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(dataDir, "navigation.log"), "not json at all\n", "utf8");

      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BG_DATA_DIR: dataDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      const exitedOnItsOwn = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        setTimeout(() => resolve(false), 8000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(exitedOnItsOwn, `expected app.quit() on startup failure; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput).toMatch(/fedos-bg: startup failed/);
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });
    },
    20000,
  );

  it(
    "14. FEDOS_ELECTRON_BG_AUTOTEST=1 runs the REAL main-process self-test sequence, covering every Phase G scenario, then shuts down cleanly on its own",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-bg-electron-autotest-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BG_DATA_DIR: dataDir, FEDOS_ELECTRON_BG_AUTOTEST: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      const exitedOnItsOwn = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        setTimeout(() => resolve(false), 25000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });

      expect(exitedOnItsOwn, `expected the self-test to shut down cleanly on its own; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput).toMatch(/fedos-bg: host started/);

      const markerLines = combinedOutput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("FEDOS_BG_TEST:") && line !== "FEDOS_BG_TEST:done")
        .map((line) => JSON.parse(line.slice("FEDOS_BG_TEST:".length)) as { step: string; result: unknown });
      const steps = markerLines.map((m) => m.step);

      const expectedSteps = [
        "notification",
        "message-notification",
        "archive-notification-complete",
        "archive-notification-failed",
        "sync-notification-complete",
        "sync-notification-failed",
        "tray-open",
        "tray-pause",
        "tray-resume",
        "tray-exit",
        "window-close-keeps-runtime-alive",
        "background-sync",
        "restart",
        "multiple-notifications",
        "unexpected-notification-kind",
        "unexpected-tray-action",
        "resource-cleanup",
      ];
      for (const step of expectedSteps) {
        expect(steps, `missing self-test step "${step}"; output:\n${combinedOutput}`).toContain(step);
      }

      // "window close keeps runtime alive" -- the process is still governed by "background", never
      // "shutting-down"/"stopped", immediately after that real window closed.
      const windowCloseResult = markerLines.find((m) => m.step === "window-close-keeps-runtime-alive")?.result as { backgroundState: string };
      expect(windowCloseResult.backgroundState).toBe("background");

      // "restart" -- opening a new window after backgrounding returns to "foreground".
      const restartResult = markerLines.find((m) => m.step === "restart")?.result as { backgroundState: string };
      expect(restartResult.backgroundState).toBe("foreground");

      // "background sync" -- both capability flags true while backgrounded.
      const backgroundSyncResult = markerLines.find((m) => m.step === "background-sync")?.result as {
        canRunBackgroundSync: boolean;
        canDeliverBackgroundNotifications: boolean;
      };
      expect(backgroundSyncResult.canRunBackgroundSync).toBe(true);
      expect(backgroundSyncResult.canDeliverBackgroundNotifications).toBe(true);

      // "unexpected command" -- both fail closed with a "rejected" outcome, never a thrown error.
      const unexpectedNotification = markerLines.find((m) => m.step === "unexpected-notification-kind")?.result as { state: string };
      expect(unexpectedNotification.state).toBe("rejected");
      const unexpectedTray = markerLines.find((m) => m.step === "unexpected-tray-action")?.result as { action: string; outcome: string };
      expect(unexpectedTray.outcome).toBe("rejected");

      // "shutdown" -- the real, single clean-shutdown path ran exactly once, after the self-test's own "done".
      const doneIndex = combinedOutput.indexOf("FEDOS_BG_TEST:done");
      const shutdownIndex = combinedOutput.indexOf("fedos-bg: shutdown clean");
      expect(doneIndex).toBeGreaterThan(-1);
      expect(shutdownIndex).toBeGreaterThan(doneIndex);
    },
    30000,
  );

  it(
    "15. repeated real launch (a second independent process immediately after the first, a fresh data directory) starts cleanly and does not corrupt build output",
    async () => {
      const beforeContent = readFileSync(mainCjsPath, "utf8");
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-bg-electron-repeat-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_BG_DATA_DIR: dataDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      const started = child.pid !== undefined && child.pid > 0;
      expect(started).toBe(true);
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      // Longer than the Navigation Arc's own equivalent wait (3000ms) -- this adapter's own
      // startup does strictly more real work (Notification/Tray/Background coordinators, a real
      // native Tray icon) than Navigation's Boundary+Registry-only startup.
      await new Promise((resolve) => setTimeout(resolve, 6000));
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(combinedOutput).toMatch(/fedos-bg: host started/);

      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(resolve, 5000);
      });
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });

      const afterContent = readFileSync(mainCjsPath, "utf8");
      expect(afterContent).toBe(beforeContent);
    },
    20000,
  );
});

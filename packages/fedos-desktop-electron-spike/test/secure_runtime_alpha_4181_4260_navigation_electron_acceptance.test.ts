import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mainSource from "../src/fedos_electron_navigation_main.cts?raw";
import preloadSource from "../src/fedos_electron_navigation_preload.cts?raw";

/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase E/F: real Electron acceptance tests for the
 * Navigation adapter (Package B — see `fedos_electron_navigation_main.cts`'s
 * own header). Same method as
 * `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts` (Alpha
 * 3881-3940/4021-4100): spawns the REAL, compiled Electron main process
 * and asserts on its REAL, observable process lifecycle — never simulated
 * pixels/DOM, and this Arc adds no browser-automation dependency, exactly
 * mirroring that suite's own explicit, disclosed choice.
 *
 * SCOPE (disclosed explicitly, per this Arc's own "stop honestly at a
 * real boundary" instruction): with no browser-automation dependency,
 * this file can verify a REAL Electron process actually launches, starts
 * a REAL `FedosDesktopConversationUiPresentationBoundary`/
 * `FedosDesktopConversationWindowRegistry` (not a stub — a genuine
 * append-only-log-backed Runtime, in an isolated temp data directory per
 * test), and exits cleanly — the actual WIRING this Arc's own Phase E
 * adds. It CANNOT click a button inside the real renderer window from
 * here. The deep interactive scenarios Phase F names (open/switch/close/
 * back/forward/restore/invalid/unavailable, and the multi-window safety
 * property itself) are exhaustively covered instead, over the SAME real
 * Runtime/Shell/Presentation Boundary stack Electron itself calls into,
 * one layer below Electron:
 * `test/secure_runtime_alpha_4181_4260_window_controller.test.ts` and
 * `test/secure_runtime_alpha_4181_4260_window_registry.test.ts` (root
 * `test/`) — every one of those tests already passes for real.
 *
 * Invoked from the ROOT project via `npm run test:electron-spike`, so
 * `process.cwd()` here is the repository ROOT, matching the sibling
 * 3881-3940 suite's own convention exactly.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_navigation_main.cjs`;
const preloadCjsPath = `${packageDir}/dist/fedos_electron_navigation_preload.cjs`;
const pageHtmlPath = `${packageDir}/dist/fedos_electron_navigation_page.html`;
const rendererJsPath = `${packageDir}/dist/fedos_electron_navigation_renderer.js`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const rootDistPresentationPath = `${repoRoot}/dist/os/messenger/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.js`;
const rootDistRegistryPath = `${repoRoot}/dist/os/messenger/desktop/navigation/fedos_desktop_conversation_window_registry.js`;

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

describe("Alpha 4181-4260 -- Navigation Electron adapter: build", () => {
  it("1. the root application graph (Presentation Boundary + Navigation Registry) is compiled to dist/ -- npm run build:runtime", () => {
    expect(existsSync(rootDistPresentationPath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
    expect(existsSync(rootDistRegistryPath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
  });

  it("2. the navigation adapter build succeeds and produces exactly the expected four output files", () => {
    execFileSync(process.execPath, [`${repoRoot}/node_modules/typescript/bin/tsc`, "-p", "tsconfig.json"], { cwd: packageDir, encoding: "utf8" });
    execFileSync(process.execPath, [`${packageDir}/scripts/copy_static_assets.mjs`], { cwd: packageDir, encoding: "utf8" });
    expect(existsSync(mainCjsPath)).toBe(true);
    expect(existsSync(preloadCjsPath)).toBe(true);
    expect(existsSync(rendererJsPath)).toBe(true);
    expect(existsSync(pageHtmlPath)).toBe(true);
  });
});

describe("Alpha 4181-4260 -- Navigation Electron adapter: security baseline UNCHANGED from Alpha 3881-3940", () => {
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
    // Package-wide Node16 module resolution (Alpha 4101-4180's own fix, applied to
    // this package's tsconfig.json) preserves a literal `import()` as a real dynamic
    // import instead of downleveling it to a non-functional `require()` -- the
    // `new Function`-based workaround this file originally needed under the OLD
    // CommonJS/Node10 setting is no longer necessary and has been removed.
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
});

describe("Alpha 4181-4260 -- Navigation Electron adapter: IPC vocabulary is closed and named", () => {
  it("8. main registers exactly the ten documented fedos-nav:* channels, no more", () => {
    const main = stripComments(mainSource as string);
    const channels = [...main.matchAll(/ipcMain\.handle\(\s*["'](fedos-nav:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(channels)).toEqual(
      new Set([
        "fedos-nav:list-conversations",
        "fedos-nav:open",
        "fedos-nav:switch",
        "fedos-nav:close",
        "fedos-nav:back",
        "fedos-nav:forward",
        "fedos-nav:pin",
        "fedos-nav:unpin",
        "fedos-nav:session-state",
        "fedos-nav:new-window",
      ]),
    );
  });

  it("9. the preload invokes the SAME ten channels, one method each, no extra channel", () => {
    const preload = stripComments(preloadSource as string);
    const invoked = [...preload.matchAll(/ipcRenderer\.invoke\(\s*["'](fedos-nav:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(invoked)).toEqual(
      new Set([
        "fedos-nav:list-conversations",
        "fedos-nav:open",
        "fedos-nav:switch",
        "fedos-nav:close",
        "fedos-nav:back",
        "fedos-nav:forward",
        "fedos-nav:pin",
        "fedos-nav:unpin",
        "fedos-nav:session-state",
        "fedos-nav:new-window",
      ]),
    );
  });

  it("10. every mutating handler validates its conversationId input before use -- never passes raw untyped IPC input to the Registry/Controller", () => {
    const main = stripComments(mainSource as string);
    const guardedCount = (main.match(/if \(!isSafeId\(conversationId\)\)/g) ?? []).length;
    // open / switch / pin / unpin -- the four channels that accept a conversationId argument.
    expect(guardedCount).toBe(4);
  });
});

describe("Alpha 4181-4260 -- Navigation Electron adapter: real process launch (Phase F)", () => {
  it(
    "11. a REAL Electron subprocess launches, starts a REAL Presentation Boundary + Navigation Registry over an isolated data directory, and exits cleanly",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-nav-electron-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_NAV_DATA_DIR: dataDir },
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
        setTimeout(() => resolve(!exited), 4000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(stayedAlive, `process exited early; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput, "expected the real startup signal from a successfully started Presentation Boundary/Registry").toMatch(
        /fedos-nav: host started/,
      );
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
    "12. repeated real launch (a second independent process immediately after the first, a fresh data directory) starts cleanly and does not corrupt build output",
    async () => {
      const beforeContent = readFileSync(mainCjsPath, "utf8");
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-nav-electron-repeat-"));
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_NAV_DATA_DIR: dataDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      spawnedElectronPid = child.pid;
      const started = child.pid !== undefined && child.pid > 0;
      expect(started).toBe(true);
      child.stdout?.on("data", (chunk: Buffer) => outChunks.push(chunk));

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(combinedOutput).toMatch(/fedos-nav: host started/);

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

  it(
    "13. a genuine startup failure (an already-occupied/corrupt data directory forced by a pre-existing malformed log line) fails closed -- process reports failure and quits, never hangs as an orphan",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-nav-electron-corrupt-"));
      // A malformed navigation log line makes the Registry's own snapshot() throw on
      // construction -- see append_only_fedos_desktop_navigation_persistence.ts's own
      // "fail closed, never repair automatically" contract.
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(dataDir, "navigation.log"), "not json at all\n", "utf8");

      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: { ...process.env, FEDOS_ELECTRON_NAV_DATA_DIR: dataDir },
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
      expect(combinedOutput).toMatch(/fedos-nav: startup failed/);
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });
    },
    20000,
  );
});

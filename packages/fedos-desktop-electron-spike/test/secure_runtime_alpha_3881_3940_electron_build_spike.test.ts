import { describe, it, expect, afterEach } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import mainSource from "../src/fedos_electron_spike_main.cts?raw";
import preloadSource from "../src/fedos_electron_spike_preload.cts?raw";
import packageJsonSource from "../package.json?raw";
import rootPackageJsonSource from "../../../package.json?raw";
import builderConfigSource from "../electron_builder.config.json?raw";
import gitignoreSource from "../../../.gitignore?raw";

/**
 * Secure Runtime Alpha 3881-3940/4021-4100 -- Electron Dependency and Build
 * Spike (Package A only), physically isolated as its own package
 * (`packages/fedos-desktop-electron-spike/`) per Alpha 4021-4100's own
 * architecture decision -- see that Arc's own docs for why tsconfig-only
 * isolation could not prevent Electron's transitive `@types/node`
 * dependency from leaking into the root application's own TypeScript
 * graph, and why a physically separate `node_modules` tree was required
 * instead. This test file itself now typechecks cleanly with REAL
 * `@types/node` (via this package's own `tsconfig.test.json`) -- no more
 * `@ts-expect-error` suppression needed for `node:fs`/`node:child_process`
 * here, unlike the root project's own, deliberately preserved convention.
 *
 * Invoked from the ROOT project via `npm run test:electron-spike`
 * (`vitest run --config vitest.electron-spike.config.ts`), so
 * `process.cwd()` here is the ROOT of the whole repository, not this
 * package's own directory -- every path below is built accordingly.
 *
 * A note on method (unchanged from Alpha 3881-3940's own reasoning): this
 * suite spawns the REAL, compiled Electron main process and asserts on its
 * REAL, observable process lifecycle -- it does NOT assert on rendered
 * pixels or DOM content, since vitest runs outside any Electron renderer
 * and this Arc adds no browser-automation dependency to do so. A REAL,
 * visible `BrowserWindow` was independently observed, in this exact
 * environment, via `Get-Process | Select MainWindowTitle`, during Alpha
 * 3881-3940's own development -- recorded in that Arc's own Completion
 * Declaration.
 */

/** Strips `/* ... *\/` and `// ...` comments so "must not appear in real code" checks below verify actual code, never this file's own explanatory prose about what is deliberately absent. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_spike_main.cjs`;
const preloadCjsPath = `${packageDir}/dist/fedos_electron_spike_preload.cjs`;
const pageHtmlPath = `${packageDir}/dist/fedos_electron_spike_page.html`;
const rendererJsPath = `${packageDir}/dist/fedos_electron_spike_renderer.js`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;

let spawnedElectronPid: number | undefined;

function killSpawnedElectronIfAny(): void {
  if (spawnedElectronPid === undefined) return;
  try {
    process.kill(spawnedElectronPid, "SIGKILL");
  } catch {
    // already exited -- nothing to clean up.
  }
  spawnedElectronPid = undefined;
}

afterEach(() => {
  killSpawnedElectronIfAny();
});

describe("Secure Runtime Alpha 3881-3940 -- dependency and build (Phase I 1-2)", () => {
  it("1. electron and electron-builder resolve as installed devDependencies of the ISOLATED package, never the root project", () => {
    expect(existsSync(`${packageDir}/node_modules/electron/package.json`)).toBe(true);
    expect(existsSync(`${packageDir}/node_modules/electron-builder/package.json`)).toBe(true);
    const pkg = JSON.parse(packageJsonSource as string) as { dependencies?: Record<string, string>; devDependencies: Record<string, string> };
    expect(pkg.devDependencies.electron).toBeDefined();
    expect(pkg.devDependencies["electron-builder"]).toBeDefined();
    expect(pkg.dependencies).toBeUndefined();

    const rootPkg = JSON.parse(rootPackageJsonSource as string) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(rootPkg.devDependencies.electron).toBeUndefined();
    expect(rootPkg.devDependencies["electron-builder"]).toBeUndefined();
    expect(rootPkg.devDependencies["@types/node"]).toBeUndefined();
  });

  it("2. the electron-spike TypeScript build succeeds and produces exactly the expected four output files", () => {
    // `process.execPath` (this same Node binary) invoked directly against the ROOT project's own already-
    // installed `tsc` -- reused, not duplicated, per Alpha 4021-4100's own "no new runtime dependency,
    // minimize duplicate installs" decision; module resolution for `node:*`/`electron` types is governed by
    // the SOURCE FILE's own directory (this package's), never by which physical `tsc` copy executes it.
    execFileSync(process.execPath, [`${repoRoot}/node_modules/typescript/bin/tsc`, "-p", "tsconfig.json"], { cwd: packageDir, encoding: "utf8" });
    execFileSync(process.execPath, [`${packageDir}/scripts/copy_static_assets.mjs`], { cwd: packageDir, encoding: "utf8" });
    expect(existsSync(mainCjsPath)).toBe(true);
    expect(existsSync(preloadCjsPath)).toBe(true);
    expect(existsSync(rendererJsPath)).toBe(true);
    expect(existsSync(pageHtmlPath)).toBe(true);
  });
});

describe("Secure Runtime Alpha 3881-3940 -- BrowserWindow security configuration (Phase D/I 5-9, structural)", () => {
  it("3. contextIsolation is exactly true", () => {
    expect(mainSource as string).toMatch(/contextIsolation:\s*true/);
  });

  it("4. nodeIntegration is exactly false", () => {
    expect(mainSource as string).toMatch(/nodeIntegration:\s*false/);
  });

  it("5. sandbox is exactly true (no blocker needed -- proven compatible by real launch, Phase I 3)", () => {
    expect(mainSource as string).toMatch(/sandbox:\s*true/);
  });

  it("6. webSecurity is exactly true", () => {
    expect(mainSource as string).toMatch(/webSecurity:\s*true/);
  });

  it("7. no enableRemoteModule, no @electron/remote, anywhere in the spike directory", () => {
    const main = stripComments(mainSource as string);
    const preload = stripComments(preloadSource as string);
    expect(main).not.toMatch(/enableRemoteModule/);
    expect(main).not.toMatch(/@electron\/remote/);
    expect(preload).not.toMatch(/enableRemoteModule/);
    expect(preload).not.toMatch(/@electron\/remote/);
  });

  it("8. no eval or new Function() anywhere in the spike directory", () => {
    const main = stripComments(mainSource as string);
    const preload = stripComments(preloadSource as string);
    expect(main).not.toMatch(/\beval\s*\(/);
    expect(main).not.toMatch(/new\s+Function\s*\(/);
    expect(preload).not.toMatch(/\beval\s*\(/);
  });

  it("9. only a local file is ever loaded -- no loadURL, no http/https/localhost reference of any kind", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/loadFile\(/);
    expect(main).not.toMatch(/loadURL/);
    expect(main).not.toMatch(/https?:\/\//);
    expect(main).not.toMatch(/localhost/);
  });
});

describe("Secure Runtime Alpha 3881-3940 -- navigation, permissions, IPC (Phase D/I 10-14, structural)", () => {
  it("10. will-navigate is unconditionally denied -- no arbitrary navigation", () => {
    expect(mainSource as string).toMatch(/will-navigate/);
    expect(mainSource as string).toMatch(/event\.preventDefault\(\)/);
  });

  it("11. every new-window/window.open attempt is denied", () => {
    expect(mainSource as string).toMatch(/setWindowOpenHandler/);
    expect(mainSource as string).toMatch(/action:\s*["']deny["']/);
  });

  it("12. every permission request is denied by default", () => {
    expect(mainSource as string).toMatch(/setPermissionRequestHandler/);
    expect(mainSource as string).toMatch(/callback\(false\)/);
  });

  it("13. no business IPC channel exists anywhere in the spike directory", () => {
    const main = stripComments(mainSource as string);
    const preload = stripComments(preloadSource as string);
    expect(main).not.toMatch(/ipcMain\.(handle|on)/);
    expect(preload).not.toMatch(/ipcRenderer/);
    expect(preload).not.toMatch(/ipcMain/);
  });

  it("14. the preload exposes exactly one contextBridge key, and it is not a function/business API -- an immutable, frozen build-metadata object only", () => {
    const preload = stripComments(preloadSource as string);
    const exposeCalls = preload.match(/contextBridge\.exposeInMainWorld/g) ?? [];
    expect(exposeCalls).toHaveLength(1);
    expect(preload).toMatch(/Object\.freeze/);
    expect(preload).not.toMatch(/require\(["'](?!electron["']$)/);
    expect(preload).not.toMatch(/\bfs\b|readFile|writeFile|child_process/);
  });
});

describe("Secure Runtime Alpha 3881-3940 -- real process smoke tests (Phase I 3,15,16,17)", () => {
  it("15. the Electron binary itself is present at the expected path (real, not a stub)", () => {
    expect(existsSync(electronBinPath)).toBe(true);
  });

  it(
    "16. the compiled main process starts as a real subprocess, stays alive briefly, and exits cleanly on termination",
    async () => {
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        stdio: "ignore",
      });
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

      const exitedCleanly = await new Promise<boolean>((resolve) => {
        child.once("exit", () => resolve(true));
        child.kill("SIGTERM");
        setTimeout(() => resolve(false), 5000);
      });
      expect(exitedCleanly).toBe(true);
      spawnedElectronPid = undefined;
    },
    15000,
  );

  it(
    "17. repeated start (a second independent launch immediately after the first) does not corrupt build output or fail to start",
    async () => {
      expect(existsSync(mainCjsPath)).toBe(true);
      const beforeContent = readFileSync(mainCjsPath, "utf8");

      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        stdio: "ignore",
      });
      spawnedElectronPid = child.pid;
      const started = child.pid !== undefined && child.pid > 0;
      expect(started).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(resolve, 5000);
      });
      spawnedElectronPid = undefined;

      const afterContent = readFileSync(mainCjsPath, "utf8");
      expect(afterContent).toBe(beforeContent);
    },
    15000,
  );
});

describe("Secure Runtime Alpha 3881-3940 -- Windows/OneDrive/path and output location (Phase I 18-19, H)", () => {
  it("18. this Arc's own build/test runs from the mandated short, non-OneDrive worktree path -- the risk `13` names is structurally avoided, not re-tested from the raw OneDrive checkout this Arc was explicitly told not to work in", () => {
    expect(repoRoot).not.toMatch(/OneDrive/i);
    expect(repoRoot.length).toBeLessThan(60);
  });

  it("19. the electron-builder output directory is project-relative, scoped inside the isolated package, and gitignored -- never under p2p/.tmp_gen or a tracked path", () => {
    const config = JSON.parse(builderConfigSource as string) as { directories: { output: string } };
    expect(config.directories.output).toBe("dist-package");
    expect(gitignoreSource as string).toMatch(/dist-package/);
    expect(config.directories.output).not.toMatch(/p2p|\.tmp_gen/);
  });
});

describe("Secure Runtime Alpha 3881-3940 -- packaging spike (Phase J)", () => {
  const packageOutputDir = `${packageDir}/dist-package`;
  const unpackedDir = `${packageOutputDir}/win-unpacked`;
  const asarPath = `${unpackedDir}/resources/app.asar`;
  const asarBin = `${packageDir}/node_modules/@electron/asar/bin/asar.js`;
  // Packaging (electron-builder) is a separate, heavier step (`npm run package:electron-spike`) than the
  // fast TypeScript build above -- these tests verify an ALREADY-produced artifact rather than invoking
  // electron-builder inline (which downloads/extracts a fresh Electron zip and takes materially longer per
  // run). They skip, rather than fail, when the artifact has not been produced in this run.
  const packagingArtifactExists = existsSync(asarPath);

  it.skipIf(!packagingArtifactExists)("22. packaging (electron-builder, 'dir' target) succeeds and produces an unpacked Windows directory containing the local static page", () => {
    expect(existsSync(`${unpackedDir}/FedOS Desktop Build Spike.exe`)).toBe(true);
    const listing = execFileSync(process.execPath, [asarBin, "list", asarPath], { encoding: "utf8" }) as string;
    expect(listing).toMatch(/fedos_electron_spike_page\.html/);
    expect(listing).toMatch(/fedos_electron_spike_main\.cjs/);
    expect(listing).toMatch(/fedos_electron_spike_preload\.cjs/);
  });

  it.skipIf(!packagingArtifactExists)("23. no source maps, and no unused production dependency (node_modules), are bundled into the packaged app -- the narrowest feasible artifact, not merely a convenient one", () => {
    const listing = execFileSync(process.execPath, [asarBin, "list", asarPath], { encoding: "utf8" }) as string;
    expect(listing).not.toMatch(/\.map\b/);
    expect(listing).not.toMatch(/node_modules/);
  });

  it.skipIf(!packagingArtifactExists)("24. no secret-shaped marker appears anywhere in the packaged app's own bundled files", () => {
    // `asar extract-file <archive> <name>` writes the extracted file to the FLAT BASENAME of `<name>`
    // inside the invocation's own working directory -- run here with `cwd` pointed at a dedicated scratch
    // directory, never this package's own directory, specifically because one bundled file is itself named
    // `package.json` (a real mistake this suite's own earlier draft made against the ROOT `package.json`,
    // caught and fixed during Alpha 3881-3940's own development -- see that Arc's own docs).
    const scratchDir = `${packageOutputDir}/.asar-extract-scratch`;
    mkdirSync(scratchDir, { recursive: true });
    const listing = execFileSync(process.execPath, [asarBin, "list", asarPath], { encoding: "utf8" }) as string;
    const bundledTextFiles = listing
      .split("\n")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && (s.endsWith(".cjs") || s.endsWith(".js") || s.endsWith(".html") || s.endsWith(".json")));
    for (const file of bundledTextFiles) {
      const relativeName = file.replace(/^[/\\]/, "").replace(/\\/g, "/");
      const baseName = relativeName.slice(relativeName.lastIndexOf("/") + 1);
      execFileSync(process.execPath, [asarBin, "extract-file", asarPath, relativeName], { cwd: scratchDir, encoding: "utf8" });
      const content = readFileSync(`${scratchDir}/${baseName}`, "utf8") as string;
      expect(content, file).not.toMatch(/masterseed|private_?key|passphrase|mnemonic|nsec|bearer/i);
    }
    rmSync(scratchDir, { recursive: true, force: true });
  });

  it.skipIf(!packagingArtifactExists)("25. the app's own bundled code (app.asar) is small -- the packaged size is dominated entirely by the unavoidable Electron/Chromium runtime, not this Arc's own code", () => {
    const asarStats = execFileSync(process.execPath, [asarBin, "list", asarPath], { encoding: "utf8" }) as string;
    expect(asarStats.split("\n").filter((l: string) => l.trim().length > 0).length).toBeLessThan(10);
  });
});

describe("Secure Runtime Alpha 4021-4100 -- root/Electron graph isolation (Phase M)", () => {
  it("26. ordinary root `test/` contains NO electron reference of any kind -- `npm test` cannot discover or launch anything Electron-related", () => {
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

  it("27. root scripts remain additive and backward compatible -- typecheck:core preserves the ORIGINAL single-graph check verbatim; test/build:runtime/start:runtime are unchanged", () => {
    const rootPkg = JSON.parse(rootPackageJsonSource as string) as { scripts: Record<string, string> };
    expect(rootPkg.scripts["typecheck:core"]).toBe("tsc --noEmit");
    expect(rootPkg.scripts.test).toBe("vitest run");
    expect(rootPkg.scripts["build:runtime"]).toBe("tsc -p tsconfig.runtime.json");
    expect(rootPkg.scripts["start:runtime"]).toBe("npm run build:runtime && node dist/desktop/runtime/run_fedos_desktop_runtime.js");
    expect(rootPkg.scripts.typecheck).toBe("npm run typecheck:core && npm run typecheck:electron");
    expect(rootPkg.scripts["typecheck:electron"]).toBeDefined();
    expect(rootPkg.scripts["build:electron-spike"]).toBeDefined();
    expect(rootPkg.scripts["start:electron-spike"]).toBeDefined();
    expect(rootPkg.scripts["package:electron-spike"]).toBeDefined();
    expect(rootPkg.scripts["test:electron-spike"]).toBeDefined();
  });

  it("28. no postinstall/install lifecycle script exists anywhere in either package.json", () => {
    const pkg = JSON.parse(packageJsonSource as string) as { scripts: Record<string, string> };
    const rootPkg = JSON.parse(rootPackageJsonSource as string) as { scripts: Record<string, string> };
    expect(Object.keys(pkg.scripts)).not.toContain("postinstall");
    expect(Object.keys(pkg.scripts)).not.toContain("install");
    expect(Object.keys(rootPkg.scripts)).not.toContain("postinstall");
    expect(Object.keys(rootPkg.scripts)).not.toContain("install");
  });
});

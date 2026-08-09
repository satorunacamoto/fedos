import { describe, it, expect, afterAll } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import mainSource from "../src/fedos_electron_unlock_main.cts?raw";
import preloadSource from "../src/fedos_electron_unlock_preload.cts?raw";
import rendererSource from "../src/fedos_electron_unlock_renderer.ts?raw";
import pageSource from "../src/fedos_electron_unlock_page.html?raw";

/**
 * Secure Runtime Alpha 4821-4900 — "Packaged Electron Real-Unlock Acceptance
 * and GUI Passphrase-Input Boundary Arc". Phase H/I/J/K/L/M/O.
 *
 * METHOD (same precedent as `secure_runtime_alpha_4341_4420_badge_electron_acceptance.test.ts`):
 * spawns the REAL, compiled Electron process and asserts on its REAL,
 * observable process lifecycle/stdout. NO browser-automation dependency is
 * added. Unlike the badge suite's main-process self-test, this Arc's
 * `FEDOS_ELECTRON_UNLOCK_AUTOTEST` self-test drives the REAL RENDERER page
 * (fills the real passphrase input, clicks the real controls via
 * `webContents.executeJavaScript`) so every command crosses the genuine
 * renderer -> preload -> main -> production activation -> real WASM boundary
 * (Phase J: calling main-process functions directly is insufficient).
 *
 * Invoked from the repo ROOT via `npm run test:electron-spike`, so
 * `process.cwd()` here is the repository root.
 */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_unlock_main.cjs`;
const preloadCjsPath = `${packageDir}/dist/fedos_electron_unlock_preload.cjs`;
const pageHtmlPath = `${packageDir}/dist/fedos_electron_unlock_page.html`;
const rendererJsPath = `${packageDir}/dist/fedos_electron_unlock_renderer.js`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const rootDistCoordinatorPath = `${repoRoot}/dist/os/messenger/desktop/onboarding/fedos_profile_initialization_coordinator.js`;
const rootDistProductionNostrPath = `${repoRoot}/dist/os/messenger/desktop/production_activation/fedos_production_nostr_signing_authority.js`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const REAL_ARTIFACT_PRESENT = existsSync(pkgWasmPath);
const ELECTRON_PRESENT = existsSync(electronBinPath);
const CAN_RUN_REAL = REAL_ARTIFACT_PRESENT && ELECTRON_PRESENT;

const tmpRoots: string[] = [];
function makeTmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-unlock-acc-"));
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

interface UnlockRun {
  readonly output: string;
  readonly markers: ReadonlyArray<{ step: string; result: unknown }>;
  readonly dataDirReported: string | null;
}

async function runUnlockProcess(mode: "create" | "unlock", dataDir: string, secret: string): Promise<UnlockRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_UNLOCK_DATA_DIR: dataDir,
      FEDOS_ELECTRON_UNLOCK_AUTOTEST: mode,
      FEDOS_UNLOCK_AUTOTEST_SECRET: secret,
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
  const markers = output
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("FEDOS_UNLOCK_TEST:") && l !== "FEDOS_UNLOCK_TEST:done")
    .map((l) => JSON.parse(l.slice("FEDOS_UNLOCK_TEST:".length)) as { step: string; result: unknown });
  const dataDirLine = output.split("\n").find((l) => l.trim().startsWith("FEDOS_UNLOCK_DATA_DIR:"));
  const dataDirReported = dataDirLine ? dataDirLine.trim().slice("FEDOS_UNLOCK_DATA_DIR:".length) : null;
  return { output, markers, dataDirReported };
}

function stepResult(run: UnlockRun, step: string): Record<string, unknown> {
  const m = run.markers.find((x) => x.step === step);
  expect(m, `missing self-test step "${step}"; output:\n${run.output}`).toBeDefined();
  return m!.result as Record<string, unknown>;
}

// ---------------------------------------------------------------------
// Structural guards (always run — no Electron/artifact needed).
// ---------------------------------------------------------------------

describe("Alpha 4821-4900 — unlock main: Electron security baseline UNCHANGED", () => {
  it("contextIsolation/nodeIntegration/sandbox/webSecurity are the SAME mandatory literals", () => {
    expect(mainSource as string).toMatch(/contextIsolation:\s*true/);
    expect(mainSource as string).toMatch(/nodeIntegration:\s*false/);
    expect(mainSource as string).toMatch(/sandbox:\s*true/);
    expect(mainSource as string).toMatch(/webSecurity:\s*true/);
  });

  it("no enableRemoteModule, no @electron/remote, no eval, no new Function()", () => {
    const main = stripComments(mainSource as string);
    const preload = stripComments(preloadSource as string);
    expect(main).not.toMatch(/enableRemoteModule|@electron\/remote/);
    expect(main).not.toMatch(/\beval\s*\(|new\s+Function\s*\(/);
    expect(preload).not.toMatch(/enableRemoteModule|@electron\/remote|\beval\s*\(/);
  });

  it("only local files are loaded — loadFile, never loadURL/http/localhost", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/loadFile\(/);
    expect(main).not.toMatch(/loadURL/);
    expect(main).not.toMatch(/https?:\/\//);
    expect(main).not.toMatch(/localhost/);
  });

  it("navigation/window-open/permission are denied", () => {
    expect(mainSource as string).toMatch(/will-navigate/);
    expect(mainSource as string).toMatch(/event\.preventDefault\(\)/);
    expect(mainSource as string).toMatch(/setWindowOpenHandler/);
    expect(mainSource as string).toMatch(/action:\s*["']deny["']/);
    expect(mainSource as string).toMatch(/setPermissionRequestHandler/);
    expect(mainSource as string).toMatch(/callback\(false\)/);
  });
});

describe("Alpha 4821-4900 — dedicated secret-input contract is closed", () => {
  it("the preload exposes exactly one frozen contextBridge key, never raw ipcRenderer/require/fs/generic-invoke", () => {
    const preload = stripComments(preloadSource as string);
    const exposeCalls = preload.match(/contextBridge\.exposeInMainWorld/g) ?? [];
    expect(exposeCalls).toHaveLength(1);
    expect(preload).toMatch(/Object\.freeze/);
    expect(preload).not.toMatch(/\bfs\b|readFile|writeFile|child_process|require\s*\(/);
    expect(preload).not.toMatch(/exposeInMainWorld\(["']ipcRenderer["']/);
    // No generic invoke(channel, any) surface — every channel is a fixed literal.
    expect(preload).not.toMatch(/invoke:\s*\(/);
  });

  it("main registers EXACTLY the five closed fedos-profile:* channels, no more", () => {
    const main = stripComments(mainSource as string);
    const channels = [...main.matchAll(/ipcMain\.handle\(\s*["'](fedos-profile:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(channels)).toEqual(
      new Set(["fedos-profile:status", "fedos-profile:create", "fedos-profile:unlock", "fedos-profile:lock", "fedos-profile:quit"]),
    );
  });

  it("the preload invokes ONLY those five channels", () => {
    const preload = stripComments(preloadSource as string);
    const invoked = [...preload.matchAll(/ipcRenderer\.invoke\(\s*["'](fedos-profile:[a-z-]+)["']/g)].map((m) => m[1]);
    expect(new Set(invoked)).toEqual(
      new Set(["fedos-profile:status", "fedos-profile:create", "fedos-profile:unlock", "fedos-profile:lock", "fedos-profile:quit"]),
    );
  });

  it("no generic crypto/secret/filesystem IPC command exists", () => {
    const main = stripComments(mainSource as string);
    expect(main).not.toMatch(/ipcMain\.handle\(\s*["'][^"']*:(crypto|secret|seed|readFile|writeFile|exec)["']/);
  });
});

describe("Alpha 4821-4900 — secret discipline (source)", () => {
  it("the passphrase is never logged/persisted/URL-embedded by the main process", () => {
    const main = stripComments(mainSource as string);
    // No console logging of the payload/secret object.
    expect(main).not.toMatch(/console\.(log|error|warn)\([^)]*payload/);
    expect(main).not.toMatch(/console\.(log|error|warn)\([^)]*secret/i);
    // The secret is wrapped in the redacting one-shot carrier.
    expect(main).toMatch(/UnlockSecret/);
    // No dev seed double / dev-only loader in this packaged flow.
    expect(main).not.toMatch(/DevelopmentFedosMasterSeedAuthority|attemptDevOnly|NODE_ENV/);
  });

  it("the renderer never writes the secret to innerHTML/URL/storage/console and clears the field", () => {
    const renderer = stripComments(rendererSource as string);
    expect(renderer).not.toMatch(/innerHTML/);
    expect(renderer).not.toMatch(/localStorage|sessionStorage/);
    expect(renderer).not.toMatch(/location\.(href|hash)\s*=/);
    expect(renderer).not.toMatch(/console\./);
    // Password fields are cleared after submit.
    expect(renderer).toMatch(/clearField\(/);
  });

  it("passphrase inputs are type=password with autocomplete off", () => {
    const page = pageSource as string;
    expect(page).toMatch(/id="create-pass"[^>]*type="password"/);
    expect(page).toMatch(/id="unlock-pass"[^>]*type="password"/);
    expect(page).toMatch(/autocomplete="off"/);
    // Local content only — CSP forbids remote/connect.
    expect(page).toMatch(/Content-Security-Policy/);
    expect(page).toMatch(/connect-src 'none'/);
  });
});

// ---------------------------------------------------------------------
// Real packaged-process acceptance (Phase H/I/K/L/M).
// ---------------------------------------------------------------------

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Alpha 4821-4900 — REAL packaged Electron create + unlock through the renderer/preload/main boundary", () => {
  it("build outputs exist (root unlock-runtime graph + spike dist)", () => {
    expect(existsSync(rootDistCoordinatorPath), "run `npm run build:unlock-runtime` from repo root first").toBe(true);
    expect(existsSync(rootDistProductionNostrPath), "run `npm run build:unlock-runtime` from repo root first").toBe(true);
    expect(existsSync(mainCjsPath) && existsSync(preloadCjsPath) && existsSync(pageHtmlPath) && existsSync(rendererJsPath), "run the spike build first").toBe(true);
  });

  const sharedDataDir = CAN_RUN_REAL ? makeTmpRoot() : "";
  const SECRET = `Uniq-${randomBytes(12).toString("hex")}-passphrase-4821`;

  it(
    "CREATE: first-run welcome -> real renderer input -> real WASM seal -> ready; sealed material real, no plaintext/secret leak anywhere",
    async () => {
      const run = await runUnlockProcess("create", sharedDataDir, SECRET);
      expect(run.output).toMatch(/fedos-unlock: host started/);
      expect(run.output).toMatch(/fedos-unlock: shutdown clean/);
      expect(run.markers.find((m) => m.step === "first-screen")!.result).toBe("welcome");

      const create = stepResult(run, "create");
      expect(create.reached).toBe("ready");
      expect(typeof create.account).toBe("string");
      expect((create.account as string).length).toBe(64);
      expect(create.trust).toBe("trusted");
      expect(create.secretVisibleInRenderer).toBe(false);
      expect(create.passFieldLength).toBe(0);

      // Sealed material on disk is real Argon2id, no plaintext secret.
      const profileDir = join(sharedDataDir, "profile");
      const sealed = readFileSync(join(profileDir, "master-seed.sealed.json"), "utf8");
      expect(sealed.startsWith('{"v":1,"kdf":"argon2id"')).toBe(true);

      // Secret leak scan: main stdout + every on-disk profile file.
      expect(run.output.includes(SECRET), "secret leaked to main stdout").toBe(false);
      for (const file of readdirSync(profileDir)) {
        const full = join(profileDir, file);
        if (statSync(full).isFile()) {
          expect(readFileSync(full, "utf8").includes(SECRET), `secret leaked into ${file}`).toBe(false);
        }
      }
    },
    120000,
  );

  it(
    "UNLOCK: fresh process — wrong secret stays locked (no Runtime); correct secret restores the SAME identity through real WASM; lock; re-unlock; no leak",
    async () => {
      const account = (stepResultFromCreate() ?? "").toString();
      const run = await runUnlockProcess("unlock", sharedDataDir, SECRET);
      expect(run.output).toMatch(/fedos-unlock: host started/);
      expect(run.output).toMatch(/fedos-unlock: shutdown clean/);
      expect(run.markers.find((m) => m.step === "first-screen")!.result).toBe("unlock");

      const wrong = stepResult(run, "wrong-secret");
      expect(wrong.screen).toBe("unlock-failed");
      expect((wrong.status as { runtimeRunning: boolean }).runtimeRunning).toBe(false);

      const correct = stepResult(run, "correct-secret");
      expect(correct.screen).toBe("ready");
      if (account.length === 64) expect(correct.account).toBe(account); // stable identity across processes

      const lock = stepResult(run, "lock");
      expect(lock.screen).toBe("unlock");
      expect((lock.status as { runtimeRunning: boolean }).runtimeRunning).toBe(false);

      const reunlock = stepResult(run, "re-unlock");
      expect(reunlock.screen).toBe("ready");
      expect(reunlock.secretVisibleInRenderer).toBe(false);

      expect(run.output.includes(SECRET), "secret leaked to main stdout on unlock").toBe(false);
    },
    120000,
  );

  // Captures the create account id from the shared data dir descriptor so the
  // unlock test can assert cross-process identity stability without ordering
  // coupling to the previous test's local variables.
  function stepResultFromCreate(): string | null {
    try {
      const descriptor = JSON.parse(readFileSync(join(sharedDataDir, "profile", "profile.json"), "utf8")) as {
        accountPublicIdentity?: { publicKeyHex?: string };
      };
      return descriptor.accountPublicIdentity?.publicKeyHex ?? null;
    } catch {
      return null;
    }
  }

  it(
    "FAILURE MATRIX: a missing WASM artifact fails closed — create never reaches ready, no Runtime, no dev fallback",
    async () => {
      const emptyArtifactDir = makeTmpRoot();
      const dataDir = makeTmpRoot();
      const outChunks: Buffer[] = [];
      const child = spawn(electronBinPath, [mainCjsPath], {
        cwd: packageDir,
        env: {
          ...process.env,
          FEDOS_ELECTRON_UNLOCK_DATA_DIR: dataDir,
          FEDOS_ELECTRON_UNLOCK_ARTIFACT_DIR: emptyArtifactDir, // no wasm/glue/manifest here
          FEDOS_ELECTRON_UNLOCK_AUTOTEST: "create",
          FEDOS_UNLOCK_AUTOTEST_SECRET: `Uniq-${randomBytes(8).toString("hex")}-fail`,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
      child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* gone */
        }
      }, 60000);
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
      clearTimeout(timer);
      const output = Buffer.concat(outChunks).toString("utf8");
      const createMarker = output
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("FEDOS_UNLOCK_TEST:") && l !== "FEDOS_UNLOCK_TEST:done")
        .map((l) => JSON.parse(l.slice("FEDOS_UNLOCK_TEST:".length)) as { step: string; result: unknown })
        .find((m) => m.step === "create");
      // create must NOT reach ready with no artifact; it fails closed on the create screen.
      if (createMarker) expect((createMarker.result as { reached: string }).reached).not.toBe("ready");
      // No sealed material was written.
      expect(existsSync(join(dataDir, "profile", "master-seed.sealed.json"))).toBe(false);
      expect(output).not.toMatch(/DevelopmentFedosMasterSeedAuthority/);
    },
    90000,
  );
});

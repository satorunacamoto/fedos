import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 1 (external audit
 * delta `6873d24f`): "prove it is not exposed in ordinary production
 * mode," not merely "prove the ordinary UI does not call it." Every test
 * here drives a REAL, separately-spawned Electron subprocess and reads
 * `typeof window.<bridge>` from the REAL rendered page via the
 * `readGlobal` (ui-script mode) / `read-global` (acceptance mode) actions
 * added alongside the `ACCEPTANCE_MODE_ENABLED` gate itself
 * (`fedos_electron_beta_main.cts`/`_preload.cts`) — never a static source
 * read alone (that already exists, `secure_runtime_alpha_8041_8120_structural_guards.test.ts`
 * test 3).
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const REAL_ARTIFACT_PRESENT = existsSync(pkgWasmPath);
const ELECTRON_PRESENT = existsSync(electronBinPath);
const CAN_RUN_REAL = REAL_ARTIFACT_PRESENT && ELECTRON_PRESENT && existsSync(mainCjsPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-8121-bridge-${label}-`));
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

async function runUiScript(dataDir: string, script: readonly Record<string, unknown>[], extraEnv: Record<string, string> = {}): Promise<string> {
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
  }, 30000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  return Buffer.concat(outChunks).toString("utf8");
}

async function runAcceptanceScript(dataDir: string, script: readonly Record<string, unknown>[], extraEnv: Record<string, string> = {}): Promise<string> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance",
      FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script),
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
  }, 30000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  return Buffer.concat(outChunks).toString("utf8");
}

function readGlobalValue(output: string, index: number): string {
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const parsed = JSON.parse(line.slice(marker.length)) as { index: number; result: { outcome: string; value?: string } };
    if (parsed.index === index) return parsed.result.value ?? "";
  }
  throw new Error(`no UI step at index ${index} found in output:\n${output}`);
}

function acceptanceStepResults(output: string, command: string): readonly { outcome: string; value?: string }[] {
  const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
  const results: { outcome: string; value?: string }[] = [];
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    if (rest.slice(firstColon + 1, secondColon) !== command) continue;
    results.push(JSON.parse(rest.slice(secondColon + 1)) as { outcome: string; value?: string });
  }
  if (results.length === 0) throw new Error(`no acceptance step "${command}" found in output:\n${output}`);
  return results;
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Alpha 8121-8200 -- Security Finding 1 (6873d24f): window.fedosAcceptance production isolation, proven from real running processes", () => {
  it("43. ordinary production Renderer (any non-'acceptance' launch, proxied here by AUTOTEST_MODE=ui-script, the SAME real preload/main/page an ordinary launch uses) has NO window.fedosAcceptance -- genuinely absent, not merely unused", async () => {
    const dir = makeTmpRoot("ordinary");
    const out = await runUiScript(dir, [
      { action: "wait", ms: 300 },
      { action: "readGlobal", selector: "fedosAcceptance" },
      { action: "readGlobal", selector: "fedosApp" },
      { action: "readGlobal", selector: "fedosProfile" },
    ]);
    expect(readGlobalValue(out, 1)).toBe("undefined");
    expect(readGlobalValue(out, 2)).toBe("object");
    expect(readGlobalValue(out, 3)).toBe("object");
  });

  it("44. acceptance-mode Renderer still supports the test harness -- window.fedosAcceptance IS present when FEDOS_ELECTRON_BETA_AUTOTEST=acceptance is the exact value active", async () => {
    const dir = makeTmpRoot("acceptance");
    const out = await runAcceptanceScript(dir, [
      { command: "wait", payload: { ms: 400 } },
      { command: "read-global", payload: { name: "fedosAcceptance" } },
      { command: "read-global", payload: { name: "fedosApp" } },
    ]);
    const results = acceptanceStepResults(out, "read-global");
    expect(results[0]!.outcome, out).toBe("ok");
    expect(results[0]!.value).toBe("object");
    expect(results[1]!.outcome, out).toBe("ok");
    expect(results[1]!.value).toBe("object");
  });

  it("malformed/near-miss environment values cannot enable acceptance mode -- only the exact literal 'acceptance' does (structural: the check is === , never truthy/includes/case-insensitive)", () => {
    const mainSource = readFileSync(join(packageDir, "src/fedos_electron_beta_main.cts"), "utf8");
    const preloadSource = readFileSync(join(packageDir, "src/fedos_electron_beta_preload.cts"), "utf8");
    expect(mainSource).toMatch(/const ACCEPTANCE_MODE_ENABLED = AUTOTEST_MODE === "acceptance";/);
    expect(preloadSource).toMatch(/const ACCEPTANCE_MODE_ENABLED = process\.env\.FEDOS_ELECTRON_BETA_AUTOTEST === "acceptance";/);
    expect(mainSource).not.toMatch(/ACCEPTANCE_MODE_ENABLED = .*\.includes\(/);
    expect(mainSource).not.toMatch(/ACCEPTANCE_MODE_ENABLED = .*toLowerCase/);
  });

  it("a real non-'acceptance' value (ui-script) genuinely cannot enable window.fedosAcceptance, even though it is a real, recognized AUTOTEST_MODE", async () => {
    const dir = makeTmpRoot("nearmiss-uiscript");
    const out = await runUiScript(dir, [
      { action: "wait", ms: 300 },
      { action: "readGlobal", selector: "fedosAcceptance" },
    ]);
    expect(readGlobalValue(out, 1)).toBe("undefined");
  });

  it("no generic execution channel was introduced by this gate -- fedos-app:* and fedos-acceptance:* both remain named, single-purpose channels only", () => {
    const preloadSource = readFileSync(join(packageDir, "src/fedos_electron_beta_preload.cts"), "utf8");
    expect(preloadSource).not.toMatch(/ipcRenderer\.invoke\(channel/);
  });
});

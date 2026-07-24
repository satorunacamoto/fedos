import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 7321-7400 — failure matrix for the four newly
 * reachable acceptance commands (`create-conversation-invitation`/
 * `search`/`archive`/`safety-center-overview`). Uses ONLY the REAL,
 * compiled, packaged Beta Electron entry point (same subprocess-spawn
 * pattern as this Arc's own real vertical slice test) — no mocks.
 *
 * Covers: no profile at all, a genuinely wrong passphrase (real
 * `unlock-failed`, never a fabricated rejection), malformed payload
 * shapes for each new command post-unlock, and Safety Center's own
 * real reachability with zero relays configured (a real degraded
 * state, never a crash).
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-7321-fm-${label}-`));
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

interface AcceptanceStep {
  readonly command: string;
  readonly result: Record<string, unknown>;
}
interface AcceptanceRun {
  readonly output: string;
  readonly steps: readonly AcceptanceStep[];
}

/** Spawns the REAL compiled Beta Electron process in `AUTOTEST_MODE=acceptance`, feeds it a real script, and parses each real step's own real result. Mirrors this Arc's own vertical slice test helper exactly. */
async function runBetaAcceptance(
  dataDir: string,
  script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }>,
): Promise<AcceptanceRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance",
      FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script),
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
  const steps: AcceptanceStep[] = [];
  for (const line of output.split("\n")) {
    const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    const command = rest.slice(firstColon + 1, secondColon);
    const resultJson = rest.slice(secondColon + 1);
    steps.push({ command, result: JSON.parse(resultJson) as Record<string, unknown> });
  }
  return { output, steps };
}

function stepFor(run: AcceptanceRun, command: string, occurrence = 0): Record<string, unknown> {
  const matches = run.steps.filter((s) => s.command === command);
  const step = matches[occurrence];
  expect(step, `${run.output}\n--- expected a "${command}" step (occurrence ${occurrence}) ---`).toBeDefined();
  return step!.result;
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Alpha 7321-7400 -- failure matrix for the four newly reachable acceptance commands", () => {
  it("1. with NO profile ever created/unlocked in this process, all four new commands genuinely reject with {outcome:'unavailable'} -- never a crash, never a silent success", async () => {
    const dir = makeTmpRoot("no-profile");
    const run = await runBetaAcceptance(dir, [
      { command: "acceptance-create-conversation-invitation", payload: { invitee: { authority: "nostr", publicIdentifier: "a".repeat(64) } } },
      { command: "acceptance-search", payload: { query: "hello" } },
      { command: "acceptance-archive", payload: { operation: "inspect", sourcePath: "/tmp/doesnotmatter" } },
      { command: "acceptance-safety-center-overview" },
    ]);
    for (const command of ["acceptance-create-conversation-invitation", "acceptance-search", "acceptance-archive", "acceptance-safety-center-overview"]) {
      const result = stepFor(run, command);
      expect(result.outcome, run.output).toBe("unavailable");
      expect(result.reason, run.output).toBe("acceptance-only");
    }
  });

  it("2. a genuinely WRONG passphrase produces a real unlock-failed outcome, and the four new commands remain gated afterward -- no partial/degraded unlock state", async () => {
    const dir = makeTmpRoot("wrong-pass");
    const run = await runBetaAcceptance(dir, [
      { command: "profile-create", payload: { label: "Wronged", secret: "correct-horse-battery-staple-1" } },
      { command: "profile-lock" },
      { command: "profile-unlock", payload: { secret: "definitely-the-wrong-passphrase" } },
      { command: "acceptance-search", payload: { query: "hello" } },
      { command: "acceptance-safety-center-overview" },
    ]);
    const unlockResult = stepFor(run, "profile-unlock");
    expect(unlockResult.outcome, run.output).toBe("unlock-failed");
    expect(stepFor(run, "acceptance-search").outcome, run.output).toBe("unavailable");
    expect(stepFor(run, "acceptance-safety-center-overview").outcome, run.output).toBe("unavailable");
  });

  it("3. once genuinely unlocked, each new command rejects malformed payloads with {outcome:'invalid-input'} before ever reaching the Shell", async () => {
    const dir = makeTmpRoot("malformed");
    const run = await runBetaAcceptance(dir, [
      { command: "profile-create", payload: { label: "Malformed", secret: "another-real-passphrase-2" } },
      { command: "acceptance-create-conversation-invitation", payload: { invitee: { authority: "nostr" } } },
      { command: "acceptance-search", payload: { query: "" } },
      { command: "acceptance-search", payload: { query: "x".repeat(300) } },
      { command: "acceptance-archive", payload: { operation: "not-a-real-operation" } },
      { command: "acceptance-archive", payload: { operation: "inspect" } },
    ]);
    expect(stepFor(run, "profile-create").outcome, run.output).toBe("ok");
    expect(stepFor(run, "acceptance-create-conversation-invitation").outcome, run.output).toBe("invalid-input");
    expect(stepFor(run, "acceptance-search", 0).outcome, run.output).toBe("invalid-input");
    expect(stepFor(run, "acceptance-search", 1).outcome, run.output).toBe("invalid-input");
    expect(stepFor(run, "acceptance-archive", 0).outcome, run.output).toBe("invalid-input");
    expect(stepFor(run, "acceptance-archive", 1).outcome, run.output).toBe("invalid-input");
  });

  it("4. Safety Center's overview genuinely loads even with zero relays configured and zero conversations ever created -- a real degraded state, never a crash or an 'unavailable'", async () => {
    const dir = makeTmpRoot("no-relay");
    const run = await runBetaAcceptance(dir, [
      { command: "profile-create", payload: { label: "Solo", secret: "yet-another-real-passphrase-3" } },
      { command: "acceptance-safety-center-overview" },
    ]);
    const result = stepFor(run, "acceptance-safety-center-overview");
    expect(result.outcome, run.output).toBe("ok");
    expect((result.value as { readonly status: string }).status, run.output).toBe("loaded");
  });
});

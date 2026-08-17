import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Disaster Recovery / Portable Backup Arc -- Restore Coordinator IPC
 * wiring, real end-to-end proof (mandate §9-11 + §24-26's own "crosses
 * the machine boundary ONLY via the recovery artifact, never a directory
 * copy" requirement).
 *
 * Uses ONLY the REAL, compiled, packaged Beta Electron entry point
 * (`dist/fedos_electron_beta_main.cjs`, spawned as a genuine Electron
 * subprocess -- real production activation, real compiled WASM, real
 * file-backed persistence), through `AUTOTEST_MODE=acceptance` (the SAME
 * real `fedos-profile:*` handler functions `registerIpcHandlers()` also
 * registers for a real renderer to call -- see
 * `secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts`'s
 * own header for why this mode is a test-automation convenience, not a
 * second implementation path).
 *
 * Machine A and Machine B are two ENTIRELY SEPARATE `dataDir`s (separate
 * temp directories, separate subprocesses) -- the ONLY thing that crosses
 * from A to B in this test is the base64 bundle bytes captured from A's
 * own `profile-recovery-export` step result and fed into B's own
 * `profile-recovery-restore` step payload. Nothing ever reads or copies
 * A's directory tree directly.
 *
 * Skips itself with a clear message if the real `pkg/` artifact or the
 * real Electron binary are absent (mirrors every sibling real-Electron
 * acceptance test's own convention).
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
  const dir = mkdtempSync(join(tmpdir(), `fedos-recovery-ipc-${label}-`));
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

/** Spawns the REAL compiled Beta Electron process in `AUTOTEST_MODE=acceptance`, feeds it a real script, and parses each real step's own real result -- verbatim pattern from the 7321-7400 vertical slice test. */
async function runBetaAcceptance(
  dataDir: string,
  script: ReadonlyArray<{ readonly command: string; readonly payload?: unknown }>,
  extraEnv: Record<string, string> = {},
): Promise<AcceptanceRun> {
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

realSuite("Disaster Recovery Portable Backup -- REAL packaged Beta Electron IPC surface, two genuinely separate machine dataDirs", () => {
  it(
    "Machine A creates a real profile and exports a real Recovery Bundle; an independent Machine B (fresh dataDir, separate subprocess) restores it through the real IPC surface, recovers the SAME account identity with a FRESH Device identity, and can lock/unlock normally afterward -- proving the sealed Master Seed durability fix, not just an in-memory restore",
    async () => {
      const machineADir = makeTmpRoot("machine-a");
      const machineBDir = makeTmpRoot("machine-b");
      const passphrase = "correct horse battery staple recovery ipc";

      // ---- Machine A: create a real profile, then export a real bundle. ----
      const aRun = await runBetaAcceptance(machineADir, [
        { command: "profile-create", payload: { label: "Alice", secret: passphrase } },
        { command: "profile-recovery-export" },
      ]);
      const aCreate = stepFor(aRun, "profile-create");
      expect(aCreate.outcome, aRun.output).toBe("ok");
      const aReady = aCreate.ready as { accountPublicIdentifier: string; localDeviceId: string };

      const aExport = stepFor(aRun, "profile-recovery-export");
      expect(aExport.outcome, aRun.output).toBe("ok");
      const bundleBase64 = aExport.bundleBase64 as string;
      expect(typeof bundleBase64).toBe("string");
      expect(bundleBase64.length).toBeGreaterThan(0);

      // ---- Machine B: inspect, then restore, through a completely separate subprocess/dataDir. ----
      const bRun = await runBetaAcceptance(machineBDir, [
        { command: "profile-recovery-inspect", payload: { bundleBytes: bundleBase64 } },
        { command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphrase } },
      ]);
      const bInspect = stepFor(bRun, "profile-recovery-inspect");
      expect(bInspect.outcome, bRun.output).toBe("ok");
      expect((bInspect.plan as { hasDataPart: boolean }).hasDataPart).toBe(true);

      const bRestore = stepFor(bRun, "profile-recovery-restore");
      expect(bRestore.outcome, bRun.output).toBe("ok");
      const bReady = bRestore.ready as { accountPublicIdentifier: string; localDeviceId: string };
      expect(bReady.accountPublicIdentifier, "Machine B must recover the SAME account identity as Machine A").toBe(aReady.accountPublicIdentifier);
      expect(bReady.localDeviceId, "Machine B must mint a FRESH Device identity, never carry Machine A's forward").not.toBe(aReady.localDeviceId);

      // ---- Machine B, a FRESH subprocess: lock/unlock must work normally -- proves the sealed Master Seed
      // was durably persisted to disk (not merely unsealed in-memory during the restore call itself). ----
      const bRelaunch = await runBetaAcceptance(machineBDir, [{ command: "profile-unlock", payload: { secret: passphrase } }]);
      const bUnlock = stepFor(bRelaunch, "profile-unlock");
      expect(bUnlock.outcome, bRelaunch.output).toBe("ok");
      const bUnlockReady = bUnlock.ready as { accountPublicIdentifier: string; localDeviceId: string };
      expect(bUnlockReady.accountPublicIdentifier).toBe(aReady.accountPublicIdentifier);
      expect(bUnlockReady.localDeviceId).toBe(bReady.localDeviceId);
    },
    120000,
  );

  it("a wrong passphrase on restore fails closed (wrong-secret) and leaves nothing on disk -- a second restore attempt with the CORRECT passphrase against the SAME fresh target still succeeds", async () => {
    const machineADir = makeTmpRoot("wrong-secret-a");
    const machineCDir = makeTmpRoot("wrong-secret-c");
    const passphrase = "correct horse battery staple wrong secret test";

    const aRun = await runBetaAcceptance(machineADir, [
      { command: "profile-create", payload: { label: "Alice", secret: passphrase } },
      { command: "profile-recovery-export" },
    ]);
    const bundleBase64 = (stepFor(aRun, "profile-recovery-export").bundleBase64 as string) ?? "";
    expect(bundleBase64.length).toBeGreaterThan(0);

    const cWrongRun = await runBetaAcceptance(machineCDir, [
      { command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: "the wrong passphrase entirely" } },
    ]);
    expect(stepFor(cWrongRun, "profile-recovery-restore").outcome, cWrongRun.output).toBe("wrong-secret");

    // The SAME target dataDir, a fresh subprocess, correct passphrase -- must still succeed (the failed
    // attempt above must not have left a stale/partial sealed-seed file blocking this one).
    const cRetryRun = await runBetaAcceptance(machineCDir, [
      { command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphrase } },
    ]);
    expect(stepFor(cRetryRun, "profile-recovery-restore").outcome, cRetryRun.output).toBe("ok");
  }, 60000);

  it("restore refuses to overwrite an already-existing profile -- already-exists, never silently clobbers a live profile", async () => {
    const machineADir = makeTmpRoot("already-exists-a");
    const passphrase = "correct horse battery staple already exists test";

    const aRun = await runBetaAcceptance(machineADir, [
      { command: "profile-create", payload: { label: "Alice", secret: passphrase } },
      { command: "profile-recovery-export" },
    ]);
    const bundleBase64 = (stepFor(aRun, "profile-recovery-export").bundleBase64 as string) ?? "";
    expect(bundleBase64.length).toBeGreaterThan(0);

    // A fresh subprocess against Machine A's OWN dataDir -- a real profile already lives there.
    const reRestoreRun = await runBetaAcceptance(machineADir, [
      { command: "profile-recovery-restore", payload: { bundleBytes: bundleBase64, secret: passphrase } },
    ]);
    expect(stepFor(reRestoreRun, "profile-recovery-restore").outcome, reRestoreRun.output).toBe("already-exists");
  }, 60000);
});

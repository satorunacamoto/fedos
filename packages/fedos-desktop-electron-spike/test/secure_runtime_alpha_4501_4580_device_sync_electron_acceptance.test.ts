import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mainSource from "../src/fedos_electron_badge_main.cts?raw";
import deviceSyncSelftestSource from "../src/fedos_electron_badge_device_sync_selftest.ts?raw";

/**
 * Secure Runtime Alpha 4501-4580 ("Desktop Device Sync Electron Main
 * Integration Arc") — real Electron acceptance tests. Same method as
 * `secure_runtime_alpha_4341_4420_badge_electron_acceptance.test.ts`
 * (Alpha 4341-4420): spawns the REAL, compiled `fedos_electron_badge_main.cjs`
 * process (this Arc extends that file IN PLACE -- see its own header for
 * why -- rather than adding a new sibling package) and asserts on its REAL,
 * observable process lifecycle/stdout.
 *
 * SCOPE (disclosed, mirrors every sibling acceptance suite's own explicit
 * "what depth are we actually testing" precedent): this file does NOT
 * re-verify the Bridge/Wiring's own event-translation logic (`sync-started`
 * classifies correctly, `retry-aborted` vs `retry-scheduled`, etc.) --
 * `secure_runtime_alpha_4421_4500_device_sync_event_bridge.test.ts` and
 * `secure_runtime_alpha_4421_4500_device_sync_wiring_acceptance.test.ts`
 * (root `test/`) already prove that, 21/21, against a real, directly-driven
 * Scheduler, and this Arc reuses both classes UNMODIFIED. What this suite
 * proves instead is the thing that did NOT exist before this Arc: that a
 * REAL, spawned Electron process constructs the Bridge/Wiring exactly once,
 * threads them into the REAL `startFedosDesktopRuntime()` config it starts,
 * routes real events into the REAL, live Notification/Badge/Tray
 * Coordinators that SAME process owns, and tears them down idempotently.
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
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const rootDistEventBridgePath = `${repoRoot}/dist/device/sync_events/fedos_device_sync_event_bridge.js`;
const rootDistWiringPath = `${repoRoot}/dist/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.js`;

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

describe("Alpha 4501-4580 -- Device Sync Electron integration: build", () => {
  it("1. the root application graph (Device Sync Event Bridge + Presentation Wiring, Alpha 4421-4500) is compiled to dist/ -- npm run build:runtime", () => {
    expect(existsSync(rootDistEventBridgePath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
    expect(existsSync(rootDistWiringPath), "run `npm run build:runtime` from the repo root before this suite").toBe(true);
  });

  it("2. the badge package build (extended in place by this Arc) still succeeds and still produces fedos_electron_badge_main.cjs", () => {
    expect(existsSync(mainCjsPath), "run `npm run build:electron-spike` from the repo root before this suite").toBe(true);
  });
});

describe("Alpha 4501-4580 -- Device Sync Electron integration: no redesign, no duplicate ownership", () => {
  it("3. the badge main file is EXTENDED, not replaced -- every Alpha 4341-4420 IPC channel and its own security baseline are still present, byte-identical in spirit", () => {
    const main = stripComments(mainSource as string);
    // Still exactly the original nine `fedos-badge:*` channels -- this Arc adds ZERO new IPC
    // surface (Device Sync scenarios are exercised through the Boundary directly, in-process, and
    // through the ALREADY-EXISTING `fedos-badge:tray-action` channel's `resume-sync`/`pause-sync`/
    // `device-sync-status` actions -- never a new channel).
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

  it("4. security baseline UNCHANGED -- contextIsolation/nodeIntegration/sandbox/webSecurity, no eval, no @electron/remote", () => {
    const main = stripComments(mainSource as string);
    expect(mainSource as string).toMatch(/contextIsolation:\s*true/);
    expect(mainSource as string).toMatch(/nodeIntegration:\s*false/);
    expect(mainSource as string).toMatch(/sandbox:\s*true/);
    expect(mainSource as string).toMatch(/webSecurity:\s*true/);
    expect(main).not.toMatch(/enableRemoteModule/);
    expect(main).not.toMatch(/@electron\/remote/);
    expect(main).not.toMatch(/\beval\s*\(/);
    expect(main).not.toMatch(/new\s+Function\s*\(/);
  });

  it("5. never constructs a second Boundary/Shell/Runtime -- exactly one `createBoundary()` call, exactly one `DeviceSyncEventBridge`/`DeviceSyncPresentationWiring` construction site each", () => {
    const main = stripComments(mainSource as string);
    expect([...main.matchAll(/modules\.createBoundary\(\)/g)]).toHaveLength(1);
    expect([...main.matchAll(/new\s+modules\.DeviceSyncEventBridge\(/g)]).toHaveLength(1);
    expect([...main.matchAll(/new\s+modules\.DeviceSyncPresentationWiring\(/g)]).toHaveLength(1);
    // Never touches FedosDesktopHostBridge -- see this file's own header for the disclosed reason.
    expect(main).not.toMatch(/FedosDesktopHostBridge|fedos_desktop_host_bridge/);
  });

  it("6. idempotent startup/shutdown guards are real code, not merely documented", () => {
    const main = stripComments(mainSource as string);
    expect(main).toMatch(/hostStarted/);
    expect(main).toMatch(/shutdownInitiated/);
  });

  it("7. the Device Sync selftest module contains no direct Electron import -- it only observes/drives the real objects handed to it", () => {
    const selftest = stripComments(deviceSyncSelftestSource as string);
    expect(selftest).not.toMatch(/from\s+["']electron["']/);
  });
});

describe("Alpha 4501-4580 -- Device Sync Electron integration: real process launch, ordinary (non-autotest) startup", () => {
  it(
    "8. a REAL Electron subprocess launches with Device Trust + the Device Sync Scheduler enabled and exits cleanly, with no behavior change to the ordinary (non-autotest) startup path",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-device-sync-electron-plain-"));
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
        setTimeout(() => resolve(!exited), 8000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      expect(stayedAlive, `process exited early; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput).toMatch(/fedos-badge: host started/);
      expect(combinedOutput).not.toMatch(/startup failed/);
      // The ordinary (non-AUTOTEST) path never runs the double-startup check or either selftest.
      expect(combinedOutput).not.toMatch(/double-startup-idempotent/);
      expect(combinedOutput).not.toMatch(/FEDOS_DEVICE_SYNC_TEST:/);

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
});

describe("Alpha 4501-4580 -- Device Sync Electron integration: AUTOTEST -- double startup, Device Sync scenarios, double shutdown", () => {
  it(
    "9. FEDOS_ELECTRON_BADGE_AUTOTEST=1 proves idempotent double-startup, runs every real Device Sync scenario against the real Scheduler/Boundary/Coordinators, then proves idempotent double-shutdown",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-device-sync-electron-autotest-"));
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
        setTimeout(() => resolve(false), 40000);
      });
      const combinedOutput = Buffer.concat(outChunks).toString("utf8");
      spawnedElectronPid = undefined;
      rmSync(dataDir, { recursive: true, force: true });

      expect(exitedOnItsOwn, `expected the self-test to shut down cleanly on its own; output:\n${combinedOutput}`).toBe(true);
      expect(combinedOutput).toMatch(/fedos-badge: host started/);

      // Phase C "double startup" -- proven, not merely asserted-by-absence-of-crash: the SAME real
      // Coordinator/Wiring/Bridge object references survived the second `startBadgeHost()` call.
      expect(combinedOutput).toMatch(/fedos-badge: double-startup-idempotent=true/);

      // The pre-existing Alpha 4341-4420 selftest still runs and completes, unmodified by this Arc.
      expect(combinedOutput).toMatch(/FEDOS_BADGE_TEST:done/);

      // This Arc's own Device Sync selftest -- parse every marker line.
      const deviceSyncLines = combinedOutput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("FEDOS_DEVICE_SYNC_TEST:") && line !== "FEDOS_DEVICE_SYNC_TEST:done")
        .map((line) => JSON.parse(line.slice("FEDOS_DEVICE_SYNC_TEST:".length)) as { step: string; result: unknown });
      const steps = deviceSyncLines.map((m) => m.step);
      const expectedSteps = [
        "scheduler-enabled",
        "resume-sync",
        "trigger-now-zero-targets",
        "event-routing",
        "device-connectivity-routing",
        "pause-sync",
      ];
      for (const step of expectedSteps) {
        expect(steps, `missing Device Sync selftest step "${step}"; output:\n${combinedOutput}`).toContain(step);
      }
      expect(combinedOutput).toMatch(/FEDOS_DEVICE_SYNC_TEST:done/);
      // This Arc's own Device Sync marker line is strictly AFTER the pre-existing badge selftest's
      // own "done" -- the two self-tests run in sequence, never interleaved.
      expect(combinedOutput.indexOf("FEDOS_DEVICE_SYNC_TEST:done")).toBeGreaterThan(combinedOutput.indexOf("FEDOS_BADGE_TEST:done"));

      // "scheduler-enabled" -- the real Boundary reports the real Scheduler as constructed
      // (`enabled: true`), never a fabricated flag (this Arc's own core, honest claim).
      const schedulerEnabledResult = deviceSyncLines.find((m) => m.step === "scheduler-enabled")?.result as {
        status: string;
        data?: { enabled: boolean };
      };
      expect(schedulerEnabledResult.status).toBe("loaded");
      expect(schedulerEnabledResult.data?.enabled).toBe(true);

      // "resume-sync" -- the real, previously-inert TrayCoordinator action is now genuinely
      // functional (ok outcome, never "unsupported"/"unavailable").
      const resumeSyncResult = deviceSyncLines.find((m) => m.step === "resume-sync")?.result as { outcome: string };
      expect(resumeSyncResult.outcome).toBe("ok");

      // "trigger-now-zero-targets" -- a real, honest Scheduler tick with zero eligible targets (see
      // this Arc's own disclosed Phase A finding). `FedosDesktopDeviceSyncStatusViewModel.triggerNow()`
      // returns its own refreshed STATUS view (the tick array itself lives on that ViewModel's
      // separate `lastTickState` getter, not threaded through this file's own narrow
      // `DeviceSyncStatusViewModelLike.triggerNow()` return type) -- `scheduleCount`/`pendingCount`
      // both `0` is this real tick's own honest, zero-target proof.
      const triggerNowResult = deviceSyncLines.find((m) => m.step === "trigger-now-zero-targets")?.result as {
        status: string;
        data?: { enabled: boolean; running: boolean; scheduleCount: number; pendingCount: number };
      };
      expect(triggerNowResult.status).toBe("loaded");
      expect(triggerNowResult.data?.enabled).toBe(true);
      expect(triggerNowResult.data?.scheduleCount).toBe(0);
      expect(triggerNowResult.data?.pendingCount).toBe(0);

      // "event-routing" -- a hand-built "sync-started" then "sync-completed" event, driven directly
      // through `wiring.handleEvent()`, produces a real tray transition (Synchronizing -> Idle), a
      // real notification delivery, and a real badge refresh -- through the SAME live Coordinators
      // this real process constructed at startup.
      const eventRoutingResult = deviceSyncLines.find((m) => m.step === "event-routing")?.result as {
        trayAfterStarted: string;
        trayAfterCompleted: string;
        notificationDelta: number;
        badgeRenderDelta: number;
      };
      expect(eventRoutingResult.trayAfterStarted).toBe("Synchronizing");
      expect(eventRoutingResult.trayAfterCompleted).toBe("Idle");
      expect(eventRoutingResult.notificationDelta).toBeGreaterThanOrEqual(1);
      expect(eventRoutingResult.badgeRenderDelta).toBeGreaterThanOrEqual(1);

      // "device-connectivity-routing" -- the SAME real routing for the connectivity vocabulary. The
      // Bridge's own `isTargetBelievedOffline()` stays honestly `false` throughout -- it is
      // populated only by the Bridge's own real `wrapAttemptFn()` observation, never by a
      // hand-fed Wiring event (this selftest's own disclosed technique) -- proving genuine
      // isolation between the two, not a bug.
      const connectivityResult = deviceSyncLines.find((m) => m.step === "device-connectivity-routing")?.result as {
        trayOffline: string;
        bridgeBelievesOfflineFromUnrelatedHandFedEvent: boolean;
        trayOnline: string;
      };
      expect(connectivityResult.trayOffline).toBe("Disconnected");
      expect(connectivityResult.bridgeBelievesOfflineFromUnrelatedHandFedEvent).toBe(false);
      expect(connectivityResult.trayOnline).toBe("Idle");

      // "pause-sync" -- the real, previously-inert TrayCoordinator action stops the real Scheduler
      // cleanly, before this process's own overall shutdown.
      const pauseSyncResult = deviceSyncLines.find((m) => m.step === "pause-sync")?.result as { outcome: string };
      expect(pauseSyncResult.outcome).toBe("ok");

      // Phase C "double shutdown" -- "shutdown clean" appears EXACTLY once, even though
      // `performCleanShutdown()` is called twice (see `fedos_electron_badge_main.cts`'s own
      // AUTOTEST `finally` block) -- the second call is a real, logged, idempotent no-op.
      const shutdownCleanOccurrences = combinedOutput.split("fedos-badge: shutdown clean").length - 1;
      expect(shutdownCleanOccurrences).toBe(1);
      expect(combinedOutput).toMatch(/performCleanShutdown\(\) called again after shutdown already began -- ignored/);
    },
    45000,
  );
});

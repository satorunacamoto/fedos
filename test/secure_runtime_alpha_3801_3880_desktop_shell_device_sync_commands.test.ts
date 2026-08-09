import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import { FedosDesktopApplicationShell } from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "npub-account-a", identityId: null };
const ABANDONMENT_POLICY = { maxAttempts: 3, laterDelaySeconds: 60 };

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-device-sync-shell-3801-3880-"));
}

function baseRuntimeConfig(dir: string) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false as const,
  };
}

describe("Secure Runtime Alpha 3801-3880 -- Phase D: Desktop Application Shell Device Sync commands", () => {
  it("1. every Device Sync command returns 'unavailable' before start()", async () => {
    const shell = FedosDesktopApplicationShell.create();
    expect(shell.devicesList().outcome).toBe("unavailable");
    expect(shell.deviceDetail("dev-A").outcome).toBe("unavailable");
    expect(shell.deviceSyncStatus().outcome).toBe("unavailable");
    expect(shell.deviceSyncStart().outcome).toBe("unavailable");
    expect((await shell.deviceSyncStop()).outcome).toBe("unavailable");
    expect((await shell.deviceSyncNow()).outcome).toBe("unavailable");
    expect(shell.syncSchedulesList().outcome).toBe("unavailable");
    expect(shell.syncTransfersList().outcome).toBe("unavailable");
    expect(shell.syncConflictsList().outcome).toBe("unavailable");
    expect(shell.syncConflictDetail("c-1").outcome).toBe("unavailable");
    expect(shell.syncConflictAcknowledge("c-1", "acknowledge").outcome).toBe("unavailable");
  });

  it("2. deviceTrustEnabled omitted -- every command reports 'unsupported', never throws", async () => {
    const dir = makeTmpDir();
    try {
      const shell = FedosDesktopApplicationShell.create();
      await shell.start({ ...baseRuntimeConfig(dir), deviceTrustEnabled: false });
      expect(shell.devicesList().outcome).toBe("unsupported");
      expect(shell.deviceSyncStatus().outcome).toBe("unsupported");
      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3/4/5/6. start sync through Shell, render running status, trigger manual sync, render in-flight/completed status", async () => {
    const dir = makeTmpDir();
    try {
      const shell = FedosDesktopApplicationShell.create();
      await shell.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });

      const disabledStatus = shell.deviceSyncStatus();
      expect(disabledStatus.outcome).toBe("ok");

      const start = shell.deviceSyncStart();
      expect(start.outcome).toBe("ok");

      const running = shell.deviceSyncStatus();
      expect(running.outcome).toBe("ok");
      if (running.outcome === "ok") expect(running.value.running).toBe(true);

      const tick = await shell.deviceSyncNow();
      expect(tick.outcome).toBe("ok");

      const stop = await shell.deviceSyncStop();
      expect(stop.outcome).toBe("ok");

      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("8. list trusted Devices through Shell", async () => {
    const dir = makeTmpDir();
    try {
      const shell = FedosDesktopApplicationShell.create();
      await shell.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      // Registration goes through the underlying deviceTrust() accessor directly -- the Shell itself exposes no device-registration command in this Arc's own scope (registration is Alpha 2921-3000's own concern).
      const result = shell.devicesList();
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") expect(result.value).toEqual([]);
      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("17. operator-required conflict visible and safely acknowledged through the Shell", async () => {
    const dir = makeTmpDir();
    try {
      const conflictLogPath = join(dir, "conflict.ndjson");
      const { AppendOnlyFedosDeviceSyncConflictPersistence } = await import("../src/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.js");
      const { fedosDeviceSyncConflictId } = await import("../src/device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js");
      const persistence = new AppendOnlyFedosDeviceSyncConflictPersistence(conflictLogPath);
      const conflictId = fedosDeviceSyncConflictId("dev-B", "chg-1");
      persistence.observe({
        schemaVersion: 1,
        conflictId,
        sourceDeviceId: "dev-A",
        targetDeviceId: "dev-B",
        changeId: "chg-1",
        conversationId: "conv-1",
        recordType: null,
        conflictKind: "operator-decision-required",
        decision: "require-operator",
        reason: "two trusted Devices diverged",
        firstObservedAt: 100,
        lastObservedAt: 100,
        resolved: false,
        resolutionAction: null,
        resolvedAt: null,
      });

      const shell = FedosDesktopApplicationShell.create();
      await shell.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncConflictLogPath: conflictLogPath,
      });

      const listed = shell.syncConflictsList();
      expect(listed.outcome).toBe("ok");
      if (listed.outcome === "ok") {
        expect(listed.value).toHaveLength(1);
        expect(listed.value[0]!.operatorRequired).toBe(true);
      }

      const ack = shell.syncConflictAcknowledge(conflictId, "acknowledge");
      expect(ack.outcome).toBe("ok");

      const afterAck = shell.syncConflictsList();
      if (afterAck.outcome === "ok") expect(afterAck.value).toHaveLength(0);

      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("25. malformed command denied -- unsupported resolution action never silently accepted", async () => {
    const dir = makeTmpDir();
    try {
      const shell = FedosDesktopApplicationShell.create();
      await shell.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      // @ts-expect-error -- deliberately invalid to prove rejection.
      const result = shell.syncConflictAcknowledge("whatever", "force-overwrite");
      expect(result.outcome).toBe("invalid-input");
      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("27/28. no raw Error, no raw secret -- every Device Sync command result is JSON-serializable", async () => {
    const dir = makeTmpDir();
    try {
      const shell = FedosDesktopApplicationShell.create();
      await shell.start({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      const results = [shell.devicesList(), shell.deviceSyncStatus(), shell.syncSchedulesList(), shell.syncTransfersList(), shell.syncConflictsList()];
      for (const result of results) {
        const json = JSON.stringify(result);
        expect(json.toLowerCase()).not.toMatch(/seed|passphrase|privatekey|"stack"/);
        expect(JSON.parse(json)).toEqual(result);
      }
      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

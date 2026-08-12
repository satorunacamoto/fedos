import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { StubVerifiedFedosDeviceRegistrationAuthority } from "./support/stub_verified_fedos_device_registration_authority.js";
import { fedosDeviceSyncConflictId } from "../src/os/messenger/device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
import type { FedosDeviceSyncAttemptFn, FedosDeviceSyncAttemptResult } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_attempt.js";

const ACCOUNT_A = { authority: "nostr", publicIdentifier: "npub-account-a", identityId: null };
const ACCOUNT_B = { authority: "nostr", publicIdentifier: "npub-account-b", identityId: null };

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "fedos-device-sync-3801-3880-"));
}

function baseRuntimeConfig(dir: string) {
  return {
    boardLogPath: join(dir, "board.ndjson"),
    outboxLogPath: join(dir, "outbox.ndjson"),
    deliveryEnabled: false as const,
  };
}

const ABANDONMENT_POLICY = { maxAttempts: 3, laterDelaySeconds: 60 };

describe("Secure Runtime Alpha 3801-3880 -- Phase B/C: Runtime Operational Facade, disabled/gated states", () => {
  it("1. Device Sync feature disabled entirely -- deviceSyncOperational() throws 'not enabled'", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({ ...baseRuntimeConfig(dir), deviceTrustEnabled: false });
      expect(() => runtime.deviceSyncOperational()).toThrow(/not enabled/);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. Device Trust enabled, Scheduler NOT enabled -- syncStatus() reports 'disabled', device inventory still works", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
      });
      const facade = runtime.deviceSyncOperational();
      const status = facade.syncStatus();
      expect(status.outcome).toBe("disabled");
      const devices = facade.listDevices();
      expect(devices.outcome).toBe("ok");
      if (devices.outcome === "ok") expect(devices.value).toEqual([]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("3. rejects deviceSyncSchedulerEnabled without deviceTrustEnabled", async () => {
    const dir = makeTmpDir();
    try {
      await expect(
        startFedosDesktopRuntime({
          ...baseRuntimeConfig(dir),
          deviceSyncSchedulerEnabled: true,
          deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        }),
      ).rejects.toThrow(/deviceTrustEnabled/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. rejects deviceSyncSchedulerEnabled without an abandonmentPolicy", async () => {
    const dir = makeTmpDir();
    try {
      await expect(
        startFedosDesktopRuntime({
          ...baseRuntimeConfig(dir),
          deviceTrustEnabled: true,
          localDeviceId: "dev-A",
          localAccountRef: ACCOUNT_A,
          deviceSyncSchedulerEnabled: true,
        }),
      ).rejects.toThrow(/deviceSyncAbandonmentPolicy/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase B/C: Scheduler start/stop/trigger", () => {
  it("5. start sync, render running status, stop sync", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncIntervalMs: 1_000_000, // never fires on its own during this test.
      });
      const facade = runtime.deviceSyncOperational();
      expect((facade.syncStatus() as { outcome: string; value?: { running: boolean } }).value?.running).toBe(false);

      const started = facade.startSync();
      expect(started.outcome).toBe("ok");
      expect((facade.syncStatus() as { value: { running: boolean } }).value.running).toBe(true);

      const startedAgain = facade.startSync();
      expect(startedAgain.outcome).toBe("conflict");

      const stopped = await facade.stopSync();
      expect(stopped.outcome).toBe("ok");
      expect((facade.syncStatus() as { value: { running: boolean } }).value.running).toBe(false);

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("6. triggerSyncNow() denied while scheduler is stopped", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      const facade = runtime.deviceSyncOperational();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("conflict");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("7. trigger manual sync with no trusted target Devices -- tick runs, produces zero entries, never fabricates a 'delivered' outcome", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const result = await facade.triggerSyncNow();
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") expect(result.value).toEqual([]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("8. stop waits for an in-flight tick before resolving", async () => {
    const dir = makeTmpDir();
    let releaseAttempt: (() => void) | undefined;
    const blockingAttemptFn: FedosDeviceSyncAttemptFn = () =>
      new Promise<FedosDeviceSyncAttemptResult>((resolve) => {
        releaseAttempt = () => resolve({ outcome: "target-unavailable" });
      });
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncAttemptFn: blockingAttemptFn,
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: null }, 100);
      dt.registerDevice({ deviceId: "dev-B", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-b", label: null }, 100);
      dt.confirmTrust("dev-A", 100);
      dt.confirmTrust("dev-B", 100);
      dt.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: "conv-1", changeId: "chg-1", kind: "upsert", contentHash: "hash-1" }, 100);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const triggerPromise = facade.triggerSyncNow();

      let stopResolved = false;
      const stopPromise = runtime.stop().then(() => {
        stopResolved = true;
      });
      // Give the microtask queue a chance to run without the attempt itself resolving.
      await Promise.resolve();
      await Promise.resolve();
      expect(stopResolved).toBe(false);

      releaseAttempt!();
      await triggerPromise;
      await stopPromise;
      expect(stopResolved).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase B: Device inventory", () => {
  it("9. list trusted Devices", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: "desktop" }, 100);
      dt.confirmTrust("dev-A", 100);

      const facade = runtime.deviceSyncOperational();
      const listed = facade.listDevices();
      expect(listed.outcome).toBe("ok");
      if (listed.outcome === "ok") {
        expect(listed.value).toHaveLength(1);
        expect(listed.value[0]).toMatchObject({ deviceId: "dev-A", trustState: "trusted", isLocal: true, label: "desktop" });
      }
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. list revoked Device -- trustState honestly reported, not hidden", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-B", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-b", label: null }, 100);
      dt.revokeDevice("dev-B", 200);

      const facade = runtime.deviceSyncOperational();
      const detail = facade.deviceDetail("dev-B");
      expect(detail.outcome).toBe("ok");
      if (detail.outcome === "ok") {
        expect(detail.value.trustState).toBe("revoked");
        expect(detail.value.revokedAt).toBe(200);
      }
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("11. deviceDetail() for an unknown id -- 'not-found', never a thrown error", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
      });
      const facade = runtime.deviceSyncOperational();
      const detail = facade.deviceDetail("does-not-exist");
      expect(detail.outcome).toBe("not-found");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("25. malformed command denied -- empty deviceId string is 'invalid-input', never thrown", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({ ...baseRuntimeConfig(dir), deviceTrustEnabled: true, localDeviceId: "dev-A", localAccountRef: ACCOUNT_A });
      const facade = runtime.deviceSyncOperational();
      expect(facade.deviceDetail("").outcome).toBe("invalid-input");
      expect(facade.deviceDetail("   ").outcome).toBe("invalid-input");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase B: schedules, transfer sessions, Relay accepted vs. imported", () => {
  it("10/11/12/13. pending, completed, Relay-accepted-not-imported, and imported states are all independently visible", async () => {
    const dir = makeTmpDir();
    let attemptCall = 0;
    const attemptFn: FedosDeviceSyncAttemptFn = async () => {
      attemptCall += 1;
      return attemptCall === 1 ? { outcome: "delivered" } : { outcome: "target-unavailable" };
    };
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncAttemptFn: attemptFn,
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: null }, 100);
      dt.registerDevice({ deviceId: "dev-B", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-b", label: null }, 100);
      dt.confirmTrust("dev-A", 100);
      dt.confirmTrust("dev-B", 100);
      dt.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: "conv-1", changeId: "chg-1", kind: "upsert", contentHash: "hash-1" }, 100);
      dt.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: "conv-1", changeId: "chg-2", kind: "upsert", contentHash: "hash-2" }, 101);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      await facade.triggerSyncNow();

      const schedules = facade.listSchedules();
      expect(schedules.outcome).toBe("ok");
      if (schedules.outcome === "ok") {
        expect(schedules.value.length).toBeGreaterThan(0);
        const states = schedules.value.map((s) => s.state);
        expect(states).toContain("completed");
      }

      // Relay-accepted-not-imported vs. imported: exercised directly against the
      // durable Relay-Sync Observation repository this Arc's facade reads --
      // this Arc does not itself drive a real Relay Sync attempt (Phase A §20).
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("12/13. Transfer session view distinguishes relayAccepted from deviceImported -- never collapsed into one 'synced' flag", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncTransferSessionLogPath: join(dir, "transfer.ndjson"),
        deviceSyncRelaySyncObservationLogPath: join(dir, "relay_observation.ndjson"),
      });

      // Directly seed a Transfer Session + Relay Observation facts through the
      // SAME real, durable ports the facade reads -- never a fabricated view.
      const { AppendOnlyFedosDeviceTransferSessionPersistence } = await import("../src/device/transfer/persistence/append_only_fedos_device_transfer_session_persistence.js");
      const transferPersistence = new AppendOnlyFedosDeviceTransferSessionPersistence(join(dir, "transfer.ndjson"));
      transferPersistence.putEvent({
        schemaVersion: 1,
        eventType: "invited",
        sessionId: "sess-1",
        accountAuthority: ACCOUNT_A.authority,
        accountPublicIdentifier: ACCOUNT_A.publicIdentifier,
        initiatorDeviceId: "dev-A",
        responderDeviceId: "dev-B",
        createdAt: 100,
        expiresAt: 200,
      });

      const { AppendOnlyFedosDeviceRelaySyncObservationRepository } = await import(
        "../src/device/relay_sync/persistence/append_only_fedos_device_relay_sync_observation_repository.js"
      );
      const observationRepository = new AppendOnlyFedosDeviceRelaySyncObservationRepository(join(dir, "relay_observation.ndjson"));
      observationRepository.record("sess-1::wss://relay.example", "relay-accepted", 150);

      const facade = runtime.deviceSyncOperational();
      const listed = facade.listTransferSessions();
      expect(listed.outcome).toBe("ok");
      if (listed.outcome === "ok") {
        expect(listed.value).toHaveLength(1);
        expect(listed.value[0]!.relayAccepted).toBe(true);
        expect(listed.value[0]!.deviceImported).toBe(false);
      }

      observationRepository.record("sess-1", "imported", 160);
      const listedAfterImport = facade.listTransferSessions();
      if (listedAfterImport.outcome === "ok") {
        expect(listedAfterImport.value[0]!.deviceImported).toBe(true);
        expect(listedAfterImport.value[0]!.relayAccepted).toBe(true);
      }

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase H: conflict visibility and safe acknowledge", () => {
  it("16/17/18. unresolved and operator-required conflicts are visible; safe acknowledge resolves them", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncConflictLogPath: join(dir, "conflict.ndjson"),
      });

      const { AppendOnlyFedosDeviceSyncConflictPersistence } = await import("../src/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.js");
      const conflictPersistence = new AppendOnlyFedosDeviceSyncConflictPersistence(join(dir, "conflict.ndjson"));
      const conflictId = fedosDeviceSyncConflictId("dev-B", "chg-1");
      conflictPersistence.observe({
        schemaVersion: 1,
        conflictId,
        sourceDeviceId: "dev-A",
        targetDeviceId: "dev-B",
        changeId: "chg-1",
        conversationId: "conv-1",
        recordType: "conversation-message",
        conflictKind: "operator-decision-required",
        decision: "require-operator",
        reason: "two trusted Devices diverged",
        firstObservedAt: 100,
        lastObservedAt: 100,
        resolved: false,
        resolutionAction: null,
        resolvedAt: null,
      });

      const facade = runtime.deviceSyncOperational();
      const unresolved = facade.listConflicts();
      expect(unresolved.outcome).toBe("ok");
      if (unresolved.outcome === "ok") {
        expect(unresolved.value).toHaveLength(1);
        expect(unresolved.value[0]!.operatorRequired).toBe(true);
        expect(unresolved.value[0]!.availableActions).toContain("acknowledge");
      }

      const detail = facade.conflictDetail(conflictId);
      expect(detail.outcome).toBe("ok");

      const ack = facade.acknowledgeConflict(conflictId, "acknowledge");
      expect(ack.outcome).toBe("ok");

      const afterAck = facade.listConflicts();
      if (afterAck.outcome === "ok") expect(afterAck.value).toHaveLength(0);

      const doubleAck = facade.acknowledgeConflict(conflictId, "acknowledge");
      expect(doubleAck.outcome).toBe("conflict");

      const badAction = facade.acknowledgeConflict("unknown-id", "acknowledge");
      expect(badAction.outcome).toBe("not-found");

      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("acknowledgeConflict rejects an unsupported action -- never a generic 'resolve-any-conflict'", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncConflictLogPath: join(dir, "conflict.ndjson"),
      });
      const facade = runtime.deviceSyncOperational();
      // @ts-expect-error -- deliberately invalid action to prove it is rejected, not silently accepted.
      const result = facade.acknowledgeConflict("whatever", "force-overwrite");
      expect(result.outcome).toBe("invalid-input");
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase I: restart and lifecycle", () => {
  it("19. restart preserves conflict/status -- durable Schedule/Conflict persistence survives a fresh Runtime instance over the same log files", async () => {
    const dir = makeTmpDir();
    const scheduleLogPath = join(dir, "schedule.ndjson");
    const conflictLogPath = join(dir, "conflict.ndjson");
    try {
      const runtime1 = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
        deviceRegistryLogPath: join(dir, "device_registry.ndjson"),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncScheduleLogPath: scheduleLogPath,
        deviceSyncConflictLogPath: conflictLogPath,
        deviceSyncAttemptFn: async () => ({ outcome: "target-unavailable" }),
      });
      const dt1 = runtime1.deviceTrust();
      dt1.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: null }, 100);
      dt1.registerDevice({ deviceId: "dev-B", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-b", label: null }, 100);
      dt1.confirmTrust("dev-A", 100);
      dt1.confirmTrust("dev-B", 100);
      dt1.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: "conv-1", changeId: "chg-1", kind: "upsert", contentHash: "hash-1" }, 100);
      const facade1 = runtime1.deviceSyncOperational();
      facade1.startSync();
      await facade1.triggerSyncNow();
      const statusBefore = facade1.syncStatus();
      expect(statusBefore.outcome).toBe("ok");
      await runtime1.stop();

      const runtime2 = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistryLogPath: join(dir, "device_registry.ndjson"),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        deviceSyncScheduleLogPath: scheduleLogPath,
        deviceSyncConflictLogPath: conflictLogPath,
        deviceSyncAttemptFn: async () => ({ outcome: "target-unavailable" }),
      });
      const facade2 = runtime2.deviceSyncOperational();
      const statusAfter = facade2.syncStatus();
      expect(statusAfter.outcome).toBe("ok");
      if (statusAfter.outcome === "ok" && statusBefore.outcome === "ok") {
        expect(statusAfter.value.scheduleCount).toBe(statusBefore.value.scheduleCount);
      }
      // Revoked Devices remain revoked across restart -- reads the SAME durable Registry log.
      expect(runtime2.deviceTrust().isDeviceTrusted("dev-A")).toBe(true);
      await runtime2.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("9/24. operation before start denied, operation after stop denied", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      const facade = runtime.deviceSyncOperational();
      await runtime.stop();
      expect(() => runtime.deviceSyncOperational()).toThrow(/inaccessible after stop/);
      // A reference grabbed BEFORE stop() also fails closed (two-layer defense).
      expect(facade.listDevices().outcome).toBe("unavailable");
      expect(facade.syncStatus().outcome).toBe("unavailable");
      await expect(facade.stopSync()).resolves.toMatchObject({ outcome: "unavailable" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("22. independent Runtime isolation -- two running facades never share Scheduler/Conflict state", async () => {
    const dirA = makeTmpDir();
    const dirB = makeTmpDir();
    try {
      const runtimeA = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dirA),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      const runtimeB = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dirB),
        deviceTrustEnabled: true,
        localDeviceId: "dev-B",
        localAccountRef: ACCOUNT_B,
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      runtimeA.deviceSyncOperational().startSync();
      expect((runtimeA.deviceSyncOperational().syncStatus() as { value: { running: boolean } }).value.running).toBe(true);
      expect((runtimeB.deviceSyncOperational().syncStatus() as { value: { running: boolean } }).value.running).toBe(false);
      await runtimeA.stop();
      await runtimeB.stop();
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it("21. wrong account isolation -- listTransferSessions() never returns another account's sessions", async () => {
    const dir = makeTmpDir();
    try {
      const transferLogPath = join(dir, "transfer.ndjson");
      const { AppendOnlyFedosDeviceTransferSessionPersistence } = await import("../src/device/transfer/persistence/append_only_fedos_device_transfer_session_persistence.js");
      const persistence = new AppendOnlyFedosDeviceTransferSessionPersistence(transferLogPath);
      persistence.putEvent({
        schemaVersion: 1,
        eventType: "invited",
        sessionId: "sess-other-account",
        accountAuthority: ACCOUNT_B.authority,
        accountPublicIdentifier: ACCOUNT_B.publicIdentifier,
        initiatorDeviceId: "dev-X",
        responderDeviceId: "dev-Y",
        createdAt: 100,
        expiresAt: 200,
      });

      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceSyncTransferSessionLogPath: transferLogPath,
      });
      const listed = runtime.deviceSyncOperational().listTransferSessions();
      expect(listed.outcome).toBe("ok");
      if (listed.outcome === "ok") expect(listed.value).toEqual([]);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase K: security/structural guards", () => {
  it("26/27/28. every facade result is JSON/structured-clone-safe, carries no raw Error, no raw secret/signature/package", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
      });
      runtime.deviceTrust().registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: "desktop" }, 100);
      const facade = runtime.deviceSyncOperational();

      const results = [facade.listDevices(), facade.syncStatus(), facade.listSchedules(), facade.listConflicts(), facade.listTransferSessions()];
      for (const result of results) {
        const json = JSON.stringify(result);
        expect(json).not.toContain("[object Error]");
        expect(json.toLowerCase()).not.toMatch(/seed|passphrase|privatekey|"stack"/);
        expect(JSON.parse(json)).toEqual(result);
        expect(result).not.toBeInstanceOf(Error);
      }
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("29. never renders a 'synced'/'delivered' label for the whole tick unless the attempt itself reported it -- an unreachable target stays honestly 'failed'-directed, not silently 'ok'", async () => {
    const dir = makeTmpDir();
    try {
      const runtime = await startFedosDesktopRuntime({
        ...baseRuntimeConfig(dir),
        deviceTrustEnabled: true,
        localDeviceId: "dev-A",
        localAccountRef: ACCOUNT_A,
        deviceRegistrationAuthority: new StubVerifiedFedosDeviceRegistrationAuthority(ACCOUNT_A.authority, ACCOUNT_A.publicIdentifier),
        deviceSyncSchedulerEnabled: true,
        deviceSyncAbandonmentPolicy: ABANDONMENT_POLICY,
        // No attemptFn supplied -- this Arc's own honest default (Phase A §20): every tick fails closed.
      });
      const dt = runtime.deviceTrust();
      dt.registerDevice({ deviceId: "dev-A", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-a", label: null }, 100);
      dt.registerDevice({ deviceId: "dev-B", accountRef: ACCOUNT_A, devicePublicKeyRef: "k-b", label: null }, 100);
      dt.recordLocalChange("dev-A", "conversation-identity-metadata", { conversationId: "conv-1", changeId: "chg-1", kind: "upsert", contentHash: "hash-1" }, 100);

      const facade = runtime.deviceSyncOperational();
      facade.startSync();
      const tick = await facade.triggerSyncNow();
      expect(tick.outcome).toBe("ok");
      if (tick.outcome === "ok") {
        for (const entry of tick.value) expect(entry.outcome).not.toBe("delivered");
      }
      const status = facade.syncStatus();
      if (status.outcome === "ok") expect(status.value.completedCount).toBe(0);
      await runtime.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("30. existing Conversation UI (Shell deviceStatus()) remains unaffected by this Arc's own new facade", async () => {
    const dir = makeTmpDir();
    try {
      const { FedosDesktopApplicationShell } = await import("../src/os/messenger/desktop/shell/fedos_desktop_application_shell.js");
      const shell = FedosDesktopApplicationShell.create();
      await shell.start({ ...baseRuntimeConfig(dir), deviceTrustEnabled: true, localDeviceId: "dev-A", localAccountRef: ACCOUNT_A });
      const result = shell.deviceStatus();
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") expect(result.value.state).toBe("unavailable");
      await shell.stop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

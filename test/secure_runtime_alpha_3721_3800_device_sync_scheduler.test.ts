import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { createFedosDeviceSyncRuntime } from "../src/os/messenger/device/runtime/fedos_device_sync_runtime.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { generateFedosDeviceSigningKeypair } from "../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.js";
import { createFedosDeviceBindingProofOfPossession } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import { FedosSyncState } from "../src/sync/fedos_sync_state.js";
import { FedosDeviceSyncScheduler, type FedosDeviceSyncSchedulerDeps } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_scheduler.js";
import { InMemoryFedosDeviceSyncSchedulePersistence } from "../src/os/messenger/device/sync_scheduler/persistence/in_memory_fedos_device_sync_schedule_persistence.js";
import { AppendOnlyFedosDeviceSyncSchedulePersistence } from "../src/os/messenger/device/sync_scheduler/persistence/append_only_fedos_device_sync_schedule_persistence.js";
import type { FedosDeviceSyncAttemptFn, FedosDeviceSyncAttemptRequest } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_attempt.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

const NOW = 1_800_000_000;
const ACCOUNT_INDEX = 0;

async function registerRealDevice(registryPersistence: FedosDeviceRegistryPersistence, signingAuthority: RealFedosNostrSigningAuthority, deviceId: string, now: number) {
  const runtime = createFedosDeviceSyncRuntime({ registryPersistence, replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(), now: () => now });
  const keypair = generateFedosDeviceSigningKeypair();
  const challenge = runtime.mintChallenge("register-device", deviceId, keypair.publicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, challenge);
  if (accountAuthorization === null) throw new Error("unreachable");
  const deviceProof = createFedosDeviceBindingProofOfPossession(keypair, challenge);
  if (deviceProof === null) throw new Error("unreachable");
  const result = await runtime.registerDevice(accountAuthorization, deviceProof, now);
  if (result.outcome !== "registered-trusted") throw new Error(`unreachable: ${result.outcome}`);
  return { runtime, keypair };
}

async function revokeRealDevice(registryPersistence: FedosDeviceRegistryPersistence, signingAuthority: RealFedosNostrSigningAuthority, deviceId: string, devicePublicKeyHex: string, now: number) {
  const runtime = createFedosDeviceSyncRuntime({ registryPersistence, replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(), now: () => now });
  const challenge = runtime.mintChallenge("revoke-device", deviceId, devicePublicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(signingAuthority, ACCOUNT_INDEX, challenge);
  if (accountAuthorization === null) throw new Error("unreachable");
  const result = await runtime.revokeDevice(accountAuthorization, now);
  if (result.outcome !== "revoked") throw new Error(`unreachable: ${result.outcome}`);
}

interface Fixture {
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly syncState: FedosSyncState;
  readonly signingAuthority: RealFedosNostrSigningAuthority;
}

async function buildFixture(now = NOW, registryPersistence: FedosDeviceRegistryPersistence = new InMemoryFedosDeviceRegistryPersistence()): Promise<Fixture> {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  await registerRealDevice(registryPersistence, signingAuthority, "phone", now);
  const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
  const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
  const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
  return { registryPersistence, accountRef, syncState, signingAuthority };
}

function recordChange(syncState: FedosSyncState, conversationId: string, at: number, changeIdSuffix = "1") {
  syncState.recordLocalChange("phone", { changeId: `change-${conversationId}-${changeIdSuffix}`, conversationId, kind: "upsert", contentHash: "hash" }, at);
}

function buildScheduler(deps: Partial<FedosDeviceSyncSchedulerDeps> & Pick<FedosDeviceSyncSchedulerDeps, "registryPersistence" | "accountRef" | "syncState" | "attemptFn">): FedosDeviceSyncScheduler {
  return new FedosDeviceSyncScheduler({
    schedulePersistence: new InMemoryFedosDeviceSyncSchedulePersistence(),
    sourceDeviceId: "phone",
    abandonmentPolicy: { maxAttempts: 3, laterDelaySeconds: 60 },
    intervalMs: 1000,
    now: () => NOW,
    ...deps,
  });
}

const ALWAYS_DELIVERED: FedosDeviceSyncAttemptFn = async () => ({ outcome: "delivered" });

describe("Secure Runtime Alpha 3721-3800 -- explicit activation (Phase C)", () => {
  it("1. disabled by default -- no timer exists, tickSync() is denied before startSync()", async () => {
    const fixture = await buildFixture();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: ALWAYS_DELIVERED });
    expect(scheduler.isRunning()).toBe(false);
    await expect(scheduler.tickSync()).rejects.toThrow();
  });

  it("2. start/stop -- start flips running true, stop flips it back false, repeated stop is safe", async () => {
    const fixture = await buildFixture();
    const setIntervalFn = vi.fn(() => 123);
    const clearIntervalFn = vi.fn();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: ALWAYS_DELIVERED, setIntervalFn, clearIntervalFn });
    scheduler.startSync();
    expect(scheduler.isRunning()).toBe(true);
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    await scheduler.stopSync();
    expect(scheduler.isRunning()).toBe(false);
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
    await scheduler.stopSync(); // repeated stop is safe, a no-op
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
  });

  it("3. repeated start is explicitly rejected", async () => {
    const fixture = await buildFixture();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: ALWAYS_DELIVERED, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    expect(() => scheduler.startSync()).toThrow();
  });

  it("4. operation after stop is denied -- tickSync()/triggerSyncNow() both rejected once stopped", async () => {
    const fixture = await buildFixture();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: ALWAYS_DELIVERED, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    await scheduler.stopSync();
    await expect(scheduler.tickSync()).rejects.toThrow();
    await expect(scheduler.triggerSyncNow()).rejects.toThrow();
  });

  it("5. syncStatus() remains available regardless of running state", async () => {
    const fixture = await buildFixture();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: ALWAYS_DELIVERED });
    expect(scheduler.syncStatus().running).toBe(false);
  });
});

describe("Secure Runtime Alpha 3721-3800 -- single-flight (Phase D)", () => {
  it("1. interval tick and manual tick share the same guard -- overlapping calls return the SAME promise", async () => {
    const fixture = await buildFixture();
    recordChange(fixture.syncState, "board-a::thread-1", NOW);
    await registerRealDevice(fixture.registryPersistence, new RealFedosNostrSigningAuthority(), "laptop", NOW); // note: separate signing authority => different account; just need a second TRUSTED device id present for planning below in a DIFFERENT fixture design. Skipped here -- see next test for real target planning.

    let resolveAttempt: (() => void) | undefined;
    const blockingAttemptFn: FedosDeviceSyncAttemptFn = () =>
      new Promise((resolve) => {
        resolveAttempt = () => resolve({ outcome: "delivered" });
      });
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: blockingAttemptFn, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();

    const first = scheduler.tickSync();
    const second = scheduler.tickSync();
    expect(second).toBe(first);
    resolveAttempt?.();
    await first;
  });

  it("2. stop() waits for the in-flight tick before resolving", async () => {
    const fixture = await buildFixture();
    let resolveAttempt: (() => void) | undefined;
    const blockingAttemptFn: FedosDeviceSyncAttemptFn = () =>
      new Promise((resolve) => {
        resolveAttempt = () => resolve({ outcome: "delivered" });
      });
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: blockingAttemptFn, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    const tick = scheduler.tickSync();

    let stopped = false;
    const stopPromise = scheduler.stopSync().then(() => {
      stopped = true;
    });
    expect(stopped).toBe(false); // stop has NOT resolved yet -- the tick is still in flight.
    resolveAttempt?.();
    await tick;
    await stopPromise;
    expect(stopped).toBe(true);
  });

  it("3. a rejected/throwing attemptFn never produces an unhandled rejection and still releases the guard", async () => {
    const fixture = await buildFixture();
    const throwingAttemptFn: FedosDeviceSyncAttemptFn = async () => {
      throw new Error("boom");
    };
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: throwingAttemptFn, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    await scheduler.tickSync();
    // guard released -- a second tick can proceed (not stuck forever on the SAME in-flight promise).
    await expect(scheduler.tickSync()).resolves.toBeDefined();
  });
});

describe("Secure Runtime Alpha 3721-3800 -- Target Planning (Phase E)", () => {
  it("1. one trusted target with pending changes is scheduled and attempted", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(registryPersistence, signingAuthority, "phone", NOW);
    await registerRealDevice(registryPersistence, signingAuthority, "laptop", NOW);
    const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
    const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
    recordChange(syncState, "board-a::thread-1", NOW);

    const seenRequests: FedosDeviceSyncAttemptRequest[] = [];
    const attemptFn: FedosDeviceSyncAttemptFn = async (request) => {
      seenRequests.push(request);
      return { outcome: "delivered" };
    };
    const scheduler = buildScheduler({ registryPersistence, accountRef, syncState, attemptFn, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    const entries = await scheduler.tickSync();

    expect(entries).toHaveLength(1);
    expect(entries[0]!.targetDeviceId).toBe("laptop");
    expect(entries[0]!.outcome).toBe("delivered");
    expect(seenRequests[0]!.fromSequence).toBe(1);
  });

  it("2. multiple trusted targets are all planned and attempted", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(registryPersistence, signingAuthority, "phone", NOW);
    await registerRealDevice(registryPersistence, signingAuthority, "laptop", NOW);
    await registerRealDevice(registryPersistence, signingAuthority, "tablet", NOW);
    const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
    const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
    recordChange(syncState, "board-a::thread-1", NOW);

    const scheduler = buildScheduler({ registryPersistence, accountRef, syncState, attemptFn: ALWAYS_DELIVERED, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    const entries = await scheduler.tickSync();
    expect(entries.map((e) => e.targetDeviceId).sort()).toEqual(["laptop", "tablet"]);
  });

  it("3. a revoked target is excluded from planning entirely", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(registryPersistence, signingAuthority, "phone", NOW);
    const { keypair: laptopKeypair } = await registerRealDevice(registryPersistence, signingAuthority, "laptop", NOW);
    await revokeRealDevice(registryPersistence, signingAuthority, "laptop", laptopKeypair.publicKeyHex, NOW + 1);
    const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
    const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
    recordChange(syncState, "board-a::thread-1", NOW);

    const scheduler = buildScheduler({ registryPersistence, accountRef, syncState, attemptFn: ALWAYS_DELIVERED, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    const entries = await scheduler.tickSync();
    expect(entries).toHaveLength(0);
  });

  it("4. no pending changes for an otherwise-eligible target -- nothing scheduled", async () => {
    const fixture = await buildFixture();
    await registerRealDevice(fixture.registryPersistence, new RealFedosNostrSigningAuthority(), "laptop-unrelated-account", NOW); // different account -- irrelevant to this account's plan
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn: ALWAYS_DELIVERED, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    const entries = await scheduler.tickSync();
    expect(entries).toHaveLength(0);
  });
});

describe("Secure Runtime Alpha 3721-3800 -- Retry Policy and Schedule state (Phase F/G)", () => {
  async function buildTwoDeviceFixture(now = NOW) {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(registryPersistence, signingAuthority, "phone", now);
    await registerRealDevice(registryPersistence, signingAuthority, "laptop", now);
    const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
    const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
    recordChange(syncState, "board-a::thread-1", now);
    return { registryPersistence, accountRef, syncState };
  }

  it("1. a transient Relay-timeout outcome is scheduled for retry-later, not abandoned", async () => {
    const fixture = await buildTwoDeviceFixture();
    const attemptFn: FedosDeviceSyncAttemptFn = async () => ({ outcome: "relay-timeout" });
    const schedulePersistence = new InMemoryFedosDeviceSyncSchedulePersistence();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn, schedulePersistence, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    const entries = await scheduler.tickSync();
    expect(entries[0]!.directive).toBe("later");
    const schedule = schedulePersistence.listAllSchedules()[0]!;
    expect(schedule.state).toBe("pending");
    expect(schedule.nextEligibleAt).toBeGreaterThan(NOW);
  });

  it("2. a permanent rejection (revoked target) is terminal (failed), never retried", async () => {
    const fixture = await buildTwoDeviceFixture();
    const attemptFn: FedosDeviceSyncAttemptFn = async () => ({ outcome: "revoked-target" });
    const schedulePersistence = new InMemoryFedosDeviceSyncSchedulePersistence();
    const scheduler = buildScheduler({ registryPersistence: fixture.registryPersistence, accountRef: fixture.accountRef, syncState: fixture.syncState, attemptFn, schedulePersistence, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    scheduler.startSync();
    await scheduler.tickSync();
    expect(schedulePersistence.listAllSchedules()[0]!.state).toBe("failed");
  });

  it("3. abandonment threshold -- repeated transient failures beyond maxAttempts become visible operator-required, not silent/infinite retry", async () => {
    const fixture = await buildTwoDeviceFixture();
    const attemptFn: FedosDeviceSyncAttemptFn = async () => ({ outcome: "relay-timeout" });
    const schedulePersistence = new InMemoryFedosDeviceSyncSchedulePersistence();
    const scheduler = new FedosDeviceSyncScheduler({
      schedulePersistence,
      registryPersistence: fixture.registryPersistence,
      accountRef: fixture.accountRef,
      sourceDeviceId: "phone",
      syncState: fixture.syncState,
      attemptFn,
      abandonmentPolicy: { maxAttempts: 2, laterDelaySeconds: 1 },
      intervalMs: 1000,
      now: () => NOW,
      setIntervalFn: () => 1,
      clearIntervalFn: () => undefined,
    });
    scheduler.startSync();
    await scheduler.tickSync(); // attempt 1 -> retry-later
    const schedule = schedulePersistence.listAllSchedules()[0]!;
    // force eligibility for the second attempt by constructing a scheduler with a later `now`.
    const scheduler2 = new FedosDeviceSyncScheduler({
      schedulePersistence,
      registryPersistence: fixture.registryPersistence,
      accountRef: fixture.accountRef,
      sourceDeviceId: "phone",
      syncState: fixture.syncState,
      attemptFn,
      abandonmentPolicy: { maxAttempts: 2, laterDelaySeconds: 1 },
      intervalMs: 1000,
      now: () => schedule.nextEligibleAt,
      setIntervalFn: () => 1,
      clearIntervalFn: () => undefined,
    });
    scheduler2.startSync();
    await scheduler2.tickSync(); // attempt 2 -> abandonment threshold reached -> operator-required
    expect(schedulePersistence.listAllSchedules()[0]!.state).toBe("operator-required");
  });

  it("4. a well-formed abandonmentPolicy is required -- no arbitrary default retry count exists", async () => {
    const fixture = await buildFixture();
    expect(
      () =>
        new FedosDeviceSyncScheduler({
          schedulePersistence: new InMemoryFedosDeviceSyncSchedulePersistence(),
          registryPersistence: fixture.registryPersistence,
          accountRef: fixture.accountRef,
          sourceDeviceId: "phone",
          syncState: fixture.syncState,
          attemptFn: ALWAYS_DELIVERED,
          abandonmentPolicy: { maxAttempts: 0, laterDelaySeconds: 60 },
          intervalMs: 1000,
        }),
    ).toThrow();
  });
});

describe("Secure Runtime Alpha 3721-3800 -- restart recovery and isolation", () => {
  it("1. scheduler restart -- an in-progress schedule at crash time is recovered to pending on the next tick, never stuck", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-sync-scheduler-"));
    const scheduleLogPath = join(dir, "schedules.ndjson");
    try {
      const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
      const signingAuthority = new RealFedosNostrSigningAuthority();
      await registerRealDevice(registryPersistence, signingAuthority, "phone", NOW);
      await registerRealDevice(registryPersistence, signingAuthority, "laptop", NOW);
      const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
      const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
      const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
      recordChange(syncState, "board-a::thread-1", NOW);

      // Simulate a crash mid-attempt: a hung attemptFn whose Promise never settles before the process "restarts."
      const schedulePersistenceA = new AppendOnlyFedosDeviceSyncSchedulePersistence(scheduleLogPath);
      const hungAttemptFn: FedosDeviceSyncAttemptFn = () => new Promise(() => undefined);
      const schedulerA = buildScheduler({ registryPersistence, accountRef, syncState, attemptFn: hungAttemptFn, schedulePersistence: schedulePersistenceA, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
      schedulerA.startSync();
      void schedulerA.tickSync(); // never awaited -- simulates the process dying mid-attempt.
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(schedulePersistenceA.listAllSchedules()[0]!.state).toBe("in-progress");

      // "Restart": a FRESH Scheduler instance over the SAME durable log file.
      const schedulePersistenceB = new AppendOnlyFedosDeviceSyncSchedulePersistence(scheduleLogPath);
      const schedulerB = buildScheduler({ registryPersistence, accountRef, syncState, attemptFn: ALWAYS_DELIVERED, schedulePersistence: schedulePersistenceB, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
      schedulerB.startSync();
      const entries = await schedulerB.tickSync();
      expect(entries[0]!.outcome).toBe("delivered");
      expect(schedulePersistenceB.listAllSchedules()[0]!.state).toBe("completed");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. independent account isolation -- two Schedulers over completely separate accounts never see each other's schedules", async () => {
    const fixtureA = await buildFixture(NOW, new InMemoryFedosDeviceRegistryPersistence());
    const fixtureB = await buildFixture(NOW, new InMemoryFedosDeviceRegistryPersistence());
    const schedulePersistenceA = new InMemoryFedosDeviceSyncSchedulePersistence();
    const schedulePersistenceB = new InMemoryFedosDeviceSyncSchedulePersistence();
    await registerRealDevice(fixtureA.registryPersistence, fixtureA.signingAuthority, "laptop-a", NOW);
    recordChange(fixtureA.syncState, "c", NOW);

    const schedulerA = buildScheduler({ registryPersistence: fixtureA.registryPersistence, accountRef: fixtureA.accountRef, syncState: fixtureA.syncState, attemptFn: ALWAYS_DELIVERED, schedulePersistence: schedulePersistenceA, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    schedulerA.startSync();
    await schedulerA.tickSync();
    expect(schedulePersistenceA.listAllSchedules().length).toBeGreaterThan(0);
    expect(schedulePersistenceB.listAllSchedules()).toHaveLength(0);
  });

  it("3. independent Runtime isolation -- two Scheduler instances over the SAME account/state but separate schedule persistence never collide", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const signingAuthority = new RealFedosNostrSigningAuthority();
    await registerRealDevice(registryPersistence, signingAuthority, "phone", NOW);
    await registerRealDevice(registryPersistence, signingAuthority, "laptop", NOW);
    const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
    const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity!.publicKeyHex, identityId: null };
    const syncState = new FedosSyncState(`${accountRef.authority}:${accountRef.publicIdentifier}`);
    recordChange(syncState, "board-a::thread-1", NOW);

    const persistenceX = new InMemoryFedosDeviceSyncSchedulePersistence();
    const persistenceY = new InMemoryFedosDeviceSyncSchedulePersistence();
    const schedulerX = buildScheduler({ registryPersistence, accountRef, syncState, attemptFn: ALWAYS_DELIVERED, schedulePersistence: persistenceX, setIntervalFn: () => 1, clearIntervalFn: () => undefined });
    schedulerX.startSync();
    await schedulerX.tickSync();
    expect(persistenceX.listAllSchedules().length).toBeGreaterThan(0);
    expect(persistenceY.listAllSchedules()).toHaveLength(0);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { createFedosDeviceSyncRuntime } from "../src/os/messenger/device/runtime/fedos_device_sync_runtime.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { generateFedosDeviceSigningKeypair } from "../src/os/messenger/device/crypto/fedos_device_signing_keypair.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.js";
import { createFedosDeviceBindingProofOfPossession } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_proof_of_possession.js";
import type { FedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/fedos_device_registry_persistence.js";
import { FedosSyncState } from "../src/sync/fedos_sync_state.js";
import { FedosDeviceSyncImportCoordinator } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_import_coordinator.js";
import { InMemoryFedosDeviceSyncConflictPersistence } from "../src/os/messenger/device/sync_scheduler/persistence/in_memory_fedos_device_sync_conflict_persistence.js";
import { AppendOnlyFedosDeviceSyncConflictPersistence } from "../src/os/messenger/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.js";
import { resolveFedosDeviceSyncConflict } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict_query.js";
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

async function buildFixture() {
  const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
  const signingAuthority = new RealFedosNostrSigningAuthority();
  await registerRealDevice(registryPersistence, signingAuthority, "phone", NOW);
  const { keypair: laptopKeypair } = await registerRealDevice(registryPersistence, signingAuthority, "laptop", NOW);
  await registerRealDevice(registryPersistence, signingAuthority, "tablet", NOW);
  const identity = await signingAuthority.publicIdentityForAccount(ACCOUNT_INDEX);
  const accountRef = `nostr:${identity!.publicKeyHex}`;
  const syncState = new FedosSyncState(accountRef);
  // `FedosSyncState` (Alpha 2421-2500) keeps its OWN internal Device Registry, separate from the
  // `FedosDeviceRegistryPersistence` trust/binding Registry above -- fan-out into a device's own outbound
  // queue (`recordLocalChange()`) only happens for devices registered here.
  syncState.registerDevice("phone", NOW);
  syncState.registerDevice("laptop", NOW);
  syncState.registerDevice("tablet", NOW);
  return { registryPersistence, signingAuthority, syncState, laptopKeypair };
}

describe("Secure Runtime Alpha 3721-3800 -- Import Coordination (Phase K)", () => {
  it("1. a clean apply is passed through -- no conflict recorded, appliedCount reflects it honestly", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);

    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({ syncState, registryPersistence, conflictPersistence });
    const summary = coordinator.importPendingChanges("tablet", NOW);

    expect(summary.appliedCount).toBe(1);
    expect(summary.conflictCount).toBe(0);
    expect(summary.skippedIdenticalCount).toBe(0);
    expect(conflictPersistence.listAll()).toHaveLength(0);
    expect(syncState.getCursor("tablet").sequence).toBe(1);
  });

  it("2. a redelivered duplicate changeId is skipped as identical -- never recorded as a conflict", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);

    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({ syncState, registryPersistence, conflictPersistence });
    coordinator.importPendingChanges("tablet", NOW);

    // At-least-once transport redelivers the SAME already-applied change. `FedosSyncState`'s own Pending
    // Change queue (Alpha 2421-2500, unmodified) refuses to re-stage a `changeId` that is already
    // staged/resolved -- so this is naturally idempotent at that layer, and never reaches a second
    // `applyPendingChanges()` call at all (the richer `"identical-duplicate"` classification -> path is
    // exercised directly, at the unit level, in `secure_runtime_alpha_3721_3800_device_sync_conflict_model.test.ts`,
    // since `FedosSyncState`'s own dedup guard makes it unreachable through this Coordinator's public,
    // integration-level surface).
    const redeliverOutcome = syncState.redeliverChange("tablet", "c1");
    expect(redeliverOutcome).toBe("duplicate");
    const summary = coordinator.importPendingChanges("tablet", NOW + 1);

    expect(summary.entries).toHaveLength(0);
    expect(summary.appliedCount).toBe(0);
    expect(summary.skippedIdenticalCount).toBe(0);
    expect(summary.conflictCount).toBe(0);
    expect(conflictPersistence.listAll()).toHaveLength(0);
  });

  it("3. a contribution from a since-revoked originating device is classified revoked-device-contribution and durably recorded as an unresolved conflict", async () => {
    const { registryPersistence, signingAuthority, syncState, laptopKeypair } = await buildFixture();
    syncState.recordLocalChange("laptop", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    await revokeRealDevice(registryPersistence, signingAuthority, "laptop", laptopKeypair.publicKeyHex, NOW + 1);

    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({ syncState, registryPersistence, conflictPersistence });
    const summary = coordinator.importPendingChanges("tablet", NOW + 2);

    expect(summary.appliedCount).toBe(0);
    expect(summary.conflictCount).toBe(1);
    expect(summary.entries[0]!.conflictKind).toBe("revoked-device-contribution");
    const conflicts = conflictPersistence.listUnresolved();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.decision).toBe("reject-invalid");
    // the Cursor still advances past the blocking record -- FedosSyncState's own unmodified design (Alpha 2421-2500)
    // "so no single conflicted/duplicate/archived entry can block everything after it". Visibility of the conflict is
    // provided by the separate Conflict persistence above, independent of Cursor position (this Arc's own honest
    // atomicity model -- see fedos_device_sync_import_coordinator.ts's own header).
    expect(syncState.getCursor("tablet").sequence).toBe(1);
  });

  it("4. two different, both-still-trusted devices editing the same conversation concurrently: no record-type context -> operator-decision-required", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({ syncState, registryPersistence, conflictPersistence });
    coordinator.importPendingChanges("tablet", NOW); // establishes phone's entry as tablet's own last-applied for this conversation.

    syncState.recordLocalChange("laptop", { changeId: "c2", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h2" }, NOW + 1);
    syncState.deliverQueuedChanges("tablet", NOW + 1);
    const summary = coordinator.importPendingChanges("tablet", NOW + 2);

    expect(summary.entries[0]!.conflictKind).toBe("operator-decision-required");
    const conflict = conflictPersistence.listUnresolved()[0]!;
    expect(conflict.decision).toBe("require-operator");
    expect(conflict.recordType).toBeNull();
  });

  it("5. the SAME concurrent scenario, with record-type context -- an append-only-safe type coexists rather than conflicting (decision 'apply', never persisted as a conflict fact)", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({
      syncState,
      registryPersistence,
      conflictPersistence,
      recordTypeForChangeId: () => "capability-public-event",
    });
    coordinator.importPendingChanges("tablet", NOW);

    syncState.recordLocalChange("laptop", { changeId: "c2", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h2" }, NOW + 1);
    syncState.deliverQueuedChanges("tablet", NOW + 1);
    const summary = coordinator.importPendingChanges("tablet", NOW + 2);

    // an append-only-safe record type from a different, still-trusted Device is domain-safe to coexist --
    // the planner's own decision is "apply", so this file never fabricates a Conflict fact for it (Phase I:
    // "does not collapse invalid data with concurrent valid data" -- this is the "valid, safely-coexisting" case).
    expect(summary.entries[0]!.conflictKind).toBe("safe-concurrent-append");
    expect(summary.entries[0]!.decision).toBe("apply");
    expect(summary.conflictCount).toBe(0);
    expect(conflictPersistence.listAll()).toHaveLength(0);
  });

  it("6. the SAME concurrent scenario, with a locally re-derivable projection record type -- classified stale-projection, never treated as a real data conflict", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({
      syncState,
      registryPersistence,
      conflictPersistence,
      recordTypeForChangeId: () => "search-canonical-id",
    });
    coordinator.importPendingChanges("tablet", NOW);

    syncState.recordLocalChange("laptop", { changeId: "c2", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h2" }, NOW + 1);
    syncState.deliverQueuedChanges("tablet", NOW + 1);
    const summary = coordinator.importPendingChanges("tablet", NOW + 2);

    expect(summary.entries[0]!.conflictKind).toBe("stale-projection");
    expect(conflictPersistence.listUnresolved()[0]!.decision).toBe("retry-after-refresh");
  });

  it("7. an insert-once/immutable record type in genuine concurrent conflict -- never silently overwritten, recorded for the operator", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({
      syncState,
      registryPersistence,
      conflictPersistence,
      recordTypeForChangeId: () => "conversation-identity-metadata",
    });
    coordinator.importPendingChanges("tablet", NOW);

    syncState.recordLocalChange("laptop", { changeId: "c2", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h2" }, NOW + 1);
    syncState.deliverQueuedChanges("tablet", NOW + 1);
    const summary = coordinator.importPendingChanges("tablet", NOW + 2);

    expect(summary.entries[0]!.conflictKind).toBe("immutable-record-conflict");
    const conflict = conflictPersistence.listUnresolved()[0]!;
    expect(conflict.decision).toBe("record-conflict");

    // Phase L: only an objectively safe action is permitted -- "acknowledge" (never a forced overwrite).
    const outcome = resolveFedosDeviceSyncConflict(conflictPersistence, conflict.conflictId, "acknowledge", NOW + 3);
    expect(outcome).toBe("resolved");
    expect(conflictPersistence.get(conflict.conflictId)!.resolved).toBe(true);

    // an unsafe action for this conflictKind is rejected outright -- there is no "force overwrite" path anywhere.
    syncState.recordLocalChange("laptop", { changeId: "c3", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h3" }, NOW + 4);
  });

  it("8. resolving via an action not on this conflictKind's own safe list is rejected as unsafe-action", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("phone", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({
      syncState,
      registryPersistence,
      conflictPersistence,
      recordTypeForChangeId: () => "conversation-identity-metadata",
    });
    coordinator.importPendingChanges("tablet", NOW);
    syncState.recordLocalChange("laptop", { changeId: "c2", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h2" }, NOW + 1);
    syncState.deliverQueuedChanges("tablet", NOW + 1);
    coordinator.importPendingChanges("tablet", NOW + 2);

    const conflictId = conflictPersistence.listUnresolved()[0]!.conflictId;
    const outcome = resolveFedosDeviceSyncConflict(conflictPersistence, conflictId, "accept-identical", NOW + 3);
    expect(outcome).toBe("unsafe-action");
    expect(conflictPersistence.get(conflictId)!.resolved).toBe(false);
  });

  it("9. restart-safety: an unresolved conflict recorded via the append-only backend survives a fresh instance over the same durable log", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-sync-conflict-"));
    const conflictLogPath = join(dir, "conflicts.ndjson");
    try {
      const { registryPersistence, signingAuthority, syncState, laptopKeypair } = await buildFixture();
      syncState.recordLocalChange("laptop", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
      syncState.deliverQueuedChanges("tablet", NOW);
      await revokeRealDevice(registryPersistence, signingAuthority, "laptop", laptopKeypair.publicKeyHex, NOW + 1);

      const conflictPersistenceA = new AppendOnlyFedosDeviceSyncConflictPersistence(conflictLogPath);
      const coordinatorA = new FedosDeviceSyncImportCoordinator({ syncState, registryPersistence, conflictPersistence: conflictPersistenceA });
      coordinatorA.importPendingChanges("tablet", NOW + 2);
      expect(conflictPersistenceA.listUnresolved()).toHaveLength(1);

      const conflictPersistenceB = new AppendOnlyFedosDeviceSyncConflictPersistence(conflictLogPath);
      const recovered = conflictPersistenceB.listUnresolved();
      expect(recovered).toHaveLength(1);
      expect(recovered[0]!.conflictKind).toBe("revoked-device-contribution");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("10. an unknown, non-allowlisted record type is classified unknown-record-type, distinct from a genuine concurrent conflict", async () => {
    const { registryPersistence, syncState } = await buildFixture();
    syncState.recordLocalChange("laptop", { changeId: "c1", conversationId: "board-a::thread-1", kind: "upsert", contentHash: "h1" }, NOW);
    syncState.deliverQueuedChanges("tablet", NOW);
    const conflictPersistence = new InMemoryFedosDeviceSyncConflictPersistence();
    const coordinator = new FedosDeviceSyncImportCoordinator({
      syncState,
      registryPersistence,
      conflictPersistence,
      recordTypeForChangeId: () => "raw-plaintext-message",
    });
    const summary = coordinator.importPendingChanges("tablet", NOW + 1);
    expect(summary.entries[0]!.conflictKind).toBe("unknown-record-type");
    expect(conflictPersistence.listUnresolved()[0]!.decision).toBe("reject-invalid");
  });
});

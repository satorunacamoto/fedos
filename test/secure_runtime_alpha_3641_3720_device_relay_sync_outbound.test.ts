import { describe, it, expect, vi } from "vitest";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { FedosDeviceRelaySyncPublisher, FEDOS_DEVICE_RELAY_SYNC_MAX_RELAYS } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_publisher.js";
import { FedosDeviceRelaySyncOutboundCoordinator } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_outbound_coordinator.js";
import { InMemoryFedosDeviceRelaySyncOutboxPersistence } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_outbox_persistence.js";
import { InMemoryFedosDeviceRelaySyncObservationRepository } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.js";
import { queryFedosDeviceRelaySyncStatusForSession } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_observation.js";
import { FakeDeviceRelaySyncRelay } from "./support/fake_device_relay_sync_relay.js";
import {
  buildDeviceRelaySyncFixture,
  driveDeviceRelaySyncSessionToApproved,
  prepareDeviceRelaySyncSyncSession,
  INITIATOR_DEVICE_ID,
  RESPONDER_DEVICE_ID,
  DEVICE_RELAY_SYNC_BUILD_FIELDS,
  type DeviceRelaySyncFixture,
} from "./support/device_relay_sync_test_fixture.js";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_registry_persistence.js";
import { createFedosDeviceTransferCoordinator } from "../src/os/messenger/device/transfer/fedos_device_transfer_coordinator.js";
import { InMemoryFedosDeviceTransferSessionPersistence } from "../src/os/messenger/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.js";

const NOW = 1_900_000_000;

async function connectedRelay(url: string, okBehavior: "accept" | "reject" | "timeout" = "accept"): Promise<FakeDeviceRelaySyncRelay> {
  const relay = new FakeDeviceRelaySyncRelay(url, okBehavior);
  await relay.connect();
  return relay;
}

function buildCoordinator(fixture: DeviceRelaySyncFixture, relays: FakeDeviceRelaySyncRelay[], timeoutMs = 200) {
  const relaySet = new FedosConversationRelaySet(relays);
  const publisher = new FedosDeviceRelaySyncPublisher(relaySet, timeoutMs);
  const outboxPersistence = new InMemoryFedosDeviceRelaySyncOutboxPersistence();
  const observationRepository = new InMemoryFedosDeviceRelaySyncObservationRepository();
  const coordinator = new FedosDeviceRelaySyncOutboundCoordinator({
    transferCoordinator: fixture.transferCoordinator,
    registryPersistence: fixture.registryPersistence,
    outboxPersistence,
    observationRepository,
    signingAuthority: fixture.signingAuthority,
    publisher,
    encryptionAuthority: fixture.encryptionAuthority,
    now: () => NOW,
  });
  return { coordinator, outboxPersistence, observationRepository, relaySet };
}

describe("Secure Runtime Alpha 3641-3720 -- Outbound Coordinator (Phase D)", () => {
  it("1. two trusted devices, one Relay -- successful publish, per-Relay outcome accepted, Observation shows the full lifecycle", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator, observationRepository } = buildCoordinator(fixture, [relay]);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });

    expect(result.outcome).toBe("published");
    expect(result.relayOutcomes).toEqual([{ relayUrl: relay.url, outcome: "accepted" }]);
    expect(relay.stored).toHaveLength(1);
    expect(relay.stored[0]!.kind).toBe(1);

    const status = queryFedosDeviceRelaySyncStatusForSession(observationRepository, sessionId);
    expect(status.map((f) => f.state)).toEqual(["queued", "publishing", "relay-accepted"]);
  });

  it("2. source-not-trusted -- a never-registered source Device is refused before any Relay is touched", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator } = buildCoordinator(fixture, [relay]);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: "never-registered",
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("source-not-trusted");
    expect(relay.stored).toHaveLength(0);
  });

  it("3. target-not-trusted -- a never-registered target Device is refused", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator } = buildCoordinator(fixture, [relay]);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: "never-registered",
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("target-not-trusted");
  });

  it("4. wrong-account -- a source Device belonging to a DIFFERENT account is refused", async () => {
    const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const transferCoordinator = createFedosDeviceTransferCoordinator({
      sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
      registryPersistence,
      now: () => NOW,
    });
    const fixture = await buildDeviceRelaySyncFixture(NOW, registryPersistence, transferCoordinator);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator } = buildCoordinator(fixture, [relay]);

    const otherAccountRef = { authority: "nostr", publicIdentifier: "ff".repeat(32), identityId: null };
    const result = await coordinator.prepareAndPublish({
      accountRef: otherAccountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("wrong-account");
  });

  it("5. session-not-found -- an unknown transferSessionId is refused", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator } = buildCoordinator(fixture, [relay]);
    const { approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: "no-such-session",
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("session-not-found");
  });

  it("6. session-wrong-state -- a session still 'invited' (never challenged/approved) is refused", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const invited = fixture.transferCoordinator.createInvitation(fixture.accountRef, INITIATOR_DEVICE_ID, RESPONDER_DEVICE_ID, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator } = buildCoordinator(fixture, [relay]);
    const { approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW + 1);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: invited.invitation!.sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("session-wrong-state");
  });

  it("7. no duplicate package construction -- a second prepareAndPublish() for the SAME session reuses the cached package, never rebuilding", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { coordinator } = buildCoordinator(fixture, [relay]);
    const buildSpy = vi.spyOn(fixture.encryptionAuthority, "build");

    const first = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(first.outcome).toBe("published");
    expect(buildSpy).toHaveBeenCalledTimes(1);

    const second = await coordinator.prepareAndPublish(
      {
        accountRef: fixture.accountRef,
        sourceDeviceId: INITIATOR_DEVICE_ID,
        targetDeviceId: RESPONDER_DEVICE_ID,
        transferSessionId: sessionId,
        approval,
        syncSession,
        selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
        ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
      },
      NOW + 5,
    );
    expect(second.outcome).toBe("published");
    expect(buildSpy).toHaveBeenCalledTimes(1); // still 1 -- NOT rebuilt.
    expect(relay.stored).toHaveLength(2); // republished, but with the SAME cached package bytes.
  });

  it("8. two Relays -- one rejects, one accepts, per-Relay outcomes recorded independently", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const acceptingRelay = await connectedRelay("wss://relay-accept.example", "accept");
    const rejectingRelay = await connectedRelay("wss://relay-reject.example", "reject");
    const { coordinator } = buildCoordinator(fixture, [acceptingRelay, rejectingRelay]);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("published");
    expect(result.relayOutcomes).toEqual(
      expect.arrayContaining([
        { relayUrl: acceptingRelay.url, outcome: "accepted" },
        { relayUrl: rejectingRelay.url, outcome: "rejected" },
      ]),
    );
  });

  it("9. all Relays fail (timeout) -- every per-Relay outcome is 'failed', one Relay's own timeout never corrupts another's result", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const relayA = await connectedRelay("wss://relay-a.example", "timeout");
    const relayB = await connectedRelay("wss://relay-b.example", "timeout");
    const { coordinator } = buildCoordinator(fixture, [relayA, relayB], 20);

    const result = await coordinator.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });
    expect(result.outcome).toBe("published");
    expect(result.relayOutcomes).toEqual([
      { relayUrl: relayA.url, outcome: "failed" },
      { relayUrl: relayB.url, outcome: "failed" },
    ]);
  });

  it("10. Relay-count resource limit -- constructing a Publisher over too many Relays throws", async () => {
    const relaySet = new FedosConversationRelaySet(
      Array.from({ length: FEDOS_DEVICE_RELAY_SYNC_MAX_RELAYS + 1 }, (_, i) => new FakeDeviceRelaySyncRelay(`wss://relay-${i}.example`)),
    );
    expect(() => new FedosDeviceRelaySyncPublisher(relaySet)).toThrow();
  });
});

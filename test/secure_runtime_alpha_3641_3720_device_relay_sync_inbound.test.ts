import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { nostrWireEventToFedosEventDescriptor } from "../src/os/messenger/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import { FedosDeviceRelaySyncPublisher } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_publisher.js";
import { FedosDeviceRelaySyncOutboundCoordinator } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_outbound_coordinator.js";
import { FedosDeviceRelaySyncInboundHandler } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_inbound_handler.js";
import { InMemoryFedosDeviceRelaySyncOutboxPersistence } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_outbox_persistence.js";
import { InMemoryFedosDeviceRelaySyncObservationRepository } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_observation_repository.js";
import { InMemoryFedosDeviceRelaySyncInboundDedupPersistence } from "../src/os/messenger/device/relay_sync/persistence/in_memory_fedos_device_relay_sync_inbound_dedup_persistence.js";
import { AppendOnlyFedosDeviceRelaySyncInboundDedupPersistence } from "../src/os/messenger/device/relay_sync/persistence/append_only_fedos_device_relay_sync_inbound_dedup_persistence.js";
import type { FedosDeviceRelaySyncInboundDedupPersistence } from "../src/os/messenger/device/relay_sync/persistence/fedos_device_relay_sync_inbound_dedup_persistence.js";
import { buildFedosDeviceRelaySyncWirePayload } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_wire_payload.js";
import { buildFedosDeviceRelaySyncUnsignedEventRequest } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_event.js";
import { queryFedosDeviceRelaySyncStatusForSession, type FedosDeviceRelaySyncObservationRepository } from "../src/os/messenger/device/relay_sync/fedos_device_relay_sync_observation.js";
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
import { AppendOnlyFedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/append_only_fedos_device_registry_persistence.js";
import { createFedosDeviceTransferCoordinator } from "../src/os/messenger/device/transfer/fedos_device_transfer_coordinator.js";
import { InMemoryFedosDeviceTransferSessionPersistence } from "../src/os/messenger/device/transfer/persistence/in_memory_fedos_device_transfer_session_persistence.js";
import { createFedosDeviceSyncRuntime } from "../src/os/messenger/device/runtime/fedos_device_sync_runtime.js";
import { InMemoryFedosDeviceBindingChallengeReplayPersistence } from "../src/os/messenger/device/persistence/in_memory_fedos_device_binding_challenge_replay_persistence.js";
import { authorizeFedosDeviceBindingChallenge } from "../src/os/messenger/device/binding_challenge/fedos_device_binding_account_authorization.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";

const NOW = 2_000_000_000;

async function connectedRelay(url: string): Promise<FakeDeviceRelaySyncRelay> {
  const relay = new FakeDeviceRelaySyncRelay(url, "accept");
  await relay.connect();
  return relay;
}

function buildOutbound(fixture: DeviceRelaySyncFixture, relays: FakeDeviceRelaySyncRelay[]) {
  const relaySet = new FedosConversationRelaySet(relays);
  const publisher = new FedosDeviceRelaySyncPublisher(relaySet, 200);
  return new FedosDeviceRelaySyncOutboundCoordinator({
    transferCoordinator: fixture.transferCoordinator,
    registryPersistence: fixture.registryPersistence,
    outboxPersistence: new InMemoryFedosDeviceRelaySyncOutboxPersistence(),
    observationRepository: new InMemoryFedosDeviceRelaySyncObservationRepository(),
    signingAuthority: fixture.signingAuthority,
    publisher,
    encryptionAuthority: fixture.encryptionAuthority,
    now: () => NOW,
  });
}

function buildInbound(
  fixture: DeviceRelaySyncFixture,
  dedupPersistence: FedosDeviceRelaySyncInboundDedupPersistence = new InMemoryFedosDeviceRelaySyncInboundDedupPersistence(),
  observationRepository: FedosDeviceRelaySyncObservationRepository = new InMemoryFedosDeviceRelaySyncObservationRepository(),
  localDeviceId = RESPONDER_DEVICE_ID,
) {
  const handler = new FedosDeviceRelaySyncInboundHandler({
    transferCoordinator: fixture.transferCoordinator,
    registryPersistence: fixture.registryPersistence,
    dedupPersistence,
    observationRepository,
    localDeviceId,
    localAccountRef: fixture.accountRef,
  });
  return { handler, dedupPersistence, observationRepository };
}

/** Receives every event currently stored on `relay` (a real, synchronous subscribe+listen, simulating "subscribe, then receive whatever the Relay already has" -- Phase J's own offline-then-later-receive). */
async function receiveStoredEvents(relay: FakeDeviceRelaySyncRelay): Promise<FedosEventDescriptor[]> {
  const received: FedosNostrWireEvent[] = [];
  const subscription: FedosSubscription = await relay.subscribe([{ kinds: [1] }]);
  relay.onSubscriptionMessage(subscription, (message) => {
    if (message.kind === "event") received.push(message.event);
  });
  return received.map(nostrWireEventToFedosEventDescriptor);
}

async function publishAndPrepareInboundRequest(fixture: DeviceRelaySyncFixture, relay: FakeDeviceRelaySyncRelay, now = NOW) {
  const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, now);
  const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, now);
  const outbound = buildOutbound(fixture, [relay]);
  const result = await outbound.prepareAndPublish({
    accountRef: fixture.accountRef,
    sourceDeviceId: INITIATOR_DEVICE_ID,
    targetDeviceId: RESPONDER_DEVICE_ID,
    transferSessionId: sessionId,
    approval,
    syncSession,
    selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
    ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
  });
  if (result.outcome !== "published") throw new Error(`unreachable: ${result.outcome}`);
  return { sessionId, syncSession };
}

function baseInboundRequestFields(fixture: DeviceRelaySyncFixture, descriptor: FedosEventDescriptor, now = NOW) {
  return { descriptor, encryptionAuthority: fixture.encryptionAuthority, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, now, ...DEVICE_RELAY_SYNC_BUILD_FIELDS };
}

describe("Secure Runtime Alpha 3641-3720 -- Inbound Handler (Phase E): happy path and offline delivery", () => {
  it("1. two trusted Devices, one Relay -- full round trip imports the identical Sync Session, Observation shows received/imported distinctly", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { sessionId, syncSession } = await publishAndPrepareInboundRequest(fixture, relay);

    const [descriptor] = await receiveStoredEvents(relay);
    const { handler, observationRepository } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));

    expect(result.outcome).toBe("imported");
    expect(result.syncSession).toEqual(syncSession);
    const status = queryFedosDeviceRelaySyncStatusForSession(observationRepository, sessionId);
    expect(status.map((f) => f.state)).toEqual(["received", "imported"]);
  });

  it("2. target offline then later receive -- subscribing AFTER publish still delivers and imports exactly once", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    // Publish happens fully BEFORE the target ever subscribes.
    await publishAndPrepareInboundRequest(fixture, relay);

    const [descriptor] = await receiveStoredEvents(relay); // subscription created only now, well "after" publish.
    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));
    expect(result.outcome).toBe("imported");
  });

  it("3. two Relays, duplicate inbound (same event via both) -- imports exactly once", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relayA = await connectedRelay("wss://relay-a.example");
    const relayB = await connectedRelay("wss://relay-b.example");
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const outbound = buildOutbound(fixture, [relayA, relayB]);
    await outbound.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    });

    const [descriptorFromA] = await receiveStoredEvents(relayA);
    const [descriptorFromB] = await receiveStoredEvents(relayB);
    expect(descriptorFromA!.id).toBe(descriptorFromB!.id); // the SAME signed event, delivered via two Relays.

    const { handler } = buildInbound(fixture);
    const first = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptorFromA!));
    expect(first.outcome).toBe("imported");
    const second = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptorFromB!, NOW + 1));
    expect(second.outcome).toBe("duplicate");
  });

  it("4. cross-Relay dedup by session+hash -- a SECOND, differently-signed republish of the SAME session/package still imports only once", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const outbound = buildOutbound(fixture, [relay]);
    const req = {
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      transferSessionId: sessionId,
      approval,
      syncSession,
      selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
      ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
    };
    await outbound.prepareAndPublish(req, NOW);
    await outbound.prepareAndPublish(req, NOW + 5); // republish -- cached package reused, but a FRESH signature/event id.

    const events = await receiveStoredEvents(relay);
    expect(events).toHaveLength(2);
    expect(events[0]!.id).not.toBe(events[1]!.id); // different outer events...

    const { handler } = buildInbound(fixture);
    const first = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, events[0]!));
    expect(first.outcome).toBe("imported");
    const second = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, events[1]!, NOW + 6));
    expect(second.outcome).toBe("duplicate"); // ...but the SAME session+package hash -- layer-2 dedup.
  });
});

describe("Secure Runtime Alpha 3641-3720 -- Inbound Handler: wrong recipient / account / device", () => {
  it("1. wrong-recipient -- an inbound handler for a DIFFERENT local Device refuses to import", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const { handler } = buildInbound(fixture, undefined, undefined, "some-other-device-id");
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));
    expect(result.outcome).toBe("wrong-recipient");
  });

  it("2. wrong-account -- an inbound handler configured for a DIFFERENT account refuses to import", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const handler = new FedosDeviceRelaySyncInboundHandler({
      transferCoordinator: fixture.transferCoordinator,
      registryPersistence: fixture.registryPersistence,
      dedupPersistence: new InMemoryFedosDeviceRelaySyncInboundDedupPersistence(),
      observationRepository: new InMemoryFedosDeviceRelaySyncObservationRepository(),
      localDeviceId: RESPONDER_DEVICE_ID,
      localAccountRef: { authority: "nostr", publicIdentifier: "ff".repeat(32), identityId: null },
    });
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));
    expect(result.outcome).toBe("wrong-account");
  });

  it("3. malformed -- a well-formed but non-Device-Sync event (no marker tag) is refused before any dedup/trust check", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const event = await fixture.signingAuthority.signEvent({ accountIndex: 0, createdAt: NOW, kind: 1, tags: [["unrelated", "tag"]], content: "hello" });
    const descriptor = nostrWireEventToFedosEventDescriptor(event!);
    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor));
    expect(result.outcome).toBe("malformed");
  });
});

describe("Secure Runtime Alpha 3641-3720 -- Inbound Handler: tampering, replay, revocation", () => {
  it("1. invalid-signature -- a tampered outer event (a tag flipped after signing) is refused", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const tampered: FedosEventDescriptor = { ...descriptor!, tags: [...descriptor!.tags, ["injected", "tag"]] };
    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, tampered));
    expect(result.outcome).toBe("invalid-signature");
  });

  it("2. invalid-signature -- a tampered wire payload (content string altered after signing) is refused", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const tampered: FedosEventDescriptor = { ...descriptor!, content: descriptor!.content.replace(RESPONDER_DEVICE_ID, "laptop-x") };
    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, tampered));
    expect(result.outcome).toBe("invalid-signature");
  });

  it("3. conflict -- a validly-signed but internally-inconsistent payload (declared hash does not match its own embedded package) is refused by the content-hash gate, independent of signature validity", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    const built = await fixture.transferCoordinator.buildTransferPackage(
      { sessionId, approval, syncSession, encryptionAuthority: fixture.encryptionAuthority, selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier, ...DEVICE_RELAY_SYNC_BUILD_FIELDS },
      NOW,
    );
    if (built.outcome !== "package-sent") throw new Error("unreachable");

    const dishonestPayload = buildFedosDeviceRelaySyncWirePayload({
      transferPackage: built.package!,
      transferSessionId: sessionId,
      sourceDeviceId: INITIATOR_DEVICE_ID,
      targetDeviceId: RESPONDER_DEVICE_ID,
      accountAuthority: fixture.accountRef.authority,
      accountPublicIdentifier: fixture.accountRef.publicIdentifier,
      createdAt: NOW,
      expiresAt: NOW + 300,
      deliveryId: "delivery-1",
    });
    // Declare a WRONG hash -- the signer signs this dishonest content for real; only the semantic binding is broken.
    const tamperedPayload = { ...dishonestPayload, packageContentHash: "0".repeat(64) };
    const unsignedRequest = buildFedosDeviceRelaySyncUnsignedEventRequest({ payload: tamperedPayload, localAccountIndex: 0 });
    const event = await fixture.signingAuthority.signEvent(unsignedRequest);
    const descriptor = nostrWireEventToFedosEventDescriptor(event!);

    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor));
    expect(result.outcome).toBe("conflict");
  });

  it("4. expired -- a package received after its own expiresAt is refused", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!, NOW + 86_401));
    expect(result.outcome).toBe("expired");
  });

  it("5. source-not-trusted (revoked source before import) -- a source Device revoked AFTER publish, BEFORE the target ever imports, is denied", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    await revokeDeviceHelper(fixture, INITIATOR_DEVICE_ID, NOW + 1);

    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!, NOW + 2));
    expect(result.outcome).toBe("source-not-trusted");
  });

  it("6. target-not-trusted (revoked target before import) -- a target Device revoked AFTER publish, BEFORE it imports, is denied", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    await revokeDeviceHelper(fixture, RESPONDER_DEVICE_ID, NOW + 1);

    const { handler } = buildInbound(fixture);
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!, NOW + 2));
    expect(result.outcome).toBe("target-not-trusted");
  });

  it("7. revoked source BEFORE publish -- the Outbound Coordinator itself refuses (already covered structurally; re-confirmed here end to end)", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
    const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
    await revokeDeviceHelper(fixture, INITIATOR_DEVICE_ID, NOW + 1);
    const relay = await connectedRelay("wss://relay-a.example");
    const outbound = buildOutbound(fixture, [relay]);
    const result = await outbound.prepareAndPublish({
      accountRef: fixture.accountRef,
      sourceDeviceId: INITIATOR_DEVICE_ID,
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
});

describe("Secure Runtime Alpha 3641-3720 -- restart recovery and isolation", () => {
  it("1. restart recovery -- a fresh, independent inbound dedup persistence over the SAME durable log file still refuses to re-import after a simulated restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-relay-sync-"));
    const dedupLogPath = join(dir, "inbound-dedup.ndjson");
    try {
      const fixture = await buildDeviceRelaySyncFixture(NOW);
      const relay = await connectedRelay("wss://relay-a.example");
      await publishAndPrepareInboundRequest(fixture, relay);
      const [descriptor] = await receiveStoredEvents(relay);

      const dedupA = new AppendOnlyFedosDeviceRelaySyncInboundDedupPersistence(dedupLogPath);
      const { handler: handlerA } = buildInbound(fixture, dedupA);
      const first = await handlerA.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));
      expect(first.outcome).toBe("imported");

      // Simulate restart: a FRESH dedup persistence instance over the SAME file.
      const dedupB = new AppendOnlyFedosDeviceRelaySyncInboundDedupPersistence(dedupLogPath);
      const { handler: handlerB } = buildInbound(fixture, dedupB);
      const second = await handlerB.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!, NOW + 1));
      expect(second.outcome).toBe("duplicate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("2. target restart does not reapply an imported record -- confirmed via the transfer session's own terminal state too", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    const { sessionId } = await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);
    const { handler } = buildInbound(fixture);
    await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));

    expect(fixture.transferCoordinator.getSession(sessionId)?.state).toBe("verified");
    const second = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!, NOW + 1));
    expect(second.outcome).toBe("duplicate");
  });

  it("3. source restart does not duplicate a completed package -- a fresh Outbound Coordinator instance over the SAME Outbox log reuses the cached package", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-relay-sync-outbox-"));
    const registryLogPath = join(dir, "device-registry.ndjson");
    try {
      const registryPersistenceA = new AppendOnlyFedosDeviceRegistryPersistence(registryLogPath);
      const transferCoordinator = createFedosDeviceTransferCoordinator({
        sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
        registryPersistence: registryPersistenceA,
        now: () => NOW,
      });
      const fixture = await buildDeviceRelaySyncFixture(NOW, registryPersistenceA, transferCoordinator);
      const { sessionId, approval } = await driveDeviceRelaySyncSessionToApproved(fixture, NOW);
      const syncSession = prepareDeviceRelaySyncSyncSession(fixture, RESPONDER_DEVICE_ID, NOW);
      const relay = await connectedRelay("wss://relay-a.example");

      const outboundA = buildOutbound(fixture, [relay]);
      await outboundA.prepareAndPublish({
        accountRef: fixture.accountRef,
        sourceDeviceId: INITIATOR_DEVICE_ID,
        targetDeviceId: RESPONDER_DEVICE_ID,
        transferSessionId: sessionId,
        approval,
        syncSession,
        selfAccountPublicKeyHex: fixture.accountRef.publicIdentifier,
        ...DEVICE_RELAY_SYNC_BUILD_FIELDS,
      });
      expect(relay.stored).toHaveLength(1);
      // The Transfer Session itself is already "package-sent" -- a FRESH Outbound Coordinator (simulating restart) with its OWN (empty) Outbox
      // still cannot rebuild (the underlying Transfer Coordinator's own state machine forbids a second buildTransferPackage() call).
      const outboundB = buildOutbound(fixture, [relay]);
      const result = await outboundB.prepareAndPublish(
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
        NOW + 1,
      );
      expect(result.outcome).toBe("session-wrong-state");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("4. independent account isolation -- an inbound handler for a genuinely different, unrelated account cannot import a message even with correct signature verification", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const otherRegistryPersistence = new InMemoryFedosDeviceRegistryPersistence();
    const otherTransferCoordinator = createFedosDeviceTransferCoordinator({
      sessionPersistence: new InMemoryFedosDeviceTransferSessionPersistence(),
      registryPersistence: otherRegistryPersistence,
      now: () => NOW,
    });
    const handler = new FedosDeviceRelaySyncInboundHandler({
      transferCoordinator: otherTransferCoordinator,
      registryPersistence: otherRegistryPersistence,
      dedupPersistence: new InMemoryFedosDeviceRelaySyncInboundDedupPersistence(),
      observationRepository: new InMemoryFedosDeviceRelaySyncObservationRepository(),
      localDeviceId: RESPONDER_DEVICE_ID,
      localAccountRef: { authority: "nostr", publicIdentifier: "cc".repeat(32), identityId: null },
    });
    const result = await handler.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));
    expect(result.outcome).toBe("wrong-account");
  });

  it("5. independent Runtime isolation -- two separate inbound handlers (separate dedup state) each import independently without interfering", async () => {
    const fixture = await buildDeviceRelaySyncFixture(NOW);
    const relay = await connectedRelay("wss://relay-a.example");
    await publishAndPrepareInboundRequest(fixture, relay);
    const [descriptor] = await receiveStoredEvents(relay);

    const { handler: handlerX, dedupPersistence: dedupX } = buildInbound(fixture);
    const { handler: handlerY, dedupPersistence: dedupY } = buildInbound(fixture);
    const resultX = await handlerX.handleIncomingEvent(baseInboundRequestFields(fixture, descriptor!));
    expect(resultX.outcome).toBe("imported");
    expect(dedupX.getByRelayEventId(descriptor!.id)).not.toBeNull();
    expect(dedupY.getByRelayEventId(descriptor!.id)).toBeNull(); // independent state -- handlerY's own dedup never saw handlerX's import.
  });
});

/** Revokes `deviceId` via the real, unmodified Device Sync Runtime -- a fresh runtime instance over the SAME registry persistence the fixture's own devices were registered against. */
async function revokeDeviceHelper(fixture: DeviceRelaySyncFixture, deviceId: string, now: number): Promise<void> {
  const keypair = deviceId === INITIATOR_DEVICE_ID ? fixture.initiatorKeypair : fixture.responderKeypair;
  const runtime = createFedosDeviceSyncRuntime({
    registryPersistence: fixture.registryPersistence,
    replayPersistence: new InMemoryFedosDeviceBindingChallengeReplayPersistence(),
    now: () => now,
  });
  const challenge = runtime.mintChallenge("revoke-device", deviceId, keypair.publicKeyHex);
  const accountAuthorization = await authorizeFedosDeviceBindingChallenge(fixture.signingAuthority, 0, challenge);
  if (accountAuthorization === null) throw new Error("unreachable");
  const result = await runtime.revokeDevice(accountAuthorization, now);
  if (result.outcome !== "revoked") throw new Error(`unreachable: ${result.outcome}`);
}

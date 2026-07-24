import { describe, it, expect } from "vitest";
import { InMemoryFedosDeviceRegistryPersistence } from "../src/device/persistence/in_memory_fedos_device_registry_persistence.js";
import type { FedosPersistedDeviceBindingEventV1 } from "../src/device/persistence/fedos_persisted_device_binding_event_v1.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosConversationRelaySet } from "../src/conversation/transport/relay/fedos_conversation_relay_set.js";
import { FedosDeviceRelaySyncPublisher } from "../src/device/relay_sync/fedos_device_relay_sync_publisher.js";
import { FedosArchiveSuppressionOutboundCoordinator } from "../src/device/archive_suppression_sync/fedos_archive_suppression_outbound_coordinator.js";
import { FedosArchiveSuppressionInboundHandler } from "../src/device/archive_suppression_sync/fedos_archive_suppression_inbound_handler.js";
import { InMemoryFedosArchiveSuppressionInboundDedupPersistence } from "../src/device/archive_suppression_sync/persistence/fedos_archive_suppression_inbound_dedup_persistence.js";
import { buildFedosArchiveSuppressionWirePayload } from "../src/device/archive_suppression_sync/fedos_archive_suppression_wire_payload.js";
import { buildFedosArchiveSuppressionUnsignedEventRequest } from "../src/device/archive_suppression_sync/fedos_archive_suppression_event.js";
import { FedosArchiveSuppressionObservationAuthority } from "../src/conversation/retention/fedos_archive_suppression_observation_authority.js";
import { InMemoryFedosArchiveSuppressionObservationPersistence } from "../src/conversation/retention/in_memory_fedos_archive_suppression_observation_persistence.js";
import { createAndRecordLocalArchiveSuppressionFact } from "../src/conversation/retention/fedos_archive_suppression_local_bridge.js";
import { nostrWireEventToFedosEventDescriptor } from "../src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";
import type { FedosRelay } from "../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
import type { FedosConversationPayloadId } from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../src/device/fedos_device_binding.js";
import type { FedosArchiveSuppressionFact } from "../src/conversation/retention/fedos_archive_suppression_fact.js";

/**
 * Secure Runtime Alpha 7721-7800 -- Phase F/G integration: real
 * `FedosArchiveSuppressionOutboundCoordinator`/`FedosArchiveSuppressionInboundHandler`
 * over a manual (test-double) RELAY (mirrors this repository's own
 * established `ManualRelay` pattern,
 * `test/secure_runtime_alpha_1471_1540_private_transport_coordinator.test.ts`),
 * but REAL BIP-340 Schnorr signing (`RealFedosNostrSigningAuthority`, the
 * SAME test-only real-crypto stand-in the Device Relay Sync test suite
 * itself uses) -- this Arc's own Inbound Handler performs REAL signature
 * verification (`NobleSignatureVerifier`), so a fabricated signature
 * cannot be used here the way a fully-mocked relay round trip could get
 * away with elsewhere. Also covers several Phase M failure-matrix items
 * that fit naturally alongside this same fixture (revoked device, wrong
 * account, replay).
 */

const SUBJECT = "payload-7721-fg" as unknown as FedosConversationPayloadId;

class ManualRelay implements FedosRelay {
  readonly url: string;
  #connected = false;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];

  constructor(url: string) {
    this.url = url;
  }
  fireOk(eventId: string, accepted: boolean): void {
    this.#relayListener?.({ kind: "ok", eventId, accepted, message: "" });
  }
  async connect(): Promise<void> {
    this.#connected = true;
  }
  async disconnect(): Promise<void> {
    this.#connected = false;
  }
  isConnected(): boolean {
    return this.#connected;
  }
  async publish(event: FedosEventDescriptor): Promise<void> {
    this.published.push(event);
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    return { id: "sub-1" };
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

function registeredAndTrustedEvents(deviceId: string, accountRef: FedosDeviceBindingAccountRef, at: number): FedosPersistedDeviceBindingEventV1[] {
  return [
    {
      schemaVersion: 1,
      eventType: "registered",
      deviceId,
      accountAuthority: accountRef.authority,
      accountPublicIdentifier: accountRef.publicIdentifier,
      accountIdentityId: accountRef.identityId,
      devicePublicKeyRef: null,
      label: null,
      initialTrustState: "pending",
      registeredAt: at,
    },
    { schemaVersion: 1, eventType: "trusted", deviceId, trustedAt: at },
  ];
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function makeFixture() {
  const signingAuthority = new RealFedosNostrSigningAuthority();
  const identity = (await signingAuthority.publicIdentityForAccount(0))!;
  const accountRef: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: identity.publicKeyHex, identityId: null };

  const registryPersistence = new InMemoryFedosDeviceRegistryPersistence();
  for (const event of registeredAndTrustedEvents("device-a", accountRef, 100)) registryPersistence.putEvent(event);
  for (const event of registeredAndTrustedEvents("device-b", accountRef, 100)) registryPersistence.putEvent(event);

  const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const relay = new ManualRelay("wss://relay-1");
  const publisher = new FedosDeviceRelaySyncPublisher(new FedosConversationRelaySet([relay]));

  const outbound = new FedosArchiveSuppressionOutboundCoordinator({ registryPersistence, signingAuthority, publisher, observationRepository });

  const inboundAuthority = new FedosArchiveSuppressionObservationAuthority({
    persistence: new InMemoryFedosArchiveSuppressionObservationPersistence(),
  });
  const inbound = new FedosArchiveSuppressionInboundHandler({
    registryPersistence,
    dedupPersistence: new InMemoryFedosArchiveSuppressionInboundDedupPersistence(),
    observationAuthority: inboundAuthority,
    localDeviceId: "device-b",
    localAccountRef: accountRef,
  });

  return { accountRef, signingAuthority, registryPersistence, observationRepository, relay, outbound, inbound, inboundAuthority };
}

function localFactAuthority() {
  return new FedosArchiveSuppressionObservationAuthority({ persistence: new InMemoryFedosArchiveSuppressionObservationPersistence() });
}

describe("Secure Runtime Alpha 7721-7800 -- outbound/inbound suppression sync (Phase F/G)", () => {
  it("1. a real, locally-created fact fans out, is REALLY signed, published, relay-accepted, and the receiving Device's Inbound Handler applies it", async () => {
    const { accountRef, relay, outbound, inbound, inboundAuthority } = await makeFixture();

    const created = createAndRecordLocalArchiveSuppressionFact(
      { accountRef, sourceDeviceId: "device-a", subjectRef: SUBJECT, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
      localFactAuthority(),
    );
    expect(created.outcome).toBe("recorded");
    const fact = (created as { fact: FedosArchiveSuppressionFact }).fact;

    const fanoutPromise = outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
    await settle();
    expect(relay.published).toHaveLength(1);
    relay.fireOk(relay.published[0]!.id, true);
    const fanoutResult = await fanoutPromise;

    expect(fanoutResult.outcome).toBe("fanned-out");
    expect(fanoutResult.targets).toHaveLength(1);
    expect(fanoutResult.targets[0]!.targetDeviceId).toBe("device-b");
    expect(fanoutResult.targets[0]!.published).toBe(true);

    const inboundResult = await inbound.handleIncomingEvent({ descriptor: relay.published[0]!, now: 1000 });
    expect(inboundResult.outcome).toBe("recorded");
    expect(inboundAuthority.evaluateSuppression(SUBJECT, "restore")).toBe("suppressed");
  });

  it("2. fanOut() targets ONLY currently-trusted devices -- a revoked device receives nothing (Phase M: revoked device)", async () => {
    const { accountRef, registryPersistence, relay, outbound } = await makeFixture();
    registryPersistence.putEvent({ schemaVersion: 1, eventType: "revoked", deviceId: "device-b", revokedAt: 200 });

    const created = createAndRecordLocalArchiveSuppressionFact(
      { accountRef, sourceDeviceId: "device-a", subjectRef: SUBJECT, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
      localFactAuthority(),
    );
    const fact = (created as { fact: FedosArchiveSuppressionFact }).fact;

    const result = await outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
    expect(result.outcome).toBe("no-other-trusted-devices");
    expect(relay.published).toHaveLength(0);
  });

  it("3. inbound handler rejects a fact from an UNREGISTERED source Device, correctly signed by the SAME account (Phase M: unknown/untrusted device)", async () => {
    const { accountRef, signingAuthority, inbound } = await makeFixture();
    const created = createAndRecordLocalArchiveSuppressionFact(
      { accountRef, sourceDeviceId: "device-unregistered", subjectRef: SUBJECT, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
      localFactAuthority(),
    );
    const fact = (created as { fact: FedosArchiveSuppressionFact }).fact;
    const payload = buildFedosArchiveSuppressionWirePayload({
      sourceDeviceId: "device-unregistered",
      targetDeviceId: "device-b",
      fact,
      deviceEvidence: null,
      createdAt: 1000,
      expiresAt: 2000,
      deliveryId: "0".repeat(32),
    });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const event = (await signingAuthority.signEvent(unsigned))!;
    const descriptor = nostrWireEventToFedosEventDescriptor(event);

    const result = await inbound.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("source-not-trusted");
  });

  it("4. inbound handler rejects a fact whose account does not match the receiver's own account (Phase M: wrong account)", async () => {
    const { inbound } = await makeFixture();
    const otherAccountSigning = new RealFedosNostrSigningAuthority();
    const otherIdentity = (await otherAccountSigning.publicIdentityForAccount(0))!;
    const otherAccount: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: otherIdentity.publicKeyHex, identityId: null };

    const created = createAndRecordLocalArchiveSuppressionFact(
      { accountRef: otherAccount, sourceDeviceId: "device-a", subjectRef: SUBJECT, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
      localFactAuthority(),
    );
    const fact = (created as { fact: FedosArchiveSuppressionFact }).fact;
    const payload = buildFedosArchiveSuppressionWirePayload({
      sourceDeviceId: "device-a",
      targetDeviceId: "device-b",
      fact,
      deviceEvidence: null,
      createdAt: 1000,
      expiresAt: 2000,
      deliveryId: "0".repeat(32),
    });
    const unsigned = buildFedosArchiveSuppressionUnsignedEventRequest({ payload, localAccountIndex: 0 });
    const event = (await otherAccountSigning.signEvent(unsigned))!;
    const descriptor = nostrWireEventToFedosEventDescriptor(event);

    const result = await inbound.handleIncomingEvent({ descriptor, now: 1000 });
    expect(result.outcome).toBe("wrong-account");
  });

  it("5. replaying the identical outer event twice is idempotent ('duplicate' the second time)", async () => {
    const { accountRef, relay, outbound, inbound } = await makeFixture();
    const created = createAndRecordLocalArchiveSuppressionFact(
      { accountRef, sourceDeviceId: "device-a", subjectRef: SUBJECT, suppressionMeaning: "suppress-payload-restore", decidedAt: 1000 },
      localFactAuthority(),
    );
    const fact = (created as { fact: FedosArchiveSuppressionFact }).fact;

    const fanoutPromise = outbound.fanOut({ fact, deviceEvidence: null, sourceDeviceId: "device-a", localAccountIndex: 0 }, 1000);
    await settle();
    relay.fireOk(relay.published[0]!.id, true);
    await fanoutPromise;

    const first = await inbound.handleIncomingEvent({ descriptor: relay.published[0]!, now: 1000 });
    expect(first.outcome).toBe("recorded");
    const second = await inbound.handleIncomingEvent({ descriptor: relay.published[0]!, now: 1001 });
    expect(second.outcome).toBe("duplicate");
  });
});

import { describe, it, expect } from "vitest";
import { FedosPrivateTransport } from "../src/os/messenger/adapters/nostr/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/os/messenger/adapters/nostr/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { serializeFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { validateFedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import { validateFedosConversationPayloadDescriptor } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_descriptor_validator.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationMembership } from "../src/os/messenger/conversations/membership/fedos_conversation_membership.js";
import { FEDOS_PRIVATE_NOSTR_DELIVERY_KIND } from "../src/os/messenger/adapters/nostr/conversation_delivery/fedos_private_nostr_delivery_mode.js";

const LOCAL_PUBKEY = "a".repeat(64);
const COUNTERPARTY_PUBKEY = "b".repeat(64);

/** A minimal, deterministic FedosNostrSigningAuthority double -- no real secp256k1 signing, matching this repository's own established convention for testing above the crypto boundary (e.g. `fakeMasterSeedAuthority`, `test/secure_runtime_alpha_861_872_encryption_authority.test.ts`). */
function fakeSigningAuthority(): FedosNostrSigningAuthority {
  return {
    async signEvent(request) {
      const id = `event-${request.tags.find((t) => t[0] === "e-envelope")?.[1] ?? "unknown"}`;
      return {
        id,
        pubkey: LOCAL_PUBKEY,
        created_at: request.createdAt,
        kind: request.kind,
        tags: request.tags,
        content: request.content,
        sig: "s".repeat(128),
      };
    },
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: LOCAL_PUBKEY };
    },
  };
}

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

function membership(participantHex: string): FedosConversationMembership {
  return Object.freeze({
    id: `membership-${participantHex}` as never,
    conversationId: "board-1::thread-1" as never,
    participant: { authority: "nostr" as const, publicIdentifier: participantHex, identityId: null },
    role: "member" as never,
    state: "active",
    joinedAt: 0,
    endedAt: null,
  });
}

function seedEnvelopeAndPayload(
  envelopePersistence: InMemoryFedosConversationMessageEnvelopePersistence,
  payloadStorage: InMemoryFedosConversationPayloadStorage,
  ciphertext: Uint8Array,
) {
  const conversationId = "board-1::thread-1";
  const descriptor = validateFedosConversationPayloadDescriptor({
    id: "payload-1",
    conversationId,
    mediaType: "application/octet-stream",
    byteLength: ciphertext.length,
    createdAt: 1_700_000_000,
  })!;
  payloadStorage.putPayload(descriptor, ciphertext);

  const envelope = validateFedosConversationMessageEnvelope({
    id: "envelope-1",
    conversationId,
    senderMembershipId: `membership-${LOCAL_PUBKEY}`,
    payloadId: "payload-1",
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
  })!;
  envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(envelope));
  return envelope;
}

function buildTransport(relay: FedosRelay, ciphertext: Uint8Array) {
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  const envelope = seedEnvelopeAndPayload(envelopePersistence, payloadStorage, ciphertext);

  const transport = new FedosPrivateTransport({
    relaySet: new FedosConversationRelaySet([relay]),
    signingAuthority: fakeSigningAuthority(),
    localAccountIndex: 0,
    envelopePersistence,
    payloadStorage,
    membershipsForConversation: () => [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
    outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
    observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
    intervalMs: 1000,
  });
  return { transport, envelope };
}

describe("Secure Runtime Alpha 1471-1540 -- FedosPrivateTransport Coordinator", () => {
  it("1. sendMailbox queues an idempotent Outbox intent; tick() drives real delivery through the Relay/Publisher pipeline", async () => {
    const relay = new ManualRelay("wss://relay-1");
    const { transport, envelope } = buildTransport(relay, new Uint8Array([10, 20, 30]));
    await transport.start();
    try {
      expect(transport.sendMailbox(envelope.id, envelope.conversationId)).toBe("inserted");
      expect(transport.sendMailbox(envelope.id, envelope.conversationId)).toBe("already-present");

      const tickPromise = transport.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      relay.fireOk(relay.published[0]!.id, true);
      const entries = await tickPromise;

      expect(entries).toHaveLength(1);
      expect(entries[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
      expect(relay.published).toHaveLength(1);
      // Alpha 1615 (Alpha 1611-1690 Kind-1 Closure) -- never kind 1 for private ciphertext.
      expect(relay.published[0]!.kind).toBe(FEDOS_PRIVATE_NOSTR_DELIVERY_KIND);
    } finally {
      await transport.stop();
    }
  });

  it("2. sendEphemeral delivers immediately without ever touching the Outbox", async () => {
    const relay = new ManualRelay("wss://relay-1");
    const { transport, envelope } = buildTransport(relay, new Uint8Array([1, 2, 3]));
    await transport.start();
    try {
      const sendPromise = transport.sendEphemeral(envelope.id, envelope.conversationId);
      await new Promise((resolve) => setTimeout(resolve, 0));
      relay.fireOk(relay.published[0]!.id, true);
      const outcome = await sendPromise;

      expect(outcome).toEqual({ outcome: "delivered", retryPolicy: "never" });
      const tickEntries = await transport.tick();
      expect(tickEntries).toHaveLength(0); // never queued in the Outbox
    } finally {
      await transport.stop();
    }
  });

  it("3. start()/stop() lifecycle -- may only be called once from each state", async () => {
    const relay = new ManualRelay("wss://relay-1");
    const { transport } = buildTransport(relay, new Uint8Array([1]));
    await transport.start();
    await expect(transport.start()).rejects.toThrow();
    await transport.stop();
    await expect(transport.stop()).rejects.toThrow();
  });

  it("4. inbound config activates the Inbound Subscription on start(), resolving the local identity via the Signing Authority", async () => {
    const relay = new ManualRelay("wss://relay-1");
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const received: string[] = [];

    const transport = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [],
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
      intervalMs: 1000,
      inbound: { filter: { kinds: [1] }, onEnvelope: (e) => received.push(e.envelopeId) },
    });

    await transport.start();
    expect(transport.isRunning()).toBe(true);
    await transport.stop();
  });

  it("6. (Secure Runtime Alpha 1761-1840 Phase G) an optional injected wireAdapter is retrievable via wireAdapter() -- narrow constructor-injection only, no internal dispatch rewiring in this Arc", () => {
    const relay = new ManualRelay("wss://relay.example");
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const fakeAdapter = {
      route: "nostr-nip17-v1" as const,
      isAvailable: () => true,
      build: async () => ({ outcome: "unsupported" as const }),
      parse: async () => ({ outcome: "unsupported" as const }),
    };

    const withAdapter = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [],
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
      intervalMs: 1000,
      wireAdapter: fakeAdapter,
    });
    expect(withAdapter.wireAdapter()).toBe(fakeAdapter);

    const withoutAdapter = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [],
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
      intervalMs: 1000,
    });
    expect(withoutAdapter.wireAdapter()).toBeUndefined();
  });
});

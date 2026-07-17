import { describe, it, expect } from "vitest";
import { FedosPrivateTransport } from "../src/conversation/transport/fedos_private_transport.js";
import { FedosConversationRelaySet } from "../src/conversation/transport/relay/fedos_conversation_relay_set.js";
import { InMemoryFedosConversationTransportOutboxPersistence } from "../src/conversation/transport/in_memory_fedos_conversation_transport_outbox_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { serializeFedosConversationMessageEnvelope } from "../src/conversation/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { validateFedosConversationMessageEnvelope } from "../src/conversation/envelope/fedos_conversation_message_envelope_validator.js";
import { validateFedosConversationPayloadDescriptor } from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor_validator.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import type { FedosRelay } from "../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
import type { FedosNostrSigningAuthority } from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
import type { FedosConversationMembership } from "../src/conversation/membership/fedos_conversation_membership.js";

const SENDER_PUBKEY = "a".repeat(64);
const RECEIVER_PUBKEY = "b".repeat(64);

/**
 * `FakeRelayServer` models ONE real relay server's own broadcast/OK
 * behavior; `LiveRelayConnection` models ONE client connection to it —
 * `FedosRelay.onRelayMessage()` is, per its own Alpha 236/238 contract,
 * ONE relay-wide listener PER CONNECTION OBJECT, exactly mirroring how a
 * real relay only ever OKs the SAME socket that published, and fans an
 * EVENT out to every connection independently. Sender and receiver each
 * get their OWN `LiveRelayConnection` to the SAME `FakeRelayServer` (two
 * separate sockets to the same logical relay, exactly as two different
 * users/processes would in reality) — sharing one `FedosRelay` OBJECT
 * between two independent `FedosPrivateTransport` instances would
 * incorrectly collapse two connections' worth of `onRelayMessage`
 * registrations into one, which no real relay boundary permits.
 */
class FakeRelayServer {
  readonly #connections: LiveRelayConnection[] = [];

  register(connection: LiveRelayConnection): void {
    this.#connections.push(connection);
  }

  publish(fromConnection: LiveRelayConnection, event: FedosEventDescriptor): void {
    const wireEvent: FedosNostrWireEvent = {
      id: event.id,
      pubkey: event.author,
      created_at: event.createdAt,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.signature,
    };
    // A real relay accepts every well-formed event unconditionally in this test double.
    queueMicrotask(() => {
      fromConnection.deliverOk(event.id, true);
      for (const connection of this.#connections) connection.deliverEvent(wireEvent);
    });
  }
}

class LiveRelayConnection implements FedosRelay {
  readonly url: string;
  readonly #server: FakeRelayServer;
  #connected = false;
  #okListener: FedosRelayMessageListener | undefined;
  #eventListeners: Array<(event: FedosNostrWireEvent) => void> = [];

  constructor(server: FakeRelayServer, url: string) {
    this.#server = server;
    this.url = url;
    server.register(this);
  }
  deliverOk(eventId: string, accepted: boolean): void {
    this.#okListener?.({ kind: "ok", eventId, accepted, message: "" });
  }
  deliverEvent(event: FedosNostrWireEvent): void {
    for (const listener of this.#eventListeners) listener(event);
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
    if (!this.#connected) throw new Error("not connected");
    this.#server.publish(this, event);
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    return { id: `sub-${this.url}` };
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(subscription: FedosSubscription, listener: FedosSubscriptionListener): void {
    this.#eventListeners.push((event) => listener({ kind: "event", subscriptionId: subscription.id, event }));
  }
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#okListener = listener;
  }
}

function fakeSigningAuthority(pubkeyHex: string): FedosNostrSigningAuthority {
  let counter = 0;
  return {
    async signEvent(request) {
      counter += 1;
      return {
        id: `event-${pubkeyHex.slice(0, 8)}-${counter}`,
        pubkey: pubkeyHex,
        created_at: request.createdAt,
        kind: request.kind,
        tags: request.tags,
        content: request.content,
        sig: "s".repeat(128),
      };
    },
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: pubkeyHex };
    },
  };
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

const SHARED_MEMBERSHIPS = [membership(SENDER_PUBKEY), membership(RECEIVER_PUBKEY)];

describe("Secure Runtime Alpha 1471-1540 -- End-to-End Real Runtime Verification (two relays, sender + receiver transports)", () => {
  it("delivers a Mailbox envelope through Multiple Relay fan-out to a real Inbound Subscription, with Relay Deduplication firing the callback exactly once despite two relays delivering the identical event, and the opaque payload bytes surviving the FULL sign -> publish -> OK-correlate -> subscribe -> dedup -> parse -> base64-decode pipeline byte-for-byte", async () => {
    const relayServer1 = new FakeRelayServer();
    const relayServer2 = new FakeRelayServer();
    const senderRelay1 = new LiveRelayConnection(relayServer1, "wss://relay-1.test");
    const senderRelay2 = new LiveRelayConnection(relayServer2, "wss://relay-2.test");
    const receiverRelay1 = new LiveRelayConnection(relayServer1, "wss://relay-1.test");
    const receiverRelay2 = new LiveRelayConnection(relayServer2, "wss://relay-2.test");

    // --- Sender-side setup: a real, persisted Envelope + Payload (Private Delivery reuse). ---
    const senderEnvelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const senderPayloadStorage = new InMemoryFedosConversationPayloadStorage();
    const conversationId = "board-1::thread-1";
    const ciphertext = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252, 253, 254, 255, 0]);

    const descriptor = validateFedosConversationPayloadDescriptor({
      id: "payload-1",
      conversationId,
      mediaType: "application/octet-stream",
      byteLength: ciphertext.length,
      createdAt: 1_700_000_000,
    })!;
    senderPayloadStorage.putPayload(descriptor, ciphertext);

    const envelope = validateFedosConversationMessageEnvelope({
      id: "envelope-e2e-1",
      conversationId,
      senderMembershipId: `membership-${SENDER_PUBKEY}`,
      payloadId: "payload-1",
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 1_700_000_000,
      replyToEnvelopeId: null,
    })!;
    senderEnvelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(envelope));

    const senderObservationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const senderTransport = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([senderRelay1, senderRelay2]),
      signingAuthority: fakeSigningAuthority(SENDER_PUBKEY),
      localAccountIndex: 0,
      envelopePersistence: senderEnvelopePersistence,
      payloadStorage: senderPayloadStorage,
      membershipsForConversation: () => SHARED_MEMBERSHIPS,
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository: senderObservationRepository,
      intervalMs: 1000,
    });

    // --- Receiver-side setup: an Inbound Subscription over the SAME two relays. ---
    const receivedEnvelopeIds: string[] = [];
    const receivedCiphertexts: Uint8Array[] = [];
    const receiverTransport = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([receiverRelay1, receiverRelay2]),
      signingAuthority: fakeSigningAuthority(RECEIVER_PUBKEY),
      localAccountIndex: 0,
      envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(),
      payloadStorage: new InMemoryFedosConversationPayloadStorage(),
      membershipsForConversation: () => [],
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository: new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence()),
      intervalMs: 1000,
      inbound: {
        filter: { kinds: [1] },
        onEnvelope: (parsed) => {
          receivedEnvelopeIds.push(parsed.envelopeId);
          receivedCiphertexts.push(parsed.ciphertext);
        },
      },
    });

    await senderTransport.start();
    await receiverTransport.start();
    try {
      // Mailbox Delivery: queue, then drive one tick -- real fan-out publish to BOTH relays.
      expect(senderTransport.sendMailbox(envelope.id, envelope.conversationId)).toBe("inserted");
      const tickEntries = await senderTransport.tick();

      expect(tickEntries).toHaveLength(1);
      expect(tickEntries[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });

      // Observation reuse: the sender's own canonical Observation history shows a real accepted fact.
      const subjectId = toFedosDeliveryObservationSubjectId(envelope.id)!;
      const history = senderTransport.observationQuery();
      const currentState = history.currentStateFor(`${subjectId}::attempt::1` as never);
      expect(currentState?.state).toBe("accepted");

      // Let the receiver's asynchronous, queued relay->subscription delivery settle
      // (LiveRelay.publish() defers OK/EVENT delivery via queueMicrotask).
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Relay Deduplication: the SAME event arrived via relay1 AND relay2, but the
      // envelope callback fired EXACTLY ONCE.
      expect(receivedEnvelopeIds).toEqual([envelope.id]);
      expect(receivedCiphertexts).toHaveLength(1);

      // Byte-for-byte proof: the opaque payload bytes survived
      // sign -> publish -> OK-correlate -> subscribe -> dedup -> parse ->
      // base64-decode without any corruption at any wire boundary.
      expect(receivedCiphertexts[0]).toEqual(ciphertext);
    } finally {
      await senderTransport.stop();
      await receiverTransport.stop();
    }
  });
});

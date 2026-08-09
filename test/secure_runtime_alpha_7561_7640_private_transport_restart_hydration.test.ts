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

/**
 * Secure Runtime Alpha 7561-7640 -- "FedOS Conversation Outbox Restart
 * Hydration and Scheduler Scalability Arc": Phase F restart-behavior
 * proofs at the `FedosPrivateTransport` construction level (the ONE real
 * production construction site this Arc's own production edit
 * touches). Mirrors `secure_runtime_alpha_1471_1540_private_transport_coordinator.test.ts`'s
 * own `ManualRelay`/`fakeSigningAuthority`/`buildTransport` fixture
 * style, extended to reuse the SAME `outboxPersistence`/
 * `observationRepository` instances across two separate
 * `FedosPrivateTransport` constructions -- the exact shape a real
 * process restart takes against durable, file-backed persistence (see
 * the Alpha 7561-7640 real vertical slice test for the file-backed,
 * real-relay, real-process-boundary version of this same proof).
 */

const LOCAL_PUBKEY = "a".repeat(64);
const COUNTERPARTY_PUBKEY = "b".repeat(64);
const CONVERSATION_ID = "board-1::thread-1";

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
    conversationId: CONVERSATION_ID as never,
    participant: { authority: "nostr" as const, publicIdentifier: participantHex, identityId: null },
    role: "member" as never,
    state: "active",
    joinedAt: 0,
    endedAt: null,
  });
}

function seedEnvelope(
  envelopePersistence: InMemoryFedosConversationMessageEnvelopePersistence,
  payloadStorage: InMemoryFedosConversationPayloadStorage,
  envelopeId: string,
  payloadId: string,
) {
  const ciphertext = new Uint8Array([1, 2, 3]);
  const descriptor = validateFedosConversationPayloadDescriptor({
    id: payloadId,
    conversationId: CONVERSATION_ID,
    mediaType: "application/octet-stream",
    byteLength: ciphertext.length,
    createdAt: 1_700_000_000,
  })!;
  payloadStorage.putPayload(descriptor, ciphertext);

  const envelope = validateFedosConversationMessageEnvelope({
    id: envelopeId,
    conversationId: CONVERSATION_ID,
    senderMembershipId: `membership-${LOCAL_PUBKEY}`,
    payloadId,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
  })!;
  envelopePersistence.putEnvelope(serializeFedosConversationMessageEnvelope(envelope));
  return envelope;
}

/** A settle tick -- lets the Scheduler's sequential per-intent `await` chain reach the next relay.publish() call before the test fires the next OK. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Secure Runtime Alpha 7561-7640 -- FedosPrivateTransport restart hydration", () => {
  it("1. delivered and abandoned intents from a prior session are never re-published after restart; a genuinely pending intent still is", async () => {
    // Durable (for this test's purposes: process-lifetime-independent)
    // state, reused across BOTH constructions below -- the exact shape
    // a real restart takes against file-backed persistence.
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();

    const envDelivered = seedEnvelope(envelopePersistence, payloadStorage, "envelope-delivered", "payload-delivered");
    const envAbandoned = seedEnvelope(envelopePersistence, payloadStorage, "envelope-abandoned", "payload-abandoned");
    const envPending = seedEnvelope(envelopePersistence, payloadStorage, "envelope-pending", "payload-pending");

    // ---- "Session 1", pre-restart ----
    const relay1 = new ManualRelay("wss://relay-1");
    const transport1 = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay1]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
      outboxPersistence,
      observationRepository,
      intervalMs: 1000,
    });
    await transport1.start();

    expect(transport1.sendMailbox(envDelivered.id, envDelivered.conversationId)).toBe("inserted");
    expect(transport1.sendMailbox(envAbandoned.id, envAbandoned.conversationId)).toBe("inserted");

    const tick1 = transport1.tick();
    await settle();
    relay1.fireOk(relay1.published[0]!.id, true); // envDelivered -> accepted -> "delivered"
    await settle();
    relay1.fireOk(relay1.published[1]!.id, false); // envAbandoned -> rejected (only relay) -> "rejected"/"never" -> abandoned
    const entries1 = await tick1;
    expect(entries1).toHaveLength(2);
    expect(entries1[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
    expect(entries1[1]!.result).toEqual({ outcome: "rejected", retryPolicy: "never" });

    // The pending intent is enqueued AFTER the only tick() this session
    // runs -- zero attempt history, exactly the "genuinely pending"
    // case. transport1 is stopped before it could ever be attempted.
    expect(transport1.sendMailbox(envPending.id, envPending.conversationId)).toBe("inserted");
    await transport1.stop();

    expect(relay1.published).toHaveLength(2); // never attempted envPending

    // ---- "Session 2", post-restart -- SAME durable persistences, a
    // FRESH relay connection and a FRESH Scheduler, exactly like a real
    // process restart reconnecting to relays and reconstructing
    // `FedosPrivateTransport` from `fedos_desktop_runtime.ts`'s own real
    // production construction path. ----
    const relay2 = new ManualRelay("wss://relay-1");
    const transport2 = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay2]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
      outboxPersistence,
      observationRepository,
      intervalMs: 1000,
    });
    await transport2.start();

    const tick2 = transport2.tick();
    await settle();
    // Exactly one publish should have happened by now -- envPending.
    // If hydration failed, envDelivered and/or envAbandoned would ALSO
    // have been re-published here, and relay2.published would be longer
    // than 1 at this point.
    expect(relay2.published).toHaveLength(1);
    relay2.fireOk(relay2.published[0]!.id, true);
    const entries2 = await tick2;

    expect(entries2).toHaveLength(1); // ONLY the genuinely pending intent was attempted
    expect(entries2[0]!.intent.envelopeId).toBe(envPending.id);
    expect(entries2[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
    expect(relay2.published).toHaveLength(1); // envDelivered/envAbandoned were NEVER re-published

    await transport2.stop();
  });

  it("2. five restart cycles over an already-fully-resolved Outbox produce zero retry amplification", async () => {
    const outboxPersistence = new InMemoryFedosConversationTransportOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();

    const envDelivered = seedEnvelope(envelopePersistence, payloadStorage, "envelope-amp-delivered", "payload-amp-delivered");
    const envAbandoned = seedEnvelope(envelopePersistence, payloadStorage, "envelope-amp-abandoned", "payload-amp-abandoned");

    function buildTransport(relay: ManualRelay) {
      return new FedosPrivateTransport({
        relaySet: new FedosConversationRelaySet([relay]),
        signingAuthority: fakeSigningAuthority(),
        localAccountIndex: 0,
        envelopePersistence,
        payloadStorage,
        membershipsForConversation: () => [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
        outboxPersistence,
        observationRepository,
        intervalMs: 1000,
      });
    }

    // Cycle 0 -- resolve both intents once.
    const relay0 = new ManualRelay("wss://relay-1");
    const transport0 = buildTransport(relay0);
    await transport0.start();
    transport0.sendMailbox(envDelivered.id, envDelivered.conversationId);
    transport0.sendMailbox(envAbandoned.id, envAbandoned.conversationId);
    const tick0 = transport0.tick();
    await settle();
    relay0.fireOk(relay0.published[0]!.id, true);
    await settle();
    relay0.fireOk(relay0.published[1]!.id, false);
    await tick0;
    await transport0.stop();
    expect(relay0.published).toHaveLength(2);

    // Cycles 1-5 -- fresh Transport, fresh relay, SAME durable state.
    // Each cycle's tick() must publish NOTHING (both intents are
    // already terminal) -- proves hydration is applied on EVERY
    // construction, not just the first restart, and that repeated
    // restarts never re-accumulate retry work.
    for (let cycle = 1; cycle <= 5; cycle++) {
      const relay = new ManualRelay("wss://relay-1");
      const transport = buildTransport(relay);
      await transport.start();
      const entries = await transport.tick();
      expect(entries).toHaveLength(0);
      expect(relay.published).toHaveLength(0);
      await transport.stop();
    }
  });
});

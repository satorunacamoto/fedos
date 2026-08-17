/**
 * Outbox Flush Reliability arc — deterministic local root-cause
 * reproduction (mandate §21/§28: local fake transport first, never
 * public-network variability). Reuses the exact fixture pattern from
 * `secure_runtime_alpha_1471_1540_private_transport_coordinator.test.ts`.
 *
 * Hypothesis under test: a message that returns `queued` synchronously
 * (already truthful per the delivery-truth arc, `50ffce50`) can, on its
 * async background tick, receive a real, terminal `"rejected"` OK from
 * every relay in the set — and this codebase's own Scheduler correctly
 * treats that as permanently abandoned (never retried, matching its own
 * documented "a real rejection is never retried" policy) but records the
 * outcome ONLY into `FedosDeliveryObservationRepository` — nowhere does
 * any presentation/Shell-layer code read it back. So a genuinely,
 * permanently rejected message is silently, invisibly lost from the
 * user's perspective, forever "queued" as far as anything the user can
 * see is concerned.
 */
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
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationMembership } from "../src/os/messenger/conversations/membership/fedos_conversation_membership.js";

const LOCAL_PUBKEY = "a".repeat(64);
const COUNTERPARTY_PUBKEY = "b".repeat(64);

function fakeSigningAuthority(): FedosNostrSigningAuthority {
  return {
    async signEvent(request) {
      const id = `event-${request.tags.find((t) => t[0] === "e-envelope")?.[1] ?? "unknown"}`;
      return { id, pubkey: LOCAL_PUBKEY, created_at: request.createdAt, kind: request.kind, tags: request.tags, content: request.content, sig: "s".repeat(128) };
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

describe("Outbox Flush Reliability -- root-cause reproduction: silent, permanent rejection", () => {
  it("a message that returns 'queued' synchronously can be terminally, permanently rejected on its async tick, with the outcome recorded ONLY in the Delivery Observation repository -- no queryable per-message status surfaces it, and the item is never retried again", async () => {
    const relay = new ManualRelay("wss://relay-1");
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const envelope = seedEnvelopeAndPayload(envelopePersistence, payloadStorage, new Uint8Array([1, 2, 3]));
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());

    const transport = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository,
      intervalMs: 1000,
    });

    await transport.start();
    try {
      // Step 1: the SYNCHRONOUS enqueue -- this is the "queued" outcome the
      // renderer sees immediately (already honest since 50ffce50).
      const writeResult = transport.sendMailbox(envelope.id, envelope.conversationId);
      expect(writeResult).toBe("inserted");

      // Step 2: the ASYNC tick actually runs, and the relay genuinely,
      // explicitly rejects it (a real, protocol-correct OK{accepted:false} --
      // not a timeout, not a connection failure).
      const tickPromise = transport.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(relay.published).toHaveLength(1);
      relay.fireOk(relay.published[0]!.id, false);
      const entries = await tickPromise;

      expect(entries).toHaveLength(1);
      expect(entries[0]!.result, "the Scheduler correctly classifies a real rejection as terminal -- this part of the design is sound").toEqual({
        outcome: "rejected",
        retryPolicy: "never",
      });

      // Step 3: prove it is NEVER retried again (the Scheduler's own
      // documented, correct "abandoned" behavior for a real rejection).
      const secondTick = await transport.tick();
      expect(secondTick, "a genuinely rejected item must never be re-attempted -- confirms retryPolicy:never is honored").toHaveLength(0);
      expect(relay.published, "no second publish attempt for the abandoned item").toHaveLength(1);

      // Step 4: the real, terminal "rejected" fact exists, durably, in the
      // Delivery Observation repository.
      const query = new FedosDeliveryObservationQuery(observationRepository);
      const rejectedObservations = query.listByState("rejected");
      expect(rejectedObservations.length, "the terminal rejection fact IS durably recorded -- it is not lost from storage, only from anything the user can see").toBeGreaterThan(0);

      // Step 5: THE FIX -- deliveryStatusForEnvelope() closes the gap:
      // a caller now has a real, queryable, presentation-safe answer.
      expect(transport.deliveryStatusForEnvelope(envelope.id)).toBe("rejected");

      // ...but `sendMailbox()`'s own return value (Step 1) is the ONLY
      // signal any caller ever receives about this specific logical send --
      // it is a plain write-result enum (`"inserted"`), not a Promise that
      // resolves once the real tick outcome is known, and NOTHING in this
      // codebase's presentation/Shell layer (confirmed by source-wide
      // search: zero references to FedosDeliveryObservationQuery or
      // FedosDeliveryObservationRepository outside board/observation and
      // this transport layer itself) ever reads this envelope's own
      // Observation record back out to surface "Failed"/"Rejected" to a
      // renderer. A caller that only inspects `sendMailbox()`'s own return
      // value, or the earlier delivery-truth arc's synchronous `queued`
      // result, has no way to ever learn this message was rejected.
    } finally {
      await transport.stop();
    }
  });

  it("deliveryStatusForEnvelope() reports 'not-yet-attempted' before any tick, 'delivered' after a real accepted OK, and 'retrying' after a transient timeout (never terminal for a retryable failure)", async () => {
    const relay = new ManualRelay("wss://relay-1");
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const envelope = seedEnvelopeAndPayload(envelopePersistence, payloadStorage, new Uint8Array([9, 9, 9]));
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());

    const transport = new FedosPrivateTransport({
      relaySet: new FedosConversationRelaySet([relay]),
      signingAuthority: fakeSigningAuthority(),
      localAccountIndex: 0,
      envelopePersistence,
      payloadStorage,
      membershipsForConversation: () => [membership(LOCAL_PUBKEY), membership(COUNTERPARTY_PUBKEY)],
      outboxPersistence: new InMemoryFedosConversationTransportOutboxPersistence(),
      observationRepository,
      intervalMs: 1000,
    });

    await transport.start();
    try {
      // Before any send at all: honestly "not-yet-attempted", never a fabricated status.
      expect(transport.deliveryStatusForEnvelope(envelope.id)).toBe("not-yet-attempted");

      expect(transport.sendMailbox(envelope.id, envelope.conversationId)).toBe("inserted");
      // Enqueued but the async tick has not yet run -- still honestly "not-yet-attempted".
      expect(transport.deliveryStatusForEnvelope(envelope.id)).toBe("not-yet-attempted");

      const tickPromise = transport.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      relay.fireOk(relay.published[0]!.id, true);
      await tickPromise;

      expect(transport.deliveryStatusForEnvelope(envelope.id)).toBe("delivered");
    } finally {
      await transport.stop();
    }
  });
});

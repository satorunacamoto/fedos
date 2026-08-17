import { describe, it, expect } from "vitest";
import { FedosConversationRelaySet } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_relay_set.js";
import { FedosRelayEventDeduplicator } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_relay_event_deduplicator.js";
import { FedosMultiRelayOkCorrelatedConversationTransportPublisher } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_multi_relay_ok_correlated_conversation_transport_publisher.js";
import { FedosConversationInboundSubscription } from "../src/os/messenger/adapters/nostr/transport/relay/fedos_conversation_inbound_subscription.js";
import {
  buildFedosPrivateTransportUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_event.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
import type {
  FedosPersistedConversationTransportOutboxRecord,
  FedosPersistedConversationTransportOutboxRecordV1,
} from "../src/os/messenger/adapters/nostr/transport/fedos_conversation_transport_outbox_codec.js";
import { RealFedosNostrSigningAuthority } from "./support/real_fedos_nostr_signing_authority.js";

/** Mirrors `ManualRelay` (`test/secure_runtime_alpha_730_ok_listener_lifecycle.test.ts`) -- a directly-controllable `FedosRelay` double, extended with subscribe/fireEvent for Inbound Subscription tests. */
class ManualRelay implements FedosRelay {
  readonly url: string;
  #connected = false;
  #relayListener: FedosRelayMessageListener | undefined;
  #subscriptionListeners = new Map<string, FedosSubscriptionListener>();
  #subscriptionCounter = 0;
  readonly published: FedosEventDescriptor[] = [];
  #shouldFailConnect = false;

  constructor(url: string) {
    this.url = url;
  }

  failNextConnect(): void {
    this.#shouldFailConnect = true;
  }
  fireOk(eventId: string, accepted: boolean): void {
    this.#relayListener?.({ kind: "ok", eventId, accepted, message: "" });
  }
  fireEvent(subscriptionId: string, event: FedosNostrWireEvent): void {
    this.#subscriptionListeners.get(subscriptionId)?.({ kind: "event", subscriptionId, event });
  }

  async connect(): Promise<void> {
    if (this.#shouldFailConnect) {
      this.#shouldFailConnect = false;
      throw new Error("simulated connect failure");
    }
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
    this.#subscriptionCounter += 1;
    return { id: `sub-${this.url}-${this.#subscriptionCounter}` };
  }
  async unsubscribe(subscription: FedosSubscription): Promise<void> {
    this.#subscriptionListeners.delete(subscription.id);
  }
  onSubscriptionMessage(subscription: FedosSubscription, listener: FedosSubscriptionListener): void {
    this.#subscriptionListeners.set(subscription.id, listener);
  }
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

describe("Secure Runtime Alpha 1471-1540 -- Multiple Relay Fan-out (Relay Set)", () => {
  it("1. rejects an empty relay list", () => {
    expect(() => new FedosConversationRelaySet([])).toThrow();
  });

  it("2. connectAll connects every relay independently -- one relay's failure never blocks another", async () => {
    const good = new ManualRelay("wss://good.test");
    const bad = new ManualRelay("wss://bad.test");
    bad.failNextConnect();
    const set = new FedosConversationRelaySet([good, bad]);

    const outcomes = await set.connectAll();
    expect(outcomes).toEqual([
      { url: "wss://good.test", connected: true },
      { url: "wss://bad.test", connected: false },
    ]);
    expect(set.connectedCount()).toBe(1);
  });
});

describe("Secure Runtime Alpha 1471-1540 -- Relay Deduplication", () => {
  it("1. shouldProcess is true exactly once per event id, regardless of how many relays deliver it", () => {
    const dedup = new FedosRelayEventDeduplicator();
    expect(dedup.shouldProcess("event-1")).toBe(true);
    expect(dedup.shouldProcess("event-1")).toBe(false);
    expect(dedup.shouldProcess("event-1")).toBe(false);
    expect(dedup.shouldProcess("event-2")).toBe(true);
  });

  it("2. evicts the oldest entry once maxSize is reached (FIFO), never growing unboundedly", () => {
    const dedup = new FedosRelayEventDeduplicator(2);
    expect(dedup.shouldProcess("a")).toBe(true);
    expect(dedup.shouldProcess("b")).toBe(true);
    expect(dedup.shouldProcess("c")).toBe(true); // evicts "a"
    expect(dedup.size()).toBe(2);
    expect(dedup.shouldProcess("a")).toBe(true); // "a" was evicted, so it is processed again
  });
});

function fakeEventSourceReturning(event: FedosNostrWireEvent | null) {
  return async (_record: FedosPersistedConversationTransportOutboxRecord) => event;
}

function fakeOutboxRecord(): FedosPersistedConversationTransportOutboxRecordV1 {
  return { schemaVersion: 1, id: "outbox-1", envelopeId: "envelope-1", conversationId: "conversation-1", createdAt: 0 };
}

function fakeWireEvent(id: string): FedosNostrWireEvent {
  const request = buildFedosPrivateTransportUnsignedEventRequest({
    envelope: {
      id: "envelope-1" as never,
      conversationId: "conversation-1" as never,
      senderMembershipId: "m1" as never,
      payloadId: "p1" as never,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 0,
      replyToEnvelopeId: null,
    },
    ciphertext: new Uint8Array([1, 2, 3]),
    counterpartyPublicKeyHex: "b".repeat(64),
    localAccountIndex: 0,
  });
  return {
    id,
    pubkey: "a".repeat(64),
    created_at: request.createdAt,
    kind: request.kind,
    tags: request.tags,
    content: request.content,
    sig: "s".repeat(128),
  };
}

/**
 * Red Team P0 closure -- `FedosConversationInboundSubscription` now runs
 * every inbound event through `validateInboundNostrEvent()` (real Event ID
 * + real BIP-340 signature verification) BEFORE dedup/delivery, so the
 * Inbound Subscription tests below (unlike `fakeWireEvent()` above, which
 * is still fine for the OK-correlated publisher tests, which never touch
 * the validator) need a GENUINELY signed event. `signingAuthority` is a
 * real-crypto `FedosNostrSigningAuthority` stand-in
 * (`test/support/real_fedos_nostr_signing_authority.ts`) -- the same
 * pattern this repository's own "real vertical slice" tests already use.
 */
const signingAuthority = new RealFedosNostrSigningAuthority();

async function realSignedWireEvent(envelopeId: string, counterpartyPublicKeyHex: string): Promise<FedosNostrWireEvent> {
  const request = buildFedosPrivateTransportUnsignedEventRequest({
    envelope: {
      id: envelopeId as never,
      conversationId: "conversation-1" as never,
      senderMembershipId: "m1" as never,
      payloadId: "p1" as never,
      encryptionSuite: "ChaCha20Poly1305",
      keyEpoch: 0,
      createdAt: 0,
      replyToEnvelopeId: null,
    },
    ciphertext: new Uint8Array([1, 2, 3]),
    counterpartyPublicKeyHex,
    localAccountIndex: 0,
  });
  const event = await signingAuthority.signEvent(request);
  if (event === null) throw new Error("realSignedWireEvent: signing failed unexpectedly");
  return event;
}

describe("Secure Runtime Alpha 1471-1540 -- Multi-Relay OK-Correlated Publisher (aggregation policy)", () => {
  it("1. delivered if ANY relay accepts", async () => {
    const r1 = new ManualRelay("wss://r1");
    const r2 = new ManualRelay("wss://r2");
    const event = fakeWireEvent("e".repeat(64));
    const publisher = new FedosMultiRelayOkCorrelatedConversationTransportPublisher(
      new FedosConversationRelaySet([r1, r2]),
      fakeEventSourceReturning(event),
      50,
    );
    const promise = publisher.publish(fakeOutboxRecord());
    await new Promise((resolve) => setTimeout(resolve, 0));
    r1.fireOk(event.id, false);
    r2.fireOk(event.id, true);
    await expect(promise).resolves.toEqual({ outcome: "delivered", retryPolicy: "never" });
  });

  it("2. rejected only when EVERY relay explicitly rejects", async () => {
    const r1 = new ManualRelay("wss://r1");
    const r2 = new ManualRelay("wss://r2");
    const event = fakeWireEvent("f".repeat(64));
    const publisher = new FedosMultiRelayOkCorrelatedConversationTransportPublisher(
      new FedosConversationRelaySet([r1, r2]),
      fakeEventSourceReturning(event),
      50,
    );
    const promise = publisher.publish(fakeOutboxRecord());
    await new Promise((resolve) => setTimeout(resolve, 0));
    r1.fireOk(event.id, false);
    r2.fireOk(event.id, false);
    await expect(promise).resolves.toEqual({ outcome: "rejected", retryPolicy: "never" });
  });

  it("3. failed/later on a timeout mix (no accept, not all reject)", async () => {
    const r1 = new ManualRelay("wss://r1");
    const r2 = new ManualRelay("wss://r2");
    const event = fakeWireEvent("1".repeat(64));
    const publisher = new FedosMultiRelayOkCorrelatedConversationTransportPublisher(
      new FedosConversationRelaySet([r1, r2]),
      fakeEventSourceReturning(event),
      20,
    );
    const promise = publisher.publish(fakeOutboxRecord());
    await new Promise((resolve) => setTimeout(resolve, 0));
    r1.fireOk(event.id, false); // one explicit rejection, one silent timeout
    await expect(promise).resolves.toEqual({ outcome: "failed", retryPolicy: "later" });
  });

  it("4. failed/later immediately when no signed event is available yet", async () => {
    const r1 = new ManualRelay("wss://r1");
    const publisher = new FedosMultiRelayOkCorrelatedConversationTransportPublisher(
      new FedosConversationRelaySet([r1]),
      fakeEventSourceReturning(null),
    );
    await expect(publisher.publish(fakeOutboxRecord())).resolves.toEqual({ outcome: "failed", retryPolicy: "later" });
    expect(r1.published).toHaveLength(0);
  });

  it("5. registers exactly ONE onRelayMessage listener per relay, at construction -- never per publish() call", async () => {
    const r1 = new ManualRelay("wss://r1");
    let registrations = 0;
    const originalOnRelayMessage = r1.onRelayMessage.bind(r1);
    r1.onRelayMessage = (listener) => {
      registrations += 1;
      originalOnRelayMessage(listener);
    };
    const event1 = fakeWireEvent("2".repeat(64));
    const event2 = fakeWireEvent("3".repeat(64));
    const publisher = new FedosMultiRelayOkCorrelatedConversationTransportPublisher(
      new FedosConversationRelaySet([r1]),
      async (record) => (record.id === "outbox-1" ? event1 : event2),
      50,
    );
    expect(registrations).toBe(1);
    const p1 = publisher.publish(fakeOutboxRecord());
    await new Promise((resolve) => setTimeout(resolve, 0));
    r1.fireOk(event1.id, true);
    await p1;
    expect(registrations).toBe(1);
  });
});

describe("Secure Runtime Alpha 1471-1540 -- Inbound Subscription (dedup across relays + client-side recipient filter)", () => {
  it("1. the SAME event arriving via two relays fires the envelope callback exactly once", async () => {
    const r1 = new ManualRelay("wss://r1");
    const r2 = new ManualRelay("wss://r2");
    await r1.connect();
    await r2.connect();
    const relaySet = new FedosConversationRelaySet([r1, r2]);
    const localPubkey = "b".repeat(64); // matches the "p" tag realSignedWireEvent() builds
    const subscription = new FedosConversationInboundSubscription(relaySet, localPubkey);

    const received: string[] = [];
    await subscription.start({ kinds: [1] }, (envelope) => received.push(envelope.envelopeId));

    const event = await realSignedWireEvent("envelope-1", localPubkey);
    r1.fireEvent(`sub-wss://r1-1`, event);
    r2.fireEvent(`sub-wss://r2-1`, event); // identical event id, delivered by a second relay

    expect(received).toEqual(["envelope-1"]);
  });

  it("2. ignores an event addressed to a different recipient", async () => {
    const r1 = new ManualRelay("wss://r1");
    await r1.connect();
    const relaySet = new FedosConversationRelaySet([r1]);
    const subscription = new FedosConversationInboundSubscription(relaySet, "c".repeat(64)); // does NOT match the "p" tag

    const received: string[] = [];
    await subscription.start({ kinds: [1] }, (envelope) => received.push(envelope.envelopeId));
    r1.fireEvent("sub-wss://r1-1", await realSignedWireEvent("envelope-1", "b".repeat(64)));

    expect(received).toEqual([]);
  });

  it("3. start() may only be called once per instance", async () => {
    const r1 = new ManualRelay("wss://r1");
    const subscription = new FedosConversationInboundSubscription(new FedosConversationRelaySet([r1]), "b".repeat(64));
    await subscription.start({ kinds: [1] }, () => {});
    await expect(subscription.start({ kinds: [1] }, () => {})).rejects.toThrow();
  });

  // -------------------------------------------------------------------
  // Red Team P0 closure -- inbound event validation (id + signature)
  // -------------------------------------------------------------------

  it("4. an event with a tampered id (does not match its own content hash) is rejected and never reaches onEnvelope", async () => {
    const r1 = new ManualRelay("wss://r1");
    await r1.connect();
    const relaySet = new FedosConversationRelaySet([r1]);
    const localPubkey = "b".repeat(64);
    const subscription = new FedosConversationInboundSubscription(relaySet, localPubkey);

    const received: string[] = [];
    await subscription.start({ kinds: [1] }, (envelope) => received.push(envelope.envelopeId));

    const event = await realSignedWireEvent("envelope-tampered-id", localPubkey);
    const tamperedId = event.id.slice(0, -1) + (event.id.endsWith("9") ? "8" : "9");
    r1.fireEvent("sub-wss://r1-1", { ...event, id: tamperedId });

    expect(received, "an event whose id does not match its own content hash must never reach onEnvelope").toEqual([]);
  });

  it("5. an event with an invalid/wrong signature is rejected and never reaches onEnvelope", async () => {
    const r1 = new ManualRelay("wss://r1");
    await r1.connect();
    const relaySet = new FedosConversationRelaySet([r1]);
    const localPubkey = "b".repeat(64);
    const subscription = new FedosConversationInboundSubscription(relaySet, localPubkey);

    const received: string[] = [];
    await subscription.start({ kinds: [1] }, (envelope) => received.push(envelope.envelopeId));

    const event = await realSignedWireEvent("envelope-bad-sig", localPubkey);
    const tamperedSig = event.sig.slice(0, -1) + (event.sig.endsWith("9") ? "8" : "9");
    r1.fireEvent("sub-wss://r1-1", { ...event, sig: tamperedSig });

    expect(received, "an event whose sig does not verify under its own pubkey must never reach onEnvelope").toEqual([]);
  });

  it("6. a genuinely duplicate valid event id (replay, e.g. via the same or a second relay) is still deduped to exactly one onEnvelope callback post-fix", async () => {
    const r1 = new ManualRelay("wss://r1");
    await r1.connect();
    const relaySet = new FedosConversationRelaySet([r1]);
    const localPubkey = "b".repeat(64);
    const subscription = new FedosConversationInboundSubscription(relaySet, localPubkey);

    const received: string[] = [];
    await subscription.start({ kinds: [1] }, (envelope) => received.push(envelope.envelopeId));

    const event = await realSignedWireEvent("envelope-replay", localPubkey);
    r1.fireEvent("sub-wss://r1-1", event);
    r1.fireEvent("sub-wss://r1-1", event); // identical, genuinely-valid event replayed

    expect(received, "dedup-by-verified-id must still collapse a real replay to exactly one callback").toEqual(["envelope-replay"]);
  });

  it("7. a well-formed, correctly-signed event is still processed normally end-to-end -- regression guard for the validation wiring", async () => {
    const r1 = new ManualRelay("wss://r1");
    await r1.connect();
    const relaySet = new FedosConversationRelaySet([r1]);
    const localPubkey = "b".repeat(64);
    const subscription = new FedosConversationInboundSubscription(relaySet, localPubkey);

    const received: string[] = [];
    await subscription.start({ kinds: [1] }, (envelope) => received.push(envelope.envelopeId));

    r1.fireEvent("sub-wss://r1-1", await realSignedWireEvent("envelope-valid", localPubkey));

    expect(received, "a real, validly-signed event from a real contact must still be delivered unchanged").toEqual(["envelope-valid"]);
  });
});

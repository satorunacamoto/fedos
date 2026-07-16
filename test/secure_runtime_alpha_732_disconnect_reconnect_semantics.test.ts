import { describe, it, expect } from "vitest";
import { FedosRelayOkCorrelatedNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.js";
import type { FedosRelay } from "../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
import type { FedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";

/** A `FedosRelay` double whose `onRelayMessage` listener can be swapped, standing in for "reconnecting with a new socket" -- each `FedosRelayOkCorrelatedNostrBoardPublisher` registers its OWN listener once at construction (Alpha 730), so a NEW publisher instance stands in for a fresh Relay/socket connection cycle in this unit-level test. */
class SwappableListenerRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];

  fireOkOnCurrentListener(eventId: string, accepted: boolean): void {
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
    if (!this.#connected) throw new Error("FedosRelay.publish() called while not connected.");
    this.published.push(event);
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used");
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener; // Alpha 238's own "one Relay-level listener" -- a later registration overwrites the prior one.
  }
}

function fakeIntent(): FedosBoardOutboxIntent {
  return Object.freeze({ id: "intent-1" as never, postId: "post-1" as never, target: { protocol: "nostr" as const, destination: null }, createdAt: 0 });
}
function fakeEvent(id: string): FedosNostrWireEvent {
  return Object.freeze({ id, pubkey: "a".repeat(64), created_at: 1, kind: 1, tags: [], content: "x", sig: "b".repeat(128) });
}

/**
 * Secure Runtime Alpha 732 ("Disconnect and Reconnect Semantics") --
 * Stage 12 of the Alpha 721–740 Arc.
 */
describe("Secure Runtime Alpha 732 -- Disconnect and Reconnect Semantics", () => {
  it("1. an active publish on disconnect fails (transport throw) rather than hanging or falsely succeeding", async () => {
    const relay = new SwappableListenerRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);
    await relay.disconnect();

    const result = await publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent("1".repeat(64)) });
    expect(result).toEqual({ outcome: "failed", externalReference: null });
  });

  it("2. reconnect with a new socket: a NEW Publisher instance (standing in for a fresh Relay/socket) starts with a clean pending set", async () => {
    const relayGen1 = new SwappableListenerRelay();
    const publisherGen1 = new FedosRelayOkCorrelatedNostrBoardPublisher(relayGen1, 30);
    const eventId = "2".repeat(64);
    const staleResult = await publisherGen1.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(eventId) });
    expect(staleResult).toEqual({ outcome: "failed", externalReference: null }); // timed out, old "connection" never ACKed

    // "Reconnect" -- a fresh Relay + fresh Publisher, simulating a new socket generation.
    const relayGen2 = new SwappableListenerRelay();
    const publisherGen2 = new FedosRelayOkCorrelatedNostrBoardPublisher(relayGen2, 500);
    const freshPromise = publisherGen2.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(eventId) });
    relayGen2.fireOkOnCurrentListener(eventId, true);
    await expect(freshPromise).resolves.toEqual({ outcome: "accepted", externalReference: eventId });
  });

  it("3. a late callback from an OLD generation's own relay reference cannot complete a NEW publish for the same Event ID", async () => {
    // Simulates: gen-1's relay reference somehow still fires late (e.g. a
    // queued callback) after gen-2 has already taken over -- since each
    // Publisher instance owns its OWN #pending map, gen-1's late fire can
    // only ever resolve gen-1's OWN (already-settled or timed-out) entry,
    // never gen-2's.
    const relayGen1 = new SwappableListenerRelay();
    const publisherGen1 = new FedosRelayOkCorrelatedNostrBoardPublisher(relayGen1, 30);
    const eventId = "3".repeat(64);
    const gen1Result = await publisherGen1.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(eventId) });
    expect(gen1Result.outcome).toBe("failed"); // timed out

    const relayGen2 = new SwappableListenerRelay();
    const publisherGen2 = new FedosRelayOkCorrelatedNostrBoardPublisher(relayGen2, 500);
    const gen2Promise = publisherGen2.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(eventId) });

    // A late fire on the OLD (gen-1) relay reference must not affect gen-2's still-pending publish.
    expect(() => relayGen1.fireOkOnCurrentListener(eventId, true)).not.toThrow();

    // gen-2's own relay must still correlate correctly.
    relayGen2.fireOkOnCurrentListener(eventId, true);
    await expect(gen2Promise).resolves.toEqual({ outcome: "accepted", externalReference: eventId });
  });

  it("4. no automatic republish inside the Publisher -- publishOneOutcome() sends at most once per call, regardless of outcome", async () => {
    const relay = new SwappableListenerRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 30);
    await publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent("4".repeat(64)) });
    expect(relay.published).toHaveLength(1); // exactly one send attempt, no internal retry
  });
});

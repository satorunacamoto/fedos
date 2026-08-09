import { describe, it, expect } from "vitest";
import { FedosRelayOkCorrelatedNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
import type { FedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";

class ManualRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];

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
    if (!this.#connected) throw new Error("not connected");
    this.published.push(event);
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used");
  }
  async unsubscribe(): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

function fakeIntent(): FedosBoardOutboxIntent {
  return Object.freeze({
    id: "intent-1" as never,
    postId: "post-1" as never,
    target: { protocol: "nostr" as const, destination: null },
    createdAt: 0,
  });
}

function fakeEvent(id: string): FedosNostrWireEvent {
  return Object.freeze({ id, pubkey: "a".repeat(64), created_at: 1, kind: 1, tags: [], content: "x", sig: "b".repeat(128) });
}

/**
 * Secure Runtime Alpha 731 ("Concurrent Publish Correlation") -- Stage 11
 * of the Alpha 721–740 Arc. Multiple in-flight Event IDs correlate
 * independently, in any arrival order, with no cross-resolution.
 */
describe("Secure Runtime Alpha 731 -- Concurrent Publish Correlation", () => {
  it("1. Event A accepted, Event B rejected, unrelated Event C ignored, out-of-order arrival, no cross-resolution", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);

    const idA = "a".repeat(64);
    const idB = "b".repeat(64);
    const idC = "c".repeat(64); // never actually published -- its OK must be ignored entirely

    const promiseA = publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(idA) });
    const promiseB = publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(idB) });

    // Arrive out of order: B's OK first, then an unrelated C, then A's OK.
    relay.fireOk(idB, false);
    relay.fireOk(idC, true);
    relay.fireOk(idA, true);

    const [resultA, resultB] = await Promise.all([promiseA, promiseB]);
    expect(resultA).toEqual({ outcome: "accepted", externalReference: idA });
    expect(resultB).toEqual({ outcome: "rejected", externalReference: idB });
    expect(relay.published.map((e) => e.id).sort()).toEqual([idA, idB].sort());
  });

  it("2. each listener/pending entry is cleaned up independently -- settling A does not affect B's own still-pending entry", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);

    const idA = "1".repeat(64);
    const idB = "2".repeat(64);
    const promiseA = publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(idA) });
    const promiseB = publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(idB) });

    relay.fireOk(idA, true);
    const resultA = await promiseA;
    expect(resultA.outcome).toBe("accepted");

    // B must still be independently resolvable after A settled.
    relay.fireOk(idB, true);
    const resultB = await promiseB;
    expect(resultB).toEqual({ outcome: "accepted", externalReference: idB });
  });

  it("3. many concurrent publishes (10) all resolve correctly and independently", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);

    const ids = Array.from({ length: 10 }, (_, i) => String(i).repeat(64).slice(0, 64));
    const promises = ids.map((id) => publisher.publishOneOutcome({ intent: fakeIntent(), event: fakeEvent(id) }));

    // Fire in reverse order, alternating accept/reject.
    for (let i = ids.length - 1; i >= 0; i--) {
      relay.fireOk(ids[i]!, i % 2 === 0);
    }

    const results = await Promise.all(promises);
    results.forEach((result, i) => {
      expect(result).toEqual({
        outcome: i % 2 === 0 ? "accepted" : "rejected",
        externalReference: ids[i],
      });
    });
  });
});

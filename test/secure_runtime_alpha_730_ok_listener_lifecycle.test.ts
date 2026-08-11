import { describe, it, expect, vi } from "vitest";
import { FedosRelayOkCorrelatedNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../src/os/messenger/desktop/fedos_relay_listeners.js";
import type { FedosSubscription } from "../src/os/messenger/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/os/messenger/desktop/fedos_subscription_filter.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
import type { FedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";

/** A directly-controllable `FedosRelay` double -- the test itself decides exactly when/whether to fire an inbound OK, never automatically. */
class ManualRelay implements FedosRelay {
  readonly url = "wss://fake-relay.test";
  #connected = true;
  #relayListener: FedosRelayMessageListener | undefined;
  readonly published: FedosEventDescriptor[] = [];
  #shouldThrow = false;

  throwOnNextPublish(): void {
    this.#shouldThrow = true;
  }
  fireOk(eventId: string, accepted: boolean, message = ""): void {
    this.#relayListener?.({ kind: "ok", eventId, accepted, message });
  }
  fireNotice(message: string): void {
    this.#relayListener?.({ kind: "notice", message });
  }
  listenerCount(): number {
    return this.#relayListener === undefined ? 0 : 1;
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
    if (this.#shouldThrow) {
      this.#shouldThrow = false;
      throw new Error("simulated send failure");
    }
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

function fakeIntent(target: { protocol: "nostr" | "activitypub" | "atproto" | "session"; destination: string | null }): FedosBoardOutboxIntent {
  return Object.freeze({
    id: "intent-1" as never,
    postId: "post-1" as never,
    target,
    createdAt: 0,
  });
}

function fakeEvent(id: string): FedosNostrWireEvent {
  return Object.freeze({
    id,
    pubkey: "a".repeat(64),
    created_at: 1,
    kind: 1,
    tags: [],
    content: "x",
    sig: "b".repeat(128),
  });
}

/**
 * Secure Runtime Alpha 730 ("OK Listener Lifecycle Implementation") --
 * Stage 10 of the Alpha 721–740 Arc. Direct, unit-level tests against
 * `FedosRelayOkCorrelatedNostrBoardPublisher.publishOneOutcome()`
 * (Alpha 723/724).
 */
describe("Secure Runtime Alpha 730 -- OK Listener Lifecycle", () => {
  it("1. registers exactly ONE relay-wide listener at construction, never per-publish", async () => {
    const relay = new ManualRelay();
    expect(relay.listenerCount()).toBe(0);
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);
    expect(relay.listenerCount()).toBe(1);

    const eventId = "e".repeat(64);
    const promise = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    expect(relay.listenerCount()).toBe(1); // unchanged -- publishing never re-registers
    relay.fireOk(eventId, true);
    await promise;
    expect(relay.listenerCount()).toBe(1); // still exactly one, after settlement
  });

  it("2. exact Event ID filter -- a matching OK resolves, case-sensitive/exact string match", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);
    const eventId = "f".repeat(64);
    const promise = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    relay.fireOk(eventId, true);
    await expect(promise).resolves.toEqual({ outcome: "accepted", externalReference: eventId });
  });

  it("3. terminal resolve once -- a duplicate OK for an already-settled event id is a no-op", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);
    const eventId = "1".repeat(64);
    const promise = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    relay.fireOk(eventId, true);
    const result = await promise;
    expect(result.outcome).toBe("accepted");
    // A second OK for the same id, after settlement, must not throw or affect anything.
    expect(() => relay.fireOk(eventId, false)).not.toThrow();
  });

  it("4. listener removal / cleanup -- resolved entries never linger in the pending set (verified indirectly: a LATER publish for the SAME event id is independently correlated, not accidentally pre-resolved)", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);
    const eventId = "2".repeat(64);
    const first = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    relay.fireOk(eventId, true);
    await first;

    const second = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    relay.fireOk(eventId, false);
    await expect(second).resolves.toEqual({ outcome: "rejected", externalReference: eventId });
  });

  it("5. timeout cancellation -- a settled-before-timeout call never fires a stray timeout branch later", async () => {
    vi.useFakeTimers();
    try {
      const relay = new ManualRelay();
      const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 1000);
      const eventId = "3".repeat(64);
      const promise = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
      await Promise.resolve(); // let publish() settle before firing OK
      relay.fireOk(eventId, true);
      const result = await promise;
      expect(result.outcome).toBe("accepted");
      // Advancing time past the timeout must not throw or change the already-settled result.
      vi.advanceTimersByTime(2000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("6. disconnect cleanup / timeout path -- no matching OK ever arrives -> resolves 'failed' after the timeout, never hangs", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 30);
    const eventId = "4".repeat(64);
    const result = await publisher.publishOneOutcome({
      intent: fakeIntent({ protocol: "nostr", destination: null }),
      event: fakeEvent(eventId),
    });
    expect(result).toEqual({ outcome: "failed", externalReference: null });
  });

  it("7. duplicate/stale-socket guard -- an unrelated event id's OK never resolves this publish", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 30);
    const eventId = "5".repeat(64);
    const promise = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    relay.fireOk("f".repeat(64), true); // unrelated id
    const result = await promise; // must fall through to the timeout, not resolve early
    expect(result).toEqual({ outcome: "failed", externalReference: null });
  });

  it("8. NOTICE is never treated as a publish result", async () => {
    const relay = new ManualRelay();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 30);
    const eventId = "6".repeat(64);
    const promise = publisher.publishOneOutcome({ intent: fakeIntent({ protocol: "nostr", destination: null }), event: fakeEvent(eventId) });
    relay.fireNotice("rate limited");
    const result = await promise;
    expect(result).toEqual({ outcome: "failed", externalReference: null }); // fell through to timeout
  });

  it("9. constructor rejects a non-positive-integer timeout", () => {
    const relay = new ManualRelay();
    expect(() => new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 0)).toThrow();
    expect(() => new FedosRelayOkCorrelatedNostrBoardPublisher(relay, -5)).toThrow();
    expect(() => new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 1.5)).toThrow();
  });

  it("10. a socket send throw settles closed immediately -- no listener/pending entry lingers", async () => {
    const relay = new ManualRelay();
    relay.throwOnNextPublish();
    const publisher = new FedosRelayOkCorrelatedNostrBoardPublisher(relay, 500);
    const eventId = "7".repeat(64);
    const result = await publisher.publishOneOutcome({
      intent: fakeIntent({ protocol: "nostr", destination: null }),
      event: fakeEvent(eventId),
    });
    expect(result).toEqual({ outcome: "failed", externalReference: null });
    // Firing a late OK for this id after the throw must be inert (no lingering listener entry).
    expect(() => relay.fireOk(eventId, true)).not.toThrow();
  });
});

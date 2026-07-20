/**
 * TEST-ONLY. Secure Runtime Alpha 3641–3720 — a real, functional in-process
 * fake `FedosRelay` (`../../src/desktop/fedos_relay.ts`, UNMODIFIED
 * interface) that actually stores published events (simulating
 * store-and-forward — Phase J's own "target offline then later receive")
 * and actually delivers OK-correlation/subscription messages (unlike
 * `NullRelay`, which never invokes a registered listener at all). Delivery
 * is SYNCHRONOUS (no `queueMicrotask`/timer) for deterministic tests — a
 * caller's own registered listener (`onRelayMessage`/`onSubscriptionMessage`)
 * is invoked directly inside `publish()`/`onSubscriptionMessage()`.
 *
 * `okBehavior` controls the simulated Relay's own OK response for every
 * `publish()` call on this instance: `"accept"` (default), `"reject"`, or
 * `"timeout"` (never sends an OK at all — the caller's own correlator
 * times out; pass a SMALL `timeoutMs` to `FedosDeviceRelaySyncPublisher`
 * in a test using this to keep it fast).
 */

import type { FedosRelay } from "../../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../../src/desktop/fedos_event_descriptor.js";
import type { FedosSubscription } from "../../src/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../../src/desktop/fedos_subscription_filter.js";
import type { FedosRelayMessageListener, FedosSubscriptionListener } from "../../src/desktop/fedos_relay_listeners.js";
import type { FedosNostrWireEvent } from "../../src/desktop/fedos_nostr_wire_event.js";

export type FakeDeviceRelaySyncOkBehavior = "accept" | "reject" | "timeout";

function descriptorToWireEvent(event: FedosEventDescriptor): FedosNostrWireEvent {
  return Object.freeze({
    id: event.id,
    pubkey: event.author,
    created_at: event.createdAt,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.signature,
  });
}

function matchesFilter(event: FedosEventDescriptor, filter: FedosSubscriptionFilter): boolean {
  if (filter.ids !== undefined && !filter.ids.includes(event.id)) return false;
  if (filter.authors !== undefined && !filter.authors.includes(event.author)) return false;
  if (filter.kinds !== undefined && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.createdAt < filter.since) return false;
  if (filter.until !== undefined && event.createdAt > filter.until) return false;
  return true;
}

interface SubscriptionEntry {
  readonly filter: FedosSubscriptionFilter;
  listener: FedosSubscriptionListener | undefined;
}

export class FakeDeviceRelaySyncRelay implements FedosRelay {
  readonly url: string;
  readonly #okBehavior: FakeDeviceRelaySyncOkBehavior;
  #connected = false;
  #stored: FedosEventDescriptor[] = [];
  #relayListener: FedosRelayMessageListener | undefined;
  #subscriptions = new Map<string, SubscriptionEntry>();
  #subscriptionCounter = 0;

  constructor(url: string, okBehavior: FakeDeviceRelaySyncOkBehavior = "accept") {
    this.url = url;
    this.#okBehavior = okBehavior;
  }

  get stored(): readonly FedosEventDescriptor[] {
    return this.#stored;
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
    if (!this.#connected) {
      throw new Error("FakeDeviceRelaySyncRelay.publish() called while not connected.");
    }
    this.#stored.push(event);

    if (this.#okBehavior !== "timeout") {
      this.#relayListener?.({ kind: "ok", eventId: event.id, accepted: this.#okBehavior === "accept", message: this.#okBehavior });
    }

    for (const [subscriptionId, entry] of this.#subscriptions) {
      if (entry.listener !== undefined && matchesFilter(event, entry.filter)) {
        entry.listener({ kind: "event", subscriptionId, event: descriptorToWireEvent(event) });
      }
    }
  }

  async subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    if (!this.#connected) {
      throw new Error("FakeDeviceRelaySyncRelay.subscribe() called while not connected.");
    }
    this.#subscriptionCounter += 1;
    const id = `fake-device-relay-sync-sub-${this.#subscriptionCounter}`;
    this.#subscriptions.set(id, { filter: filters[0] ?? {}, listener: undefined });
    return { id };
  }

  async unsubscribe(subscription: FedosSubscription): Promise<void> {
    if (!this.#connected) {
      throw new Error("FakeDeviceRelaySyncRelay.unsubscribe() called while not connected.");
    }
    this.#subscriptions.delete(subscription.id);
  }

  /** Registers the listener AND immediately replays every already-stored, matching event (simulating a Relay's own historical replay before EOSE — the exact "target offline then later receive" behavior Phase J needs). */
  onSubscriptionMessage(subscription: FedosSubscription, listener: FedosSubscriptionListener): void {
    const entry = this.#subscriptions.get(subscription.id);
    if (entry === undefined) return;
    entry.listener = listener;
    for (const event of this.#stored) {
      if (matchesFilter(event, entry.filter)) {
        listener({ kind: "event", subscriptionId: subscription.id, event: descriptorToWireEvent(event) });
      }
    }
  }

  onRelayMessage(listener: FedosRelayMessageListener): void {
    this.#relayListener = listener;
  }
}

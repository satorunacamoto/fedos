/**
 * Secure Runtime Alpha 213 ("Null Relay") — the FIRST implementation
 * of `FedosRelay` (`fedos_relay.ts`, Alpha 212) anywhere in this
 * repository, mirroring the exact relationship `NullEventReader`
 * (`null_event_reader.ts`, Alpha 203) already has to `FedosEventReader`:
 * a dependency-free implementation, holding nothing but the connection
 * target itself, since `FedosRelay` (as of this Stage) names nothing
 * beyond that target. No networking of any kind exists in this file —
 * there is, as yet, no method on the interface THIS Stage's own
 * `NullRelay` could even open a network connection through.
 *
 * Secure Runtime Alpha 214 ("WebSocket Relay — Connection Only") adds
 * a new private field, `#connected: boolean` (initial `false`), and a
 * new public method, `connect(): Promise<void>`, whose own entire body
 * sets `#connected = true` — the ONLY change this Stage makes.
 * `NullRelay` still opens NO real network connection of any kind —
 * `#connected` is plain in-memory call-history bookkeeping, kept in
 * lockstep with `FedosRelay`'s own newly-added `connect()` method so
 * `NullRelay` remains a behaviorally faithful (though non-networked)
 * stand-in for `WebSocketRelay` (`websocket_relay.ts`, Alpha 214, the
 * SAME Stage's other new file) in tests.
 *
 * Secure Runtime Alpha 215 ("Connection Lifecycle") adds two new
 * public methods, `disconnect(): Promise<void>` (sets `#connected =
 * false`) and `isConnected(): boolean` (returns `#connected`) — the
 * ONLY change this Stage makes. Both are PURE reads/writes of the
 * SAME `#connected` field Alpha 214 already introduced — no new
 * field, no network reference of any kind.
 *
 * Secure Runtime Alpha 216 ("Publish API") adds a new private field,
 * `#published: FedosEventDescriptor[]` (initial `[]`), a new public
 * getter, `published: readonly FedosEventDescriptor[]`, and a new
 * public method, `publish(event: FedosEventDescriptor): Promise<void>`
 * — the ONLY change this Stage makes. `publish()` REJECTS (throws)
 * when `#connected` is `false` — the SAME "transport requires an open
 * connection" contract `WebSocketRelay.publish()`
 * (`websocket_relay.ts`, Alpha 216) enforces for real, so both
 * implementations remain behaviorally interchangeable. On success, the
 * event is appended to `#published` — plain in-memory bookkeeping,
 * never a network send of any kind — and the returned `Promise`
 * resolves with no value, matching `FedosRelay.publish()`'s own
 * `Promise<void>` contract exactly (no ACK, no result object).
 *
 * Secure Runtime Alpha 226 ("Subscription Lifecycle") adds two new
 * private fields, `#subscriptions: FedosSubscription[]` (initial `[]`)
 * and `#subscriptionCounter: number` (initial `0`), a new public
 * getter, `subscriptions: readonly FedosSubscription[]`, and two new
 * public methods, `subscribe(filters: readonly FedosSubscriptionFilter[]):
 * Promise<FedosSubscription>` and `unsubscribe(subscription:
 * FedosSubscription): Promise<void>` -- the ONLY change this Stage
 * makes. `subscribe()` REJECTS (throws) when `#connected` is `false` --
 * the SAME "transport requires an open connection" contract
 * `publish()` (Alpha 216) already enforces, so all three transport
 * methods (`publish`/`subscribe`/`unsubscribe`) share one discipline.
 * On success, `subscribe()` generates a fresh opaque id, appends a new
 * `FedosSubscription` to `#subscriptions`, and returns it -- plain
 * in-memory bookkeeping, never a network send of any kind. `filters`
 * is accepted (to satisfy `FedosRelay`'s own shape) but never inspected
 * or stored -- `NullRelay` never validates or matches filters, the SAME
 * "records without judging content" discipline `publish()` already
 * applies to the events it records. `unsubscribe()` REJECTS when
 * `!#connected`, and otherwise removes the matching subscription (by
 * `id`) from `#subscriptions` -- removing an id that is not present is
 * a silent no-op, never a throw.
 *
 * HARD GUARDRAILS:
 *   - `NullRelay` is the ONLY export.
 *   - The constructor takes exactly ONE argument, `url: string`, and
 *     performs NO async work of any kind.
 *   - `#connected` (Alpha 214) is PLAIN in-memory state — never backed
 *     by a real socket, `fetch`, or any other network primitive.
 *   - `connect()` (Alpha 214) NEVER throws and performs NO network
 *     I/O of any kind — its own entire body is a single field
 *     assignment.
 *   - `disconnect()` (Alpha 215) NEVER throws — its own entire body is
 *     a single field assignment, `#connected = false`, regardless of
 *     whether `connect()` was ever called first.
 *   - `isConnected()` (Alpha 215) is a PURE, SYNCHRONOUS WRAPPER — its
 *     own entire body is `return this.#connected;`, nothing more.
 *   - `publish()` (Alpha 216) throws when `!#connected`, and otherwise
 *     ONLY appends to `#published` — no network I/O, no ACK, no result
 *     object of any kind.
 *   - `published` (Alpha 216) is a `readonly` getter — no method on
 *     this class allows external code to clear or splice the recorded
 *     list.
 *   - `subscribe()`/`unsubscribe()` (Alpha 226) throw when `!#connected`,
 *     and otherwise ONLY mutate `#subscriptions` — no network I/O, no
 *     REQ/CLOSE wire string of any kind is ever constructed here.
 *   - `subscriptions` (Alpha 226) is a `readonly` getter — no method on
 *     this class allows external code to clear or splice the tracked
 *     list directly.
 *   - NO `WebSocket`, `fetch`, or network reference of any kind.
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";
import type { FedosRelay } from "./fedos_relay.js";
import type { FedosSubscription } from "./fedos_subscription.js";
import type { FedosSubscriptionFilter } from "./fedos_subscription_filter.js";

export class NullRelay implements FedosRelay {
  readonly url: string;
  #connected: boolean = false;
  #published: FedosEventDescriptor[] = [];
  #subscriptions: FedosSubscription[] = [];
  #subscriptionCounter = 0;

  constructor(url: string) {
    this.url = url;
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

  get published(): readonly FedosEventDescriptor[] {
    return this.#published;
  }

  async publish(event: FedosEventDescriptor): Promise<void> {
    if (!this.#connected) {
      throw new Error("FedosRelay.publish() called while not connected.");
    }
    this.#published.push(event);
  }

  get subscriptions(): readonly FedosSubscription[] {
    return this.#subscriptions;
  }

  async subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    if (!this.#connected) {
      throw new Error("FedosRelay.subscribe() called while not connected.");
    }
    void filters;
    const subscription: FedosSubscription = { id: `fedos-sub-${++this.#subscriptionCounter}` };
    this.#subscriptions.push(subscription);
    return subscription;
  }

  async unsubscribe(subscription: FedosSubscription): Promise<void> {
    if (!this.#connected) {
      throw new Error("FedosRelay.unsubscribe() called while not connected.");
    }
    this.#subscriptions = this.#subscriptions.filter((s) => s.id !== subscription.id);
  }
}

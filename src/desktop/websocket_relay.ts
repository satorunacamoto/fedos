/**
 * Secure Runtime Alpha 214 ("WebSocket Relay — Connection Only") — the
 * SECOND real implementation of `FedosRelay` (`fedos_relay.ts`, Alpha
 * 212/214), alongside `NullRelay` (`null_relay.ts`, Alpha 213/214).
 * `WebSocketRelay` is a NEW, INDEPENDENT socket-transport type — it
 * shares NO code, NO type, and NO import with `src/nostr/ws_relay.ts`
 * (Alpha 211 §3's own finding: that file is REQ/EOSE/CLOSE-oriented,
 * explicitly out of this Arc's own scope). The socket itself is
 * obtained from an INJECTED `FedosRelaySocketFactory` — never a
 * hardcoded `new WebSocket(url)` call — so this class is testable
 * against a fake socket with zero real network I/O, mirroring the
 * SAME "inject the transport, never construct it inline" discipline
 * `NostrPublicIdentityReader` (Alpha 103) already established for the
 * Identity Reader boundary, now applied fresh here.
 *
 * This Stage's own scope was DELIBERATELY narrow — "Connection only"
 * (this Arc's own Alpha 214 instruction) — `connect()` was the ONLY
 * method with real behavior. It requests a socket from the factory,
 * listens for `"close"`/`"error"` so `#connected` never lies about a
 * socket that has actually gone away, and marks itself connected once
 * the factory's own `Promise` resolves.
 *
 * Secure Runtime Alpha 215 ("Connection Lifecycle") added two new
 * methods, `disconnect(): Promise<void>` and `isConnected(): boolean`.
 * `disconnect()` closes the held socket (if any) and clears
 * `#connected`/`#socket`; it is idempotent — calling it while not
 * connected performs no socket operation. `isConnected()` is a PURE,
 * SYNCHRONOUS read of `#connected` — the SAME field the
 * `"close"`/`"error"` listeners (Alpha 214) already keep accurate on
 * an unexpected disconnect, so `isConnected()` reflects BOTH an
 * explicit `disconnect()` call AND a socket that closed on its own,
 * with no distinction visible to the caller.
 *
 * Secure Runtime Alpha 216 ("Publish API") adds ONE new method,
 * `publish(event: FedosEventDescriptor): Promise<void>` — the ONLY
 * change this Stage makes, and the LAST method this class implements
 * for this Arc. Its own ENTIRE body: reject if `!#connected`
 * (transport-level failure — there is no socket to send on); otherwise
 * map the REUSED, protocol-independent `FedosEventDescriptor` (Alpha
 * 202) onto NIP-01's own seven-field wire shape
 * (`author`→`pubkey`, `createdAt`→`created_at`, `signature`→`sig`,
 * `id`/`kind`/`tags`/`content` verbatim; `provider` is DROPPED — it is
 * not part of NIP-01's own wire format), then call
 * `this.#socket.send(JSON.stringify(["EVENT", wireEvent]))` exactly
 * once. NO `"message"` listener is registered anywhere in this file —
 * this method NEVER waits for a relay's own `["OK", ...]` response;
 * it resolves as soon as the local `send()` call itself returns,
 * matching this Arc's own "Transport only. No ACK handling."
 * instruction precisely. Being Nostr-wire-aware INSIDE this mapping is
 * legitimate and expected — a Relay is, by definition, a Nostr wire
 * protocol boundary — exactly as `NostrPublicIdentityReader` (Alpha
 * 103) was legitimately Nostr-specific internally while conforming to
 * a protocol-neutral interface.
 *
 * Secure Runtime Alpha 226 ("Subscription Lifecycle") adds a new
 * private field, `#subscriptionCounter: number` (initial `0`), and two
 * new public methods, `subscribe(filters: readonly
 * FedosSubscriptionFilter[]): Promise<FedosSubscription>` and
 * `unsubscribe(subscription: FedosSubscription): Promise<void>` -- the
 * ONLY change this Stage makes. `subscribe()` rejects when
 * `!#connected` (the SAME "transport requires an open connection"
 * contract `publish()`, Alpha 216, already enforces); on success it
 * generates a fresh per-instance opaque id (`fedos-sub-${n}`), sends
 * the `buildReqMessage` (Alpha 224) wire string exactly once via
 * `this.#socket.send(...)`, and resolves with the new
 * `FedosSubscription` -- it does NOT register a `"message"` listener
 * of any kind, matching Alpha 224's own "Transport only. No event
 * processing." instruction: this class never receives or processes an
 * `EVENT`/`EOSE` reply to its own REQ. `unsubscribe()` rejects when
 * `!#connected`, and otherwise sends the `buildCloseMessage` (Alpha
 * 225) wire string exactly once -- it performs no local bookkeeping of
 * which ids were previously subscribed (the SAME "transport only,
 * no validation" discipline `publish()` already applies to the events
 * it sends), trusting the relay itself to ignore a CLOSE for an unknown
 * or already-closed subscription id, exactly as NIP-01 permits.
 *
 * HARD GUARDRAILS:
 *   - `WebSocketRelay`, `FedosRelaySocket`, and `FedosRelaySocketFactory`
 *     are the ONLY exports.
 *   - The constructor takes exactly TWO arguments, `url: string` and
 *     `factory: FedosRelaySocketFactory`, and performs NO async work
 *     of any kind — it only stores both.
 *   - `connect()` NEVER constructs a socket directly (`new WebSocket(...)`
 *     appears nowhere in this file) — it ALWAYS obtains one via
 *     `this.#factory(this.url)`.
 *   - `connect()` is idempotent: calling it while already connected
 *     resolves immediately, requesting no second socket.
 *   - `disconnect()` (Alpha 215) is idempotent: calling it while not
 *     connected resolves immediately, calling no method on any socket.
 *   - `isConnected()` (Alpha 215) is a PURE, SYNCHRONOUS WRAPPER — its
 *     own entire body is `return this.#connected;`, nothing more. It
 *     NEVER throws, NEVER awaits, and opens no connection of its own.
 *   - `publish()` (Alpha 216) calls `socket.send(...)` EXACTLY ONCE on
 *     the success path, and registers NO `"message"` listener of any
 *     kind — no ACK/OK of any kind is ever awaited.
 *   - `publish()` throws (via Promise rejection) when `!#connected` —
 *     it NEVER silently no-ops and NEVER attempts to auto-reconnect.
 *   - `FedosEventDescriptor` is imported as a TYPE ONLY
 *     (`import type`) — this file performs no Event construction,
 *     signing, or transformation beyond the one wire-shape mapping
 *     `publish()` itself performs.
 *   - `subscribe()`/`unsubscribe()` (Alpha 226) call `socket.send(...)`
 *     EXACTLY ONCE on their own success path each, and register NO
 *     `"message"` listener of any kind — no `EVENT`/`EOSE` reply is
 *     ever awaited or processed.
 *   - `subscribe()`/`unsubscribe()` throw (via Promise rejection) when
 *     `!#connected` — neither silently no-ops and neither attempts to
 *     auto-reconnect.
 *   - `buildReqMessage`/`buildCloseMessage` (Alpha 224/225) are the
 *     ONLY source of REQ/CLOSE wire strings in this file — no inline
 *     `JSON.stringify(["REQ"` or `JSON.stringify(["CLOSE"` of any kind
 *     appears here.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";
import type { FedosRelay } from "./fedos_relay.js";
import type { FedosSubscription } from "./fedos_subscription.js";
import type { FedosSubscriptionFilter } from "./fedos_subscription_filter.js";
import { buildCloseMessage, buildReqMessage } from "./subscription_messages.js";

/** The minimal socket surface this Relay needs — a subset of `WebSocket`. */
export interface FedosRelaySocket {
  send(data: string): void;
  close(): void;
  addEventListener(type: "close" | "error", listener: () => void): void;
}

/** Produces a ready-to-use socket for a relay URL (may be async). */
export type FedosRelaySocketFactory = (
  url: string,
) => FedosRelaySocket | Promise<FedosRelaySocket>;

export class WebSocketRelay implements FedosRelay {
  readonly url: string;
  readonly #factory: FedosRelaySocketFactory;
  #socket: FedosRelaySocket | undefined;
  #connected: boolean = false;
  #subscriptionCounter = 0;

  constructor(url: string, factory: FedosRelaySocketFactory) {
    this.url = url;
    this.#factory = factory;
  }

  async connect(): Promise<void> {
    if (this.#connected) {
      return;
    }
    const socket = await this.#factory(this.url);
    socket.addEventListener("close", () => {
      this.#connected = false;
      this.#socket = undefined;
    });
    socket.addEventListener("error", () => {
      this.#connected = false;
      this.#socket = undefined;
    });
    this.#socket = socket;
    this.#connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.#connected || this.#socket === undefined) {
      this.#connected = false;
      return;
    }
    const socket = this.#socket;
    this.#socket = undefined;
    this.#connected = false;
    socket.close();
  }

  isConnected(): boolean {
    return this.#connected;
  }

  async publish(event: FedosEventDescriptor): Promise<void> {
    if (!this.#connected || this.#socket === undefined) {
      throw new Error("FedosRelay.publish() called while not connected.");
    }
    const wireEvent = {
      id: event.id,
      pubkey: event.author,
      created_at: event.createdAt,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.signature,
    };
    this.#socket.send(JSON.stringify(["EVENT", wireEvent]));
  }

  async subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    if (!this.#connected || this.#socket === undefined) {
      throw new Error("FedosRelay.subscribe() called while not connected.");
    }
    const subscription: FedosSubscription = { id: `fedos-sub-${++this.#subscriptionCounter}` };
    this.#socket.send(buildReqMessage(subscription.id, filters));
    return subscription;
  }

  async unsubscribe(subscription: FedosSubscription): Promise<void> {
    if (!this.#connected || this.#socket === undefined) {
      throw new Error("FedosRelay.unsubscribe() called while not connected.");
    }
    this.#socket.send(buildCloseMessage(subscription.id));
  }
}

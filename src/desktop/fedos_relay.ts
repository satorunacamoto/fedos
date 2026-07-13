/**
 * Secure Runtime Alpha 212 ("Relay Interface") — the FIRST file of the
 * Alpha 211–220 Nostr Relay Foundation Arc to add real code, following
 * Alpha 211's own Decision to build a new, minimal, Desktop-owned
 * Relay boundary rather than reuse `src/nostr/relay.ts`/`ws_relay.ts`/
 * `publish.ts` (all three REQ/EOSE/CLOSE/Filter/ACK-oriented, all
 * explicitly excluded by this Arc's own instruction list). `FedosRelay`
 * is a NEW, protocol-independent interface — deliberately named
 * without "Nostr" in it, mirroring `FedosPublicIdentityReader` (Alpha
 * 101) and `FedosEventReader` (Alpha 202) exactly. This Stage's own
 * entire deliverable is the "exactly one connection target" shape this
 * Arc's own Alpha 212 instruction names: a single `readonly url`
 * field, and nothing else yet — no connection method, no publish
 * method, no state query of any kind. This is an INTERFACE ONLY — no
 * implementation exists in this file, and none is wired anywhere yet.
 *
 * Secure Runtime Alpha 214 ("WebSocket Relay — Connection Only") adds
 * ONE new method, `connect(): Promise<void>` — the ONLY change this
 * Stage makes. `WebSocketRelay` (`websocket_relay.ts`, Alpha 214) is
 * the first implementation to give this method real behavior;
 * `NullRelay` (`null_relay.ts`, Alpha 213, extended by this Stage) is
 * updated in lockstep with a no-op that still tracks call state, so
 * both implementations remain interchangeable test doubles for one
 * another. `disconnect()`/`isConnected()` (Alpha 215) and `publish()`
 * (Alpha 216) remain absent — this Stage adds ONLY the ability to
 * OPEN a connection, matching this Arc's own "Connection only" scope
 * for Alpha 214 precisely.
 *
 * Secure Runtime Alpha 215 ("Connection Lifecycle") adds TWO new
 * methods, `disconnect(): Promise<void>` and `isConnected(): boolean`
 * — the ONLY change this Stage makes. Together with `connect()`
 * (Alpha 214), `FedosRelay` now names the FULL connection lifecycle
 * this Arc's own Alpha 215 instruction lists: connect, disconnect,
 * query state. `isConnected()` is deliberately SYNCHRONOUS — a plain
 * state read, never a network round-trip — mirroring
 * `DesktopApplication.isBootstrapped()`'s (Alpha 117) own identical
 * "pure, synchronous state query" shape. `WebSocketRelay`
 * (`websocket_relay.ts`, Alpha 215) gives both methods real behavior;
 * `NullRelay` (`null_relay.ts`, Alpha 215) tracks the SAME
 * `#connected` bookkeeping it already started in Alpha 214, still
 * with zero real networking.
 *
 * Secure Runtime Alpha 216 ("Publish API") adds ONE new method,
 * `publish(event: FedosEventDescriptor): Promise<void>` — the ONLY
 * change this Stage makes, and the LAST method this Arc's own Goals
 * list names ("Event publishing transport"). `FedosEventDescriptor`
 * (`fedos_event_descriptor.ts`, Alpha 202) is REUSED, not redesigned
 * — this Arc's own "MUST NOT redesign: Event" instruction, honored by
 * importing the EXISTING, unchanged type rather than inventing a new
 * one. `publish()` returns `Promise<void>` — NO `PublishResult`, NO
 * `accepted`/`message` field, NO acknowledgement of any kind — this
 * Arc's own Alpha 216 instruction states plainly "No ACK handling."
 * `WebSocketRelay` (`websocket_relay.ts`, Alpha 216) gives this method
 * real behavior (a single `socket.send(...)` call, nothing more);
 * `NullRelay` (`null_relay.ts`, Alpha 216) records the event into an
 * in-memory list, still with zero real networking.
 *
 * HARD GUARDRAILS:
 *   - `FedosRelay` is the ONLY export.
 *   - `readonly url: string` (Alpha 212), `connect(): Promise<void>`
 *     (Alpha 214), and `disconnect(): Promise<void>`/
 *     `isConnected(): boolean` (Alpha 215) are UNCHANGED.
 *   - `publish(event: FedosEventDescriptor): Promise<void>` (Alpha
 *     216) is UNCHANGED by this Arc. Its own return
 *     type is `Promise<void>` — NEVER a result object, NEVER an
 *     `accepted`/`ok`/`message` field of any kind.
 *   - `FedosEventDescriptor` is imported as a TYPE ONLY
 *     (`import type`) — this file performs no Event construction,
 *     signing, or transformation of any kind.
 *
 * Secure Runtime Alpha 226 ("Subscription Lifecycle") — the first
 * Stage of the Alpha 221-230 Nostr Subscription Foundation Arc to
 * change this file — adds TWO new methods,
 * `subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription>`
 * and `unsubscribe(subscription: FedosSubscription): Promise<void>` —
 * the ONLY change this Stage makes, and the LAST two methods this Arc's
 * own Goals list names ("Subscription lifecycle"). This is exactly the
 * ADDITIVE extension Alpha 219 Section 3 (Relay Foundation Arc) already
 * previewed: a new method pair on `FedosRelay`, never a reshaping of
 * `connect`/`disconnect`/`isConnected`/`publish`'s own already-shipped
 * shapes. `FedosSubscription` (Alpha 222) and `FedosSubscriptionFilter`
 * (Alpha 223) are REUSED, not redesigned. `subscribe()` returns a
 * `Promise` of the OPAQUE `FedosSubscription` handle (never a raw
 * string, never the filters echoed back); `unsubscribe()` takes that
 * SAME handle back. `WebSocketRelay` (`websocket_relay.ts`, Alpha 226)
 * gives both methods real behavior, sending the `buildReqMessage`/
 * `buildCloseMessage` (Alpha 224/225) wire strings; `NullRelay`
 * (`null_relay.ts`, Alpha 226) tracks subscriptions in an in-memory
 * list, still with zero real networking.
 *
 * HARD GUARDRAILS (Alpha 226 additions):
 *   - `subscribe()`/`unsubscribe()` are the ONLY methods added by this
 *     Arc. Neither returns nor accepts a raw filter/id echo of any kind
 *     beyond the opaque `FedosSubscription` handle itself.
 *   - `FedosSubscription`/`FedosSubscriptionFilter` are imported as
 *     TYPE ONLY (`import type`) — this file performs no subscription
 *     construction, id generation, or wire encoding of any kind; that
 *     is exclusively `WebSocketRelay`'s/`NullRelay`'s own concern.
 *   - This interface registers NO `"message"` listener and processes NO
 *     incoming `EVENT`/`EOSE`/`NOTICE` of any kind — `subscribe()`/
 *     `unsubscribe()` are OUTBOUND-only, matching Alpha 224's own
 *     "Transport only. No event processing." instruction.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 *
 * Secure Runtime Alpha 236 ("Subscription Event Delivery") and Alpha
 * 238 ("OK and NOTICE Handling") — the Alpha 231-240 Nostr Relay
 * Message Reception Arc's own two Stages to change this file — add TWO
 * new methods, `onSubscriptionMessage(subscription: FedosSubscription,
 * listener: FedosSubscriptionListener): void` (Alpha 236) and
 * `onRelayMessage(listener: FedosRelayMessageListener): void` (Alpha
 * 238). Both are ADDITIVE listener-REGISTRATION methods, never a
 * reshaping of `connect`/`disconnect`/`isConnected`/`publish`/
 * `subscribe`/`unsubscribe`'s own already-shipped, frozen shapes (this
 * Arc's own "Already complete and MUST NOT be redesigned" list names
 * `subscribe()`/`unsubscribe()` explicitly). `onSubscriptionMessage()`
 * registers interest in the EVENT/EOSE traffic belonging to ONE
 * `FedosSubscription` (obtained separately from `subscribe()`, Alpha
 * 226, unchanged); `onRelayMessage()` registers ONE relay-wide listener
 * for OK/NOTICE, which are never subscription-scoped on the wire
 * (`fedos_relay_listeners.ts`, Alpha 236/238, explains the Option-A
 * "one Relay-level listener" decision in full). `WebSocketRelay`
 * (`websocket_relay.ts`, Alpha 235/236/238) gives both methods real
 * delivery, parsing every inbound socket frame and dispatching it;
 * `NullRelay` (`null_relay.ts`, Alpha 236/238) accepts registrations as
 * plain bookkeeping and never invokes them, since it has no real
 * transport to receive a message from.
 *
 * HARD GUARDRAILS (Alpha 236/238 additions):
 *   - `onSubscriptionMessage()`/`onRelayMessage()` are the ONLY methods
 *     added by this Arc. Both return `void` — registration is
 *     synchronous, local bookkeeping, never a network operation of any
 *     kind, and never requires an open connection.
 *   - `FedosSubscriptionListener`/`FedosRelayMessageListener`
 *     (`fedos_relay_listeners.ts`) are imported as TYPE ONLY (`import
 *     type`) — this file performs no dispatch, parsing, or socket
 *     wiring of any kind; that is exclusively `WebSocketRelay`'s own
 *     concern (Alpha 235).
 *   - NO `Promise`-returning listener contract of any kind — a listener
 *     is fire-and-forget, matching this Arc's own "listener exception
 *     does not break socket processing" requirement.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";
import type { FedosSubscription } from "./fedos_subscription.js";
import type { FedosSubscriptionFilter } from "./fedos_subscription_filter.js";
import type {
  FedosRelayMessageListener,
  FedosSubscriptionListener,
} from "./fedos_relay_listeners.js";

export interface FedosRelay {
  readonly url: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  publish(event: FedosEventDescriptor): Promise<void>;
  subscribe(filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription>;
  unsubscribe(subscription: FedosSubscription): Promise<void>;
  onSubscriptionMessage(subscription: FedosSubscription, listener: FedosSubscriptionListener): void;
  onRelayMessage(listener: FedosRelayMessageListener): void;
}

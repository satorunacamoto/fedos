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
 *     216) is the ONLY method added by this Stage. Its own return
 *     type is `Promise<void>` — NEVER a result object, NEVER an
 *     `accepted`/`ok`/`message` field of any kind.
 *   - `FedosEventDescriptor` is imported as a TYPE ONLY
 *     (`import type`) — this file performs no Event construction,
 *     signing, or transformation of any kind.
 *   - NO REQ, CLOSE, Subscription, or Filter vocabulary of any kind.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 */

import type { FedosEventDescriptor } from "./fedos_event_descriptor.js";

export interface FedosRelay {
  readonly url: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  publish(event: FedosEventDescriptor): Promise<void>;
}

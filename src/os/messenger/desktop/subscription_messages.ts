/**
 * Secure Runtime Alpha 224 ("REQ Generation") — the THIRD new file of
 * the Alpha 221–230 Nostr Subscription Foundation Arc. `buildReqMessage`
 * is a PURE function mapping a subscription id and a list of
 * `FedosSubscriptionFilter` values (Alpha 223) onto NIP-01's own REQ
 * wire shape, `["REQ", subscriptionId, ...filters]` — mirroring the
 * SAME "encode the wire shape as a small, pure, internal detail" idiom
 * `WebSocketRelay.publish()` (`websocket_relay.ts`, Alpha 216) already
 * established for `["EVENT", wireEvent]`. This Stage's own scope is
 * DELIBERATELY narrow — "Transport only. No event processing." (this
 * Arc's own Alpha 224 instruction) — `buildReqMessage` only PRODUCES a
 * wire string; it performs NO socket I/O, NO subscription-id
 * generation, and registers NO listener of any kind for the `EVENT`/
 * `EOSE` messages a real relay would later send back. Wiring this
 * function into an actual `socket.send(...)` call is Alpha 226's own
 * "Subscription lifecycle" deliverable, not this Stage's.
 *
 * Secure Runtime Alpha 225 ("CLOSE Generation") adds ONE new function,
 * `buildCloseMessage`, — the ONLY change this Stage makes, and the
 * LAST message-builder this Arc's own Goals list names. It maps a
 * subscription id onto NIP-01's own CLOSE wire shape,
 * `["CLOSE", subscriptionId]` — the natural counterpart to
 * `buildReqMessage`, mirroring the SAME "one pure function per wire
 * message" shape this Stage's own Alpha 224 half already established.
 *
 * HARD GUARDRAILS:
 *   - `buildReqMessage` and `buildCloseMessage` are the ONLY exports.
 *   - Both functions are PURE: no socket, no `fetch`, no `WebSocket`,
 *     no mutable module-level state, no subscription-id generation of
 *     any kind — the id is always supplied by the caller.
 *   - Neither function parses, awaits, or otherwise processes an
 *     incoming relay message of any kind — this file has NO knowledge
 *     of `EVENT`, `EOSE`, or `NOTICE`.
 *   - `FedosSubscriptionFilter` (Alpha 223) is imported as a TYPE ONLY
 *     (`import type`) — this file performs no filter validation or
 *     transformation of any kind.
 *   - NO reference to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`,
 *     `src/nostr/publish.ts`, `src/nostr/messages.ts`,
 *     `src/nostr/crypto.ts`, `src/nostr/signature.ts`, or
 *     `src/nostr/noble_signature.ts` anywhere in this file.
 */

import type { FedosSubscriptionFilter } from "./fedos_subscription_filter.js";

export function buildReqMessage(
  subscriptionId: string,
  filters: readonly FedosSubscriptionFilter[],
): string {
  return JSON.stringify(["REQ", subscriptionId, ...filters]);
}

export function buildCloseMessage(subscriptionId: string): string {
  return JSON.stringify(["CLOSE", subscriptionId]);
}

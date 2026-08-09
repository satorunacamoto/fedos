/**
 * Secure Runtime Alpha 236 ("Subscription Event Delivery") — the FIRST
 * file of the Alpha 231–240 Nostr Relay Message Reception Arc to
 * introduce the caller-facing listener contracts. `FedosSubscriptionListener`
 * is the minimum subscription-consumer boundary this Arc's own Alpha
 * 236 instruction asks for: a plain callback receiving ONLY the two
 * message kinds a subscription (opened by `subscribe()`, Alpha 226) can
 * ever legitimately receive — `FedosRelayEventMessage` and
 * `FedosRelayEoseMessage` (Alpha 232). `FedosRelayOkMessage` and
 * `FedosRelayNoticeMessage` are deliberately EXCLUDED from this union —
 * neither is ever scoped to a subscription id on the wire (OK
 * references a published event id; NOTICE is relay-wide), so routing
 * either to a per-subscription listener would misrepresent NIP-01's own
 * semantics.
 *
 * This is an ADDITIVE listener-registration contract, not a change to
 * `subscribe()`'s own signature — `subscribe()` is on this Arc's own
 * "Already complete and MUST NOT be redesigned" list. A caller obtains
 * a `FedosSubscription` from `subscribe()` (unchanged) and separately
 * registers interest via `FedosRelay.onSubscriptionMessage()` (Alpha
 * 236, `fedos_relay.ts`) — the SAME "additive method pair, never a
 * reshaping of an already-shipped method" discipline `subscribe()`/
 * `unsubscribe()` themselves were built with, one Arc ago (Alpha 226).
 *
 * Secure Runtime Alpha 238 ("OK and NOTICE Handling") adds
 * `FedosRelayMessageListener` — the ONLY change this Stage makes to
 * this file. This Arc's own Alpha 238 instruction lists four candidate
 * boundaries (A: one Relay-level listener; B: publish-result tracking;
 * C: separate callbacks; D: parsed but discarded) and asks to "Adopt
 * the smallest honest boundary supported by a real caller." Option A
 * (one Relay-level listener) is adopted: OK and NOTICE are BOTH
 * relay-wide facts (never subscription-scoped), so a single
 * `FedosRelay.onRelayMessage()` registration (Alpha 238,
 * `fedos_relay.ts`) covers both with no unused complexity — Option B
 * would require reshaping `publish()`'s own frozen `Promise<void>`
 * contract (explicitly forbidden); Option C (separate OK/NOTICE
 * callbacks) adds a second registration method for no behavioral gain
 * over one listener receiving a two-member union; Option D (discard)
 * would silently drop information a real caller (this Arc's own
 * completion doc, Alpha 240) explicitly wants observable.
 *
 * HARD GUARDRAILS:
 *   - `FedosSubscriptionListener` and `FedosRelayMessageListener` are
 *     the ONLY exports.
 *   - Both are PLAIN function type aliases — no class, no interface
 *     with extra methods, no mutable state of any kind attached.
 *   - Neither listener type returns anything meaningful (`void`) — a
 *     listener OBSERVES a message; it never gates delivery or is
 *     awaited by the dispatcher (Alpha 235/236/238's own "listener
 *     exception does not break socket processing" requirement depends
 *     on delivery being fire-and-forget, never `Promise`-chained).
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

import type {
  FedosRelayEventMessage,
  FedosRelayEoseMessage,
  FedosRelayNoticeMessage,
  FedosRelayOkMessage,
} from "./fedos_relay_inbound_message.js";

/** Receives EVENT/EOSE messages belonging to exactly one subscription. */
export type FedosSubscriptionListener = (
  message: FedosRelayEventMessage | FedosRelayEoseMessage,
) => void;

/** Receives relay-wide OK/NOTICE messages (never subscription-scoped). */
export type FedosRelayMessageListener = (
  message: FedosRelayOkMessage | FedosRelayNoticeMessage,
) => void;

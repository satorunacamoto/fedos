/**
 * Secure Runtime Alpha 246 ("Validated Subscription Delivery") — the
 * FIFTH new file of the Alpha 241–250 Nostr Inbound Event Validation
 * Arc. Adds the minimum validated-delivery boundary this Arc's own
 * Alpha 246 instruction asks for, as an EXTERNAL ADAPTER — Option C of
 * four compared — never a change to `WebSocketRelay`, `FedosRelay`, or
 * `NullRelay`.
 *
 * Four options were compared:
 *
 *   A. Validate INSIDE `WebSocketRelay` and deliver only validated
 *      EVENT messages. REJECTED: "EVENT/EOSE/OK/NOTICE parsing" and
 *      "subscription-scoped delivery" are BOTH named on this Arc's own
 *      "Already complete and MUST NOT be redesigned" list — reaching
 *      into `#handleSocketMessage` to add a validation step would
 *      redesign the exact dispatch mechanism that list freezes.
 *   B. Keep raw delivery and add `onValidatedEvent(subscription,
 *      listener)` as a THIRD method on `FedosRelay`. Viable, but
 *      REJECTED in favor of C: it would still require touching
 *      `fedos_relay.ts`/`null_relay.ts`/`websocket_relay.ts` a third
 *      time, and the prior two Arcs' own experience (Alpha 226, Alpha
 *      236/238) already showed each such extension forces updating
 *      several older tests' exact-shape assertions — an avoidable cost
 *      when a plain external function achieves the identical
 *      observable behavior with ZERO such risk.
 *   C. Add a validator adapter OUTSIDE `WebSocketRelay`.
 *      **ADOPTED.**
 *   D. Replace `FedosNostrWireEvent` with validated events GLOBALLY.
 *      REJECTED: this Arc's own Architecture Boundary states plainly
 *      "The validated Nostr Event remains Nostr-specific. It must not
 *      be generalized" and, separately, the wire/validated distinction
 *      itself would collapse — a parser (Alpha 233) that could only
 *      ever produce ALREADY-validated events would need to perform
 *      cryptographic verification itself, mixing transport and
 *      validation into one layer, against this Arc's own explicit
 *      "Transport parses. Validator validates. Consumer consumes."
 *      separation.
 *
 * `createValidatedEventListener` wraps a caller-supplied
 * `FedosValidatedEventListener` into an ordinary `FedosSubscriptionListener`
 * (`fedos_relay_listeners.ts`, Alpha 236) — the SAME type
 * `FedosRelay.onSubscriptionMessage()` already accepts, UNCHANGED. A
 * caller wires validated delivery in by calling
 * `relay.onSubscriptionMessage(subscription, createValidatedEventListener(onValid))`
 * — no new `FedosRelay` method, no new `WebSocketRelay` field, no new
 * `NullRelay` field. `WebSocketRelay`'s own EXISTING per-listener
 * `try`/`catch` (Alpha 235/236, unchanged) already isolates any
 * exception thrown by the wrapped listener — this file adds a SECOND,
 * INNER `try`/`catch` around the validated-callback specifically, so
 * that a throwing `onValid` callback cannot itself prevent this
 * adapter's own (harmless, no-op) EOSE handling from completing —
 * defense in depth, not a requirement `WebSocketRelay`'s own isolation
 * doesn't already satisfy at the socket-processing level.
 *
 * ## Ownership, made explicit (this Arc's own Architecture Boundary)
 *
 * - **Transport parses.** `WebSocketRelay`/`parseRelayInboundMessage`
 *   (Alpha 233/235) — UNTOUCHED by this file.
 * - **Validator validates.** `validateInboundNostrEvent` (Alpha 245) —
 *   called by this file, never reimplemented here.
 * - **Consumer consumes.** The caller-supplied
 *   `FedosValidatedEventListener` — this file only WIRES the consumer
 *   to the transport via the validator; it holds no application state
 *   of its own.
 *
 * HARD GUARDRAILS:
 *   - `FedosValidatedEventListener` and `createValidatedEventListener`
 *     are the ONLY exports.
 *   - `createValidatedEventListener`'s own returned function NEVER
 *     forwards an `"eose"`/`"ok"`/`"notice"` message to the validated
 *     listener — EOSE remains available ONLY through the existing raw
 *     `onSubscriptionMessage()` path (a caller wanting both registers
 *     its OWN combined listener, calling `validateInboundNostrEvent`
 *     directly, instead of this adapter); OK/NOTICE remain
 *     `onRelayMessage()`-only, UNCHANGED (Alpha 238).
 *   - A valid EVENT is delivered to the wrapped listener EXACTLY ONCE
 *     — `validateInboundNostrEvent` (Alpha 245) is called exactly once
 *     per candidate EVENT message.
 *   - An invalid EVENT (id or signature verification failure) NEVER
 *     reaches the wrapped listener — confirmed by the same `null`
 *     early-return this file's own single `if` statement performs.
 *   - This file does NOT modify `fedos_relay.ts`, `null_relay.ts`, or
 *     `websocket_relay.ts` — confirmed unmodified by this Stage.
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

import type { FedosSubscriptionListener } from "./fedos_relay_listeners.js";
import type { FedosValidatedNostrEvent } from "./fedos_validated_nostr_event.js";
import { validateInboundNostrEvent } from "./combined_inbound_event_validator.js";

/** Receives only events that have already passed id + signature verification. */
export type FedosValidatedEventListener = (event: FedosValidatedNostrEvent) => void;

/**
 * Wraps `listener` into a `FedosSubscriptionListener` suitable for
 * `FedosRelay.onSubscriptionMessage()`. EOSE messages are silently
 * dropped (they remain a raw/transport concern, never validated-event
 * traffic); EVENT messages are validated exactly once and forwarded
 * ONLY on success.
 */
export function createValidatedEventListener(
  listener: FedosValidatedEventListener,
): FedosSubscriptionListener {
  return (message) => {
    if (message.kind !== "event") return;
    const validated = validateInboundNostrEvent(message.event);
    if (validated === null) return;
    try {
      listener(validated);
    } catch {
      // A throwing validated-event listener must never escape this
      // adapter or affect any other message's own delivery.
    }
  };
}

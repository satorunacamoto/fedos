/**
 * Secure Runtime Alpha 232 ("Relay Inbound Message Model") — the FIRST
 * file of the Alpha 231–240 Nostr Relay Message Reception Arc to add
 * real code, following Alpha 231's own inventory. Defines a minimal,
 * transport-facing, Nostr-specific discriminated union naming the four
 * inbound Relay message categories this Arc's own Goals list requires
 * (EVENT, EOSE, OK, NOTICE) — deliberately NOT forced into a generic
 * Runtime event model, matching this Arc's own instruction ("Keep this
 * transport-facing and Nostr-specific. Do not force these wire messages
 * into a generic Runtime event model.") and the SAME "a Relay is, by
 * definition, a Nostr wire protocol boundary" discipline
 * `WebSocketRelay.publish()` (Alpha 216) already established for the
 * outbound direction.
 *
 * Each variant is discriminated by a `readonly kind` string literal —
 * the SAME idiom the legacy (excluded) `RelayMessage`
 * (`src/nostr/messages.ts`, Stage 5) already used for its own
 * `"event"`/`"eose"`/`"notice"`/`"unknown"`/`"invalid"` tags — reused as
 * an IDIOM only, not as code: this file shares no type, no import, and
 * no code path with `src/nostr/messages.ts`. `FedosRelayEventMessage`
 * carries a `FedosNostrWireEvent` (Alpha 234) — the dedicated,
 * protocol-honest wire-event representation that Stage decided on,
 * REUSED here rather than inventing a second event shape.
 *
 * "Unknown message kinds rejected" (this Arc's own Alpha 232
 * instruction) is honored by NOT adding a fifth "unsupported" variant
 * to this union at all — the union stays a closed set of exactly the
 * four real Nostr message kinds a Relay sends this Arc's own Goals list
 * names. Rejection of anything else is the PARSER's own job (Alpha
 * 233's `parseRelayInboundMessage` returns `null`) — the smallest
 * honest boundary: a value of type `FedosRelayInboundMessage` is always
 * ONE of the four real kinds, never a placeholder "we don't know what
 * this is" variant a caller would have to remember to handle.
 *
 * HARD GUARDRAILS:
 *   - `FedosRelayEventMessage`, `FedosRelayEoseMessage`,
 *     `FedosRelayOkMessage`, `FedosRelayNoticeMessage`, and
 *     `FedosRelayInboundMessage` are the ONLY exports.
 *   - Every field, on every variant, is `readonly` — no mutable payload
 *     of any kind, matching this Arc's own "no mutable payload"
 *     instruction.
 *   - NO free-form metadata bag (no `Record<string, unknown>`, no
 *     index signature, no `[key: string]: unknown`) on any variant —
 *     every field is a named, typed, single-purpose value.
 *   - `FedosNostrWireEvent` (Alpha 234) is imported as a TYPE ONLY
 *     (`import type`) — this file performs no event construction or
 *     transformation of any kind.
 *   - This file defines TYPES ONLY — no function, no class, no parsing
 *     logic, no cryptographic verification of any kind (that is Alpha
 *     233's own concern).
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

import type { FedosNostrWireEvent } from "./fedos_nostr_wire_event.js";

export interface FedosRelayEventMessage {
  readonly kind: "event";
  readonly subscriptionId: string;
  readonly event: FedosNostrWireEvent;
}

export interface FedosRelayEoseMessage {
  readonly kind: "eose";
  readonly subscriptionId: string;
}

export interface FedosRelayOkMessage {
  readonly kind: "ok";
  readonly eventId: string;
  readonly accepted: boolean;
  readonly message: string;
}

export interface FedosRelayNoticeMessage {
  readonly kind: "notice";
  readonly message: string;
}

export type FedosRelayInboundMessage =
  | FedosRelayEventMessage
  | FedosRelayEoseMessage
  | FedosRelayOkMessage
  | FedosRelayNoticeMessage;

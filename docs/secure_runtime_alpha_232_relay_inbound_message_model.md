# Secure Runtime Alpha 232 — Relay Inbound Message Model

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_relay_inbound_message.ts`. This is Stage 2 of the
Alpha 231–240 Nostr Relay Message Reception Arc, following Alpha 231's
own inventory and Decision.**

## 1. Why now

Alpha 231 §4 decided this Arc needs a closed, Nostr-specific
discriminated union naming the four inbound Relay message categories
before a parser (Alpha 233) or any delivery mechanism (Alpha 235/236)
can exist. This Stage builds exactly that union — type-first, behavior
in later Stages, the SAME sequencing `FedosSubscription` (Alpha 222)
→ `subscribe()` (Alpha 226) already established one Arc ago.

## 2. What was implemented

```ts
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
```

`FedosRelayEventMessage` carries a `FedosNostrWireEvent` — the
dedicated wire-event representation Alpha 234 (this same commit)
decides on. This forward reference is the SAME kind Alpha 219 §3
(Relay Foundation Arc) made toward a not-yet-built Subscription
capability; both types land together in this Arc's own single commit.

## 3. Design decisions, explained

- **Transport-facing and Nostr-specific, not forced into a generic
  Runtime event model.** This Arc's own Alpha 232 instruction states
  this plainly. `AppRuntime`/`src/runtime/*` carry zero reference to
  any of these four types — they exist ONLY as a Desktop-owned,
  Relay-message-shaped contract, the SAME "Desktop owns Relay" split
  `FedosRelay` itself (Alpha 212) already established.
- **`readonly` everywhere, no mutable payload.** Every field, on every
  variant, is `readonly` — an inbound message is a fact already
  received; nothing on this repository's own side should ever be able
  to mutate it in place after the parser (Alpha 233) constructs it.
- **No free-form metadata bag.** No `Record<string, unknown>`, no index
  signature, no catch-all field exists on any variant — a caller can
  always enumerate exactly what a message carries from its own type
  alone.
- **Unknown message kinds are REJECTED, not represented.** This union
  stays a CLOSED set of exactly the four real message kinds a Relay
  sends (this Arc's own Goals list names no fifth kind). Rather than
  adding a `{ kind: "unsupported" }` variant every caller would need to
  remember to handle, an unsupported/malformed input simply never
  produces a `FedosRelayInboundMessage` value at all — the parser
  (Alpha 233) returns `null` instead. A value of this type is therefore
  ALWAYS one of the four real kinds, never a placeholder.

## 4. Structural confirmation (real inspection, this Stage)

- `fedos_relay_inbound_message.ts` exports exactly five symbols:
  `FedosRelayEventMessage`, `FedosRelayEoseMessage`,
  `FedosRelayOkMessage`, `FedosRelayNoticeMessage`,
  `FedosRelayInboundMessage`.
- Every field on every one of the four message interfaces is
  `readonly`.
- Zero index signature (`[key: string]`) or `Record<string, unknown>`
  exists anywhere in this file.
- `FedosNostrWireEvent` is imported as a TYPE ONLY (`import type`).
- Zero function, zero class, zero parsing logic of any kind — this
  file defines TYPES ONLY.

## 5. What this Stage does NOT do

- Does **not** implement `parseRelayInboundMessage` — Alpha 233's own
  deliverable.
- Does **not** implement `FedosNostrWireEvent` itself — landed
  alongside this Stage as Alpha 234's own deliverable (same commit).
- Does **not** wire any of these types into `WebSocketRelay` or
  `FedosRelay` — Alpha 235/236/238's own deliverables.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `src/sign/*`,
  `create_runtime.ts`, `types.ts`, `AppRuntime`, `worker.ts`,
  `src/identity/*`, `desktop_application.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_231_existing_relay_inbound_inventory.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
- `docs/secure_runtime_alpha_222_subscription_interface.md`

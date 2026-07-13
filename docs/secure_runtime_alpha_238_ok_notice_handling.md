# Secure Runtime Alpha 238 — OK and NOTICE Handling

**Status: this Stage IMPLEMENTS. It modifies
`src/desktop/fedos_relay_listeners.ts`, `fedos_relay.ts`,
`null_relay.ts`, and `websocket_relay.ts` (all four landed alongside
Alpha 236 in this same commit). This is Stage 8 of the Alpha 231–240
Nostr Relay Message Reception Arc, following Alpha 237's own EOSE
review.**

## 1. Why now

`FedosRelayOkMessage`/`FedosRelayNoticeMessage` (Alpha 232) have no
delivery mechanism yet — `#handleSocketMessage`'s (Alpha 235) own
`"ok"`/`"notice"` fallthrough branch needs a real listener to call.

## 2. Boundary chosen: Option A — one Relay-level listener

This Arc's own Alpha 238 instruction lists four candidates:

- **A. One Relay-level listener.** ADOPTED.
- **B. Publish-result tracking.** REJECTED — would require reshaping
  `publish()`'s own frozen `Promise<void>` contract (on this Arc's own
  "MUST NOT be redesigned" list) into something that waits for or
  correlates an OK, directly contradicting Alpha 216's own "Transport
  only. No ACK handling" instruction from one Arc ago.
- **C. Separate OK/NOTICE callbacks.** REJECTED — OK and NOTICE are
  BOTH relay-wide, non-subscription-scoped facts; two separate
  registration methods would double the API surface for no behavioral
  gain over one listener receiving a two-member union, violating this
  Arc's own "do not add unused complexity merely to expose every parsed
  value" instruction.
- **D. Parsed but currently discarded.** REJECTED — this Arc's own
  Alpha 240 Completion Declaration explicitly lists OK/NOTICE
  classification as IN scope for this Arc ("OK classification, NOTICE
  classification"), so a real caller (this Arc's own completion
  criteria) explicitly wants both observable, not silently dropped.

```ts
export type FedosRelayMessageListener = (
  message: FedosRelayOkMessage | FedosRelayNoticeMessage,
) => void;
```

```ts
onRelayMessage(listener: FedosRelayMessageListener): void;
```

`WebSocketRelay`/`NullRelay` each hold ONE `#relayListener` slot,
registered/replaced by `onRelayMessage()` — the SAME single-slot,
last-registration-wins shape `onSubscriptionMessage()` (Alpha 236)
already established, applied here at relay scope instead of
subscription scope.

## 3. Rules honored, each explained

- **Do not treat Relay text as trusted.** `FedosRelayOkMessage.message`/
  `FedosRelayNoticeMessage.message` are plain `string` values, passed
  through UNMODIFIED from the wire — no HTML/markup interpretation, no
  templating, no execution of any kind occurs anywhere in this Arc's
  own code.
- **Do not interpret severity.** NOTICE carries no structured
  severity field in NIP-01 itself, and this Arc adds none — a listener
  receives the raw text and decides for itself, if it chooses to.
- **Do not retry automatically.** `onRelayMessage()`'s own listener is
  a passive OBSERVER — nothing in this Arc re-sends a REQ, re-publishes
  an EVENT, or otherwise reacts to an `accepted: false` OK on the
  caller's behalf.
- **Do not mutate Event state.** No `FedosEventDescriptor` or
  `FedosNostrWireEvent` value is looked up, modified, or marked in any
  way when an OK arrives — `WebSocketRelay` holds no event-tracking
  table of any kind.
- **Do not log automatically.** Zero `console.log`/`console.warn`/
  `console.error` call exists anywhere in this Arc's own new or
  modified files.
- **Do not store automatically.** No OK/NOTICE value is written to any
  field beyond the transient argument passed into the listener call
  itself — nothing is retained after `onRelayMessage`'s own listener
  invocation returns.

## 4. Structural confirmation (real inspection, this Stage)

- `fedos_relay_listeners.ts` exports exactly two symbols total (Alpha
  236 + this Stage): `FedosSubscriptionListener`,
  `FedosRelayMessageListener`.
- `FedosRelay` gains exactly one new method this Stage names,
  `onRelayMessage()` — `void`-returning, ungated by `#connected`.
- `WebSocketRelay`'s `#handleSocketMessage` routes `"ok"`/`"notice"`
  messages to `this.#relayListener`, wrapped in its own `try`/`catch` —
  the SAME listener-isolation discipline `onSubscriptionMessage()`
  (Alpha 236) already established.
- Zero `console.*` call, zero storage write, zero retry/re-send call
  exists anywhere in `websocket_relay.ts`, `null_relay.ts`, or
  `fedos_relay.ts`.

## 5. What this Stage does NOT do

- Does **not** change `publish()`'s own signature, return type, or
  "no ACK handling" contract in any way (Option B, rejected, §2).
- Does **not** add a second OK/NOTICE-specific registration method
  (Option C, rejected, §2).
- Does **not** correlate an OK message with the specific `publish()`
  call that produced it — the listener receives the SAME
  `FedosRelayOkMessage` regardless of which `publish()` invocation (if
  any, on THIS relay instance) sent the referenced event id; matching
  an OK back to a specific `publish()` promise is explicitly left to a
  future, separately-reviewed Stage, if a real caller ever needs it.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `create_runtime.ts`,
  `types.ts`, `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_236_subscription_event_delivery.md`
- `docs/secure_runtime_alpha_237_eose_lifecycle.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`

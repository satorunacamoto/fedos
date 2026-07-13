# Secure Runtime Alpha 235 — WebSocket Inbound Wiring

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/websocket_relay.ts`. This is Stage 5 of the Alpha
231–240 Nostr Relay Message Reception Arc, following Alpha 232–234's
own message model, parser, and wire-event representation.**

## 1. Why now

A parser with nothing feeding it is dead code. This Stage wires the
injected socket's own message callback into `WebSocketRelay`, so
`parseRelayInboundMessage` (Alpha 233) actually runs against real
inbound frames.

## 2. What was implemented

`FedosRelaySocket` gains a THIRD event type, `"message"`, and a new
`FedosRelaySocketEvent` shape (`{ readonly data?: unknown }`):

```ts
export type FedosRelaySocketEventType = "close" | "error" | "message";

export interface FedosRelaySocketEvent {
  readonly data?: unknown;
}

export interface FedosRelaySocket {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: FedosRelaySocketEventType,
    listener: (event?: FedosRelaySocketEvent) => void,
  ): void;
}
```

`connect()` registers ONE `"message"` listener alongside its own
existing `"close"`/`"error"` listeners (Alpha 214/215, byte-for-byte
UNCHANGED):

```ts
socket.addEventListener("message", (event) => {
  if (this.#socket !== socket) return;
  this.#handleSocketMessage(event);
});
```

`#handleSocketMessage` (private) decodes JSON, parses, and dispatches:

```ts
#handleSocketMessage(event: FedosRelaySocketEvent | undefined): void {
  let parsedJson: unknown;
  try {
    const data = event?.data;
    const raw = typeof data === "string" ? data : String(data ?? "");
    parsedJson = JSON.parse(raw);
  } catch {
    return;
  }
  const message = parseRelayInboundMessage(parsedJson);
  if (message === null) return;
  // ... routed to a subscription or relay-level listener (Alpha 236/238)
}
```

## 3. Design decisions, explained

- **The listener parameter is now OPTIONAL
  (`listener?: FedosRelaySocketEvent`).** This is what lets the
  PRE-EXISTING `"close"`/`"error"` zero-argument calling convention
  (`socket.addEventListener("close", () => {...})`) remain valid
  UNCHANGED — a function accepting an optional parameter is callable
  with zero arguments, so no existing call site needed to change.
- **A stale-socket guard exists ONLY on the new `"message"` listener.**
  `connect()`'s own pre-existing `"close"`/`"error"` listeners are left
  BYTE-FOR-BYTE as Alpha 214/215 shipped them, since `FedosRelay
  connection lifecycle` is on this Arc's own "Already complete and MUST
  NOT be redesigned" list. The guard (`if (this.#socket !== socket)
  return;`) satisfies this Arc's own Alpha 239 "no delivery through
  stale socket callbacks after reconnect" requirement for the ONE new
  capability this Arc adds, without touching the frozen lifecycle or
  its own pre-existing (and out-of-scope) behavior.
- **Malformed JSON is silently ignored.** `JSON.parse` is wrapped in
  its own `try`/`catch`; a parse failure returns from the handler with
  no further action — matching this Arc's own "invalid JSON →
  ignored/fail-closed" instruction exactly.
- **A malformed/unsupported Nostr message is silently ignored.**
  `parseRelayInboundMessage` returning `null` short-circuits the
  handler the same way — matching "malformed Nostr message →
  ignored/fail-closed."
- **No parser exception can escape the callback.** `parseRelayInboundMessage`
  (Alpha 233) itself never throws (its own `try`/`catch`), and this
  Stage's OWN `try`/`catch` around JSON decoding adds a second layer —
  a socket implementation that somehow raised inside `JSON.parse` (e.g.
  a hostile `toString()` on `event.data`) still cannot escape
  `#handleSocketMessage`.
- **No browser-global `WebSocket` reference of any kind.** The socket
  continues to arrive exclusively via the injected
  `FedosRelaySocketFactory` (Alpha 214, UNCHANGED) — this Stage adds no
  `new WebSocket(...)` call anywhere.
- **No automatic reconnect, no storage, no global event bus.** A
  `"close"`/`"error"` event still ONLY clears `#connected`/`#socket`
  (Alpha 214/215's own unchanged behavior) — this Stage adds no retry
  logic, no persistence of any kind, and dispatches parsed messages
  ONLY to the listeners registered directly on THIS `WebSocketRelay`
  instance (Alpha 236/238), never to any module-level or global
  registry.

## 4. Structural confirmation (real inspection, this Stage)

- `connect()` registers exactly THREE listeners per socket: `"close"`,
  `"error"`, `"message"` — confirmed by direct inspection.
- `#handleSocketMessage` is `private` (a `#`-prefixed class field
  method) — unreachable from outside the class by JavaScript's own
  privacy rules.
- Zero `new WebSocket(` appears anywhere in this file.
- `parseRelayInboundMessage` (Alpha 233) is the ONLY source of inbound
  message structure decisions — no inline re-implementation of
  EVENT/EOSE/OK/NOTICE shape-checking exists in this file.

## 5. What this Stage does NOT do

- Does **not** route a parsed message to any listener yet — routing to
  a subscription-scoped or relay-level listener is Alpha 236/238's own
  deliverable (landed in the same commit, immediately following this
  Stage's own dispatch skeleton).
- Does **not** perform cryptographic verification of a received EVENT.
- Does **not** implement automatic reconnect, retry, or persistent
  subscriptions of any kind.
- Does **not** modify `fedos_relay.ts`'s own PUBLIC interface (that is
  Alpha 236/238's own deliverable, landed alongside this Stage), or
  `null_relay.ts`, `src/nostr/*`, `src/sign/*`, `create_runtime.ts`,
  `types.ts`, `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_233_nip01_relay_wire_parser.md`
- `docs/secure_runtime_alpha_232_relay_inbound_message_model.md`
- `docs/secure_runtime_alpha_214_websocket_relay_connection_only.md`
- `docs/secure_runtime_alpha_236_subscription_event_delivery.md`

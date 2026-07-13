# Secure Runtime Alpha 214 — WebSocket Relay: Connection Only

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/websocket_relay.ts`, and edits exactly two existing
files, `src/desktop/fedos_relay.ts` and `src/desktop/null_relay.ts`,
to add one method, `connect()`, to each. This is Stage 4 of the Alpha
211–220 Nostr Relay Foundation Arc, following Alpha 213's own Null
Relay.**

## 1. Why now

`FedosRelay` (Alpha 212) and `NullRelay` (Alpha 213) exist, but
neither can open a real connection to anything — the interface names
no capability beyond a target `url`. This Stage adds the FIRST real
capability, `connect()`, and the FIRST real (socket-backed)
implementation, `WebSocketRelay` — deliberately scoped to CONNECTION
ONLY, per this Arc's own Alpha 214 instruction, leaving
`disconnect()`/`isConnected()` (Alpha 215) and `publish()` (Alpha 216)
for later, dedicated Stages.

## 2. What was implemented

`src/desktop/fedos_relay.ts` gains one method:

```ts
export interface FedosRelay {
  readonly url: string;
  connect(): Promise<void>;
}
```

`src/desktop/null_relay.ts` gains a matching no-op:

```ts
export class NullRelay implements FedosRelay {
  // ...
  async connect(): Promise<void> {
    this.#connected = true;
  }
}
```

`src/desktop/websocket_relay.ts` (new) implements the SAME method for
real, via an injected socket factory:

```ts
export type FedosRelaySocketFactory = (
  url: string,
) => FedosRelaySocket | Promise<FedosRelaySocket>;

export class WebSocketRelay implements FedosRelay {
  readonly url: string;
  // ...
  async connect(): Promise<void> {
    if (this.#connected) return;
    const socket = await this.#factory(this.url);
    socket.addEventListener("close", () => { /* ... */ });
    socket.addEventListener("error", () => { /* ... */ });
    this.#socket = socket;
    this.#connected = true;
  }
}
```

- `FedosRelaySocket`/`FedosRelaySocketFactory` are a NEW, INDEPENDENT
  pair of types — no import from `src/nostr/ws_relay.ts`, whose own
  `RelaySocketLike`/`WebSocketFactory` this Stage deliberately does
  NOT reuse (Alpha 211 §3).
- The socket is ALWAYS obtained via `this.#factory(this.url)` — no
  `new WebSocket(...)` call exists anywhere in this file, keeping the
  class fully testable against a fake socket with zero real network
  I/O.
- `connect()` is idempotent — a second call while already connected
  resolves immediately without requesting a second socket.
- `"close"`/`"error"` listeners keep `#connected` accurate if the
  underlying socket goes away on its own — no `"message"` listener of
  any kind exists yet (nor will one until Alpha 216's own publish
  path, which itself needs none — "No ACK handling").

## 3. Responsibility boundary

- **Connection only:** `connect()` is the ONLY method with real
  behavior in `WebSocketRelay`. No send, no publish, no disconnect
  logic exists yet.
- **Injected transport:** the socket factory is supplied by the
  caller, never constructed inline — `WebSocketRelay` itself never
  references the global `WebSocket` constructor.
- **No REQ/CLOSE/Subscription/Filter/ACK vocabulary:** matching this
  Arc's own exclusion list exactly, unchanged from Alpha 212/213.
- **`NullRelay` stays real-network-free:** its own `connect()` is
  plain in-memory bookkeeping (`#connected = true`), never a socket of
  any kind.

## 4. What this Stage does NOT do

- Does **not** add `disconnect()` or `isConnected()` to `FedosRelay`,
  `NullRelay`, or `WebSocketRelay` — Alpha 215's own deliverable.
- Does **not** add `publish()` to any of the three — Alpha 216's own
  deliverable.
- Does **not** send any message over the socket — no `socket.send(...)`
  call exists anywhere in this Stage's own code.
- Does **not** modify `src/desktop/desktop_application.ts` or
  `create_desktop_application.ts`.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_213_null_relay.md`
- `docs/secure_runtime_alpha_212_relay_interface.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
- `docs/secure_runtime_alpha_103_source_injection.md`

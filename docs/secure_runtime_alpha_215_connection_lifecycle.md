# Secure Runtime Alpha 215 — Connection Lifecycle

**Status: this Stage IMPLEMENTS. It edits exactly three existing
files — `src/desktop/fedos_relay.ts`, `src/desktop/null_relay.ts`,
and `src/desktop/websocket_relay.ts` — to add two methods,
`disconnect()` and `isConnected()`, to each. No new file is added.
This is Stage 5 of the Alpha 211–220 Nostr Relay Foundation Arc,
following Alpha 214's own Connection-Only WebSocket Relay.**

## 1. Why now

Alpha 214 gave `FedosRelay` a way to OPEN a connection, but no way to
close one or ask whether one is currently open. This Stage completes
the lifecycle this Arc's own Alpha 215 instruction names explicitly:
`connect()` (Alpha 214), `disconnect()`, `isConnected()`.

## 2. What was implemented

`src/desktop/fedos_relay.ts`:

```ts
export interface FedosRelay {
  readonly url: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
```

`src/desktop/null_relay.ts`:

```ts
async disconnect(): Promise<void> {
  this.#connected = false;
}

isConnected(): boolean {
  return this.#connected;
}
```

`src/desktop/websocket_relay.ts`:

```ts
async disconnect(): Promise<void> {
  if (!this.#connected || this.#socket === undefined) {
    this.#connected = false;
    return;
  }
  const socket = this.#socket;
  this.#socket = undefined;
  this.#connected = false;
  socket.close();
}

isConnected(): boolean {
  return this.#connected;
}
```

- `isConnected()` is SYNCHRONOUS on both implementations — a plain
  state read, never a network round-trip, mirroring
  `DesktopApplication.isBootstrapped()`'s (Alpha 117) own identical
  shape.
- `disconnect()` is idempotent on both implementations — calling it
  while not connected performs no socket operation on
  `WebSocketRelay`, and simply re-asserts `false` on `NullRelay`.
- `WebSocketRelay.isConnected()` reflects BOTH an explicit
  `disconnect()` call and a socket that closed on its own (via the
  `"close"`/`"error"` listeners Alpha 214 already registered) — the
  SAME `#connected` field backs both paths, so the caller sees no
  difference between the two.

## 3. Responsibility boundary

- **State query is pure:** `isConnected()` never throws, never awaits,
  and never opens a connection of its own on either implementation.
- **Disconnect is safe to call unconditionally:** neither
  implementation's own `disconnect()` throws when called on an
  already-disconnected instance.
- **`NullRelay` remains real-network-free:** `disconnect()` is a
  single field assignment; no socket, no `fetch`, no timer.

## 4. What this Stage does NOT do

- Does **not** add `publish()` to `FedosRelay`, `NullRelay`, or
  `WebSocketRelay` — Alpha 216's own deliverable.
- Does **not** add any new file — this Stage edits three existing
  files only.
- Does **not** modify `src/desktop/desktop_application.ts` or
  `create_desktop_application.ts`.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_214_websocket_relay_connection_only.md`
- `docs/secure_runtime_alpha_213_null_relay.md`
- `docs/secure_runtime_alpha_212_relay_interface.md`
- `docs/secure_runtime_alpha_117_desktop_bootstrap_state.md`

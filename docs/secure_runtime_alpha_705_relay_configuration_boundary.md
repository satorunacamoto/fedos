# Secure Runtime Alpha 705 — Relay Configuration Boundary

Stage 5 of Phase B.

## Finding

This environment's Node runtime (v24) already ships a real, spec-following
global `WebSocket` constructor — confirmed present
(`typeof WebSocket === "function"`). No `ws` package or any other new npm
dependency is needed for a real, production WebSocket client.

## Minimum injected configuration

- The Relay URL is a plain string, supplied by the caller (matching
  `FedosRelay.url`'s own existing shape — unchanged).
- The socket itself is constructed by an INJECTED
  `FedosRelaySocketFactory` (`WebSocketRelay`'s own existing constructor
  parameter, Alpha 214, unchanged) — never a hardcoded `new WebSocket(url)`
  inside `WebSocketRelay` itself.
- `createNodeWebSocketRelaySocketFactory()`
  (`src/desktop/node_websocket_relay_socket_factory.ts`) is the ONE real,
  production factory this Arc adds: it constructs a global `WebSocket` and
  resolves its returned `Promise` only once the socket's own `"open"`
  event fires (rejecting on `"error"`) — because `WebSocketRelay.connect()`
  itself sets `#connected = true` the instant the factory's promise
  resolves, with no separate readiness wait of its own.

No socket object is ever placed in `FedosDesktopRuntimeConfig` (which
stays a plain, serializable-shaped object per its own existing
guardrails) — the Relay/factory live entirely in caller-assembled
publisher wiring (Alpha 704), never in config itself.

No Relay Pool, no automatic relay discovery, no source-derived relay —
none of this Arc's code selects a relay URL from anything but an explicit
caller value.

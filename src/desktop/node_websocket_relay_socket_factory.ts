/**
 * Secure Runtime Alpha 705 ("Relay Configuration Boundary") — Stage 5 of
 * Phase B of the Alpha 681–720 Nostr Identity Binding & Outbound Delivery
 * Activation Arc.
 *
 * `WebSocketRelay` (`./websocket_relay.ts`) never constructs a socket
 * itself — it always calls an injected `FedosRelaySocketFactory`
 * (`(url: string) => FedosRelaySocket | Promise<FedosRelaySocket>`). This
 * file supplies the ONE real, production factory: the global `WebSocket`
 * constructor Node 22+ already ships (no `ws` package, no new npm
 * dependency of any kind — confirmed present in this environment's own
 * Node runtime, `WebSocket` is a real, spec-following global here).
 *
 * `WebSocketRelay.connect()` sets its own `#connected = true` the moment
 * the factory's `Promise` resolves — it never separately awaits an
 * `"open"` event. This factory therefore does that waiting itself: it
 * resolves only once the underlying WebSocket's own `"open"` event fires,
 * and rejects if `"error"` fires first — so a caller never observes
 * `isConnected() === true` for a socket that has not actually finished
 * its handshake.
 *
 * No Relay Pool, no automatic reconnect, no relay discovery — this file
 * constructs exactly one socket per call, for exactly the URL it is
 * given.
 */

import type { FedosRelaySocket, FedosRelaySocketFactory } from "./websocket_relay.js";

/** The narrow slice of the real, global `WebSocket` this factory depends on. */
interface RealWebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event?: unknown) => void): void;
}

declare const WebSocket: new (url: string) => RealWebSocketLike;

/**
 * Builds a `FedosRelaySocketFactory` backed by the real global `WebSocket`.
 * Never constructs a socket eagerly — only when `WebSocketRelay.connect()`
 * itself calls the returned factory.
 */
export function createNodeWebSocketRelaySocketFactory(): FedosRelaySocketFactory {
  return (url: string): Promise<FedosRelaySocket> => {
    return new Promise<FedosRelaySocket>((resolve, reject) => {
      const socket = new WebSocket(url);
      const onOpen = (): void => {
        resolve(socket as unknown as FedosRelaySocket);
      };
      const onError = (): void => {
        reject(new Error(`createNodeWebSocketRelaySocketFactory: failed to connect to ${url}`));
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
    });
  };
}

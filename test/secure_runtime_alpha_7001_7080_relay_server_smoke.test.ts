/**
 * Secure Runtime Alpha 7001-7080 — smoke test for the real local
 * WebSocket relay server fixture (`test/support/fedos_real_local_websocket_relay_server.ts`)
 * in isolation, using Node's own real global `WebSocket` client directly
 * (not `WebSocketRelay` itself — that integration is proven separately in
 * the full vertical slice). Proves the handshake, REQ/EVENT/CLOSE framing,
 * OK ack, and redeliverLast() all work over a REAL socket before this
 * fixture is trusted by the larger acceptance slice.
 */
import { describe, it, expect } from "vitest";
import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";

declare const WebSocket: new (url: string) => {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event?: { data?: unknown }) => void): void;
};

function onceMessage(socket: { addEventListener(type: string, listener: (event?: { data?: unknown }) => void): void }): Promise<unknown> {
  return new Promise((resolve) => {
    socket.addEventListener("message", (event) => resolve(JSON.parse(String(event?.data ?? "null"))));
  });
}

function connect(url: string): Promise<InstanceType<typeof WebSocket>> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket));
    socket.addEventListener("error", () => reject(new Error("connect failed")));
  });
}

describe("Secure Runtime Alpha 7001-7080 -- real local WebSocket relay server smoke test", () => {
  it("real handshake, REQ/EOSE, EVENT publish -> OK ack, subscriber delivery, CLOSE, redeliverLast", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer();
    try {
      expect(relay.url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);

      const publisher = await connect(relay.url);
      const subscriber = await connect(relay.url);
      expect(relay.connectionCount()).toBe(2);

      const eose = onceMessage(subscriber);
      subscriber.send(JSON.stringify(["REQ", "sub-1", { kinds: [1059] }]));
      expect(await eose).toEqual(["EOSE", "sub-1"]);

      const ok = onceMessage(publisher);
      const delivered = onceMessage(subscriber);
      const testEvent = { id: "evt-1", kind: 1059, content: "opaque-ciphertext" };
      publisher.send(JSON.stringify(["EVENT", testEvent]));
      expect(await ok).toEqual(["OK", "evt-1", true, ""]);
      expect(await delivered).toEqual(["EVENT", "sub-1", testEvent]);

      const redelivered = onceMessage(subscriber);
      relay.redeliverLast();
      expect(await redelivered).toEqual(["EVENT", "sub-1", testEvent]);

      subscriber.send(JSON.stringify(["CLOSE", "sub-1"]));
      await new Promise((resolve) => setTimeout(resolve, 50));
      let receivedAfterClose = false;
      subscriber.addEventListener("message", () => {
        receivedAfterClose = true;
      });
      publisher.send(JSON.stringify(["EVENT", { id: "evt-2", kind: 1059, content: "should not be delivered" }]));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(receivedAfterClose).toBe(false);

      publisher.close();
      subscriber.close();
    } finally {
      await relay.close();
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import type { FedosRelaySocket, FedosRelaySocketEvent } from "../src/os/messenger/desktop/websocket_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_235_websocket_inbound_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";

function fakeSocket(): {
  socket: FedosRelaySocket;
  listeners: { close: (() => void)[]; error: (() => void)[]; message: ((event?: FedosRelaySocketEvent) => void)[] };
} {
  const listeners = {
    close: [] as (() => void)[],
    error: [] as (() => void)[],
    message: [] as ((event?: FedosRelaySocketEvent) => void)[],
  };
  const socket: FedosRelaySocket = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: (type, listener) => {
      listeners[type].push(listener);
    },
  };
  return { socket, listeners };
}

/**
 * Secure Runtime Alpha 235 -- "WebSocket Inbound Wiring": Stage 5 of
 * the Nostr Relay Message Reception Arc. Wires the injected socket's
 * "message" callback into WebSocketRelay's connect(); parses every
 * frame via parseRelayInboundMessage; fails closed on malformed JSON
 * or malformed Nostr messages; no exception escapes the callback.
 */
describe("Secure Runtime Alpha 235 -- WebSocket Inbound Wiring", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one existing file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/websocket_relay\.ts`\./,
    );
  });

  it("3. structural: FedosRelaySocketEventType/FedosRelaySocketEvent are exported, and the socket listener parameter is optional", () => {
    expect(websocketRelaySource).toMatch(/export type FedosRelaySocketEventType = "close" \| "error" \| "message";/);
    expect(websocketRelaySource).toMatch(/export interface FedosRelaySocketEvent \{/);
    expect(websocketRelaySource).toMatch(/listener: \(event\?: FedosRelaySocketEvent\) => void,/);
  });

  it("4. structural: connect() registers exactly one 'message' listener, with a stale-socket guard", () => {
    const connectBody = (websocketRelaySource.match(/async connect\(\): Promise<void> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(connectBody).toMatch(/socket\.addEventListener\("message", \(event\) => \{/);
    expect(connectBody).toMatch(/if \(this\.#socket !== socket\) return;/);
  });

  it("5. structural: parseRelayInboundMessage is imported and is the only source of inbound message structure decisions", () => {
    expect(websocketRelaySource).toMatch(
      /import \{ parseRelayInboundMessage \} from "\.\/relay_inbound_parser\.js";/,
    );
  });

  it("6. structural: no cryptographic verification reference exists IN CODE", () => {
    const codeOnly = websocketRelaySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/schnorr|NobleSignatureVerifier|verifyEventId/);
  });

  it("7. structural: no new WebSocket( construction exists IN CODE anywhere in this file", () => {
    const codeOnly = websocketRelaySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/new WebSocket\(/);
  });

  it("8. the design doc cross-references Alpha 233, Alpha 232, Alpha 214, and Alpha 236", () => {
    for (const ref of [
      "secure_runtime_alpha_233_nip01_relay_wire_parser",
      "secure_runtime_alpha_232_relay_inbound_message_model",
      "secure_runtime_alpha_214_websocket_relay_connection_only",
      "secure_runtime_alpha_236_subscription_event_delivery",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("9. behavioral: a well-formed NOTICE frame is decoded and dispatched to the relay-level listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((message) => received.push(message));
    await relay.connect();

    expect(listeners.message.length).toBe(1);
    listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "hello"]) });

    expect(received).toEqual([{ kind: "notice", message: "hello" }]);
  });

  it("10. behavioral: malformed JSON is silently ignored -- no listener call, no throw, socket stays open", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((message) => received.push(message));
    await relay.connect();

    expect(() => listeners.message[0]?.({ data: "{ not json" })).not.toThrow();
    expect(received).toEqual([]);
    expect(relay.isConnected()).toBe(true);
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("11. behavioral: a structurally malformed Nostr message is silently ignored", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((message) => received.push(message));
    await relay.connect();

    listeners.message[0]?.({ data: JSON.stringify(["NOTICE"]) });
    listeners.message[0]?.({ data: JSON.stringify(["AUTH", "challenge"]) });

    expect(received).toEqual([]);
  });

  it("12. behavioral: an inbound frame with no event.data at all is handled without throwing", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    expect(() => listeners.message[0]?.()).not.toThrow();
    expect(() => listeners.message[0]?.({})).not.toThrow();
  });
});

import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import type { FedosRelaySocket } from "../src/os/messenger/desktop/websocket_relay.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
import type { FedosRelay } from "../src/os/messenger/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_217_relay_foundation_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";

function fakeSocket(): {
  socket: FedosRelaySocket;
  listeners: { close: (() => void)[]; error: (() => void)[]; message: (() => void)[] };
} {
  const listeners = { close: [] as (() => void)[], error: [] as (() => void)[], message: [] as (() => void)[] };
  const socket: FedosRelaySocket = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: (type, listener) => {
      listeners[type].push(listener);
    },
  };
  return { socket, listeners };
}

const sampleEvent: FedosEventDescriptor = {
  id: "a".repeat(64),
  provider: "nostr",
  author: "b".repeat(64),
  createdAt: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "verification event",
  signature: "d".repeat(128),
};

/**
 * Secure Runtime Alpha 217 -- "Relay Foundation Verification": Stage 7
 * of the Nostr Relay Foundation Arc. Test coverage only, no production
 * code change. Real execution of Connect/Disconnect/Publish/Reconnect
 * against WebSocketRelay and NullRelay.
 */
describe("Secure Runtime Alpha 217 -- Relay Foundation Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage only", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it adds test coverage only/);
  });

  it("3. Regression: fedos_relay.ts, null_relay.ts, and websocket_relay.ts carry no reference to this Stage's own doc", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_217/);
    }
  });

  // ---------------------------------------------------------------------
  // Real execution: WebSocketRelay
  // ---------------------------------------------------------------------

  it("4. Connect: requests exactly one socket and reports isConnected() true", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay: FedosRelay = new WebSocketRelay("wss://relay.example.test", factory);
    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("5. Disconnect: closes the held socket exactly once and reports isConnected() false", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay: FedosRelay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await relay.disconnect();
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(relay.isConnected()).toBe(false);
  });

  it("6. Publish: sends exactly one correctly-mapped EVENT wire message, no ACK wait", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay: FedosRelay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await expect(relay.publish(sampleEvent)).resolves.toBeUndefined();
    expect(socket.send).toHaveBeenCalledTimes(1);
    const [label, wire] = JSON.parse((socket.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string);
    expect(label).toBe("EVENT");
    expect(wire.pubkey).toBe(sampleEvent.author);
    expect(wire.created_at).toBe(sampleEvent.createdAt);
    expect(wire.sig).toBe(sampleEvent.signature);
  });

  it("7. Reconnect: a full connect -> publish -> disconnect -> connect -> publish cycle succeeds, requesting a SECOND fresh socket", async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    const factory = vi.fn().mockResolvedValueOnce(first.socket).mockResolvedValueOnce(second.socket);
    const relay: FedosRelay = new WebSocketRelay("wss://relay.example.test", factory);

    await relay.connect();
    await relay.publish(sampleEvent);
    await relay.disconnect();
    expect(relay.isConnected()).toBe(false);

    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await relay.publish(sampleEvent);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(first.socket.send).toHaveBeenCalledTimes(1);
    expect(second.socket.send).toHaveBeenCalledTimes(1);
  });

  it("8. Reconnect after an unexpected socket close also succeeds", async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    const factory = vi.fn().mockResolvedValueOnce(first.socket).mockResolvedValueOnce(second.socket);
    const relay: FedosRelay = new WebSocketRelay("wss://relay.example.test", factory);

    await relay.connect();
    for (const listener of first.listeners.close) listener();
    expect(relay.isConnected()).toBe(false);

    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await expect(relay.publish(sampleEvent)).resolves.toBeUndefined();
  });

  // ---------------------------------------------------------------------
  // Real execution: NullRelay, cross-implementation parity
  // ---------------------------------------------------------------------

  it("9. cross-implementation parity: the SAME connect/publish/disconnect/reconnect cycle succeeds against NullRelay", async () => {
    const relay: FedosRelay = new NullRelay("wss://relay.example.test");

    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await relay.publish(sampleEvent);
    await relay.disconnect();
    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await expect(relay.publish(sampleEvent)).resolves.toBeUndefined();
  });

  it("10. no real network global (fetch/WebSocket) is touched anywhere in this Stage's own execution", async () => {
    const originalFetch = (globalThis as { fetch?: unknown }).fetch;
    const fetchSpy = vi.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchSpy;
    try {
      const { socket } = fakeSocket();
      const factory = vi.fn().mockResolvedValue(socket);
      const relay: FedosRelay = new WebSocketRelay("wss://relay.example.test", factory);
      await relay.connect();
      await relay.publish(sampleEvent);
      await relay.disconnect();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });

  it("11. the design doc cross-references Alpha 216, Alpha 215, Alpha 214, Alpha 196, and Alpha 209", () => {
    for (const ref of [
      "secure_runtime_alpha_216_publish_api",
      "secure_runtime_alpha_215_connection_lifecycle",
      "secure_runtime_alpha_214_websocket_relay_connection_only",
      "secure_runtime_alpha_196_event_foundation_verification",
      "secure_runtime_alpha_209_end_to_end_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

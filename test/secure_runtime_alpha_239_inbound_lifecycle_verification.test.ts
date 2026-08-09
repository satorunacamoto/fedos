import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import type { FedosRelaySocket, FedosRelaySocketEvent } from "../src/os/messenger/desktop/websocket_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_239_inbound_lifecycle_verification.md?raw";
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

const sampleWireEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content: "hello",
  sig: "d".repeat(128),
};

/**
 * Secure Runtime Alpha 239 -- "Failure and Lifecycle Verification":
 * Stage 9 of the Nostr Relay Message Reception Arc. Test coverage
 * only, no production code change. Real, end-to-end execution of the
 * full required scenario list against an injected fake socket.
 */
describe("Secure Runtime Alpha 239 -- Failure and Lifecycle Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage only", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it adds test coverage only/);
  });

  it("3. Regression: websocket_relay.ts carries no reference to this Stage's own doc", () => {
    expect(websocketRelaySource).not.toMatch(/secure_runtime_alpha_239/);
  });

  // ---------------------------------------------------------------------
  // 4-17: the full required scenario list, real execution
  // ---------------------------------------------------------------------

  it("4. Connect: requests exactly one socket and reports isConnected() true", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("5. Receive valid EVENT: delivered to the matching subscription listener, fields preserved verbatim", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([{ kinds: [1] }]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });

    expect(received).toEqual([{ kind: "event", subscriptionId: sub.id, event: sampleWireEvent }]);
  });

  it("6. Receive matching EOSE: delivered to the same subscription listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EOSE", sub.id]) });

    expect(received).toEqual([{ kind: "eose", subscriptionId: sub.id }]);
  });

  it("7. Receive OK accepted=true", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    const eventId = "e".repeat(64);
    listeners.message[0]?.({ data: JSON.stringify(["OK", eventId, true, "stored"]) });

    expect(received).toEqual([{ kind: "ok", eventId, accepted: true, message: "stored" }]);
  });

  it("8. Receive OK accepted=false", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    const eventId = "e".repeat(64);
    listeners.message[0]?.({ data: JSON.stringify(["OK", eventId, false, "blocked: spam"]) });

    expect(received).toEqual([{ kind: "ok", eventId, accepted: false, message: "blocked: spam" }]);
  });

  it("9. Receive NOTICE", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "restart imminent"]) });

    expect(received).toEqual([{ kind: "notice", message: "restart imminent" }]);
  });

  it("10. Malformed JSON: no listener call, no throw, connection stays open", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    expect(() => listeners.message[0]?.({ data: "not json {{{" })).not.toThrow();
    expect(received).toEqual([]);
    expect(relay.isConnected()).toBe(true);
  });

  it("11. Malformed array: no listener call, no throw", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    expect(() => listeners.message[0]?.({ data: JSON.stringify(["OK", "not-hex", true]) })).not.toThrow();
    expect(received).toEqual([]);
  });

  it("12. Unsupported message type: no listener call, no throw", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    expect(() => listeners.message[0]?.({ data: JSON.stringify(["AUTH", "challenge-string"]) })).not.toThrow();
    expect(received).toEqual([]);
  });

  it("13. EVENT for unknown subscription: dropped silently", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", "totally-unknown-sub", sampleWireEvent]) });

    expect(received).toEqual([]);
  });

  it("14. EVENT after unsubscribe: no longer delivered", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));
    await relay.unsubscribe(sub);

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });

    expect(received).toEqual([]);
  });

  it("15. Multiple active subscriptions: each receives only its own messages", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const subA = await relay.subscribe([{ kinds: [1] }]);
    const subB = await relay.subscribe([{ kinds: [2] }]);
    const subC = await relay.subscribe([{ kinds: [3] }]);
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    const receivedC: unknown[] = [];
    relay.onSubscriptionMessage(subA, (m) => receivedA.push(m));
    relay.onSubscriptionMessage(subB, (m) => receivedB.push(m));
    relay.onSubscriptionMessage(subC, (m) => receivedC.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", subB.id, sampleWireEvent]) });
    listeners.message[0]?.({ data: JSON.stringify(["EOSE", subC.id]) });

    expect(receivedA).toEqual([]);
    expect(receivedB).toEqual([{ kind: "event", subscriptionId: subB.id, event: sampleWireEvent }]);
    expect(receivedC).toEqual([{ kind: "eose", subscriptionId: subC.id }]);
  });

  it("16. Disconnect: closes the held socket exactly once and reports isConnected() false", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await relay.disconnect();
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(relay.isConnected()).toBe(false);
  });

  it("17. Reconnect: a full connect -> subscribe -> disconnect -> connect -> subscribe cycle succeeds, requesting a SECOND fresh socket", async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    const factory = vi.fn().mockResolvedValueOnce(first.socket).mockResolvedValueOnce(second.socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);

    await relay.connect();
    await relay.subscribe([]);
    await relay.disconnect();
    expect(relay.isConnected()).toBe(false);

    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await relay.subscribe([]);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(first.socket.send).toHaveBeenCalledTimes(1);
    expect(second.socket.send).toHaveBeenCalledTimes(1);
  });

  it("18. No delivery through stale socket callbacks after reconnect", async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    const factory = vi.fn().mockResolvedValueOnce(first.socket).mockResolvedValueOnce(second.socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);

    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    await relay.disconnect();
    await relay.connect();

    // The FIRST socket's own captured "message" listener is now stale --
    // firing it must not deliver anything, even though the subscription
    // id happens to still be registered internally.
    expect(first.listeners.message.length).toBe(1);
    first.listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });

    expect(received).toEqual([]);

    // The SECOND (current) socket's own listener still works normally.
    expect(second.listeners.message.length).toBe(1);
    second.listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });
    expect(received).toEqual([{ kind: "event", subscriptionId: sub.id, event: sampleWireEvent }]);
  });

  // ---------------------------------------------------------------------
  // Listener-exception isolation, explicitly tested
  // ---------------------------------------------------------------------

  it("19. A throwing subscription listener does not disconnect the relay, does not prevent later messages, and does not escape the socket callback", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    let callCount = 0;
    relay.onSubscriptionMessage(sub, () => {
      callCount += 1;
      throw new Error("listener boom");
    });

    expect(() =>
      listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) }),
    ).not.toThrow();
    expect(relay.isConnected()).toBe(true);

    // A second, later message still reaches the (still-throwing) listener --
    // proving the first exception did not corrupt subscription state.
    expect(() => listeners.message[0]?.({ data: JSON.stringify(["EOSE", sub.id]) })).not.toThrow();
    expect(callCount).toBe(2);

    // The relay is still fully usable afterward.
    await expect(relay.unsubscribe(sub)).resolves.toBeUndefined();
  });

  it("20. A throwing relay-level listener does not disconnect the relay and does not prevent later messages", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    let callCount = 0;
    relay.onRelayMessage(() => {
      callCount += 1;
      throw new Error("relay listener boom");
    });
    await relay.connect();

    expect(() => listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "first"]) })).not.toThrow();
    expect(() => listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "second"]) })).not.toThrow();

    expect(callCount).toBe(2);
    expect(relay.isConnected()).toBe(true);
  });

  it("21. cross-implementation parity: NullRelay's own connect/subscribe/unsubscribe/disconnect/reconnect cycle succeeds identically", async () => {
    const { NullRelay } = await import("../src/os/messenger/desktop/null_relay.js");
    const relay = new NullRelay("wss://relay.example.test");

    await relay.connect();
    const sub = await relay.subscribe([]);
    relay.onSubscriptionMessage(sub, () => {
      throw new Error("never called");
    });
    await relay.unsubscribe(sub);
    await relay.disconnect();
    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
  });
});

import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/os/messenger/desktop/websocket_relay.js";
import type { FedosRelaySocket, FedosRelaySocketEvent } from "../src/os/messenger/desktop/websocket_relay.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_236_subscription_event_delivery.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import listenersSource from "../src/os/messenger/desktop/fedos_relay_listeners.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";

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
  tags: [],
  content: "hello",
  sig: "d".repeat(128),
};

/**
 * Secure Runtime Alpha 236 -- "Subscription Event Delivery": Stage 6
 * of the Nostr Relay Message Reception Arc. Adds
 * onSubscriptionMessage() to FedosRelay/NullRelay/WebSocketRelay --
 * EVENT/EOSE routed only to the matching subscription id, unknown ids
 * ignored, unsubscribe() removes delivery eligibility, duplicate
 * registration overwrites.
 */
describe("Secure Runtime Alpha 236 -- Subscription Event Delivery", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
  });

  it("3. structural: FedosSubscriptionListener is exported, receiving only EVENT/EOSE messages", () => {
    expect(listenersSource).toMatch(
      /export type FedosSubscriptionListener = \(\s*\n\s*message: FedosRelayEventMessage \| FedosRelayEoseMessage,\s*\n\) => void;/,
    );
  });

  it("4. structural: FedosRelay declares onSubscriptionMessage() returning void", () => {
    expect(relaySource).toMatch(
      /onSubscriptionMessage\(subscription: FedosSubscription, listener: FedosSubscriptionListener\): void;/,
    );
  });

  it("5. structural: subscribe()'s own signature is byte-for-byte unchanged from Alpha 226", () => {
    expect(relaySource).toMatch(
      /subscribe\(filters: readonly FedosSubscriptionFilter\[\]\): Promise<FedosSubscription>;/,
    );
  });

  it("6. structural: NullRelay never invokes a registered subscription listener anywhere in its own code", () => {
    const classBody = (nullRelaySource.match(/export class NullRelay implements FedosRelay \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/listener\(/);
  });

  it("7. the design doc cross-references Alpha 235, Alpha 238, and Alpha 226", () => {
    for (const ref of [
      "secure_runtime_alpha_235_websocket_inbound_wiring",
      "secure_runtime_alpha_238_ok_notice_handling",
      "secure_runtime_alpha_226_subscription_lifecycle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: WebSocketRelay
  // ---------------------------------------------------------------------

  it("8. behavioral: EVENT is routed only to the matching subscription's own listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const subA = await relay.subscribe([]);
    const subB = await relay.subscribe([]);
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    relay.onSubscriptionMessage(subA, (m) => receivedA.push(m));
    relay.onSubscriptionMessage(subB, (m) => receivedB.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", subA.id, sampleWireEvent]) });

    expect(receivedA).toEqual([{ kind: "event", subscriptionId: subA.id, event: sampleWireEvent }]);
    expect(receivedB).toEqual([]);
  });

  it("9. behavioral: EVENT for an unknown/unregistered subscription id is silently ignored", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    expect(() =>
      listeners.message[0]?.({ data: JSON.stringify(["EVENT", "never-registered", sampleWireEvent]) }),
    ).not.toThrow();
    expect(received).toEqual([]);
  });

  it("10. behavioral: unsubscribe() removes delivery eligibility -- a later EVENT for that id is dropped", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });
    await relay.unsubscribe(sub);
    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });

    expect(received.length).toBe(1);
  });

  it("11. behavioral: registering onSubscriptionMessage() twice for the same id overwrites the previous listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const firstReceived: unknown[] = [];
    const secondReceived: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => firstReceived.push(m));
    relay.onSubscriptionMessage(sub, (m) => secondReceived.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });

    expect(firstReceived).toEqual([]);
    expect(secondReceived.length).toBe(1);
  });

  // ---------------------------------------------------------------------
  // Behavioral: NullRelay (bookkeeping only)
  // ---------------------------------------------------------------------

  it("12. behavioral: NullRelay.onSubscriptionMessage() never throws and never invokes the listener", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const sub = await relay.subscribe([]);
    const listener = vi.fn();
    expect(() => relay.onSubscriptionMessage(sub, listener)).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });
});

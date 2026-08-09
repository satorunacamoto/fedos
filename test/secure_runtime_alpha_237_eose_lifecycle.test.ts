import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket, FedosRelaySocketEvent } from "../src/desktop/websocket_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_237_eose_lifecycle.md?raw";
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
  tags: [],
  content: "hello",
  sig: "d".repeat(128),
};

/**
 * Secure Runtime Alpha 237 -- "EOSE Lifecycle": Stage 7 of the Nostr
 * Relay Message Reception Arc. Review only -- confirms, by real
 * execution, that EOSE does not unsubscribe, does not disconnect, and
 * that later EVENT messages still deliver to the same listener.
 */
describe("Secure Runtime Alpha 237 -- EOSE Lifecycle", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO further code change/);
  });

  it("3. structural: the EOSE dispatch branch never calls unsubscribe or sends CLOSE", () => {
    const dispatchBody = (websocketRelaySource.match(/#handleSocketMessage\(event: FedosRelaySocketEvent \| undefined\): void \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(dispatchBody.length).toBeGreaterThan(0);
    expect(dispatchBody).not.toMatch(/unsubscribe|buildCloseMessage/);
  });

  it("4. the design doc's own section 2 confirms all five required EOSE semantics", () => {
    expect(designDocSource).toMatch(/does NOT automatically close the subscription/);
    expect(designDocSource).toMatch(/does NOT call `unsubscribe\(\)`/);
    expect(designDocSource).toMatch(/Later live EVENT messages may still arrive/);
    expect(designDocSource).toMatch(/does NOT imply Relay disconnection/);
  });

  it("5. the design doc confirms no second Observation Framework is introduced", () => {
    expect(designDocSource).toMatch(/"Do not introduce a\s*\nsecond Observation Framework\."/);
  });

  it("6. the design doc cross-references Alpha 236, Alpha 235, and Alpha 239", () => {
    for (const ref of [
      "secure_runtime_alpha_236_subscription_event_delivery",
      "secure_runtime_alpha_235_websocket_inbound_wiring",
      "secure_runtime_alpha_239_inbound_lifecycle_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution
  // ---------------------------------------------------------------------

  it("7. behavioral: EOSE is delivered to the subscription's own listener, discriminated by kind", async () => {
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

  it("8. behavioral: EOSE does not disconnect the relay and does not remove the subscription's own listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => received.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EOSE", sub.id]) });

    expect(relay.isConnected()).toBe(true);
    expect(socket.close).not.toHaveBeenCalled();

    // A later live EVENT for the same subscription still delivers.
    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, sampleWireEvent]) });
    expect(received).toEqual([
      { kind: "eose", subscriptionId: sub.id },
      { kind: "event", subscriptionId: sub.id, event: sampleWireEvent },
    ]);
  });
});

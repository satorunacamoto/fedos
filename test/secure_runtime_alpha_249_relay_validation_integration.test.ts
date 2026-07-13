import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket, FedosRelaySocketEvent } from "../src/desktop/websocket_relay.js";
import { createValidatedEventListener } from "../src/desktop/validated_subscription_adapter.js";
import * as combinedValidator from "../src/desktop/combined_inbound_event_validator.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_249_relay_validation_integration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRelaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterSource from "../src/desktop/validated_subscription_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import combinedValidatorSource from "../src/desktop/combined_inbound_event_validator.ts?raw";

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

const VALID_EVENT = {
  id: "9e4ed05065d5c5135e3843706956fe07b81c635ea3bd9eeddb9e207e82fd0f1d",
  pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
  created_at: 1700000300,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content:
    'quote:" backslash:\\ newline:\n cr:\r tab:\t backspace:\b formfeed:\f nonascii: héllo 世界 🎉',
  sig: "cf26861991315ab023a2742f11994f2f87cffb587c5add230401e835fbed1798ce7901487a51bde1bd5ab37f4a3fa75ada90bff02ec0c6bbbc1bc327763ba514",
};

/**
 * Secure Runtime Alpha 249 -- "Relay Integration Verification": Stage
 * 9 of the Nostr Inbound Event Validation Arc. Test coverage only --
 * no production code change. Exercises the FULL wired-together path: a
 * real `WebSocketRelay`, an injected fake socket, and
 * `createValidatedEventListener` (Alpha 246) registered via the
 * existing `onSubscriptionMessage()`.
 */
describe("Secure Runtime Alpha 249 -- Relay Integration Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage only", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it adds test coverage only/);
  });

  it("3. the design doc cross-references Alpha 248, Alpha 246, Alpha 239, and Alpha 227", () => {
    for (const ref of [
      "secure_runtime_alpha_248_known_answer_tamper_verification",
      "secure_runtime_alpha_246_validated_subscription_delivery",
      "secure_runtime_alpha_239_inbound_lifecycle_verification",
      "secure_runtime_alpha_227_subscription_foundation_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("4. Regression: websocket_relay.ts, fedos_relay.ts, null_relay.ts, the adapter, and the combined validator carry no reference to this Stage's own doc", () => {
    for (const source of [websocketRelaySource, fedosRelaySource, nullRelaySource, adapterSource, combinedValidatorSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_249/);
    }
  });

  // ---------------------------------------------------------------------
  // Full wired-together path, real execution against a fake socket
  // ---------------------------------------------------------------------

  it("5. Valid EVENT reaches the validated listener exactly once", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([{ kinds: [1] }]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(VALID_EVENT);
  });

  it("6. Invalid-id EVENT does not reach the validated listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, { ...VALID_EVENT, id: "00".repeat(32) }]) });

    expect(received).toEqual([]);
  });

  it("7. Invalid-signature EVENT does not reach the validated listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    const sig = VALID_EVENT.sig.slice(0, -1) + (VALID_EVENT.sig.endsWith("9") ? "8" : "9");
    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, { ...VALID_EVENT, sig }]) });

    expect(received).toEqual([]);
  });

  it("8. Malformed EVENT is rejected before validation -- validateInboundNostrEvent is never invoked", async () => {
    const spy = vi.spyOn(combinedValidator, "validateInboundNostrEvent");
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    // A structurally invalid EVENT payload (wrong item count) never
    // survives parseRelayInboundMessage in the first place.
    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, { ...VALID_EVENT, id: "not-hex" }]) });

    expect(received).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("9. Unknown subscription is ignored -- no validated call", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", "totally-unknown-sub", VALID_EVENT]) });

    expect(received).toEqual([]);
  });

  it("10. EVENT after unsubscribe is ignored", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));
    await relay.unsubscribe(sub);

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) });

    expect(received).toEqual([]);
  });

  it("11. EOSE still delivers through its existing raw path, unaffected by validation", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const rawReceived: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => rawReceived.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["EOSE", sub.id]) });

    expect(rawReceived).toEqual([{ kind: "eose", subscriptionId: sub.id }]);
  });

  it("12. OK and NOTICE remain unchanged, entirely independent of the validated layer", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const relayReceived: unknown[] = [];
    relay.onRelayMessage((m) => relayReceived.push(m));
    await relay.connect();

    const eventId = "e".repeat(64);
    listeners.message[0]?.({ data: JSON.stringify(["OK", eventId, true, "stored"]) });
    listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "restart imminent"]) });

    expect(relayReceived).toEqual([
      { kind: "ok", eventId, accepted: true, message: "stored" },
      { kind: "notice", message: "restart imminent" },
    ]);
  });

  it("13. A throwing validated listener does not break later delivery", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    let calls = 0;
    relay.onSubscriptionMessage(
      sub,
      createValidatedEventListener(() => {
        calls += 1;
        if (calls === 1) throw new Error("boom");
      }),
    );

    expect(() => listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) })).not.toThrow();
    expect(() => listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) })).not.toThrow();

    expect(calls).toBe(2);
    expect(relay.isConnected()).toBe(true);
  });

  it("14. An invalid event does not disconnect the Relay", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    relay.onSubscriptionMessage(sub, createValidatedEventListener(() => {}));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, { ...VALID_EVENT, id: "00".repeat(32) }]) });

    expect(relay.isConnected()).toBe(true);
  });

  it("15. A valid event after an invalid event still delivers", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, { ...VALID_EVENT, id: "00".repeat(32) }]) });
    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(VALID_EVENT);
  });

  it("16. Stale socket callback cannot deliver validated events after reconnect", async () => {
    const first = fakeSocket();
    const second = fakeSocket();
    const factory = vi.fn().mockResolvedValueOnce(first.socket).mockResolvedValueOnce(second.socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);

    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    await relay.disconnect();
    await relay.connect();

    first.listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) });
    expect(received).toEqual([]);

    second.listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) });
    expect(received).toHaveLength(1);
  });

  it("17. Multiple subscriptions do not cross-deliver validated events", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const subA = await relay.subscribe([{ kinds: [1] }]);
    const subB = await relay.subscribe([{ kinds: [2] }]);
    const receivedA: FedosValidatedNostrEvent[] = [];
    const receivedB: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(subA, createValidatedEventListener((e) => receivedA.push(e)));
    relay.onSubscriptionMessage(subB, createValidatedEventListener((e) => receivedB.push(e)));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", subB.id, VALID_EVENT]) });

    expect(receivedA).toEqual([]);
    expect(receivedB).toHaveLength(1);
  });

  it("18. Validation runs exactly once per candidate EVENT -- confirmed via a call-counting spy", async () => {
    const spy = vi.spyOn(combinedValidator, "validateInboundNostrEvent");
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const received: FedosValidatedNostrEvent[] = [];
    relay.onSubscriptionMessage(sub, createValidatedEventListener((e) => received.push(e)));

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, VALID_EVENT]) });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(received).toHaveLength(1);

    listeners.message[0]?.({ data: JSON.stringify(["EVENT", sub.id, { ...VALID_EVENT, id: "00".repeat(32) }]) });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(received).toHaveLength(1);

    spy.mockRestore();
  });
});

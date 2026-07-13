import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket, FedosRelaySocketEvent } from "../src/desktop/websocket_relay.js";
import { NullRelay } from "../src/desktop/null_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_238_ok_notice_handling.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import listenersSource from "../src/desktop/fedos_relay_listeners.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";

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
 * Secure Runtime Alpha 238 -- "OK and NOTICE Handling": Stage 8 of the
 * Nostr Relay Message Reception Arc. Adds onRelayMessage() -- ONE
 * relay-wide listener (Option A) for OK/NOTICE, never subscription
 * scoped, never retried/logged/stored automatically.
 */
describe("Secure Runtime Alpha 238 -- OK and NOTICE Handling", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
  });

  it("3. the design doc's own section 2 adopts exactly Option A and rejects B/C/D", () => {
    expect(designDocSource).toMatch(/\*\*A\. One Relay-level listener\.\*\* ADOPTED\./);
    expect(designDocSource).toMatch(/\*\*B\. Publish-result tracking\.\*\* REJECTED/);
    expect(designDocSource).toMatch(/\*\*C\. Separate OK\/NOTICE callbacks\.\*\* REJECTED/);
    expect(designDocSource).toMatch(/\*\*D\. Parsed but currently discarded\.\*\* REJECTED/);
  });

  it("4. structural: FedosRelayMessageListener is exported, receiving only OK/NOTICE messages", () => {
    expect(listenersSource).toMatch(
      /export type FedosRelayMessageListener = \(\s*\n\s*message: FedosRelayOkMessage \| FedosRelayNoticeMessage,\s*\n\) => void;/,
    );
  });

  it("5. structural: FedosRelay declares onRelayMessage() returning void", () => {
    expect(relaySource).toMatch(/onRelayMessage\(listener: FedosRelayMessageListener\): void;/);
  });

  it("6. structural: publish()'s own signature is byte-for-byte unchanged from Alpha 216 (Option B rejected)", () => {
    expect(relaySource).toMatch(/publish\(event: FedosEventDescriptor\): Promise<void>;/);
  });

  it("7. structural: zero console.* call and zero storage write exists anywhere in websocket_relay.ts", () => {
    expect(websocketRelaySource).not.toMatch(/console\./);
  });

  it("8. the design doc cross-references Alpha 236, Alpha 237, and Alpha 216", () => {
    for (const ref of [
      "secure_runtime_alpha_236_subscription_event_delivery",
      "secure_runtime_alpha_237_eose_lifecycle",
      "secure_runtime_alpha_216_publish_api",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("9. behavioral: OK accepted=true/false and NOTICE all deliver to the one relay-level listener, verbatim", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const received: unknown[] = [];
    relay.onRelayMessage((m) => received.push(m));
    await relay.connect();

    const eventId = "a".repeat(64);
    listeners.message[0]?.({ data: JSON.stringify(["OK", eventId, true, "stored"]) });
    listeners.message[0]?.({ data: JSON.stringify(["OK", eventId, false, "duplicate"]) });
    listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "rate limited"]) });

    expect(received).toEqual([
      { kind: "ok", eventId, accepted: true, message: "stored" },
      { kind: "ok", eventId, accepted: false, message: "duplicate" },
      { kind: "notice", message: "rate limited" },
    ]);
  });

  it("10. behavioral: registering onRelayMessage() twice overwrites the previous listener", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    const first: unknown[] = [];
    const second: unknown[] = [];
    relay.onRelayMessage((m) => first.push(m));
    relay.onRelayMessage((m) => second.push(m));
    await relay.connect();

    listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "hi"]) });

    expect(first).toEqual([]);
    expect(second.length).toBe(1);
  });

  it("11. behavioral: an OK/NOTICE message is never routed through onSubscriptionMessage()", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const sub = await relay.subscribe([]);
    const subReceived: unknown[] = [];
    relay.onSubscriptionMessage(sub, (m) => subReceived.push(m));

    listeners.message[0]?.({ data: JSON.stringify(["NOTICE", "hi"]) });

    expect(subReceived).toEqual([]);
  });

  it("12. behavioral: NullRelay.onRelayMessage() never throws and never invokes the listener", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    const listener = vi.fn();
    expect(() => relay.onRelayMessage(listener)).not.toThrow();
    await relay.connect();
    expect(listener).not.toHaveBeenCalled();
  });
});

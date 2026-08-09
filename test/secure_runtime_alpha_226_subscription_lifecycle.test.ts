import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket } from "../src/desktop/websocket_relay.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_226_subscription_lifecycle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/os/messenger/adapters/nostr/protocol/ws_relay.ts?raw";

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

const sampleFilters: FedosSubscriptionFilter[] = [{ kinds: [1], limit: 20 }];

/**
 * Secure Runtime Alpha 226 -- "Subscription Lifecycle": Stage 6 of the
 * Nostr Subscription Foundation Arc, and its closing implementation
 * Stage. Adds subscribe()/unsubscribe() to FedosRelay/NullRelay/
 * WebSocketRelay -- transport only, no event processing. This is the
 * FINAL shape of all three files for this Arc; later Stages (227-230)
 * are review/verification only.
 */
describe("Secure Runtime Alpha 226 -- Subscription Lifecycle", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage editing three existing files, no new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(/adding no new file/);
  });

  // ---------------------------------------------------------------------
  // Structural: the FINAL, complete shape of all three files
  // ---------------------------------------------------------------------

  it("3. structural: FedosRelay's shape AS OF this Arc's closing state contains url, connect, disconnect, isConnected, publish, subscribe, unsubscribe, in that order (Alpha 236/238, a later Arc, additively appends onSubscriptionMessage/onRelayMessage)", () => {
    expect(relaySource).toMatch(
      /export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*connect\(\): Promise<void>;\s*\n\s*disconnect\(\): Promise<void>;\s*\n\s*isConnected\(\): boolean;\s*\n\s*publish\(event: FedosEventDescriptor\): Promise<void>;\s*\n\s*subscribe\(filters: readonly FedosSubscriptionFilter\[\]\): Promise<FedosSubscription>;\s*\n\s*unsubscribe\(subscription: FedosSubscription\): Promise<void>;/,
    );
  });

  it("4. structural: FedosRelay imports FedosSubscription/FedosSubscriptionFilter as type-only imports", () => {
    expect(relaySource).toMatch(/import type \{ FedosSubscription \} from "\.\/fedos_subscription\.js";/);
    expect(relaySource).toMatch(
      /import type \{ FedosSubscriptionFilter \} from "\.\/fedos_subscription_filter\.js";/,
    );
  });

  it("5. structural: NullRelay's public method/getter set AS OF this Arc contains connect/disconnect/isConnected/published/publish/subscriptions/subscribe/unsubscribe (Alpha 236/238, a later Arc, additively appends onSubscriptionMessage/onRelayMessage)", () => {
    const classBody = (nullRelaySource.match(/export class NullRelay implements FedosRelay \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const methodNames = [...codeOnly.matchAll(/^\s{2}(?:async\s+)?(?:get\s+)?(\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    for (const expected of ["constructor", "connect", "disconnect", "isConnected", "published", "publish", "subscriptions", "subscribe", "unsubscribe"]) {
      expect(methodNames).toContain(expected);
    }
    expect(nullRelaySource).toMatch(/get subscriptions\(\): readonly FedosSubscription\[\] \{/);
  });

  it("6. structural: WebSocketRelay's public method set AS OF this Arc contains connect/disconnect/isConnected/publish/subscribe/unsubscribe (Alpha 236/238, a later Arc, additively appends onSubscriptionMessage/onRelayMessage)", () => {
    const classBody = (websocketRelaySource.match(/export class WebSocketRelay implements FedosRelay \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const methodNames = [...codeOnly.matchAll(/^\s{2}(?:async\s+)?(\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    for (const expected of ["constructor", "connect", "disconnect", "isConnected", "publish", "subscribe", "unsubscribe"]) {
      expect(methodNames).toContain(expected);
    }
  });

  it("7. structural: WebSocketRelay.subscribe()/unsubscribe() each call socket.send exactly once, and their OWN method bodies register no 'message' listener (Alpha 235, a later Arc, additively registers ONE 'message' listener inside connect() for inbound reception)", () => {
    expect(websocketRelaySource).toMatch(/this\.#socket\.send\(buildReqMessage\(subscription\.id, filters\)\);/);
    expect(websocketRelaySource).toMatch(/this\.#socket\.send\(buildCloseMessage\(subscription\.id\)\);/);
    const subscribeBody = (websocketRelaySource.match(/async subscribe\(filters: readonly FedosSubscriptionFilter\[\]\): Promise<FedosSubscription> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    const unsubscribeBody = (websocketRelaySource.match(/async unsubscribe\(subscription: FedosSubscription\): Promise<void> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(subscribeBody.length).toBeGreaterThan(0);
    expect(unsubscribeBody.length).toBeGreaterThan(0);
    expect(subscribeBody).not.toMatch(/"message"/);
    expect(unsubscribeBody).not.toMatch(/"message"/);
  });

  it("8. structural: no ACK/result-object vocabulary and no EVENT/EOSE/NOTICE parsing exists IN CODE across all three files", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/PublishResult|accepted|parseOkMessage|EOSE|NOTICE|isEventMessage/);
    }
  });

  it("9. the design doc cross-references Alpha 225, Alpha 224, Alpha 223, Alpha 222, and Alpha 216", () => {
    for (const ref of [
      "secure_runtime_alpha_225_close_generation",
      "secure_runtime_alpha_224_req_generation",
      "secure_runtime_alpha_223_filter_representation",
      "secure_runtime_alpha_222_subscription_interface",
      "secure_runtime_alpha_216_publish_api",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("10. Regression: src/nostr/ws_relay.ts carries no reference to this Arc's own symbols", () => {
    expect(wsRelaySource).not.toMatch(/FedosRelay|WebSocketRelay\b|NullRelay|FedosSubscription/);
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("11. behavioral: WebSocketRelay.subscribe() rejects when not connected, and calls no send", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await expect(relay.subscribe(sampleFilters)).rejects.toThrow(/not connected/);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("12. behavioral: WebSocketRelay.subscribe() sends exactly one ['REQ', id, ...filters] wire message once connected", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const subscription = await relay.subscribe(sampleFilters);
    expect(socket.send).toHaveBeenCalledTimes(1);
    const sentRaw = (socket.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(sentRaw);
    expect(parsed[0]).toBe("REQ");
    expect(parsed[1]).toBe(subscription.id);
    expect(parsed[2]).toEqual(sampleFilters[0]);
  });

  it("13. behavioral: WebSocketRelay.unsubscribe() rejects when not connected, and calls no send", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await expect(relay.unsubscribe({ id: "fedos-sub-1" })).rejects.toThrow(/not connected/);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("14. behavioral: WebSocketRelay.unsubscribe() sends exactly one ['CLOSE', id] wire message once connected", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const subscription = await relay.subscribe(sampleFilters);
    (socket.send as ReturnType<typeof vi.fn>).mockClear();
    await relay.unsubscribe(subscription);
    expect(socket.send).toHaveBeenCalledTimes(1);
    const sentRaw = (socket.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(JSON.parse(sentRaw)).toEqual(["CLOSE", subscription.id]);
  });

  it("15. behavioral: WebSocketRelay.subscribe() resolves without waiting for any relay response", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await expect(relay.subscribe(sampleFilters)).resolves.toEqual({ id: expect.any(String) });
  });

  it("16. behavioral: WebSocketRelay generates a fresh, distinct subscription id on each subscribe() call", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    const first = await relay.subscribe(sampleFilters);
    const second = await relay.subscribe(sampleFilters);
    expect(first.id).not.toBe(second.id);
  });

  it("17. behavioral: NullRelay.subscribe()/unsubscribe() reject when not connected", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await expect(relay.subscribe(sampleFilters)).rejects.toThrow(/not connected/);
    await expect(relay.unsubscribe({ id: "fedos-sub-1" })).rejects.toThrow(/not connected/);
    expect(relay.subscriptions).toEqual([]);
  });

  it("18. behavioral: NullRelay.subscribe() records the subscription once connected, with zero real networking", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const subscription = await relay.subscribe(sampleFilters);
    expect(relay.subscriptions).toEqual([subscription]);
  });

  it("19. behavioral: NullRelay.unsubscribe() removes only the matching subscription, leaving others untouched", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const first = await relay.subscribe(sampleFilters);
    const second = await relay.subscribe(sampleFilters);
    await relay.unsubscribe(first);
    expect(relay.subscriptions).toEqual([second]);
  });

  it("20. behavioral: NullRelay.unsubscribe() on an unknown subscription id is a silent no-op, never a throw", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const subscription = await relay.subscribe(sampleFilters);
    await expect(relay.unsubscribe({ id: "not-a-real-id" })).resolves.toBeUndefined();
    expect(relay.subscriptions).toEqual([subscription]);
  });
});

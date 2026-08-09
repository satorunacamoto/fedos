import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket } from "../src/desktop/websocket_relay.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_216_publish_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/os/messenger/adapters/nostr/protocol/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publishSource from "../src/os/messenger/adapters/nostr/protocol/publish.ts?raw";

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
  tags: [["e", "c".repeat(64)]],
  content: "hello relay",
  signature: "d".repeat(128),
};

/**
 * Secure Runtime Alpha 216 -- "Publish API": Stage 6 of the Nostr
 * Relay Foundation Arc, and its closing implementation Stage. Adds
 * publish(event: FedosEventDescriptor) to FedosRelay/NullRelay/
 * WebSocketRelay -- transport only, no ACK handling. This is the
 * FINAL shape of all three files for this Arc; later Stages
 * (217-220) are review/verification only.
 */
describe("Secure Runtime Alpha 216 -- Publish API", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage editing three existing files, no new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(/No new file is added/);
  });

  // ---------------------------------------------------------------------
  // Structural: the FINAL, complete shape of all three files
  // ---------------------------------------------------------------------

  it("3. structural: FedosRelay's shape AS OF this Arc contains url, connect, disconnect, isConnected, publish, in that order (Alpha 226, a later Arc, additively appends subscribe/unsubscribe after publish -- see secure_runtime_alpha_226_subscription_lifecycle.test.ts for that Arc's own closing shape)", () => {
    expect(relaySource).toMatch(
      /export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*connect\(\): Promise<void>;\s*\n\s*disconnect\(\): Promise<void>;\s*\n\s*isConnected\(\): boolean;\s*\n\s*publish\(event: FedosEventDescriptor\): Promise<void>;/,
    );
  });

  it("4. structural: FedosRelay imports FedosEventDescriptor as a type-only import", () => {
    expect(relaySource).toMatch(
      /import type \{ FedosEventDescriptor \} from "\.\/fedos_event_descriptor\.js";/,
    );
  });

  it("5. structural: NullRelay's public method set AS OF this Arc contains connect/disconnect/isConnected/publish, plus a published getter (Alpha 226, a later Arc, additively appends subscriptions/subscribe/unsubscribe)", () => {
    const classBody = (nullRelaySource.match(/export class NullRelay implements FedosRelay \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const methodNames = [...codeOnly.matchAll(/^\s{2}(?:async\s+)?(?:get\s+)?(\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    for (const expected of ["constructor", "connect", "disconnect", "isConnected", "published", "publish"]) {
      expect(methodNames).toContain(expected);
    }
    expect(nullRelaySource).toMatch(/get published\(\): readonly FedosEventDescriptor\[\] \{/);
  });

  it("6. structural: WebSocketRelay's public method set AS OF this Arc contains connect/disconnect/isConnected/publish (Alpha 226, a later Arc, additively appends subscribe/unsubscribe)", () => {
    const classBody = (websocketRelaySource.match(/export class WebSocketRelay implements FedosRelay \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const methodNames = [...codeOnly.matchAll(/^\s{2}(?:async\s+)?(\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    for (const expected of ["constructor", "connect", "disconnect", "isConnected", "publish"]) {
      expect(methodNames).toContain(expected);
    }
  });

  it("7. structural: WebSocketRelay.publish() calls socket.send exactly once and its OWN method body registers no 'message' listener (Alpha 235, a later Arc, additively registers ONE 'message' listener inside connect() for inbound reception -- publish() itself remains untouched)", () => {
    expect(websocketRelaySource).toMatch(/this\.#socket\.send\(JSON\.stringify\(\["EVENT", wireEvent\]\)\);/);
    const publishBody = (websocketRelaySource.match(/async publish\(event: FedosEventDescriptor\): Promise<void> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(publishBody.length).toBeGreaterThan(0);
    expect(publishBody).not.toMatch(/"message"/);
  });

  it("8. structural: the wire mapping renames author/createdAt/signature to pubkey/created_at/sig, and drops provider", () => {
    const body = (websocketRelaySource.match(/const wireEvent = \{([\s\S]*?)\};/) ?? [])[1] ?? "";
    expect(body).toMatch(/pubkey: event\.author,/);
    expect(body).toMatch(/created_at: event\.createdAt,/);
    expect(body).toMatch(/sig: event\.signature,/);
    expect(body).not.toMatch(/provider/);
  });

  it("9. structural: no ACK/result-object vocabulary (PublishResult, accepted, OK message) exists IN CODE across all three files", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/PublishResult|accepted|parseOkMessage/);
    }
  });

  it("10. the design doc cross-references Alpha 215, Alpha 214, Alpha 202, and Alpha 103", () => {
    for (const ref of [
      "secure_runtime_alpha_215_connection_lifecycle",
      "secure_runtime_alpha_214_websocket_relay_connection_only",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_103_source_injection",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("11. Regression: src/nostr/ws_relay.ts and publish.ts carry no reference to this Arc's own symbols", () => {
    for (const source of [wsRelaySource, publishSource]) {
      expect(source).not.toMatch(/FedosRelay|WebSocketRelay\b|NullRelay/);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("12. behavioral: WebSocketRelay.publish() rejects when not connected, and calls no send", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await expect(relay.publish(sampleEvent)).rejects.toThrow(/not connected/);
    expect(socket.send).not.toHaveBeenCalled();
  });

  it("13. behavioral: WebSocketRelay.publish() sends exactly one ['EVENT', ...] wire message once connected", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await relay.publish(sampleEvent);
    expect(socket.send).toHaveBeenCalledTimes(1);
    const sentRaw = (socket.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(sentRaw);
    expect(parsed[0]).toBe("EVENT");
    expect(parsed[1]).toEqual({
      id: sampleEvent.id,
      pubkey: sampleEvent.author,
      created_at: sampleEvent.createdAt,
      kind: sampleEvent.kind,
      tags: sampleEvent.tags,
      content: sampleEvent.content,
      sig: sampleEvent.signature,
    });
  });

  it("14. behavioral: WebSocketRelay.publish() resolves without waiting for any relay response", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await expect(relay.publish(sampleEvent)).resolves.toBeUndefined();
  });

  it("15. behavioral: NullRelay.publish() rejects when not connected", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await expect(relay.publish(sampleEvent)).rejects.toThrow(/not connected/);
    expect(relay.published).toEqual([]);
  });

  it("16. behavioral: NullRelay.publish() records the event once connected, with zero real networking", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    await relay.publish(sampleEvent);
    expect(relay.published).toEqual([sampleEvent]);
  });
});

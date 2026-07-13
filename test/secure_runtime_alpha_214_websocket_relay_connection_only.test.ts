import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket } from "../src/desktop/websocket_relay.js";
import { NullRelay } from "../src/desktop/null_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_214_websocket_relay_connection_only.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/nostr/ws_relay.ts?raw";

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

/**
 * Secure Runtime Alpha 214 -- "WebSocket Relay: Connection Only":
 * Stage 4 of the Nostr Relay Foundation Arc. Adds
 * src/desktop/websocket_relay.ts (WebSocketRelay), and extends
 * FedosRelay/NullRelay with connect(). Real, socket-injected
 * connection only -- no send, no disconnect, no isConnected yet.
 */
describe("Secure Runtime Alpha 214 -- WebSocket Relay: Connection Only", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding one new file and editing two existing ones", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/websocket_relay\.ts`, and edits exactly two existing\s*\nfiles, `src\/desktop\/fedos_relay\.ts` and `src\/desktop\/null_relay\.ts`,\s*\nto add one method, `connect\(\)`, to each\./,
    );
  });

  it("3. structural: FedosRelay carries connect(), added by this Stage and never removed", () => {
    expect(relaySource).toMatch(/connect\(\): Promise<void>;/);
  });

  it("3b. the design doc's own Alpha 214 code snippet shows FedosRelay as it stood AT THIS STAGE -- exactly url and connect(), no more (a frozen, point-in-time record; the live source grows in later Stages of this same Arc)", () => {
    const section = (designDocSource.match(/## 2\. What was implemented([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*connect\(\): Promise<void>;\s*\n\}/,
    );
  });

  it("4. structural: WebSocketRelay, FedosRelaySocket, and FedosRelaySocketFactory are exports of websocket_relay.ts AS OF this Arc (Alpha 235, a later Arc, additively appends FedosRelaySocketEventType/FedosRelaySocketEvent for inbound message wiring)", () => {
    const exportNames = [...websocketRelaySource.matchAll(/^export (?:interface|class|function|const|type) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    for (const expected of ["FedosRelaySocket", "FedosRelaySocketFactory", "WebSocketRelay"]) {
      expect(exportNames).toContain(expected);
    }
  });

  it("5. structural: no `new WebSocket(` call exists in websocket_relay.ts's own CODE (the guardrail comment legitimately names it as forbidden)", () => {
    const codeOnly = websocketRelaySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/new WebSocket\(/);
  });

  it("6. structural: no reference to src/nostr/ws_relay.ts's own RelaySocketLike/WebSocketFactory types", () => {
    expect(websocketRelaySource).not.toMatch(/from ".*nostr\/ws_relay\.js"/);
    expect(websocketRelaySource).not.toMatch(/RelaySocketLike/);
  });

  it("7. the design doc's own Alpha 214 code snippet for WebSocketRelay.connect() shows no socket.send( call -- publish() was not yet this Stage's own deliverable (a frozen, point-in-time record)", () => {
    const section = (designDocSource.match(/## 2\. What was implemented([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    const connectSnippet = (section.match(/async connect\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(connectSnippet.length).toBeGreaterThan(0);
    expect(connectSnippet).not.toMatch(/\.send\(/);
  });

  it("8. the design doc's own Alpha 214 prose confirms disconnect()/isConnected()/publish() did not exist as of this Stage (a frozen, point-in-time record; later Stages of this same Arc add all three)", () => {
    expect(designDocSource).toMatch(/`disconnect\(\)`\/`isConnected\(\)` \(Alpha 215\) and `publish\(\)`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add `disconnect\(\)` or `isConnected\(\)` to `FedosRelay`,/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add `publish\(\)` to any of the three/);
  });

  it("9. the design doc cross-references Alpha 213, Alpha 212, Alpha 211, and Alpha 103", () => {
    for (const ref of [
      "secure_runtime_alpha_213_null_relay",
      "secure_runtime_alpha_212_relay_interface",
      "secure_runtime_alpha_211_relay_code_review",
      "secure_runtime_alpha_103_source_injection",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("10. Regression: src/nostr/ws_relay.ts carries no reference to this Stage's own doc or the new symbols", () => {
    expect(wsRelaySource).not.toMatch(/secure_runtime_alpha_214/);
    expect(wsRelaySource).not.toMatch(/WebSocketRelay\b/);
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("11. behavioral: connect() requests a socket from the injected factory, never constructing one directly", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith("wss://relay.example.test");
  });

  it("12. behavioral: connect() is idempotent -- a second call while already connected requests no second socket", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await relay.connect();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("13. behavioral: connect() registers close/error listeners on the socket", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    expect(listeners.close.length).toBe(1);
    expect(listeners.error.length).toBe(1);
  });

  it("14. behavioral: NullRelay.connect() resolves without throwing and opens no real socket", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await expect(relay.connect()).resolves.toBeUndefined();
  });
});

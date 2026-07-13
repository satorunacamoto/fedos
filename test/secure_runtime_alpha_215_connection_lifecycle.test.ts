import { describe, it, expect, vi } from "vitest";
import { WebSocketRelay } from "../src/desktop/websocket_relay.js";
import type { FedosRelaySocket } from "../src/desktop/websocket_relay.js";
import { NullRelay } from "../src/desktop/null_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_215_connection_lifecycle.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";

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
 * Secure Runtime Alpha 215 -- "Connection Lifecycle": Stage 5 of the
 * Nostr Relay Foundation Arc. Edits fedos_relay.ts, null_relay.ts, and
 * websocket_relay.ts to add disconnect()/isConnected(). No new file.
 */
describe("Secure Runtime Alpha 215 -- Connection Lifecycle", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage editing three existing files, no new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(/No new file is added/);
  });

  it("3. structural: FedosRelay carries url, connect(), disconnect(), and isConnected(), added by this Stage and never removed", () => {
    expect(relaySource).toMatch(/readonly url: string;/);
    expect(relaySource).toMatch(/connect\(\): Promise<void>;/);
    expect(relaySource).toMatch(/disconnect\(\): Promise<void>;/);
    expect(relaySource).toMatch(/isConnected\(\): boolean;/);
  });

  it("3b. the design doc's own Alpha 215 code snippet shows FedosRelay as it stood AT THIS STAGE -- exactly url/connect/disconnect/isConnected, no publish yet (a frozen, point-in-time record; the live source grows further in Alpha 216 of this same Arc)", () => {
    const section = (designDocSource.match(/## 2\. What was implemented([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*connect\(\): Promise<void>;\s*\n\s*disconnect\(\): Promise<void>;\s*\n\s*isConnected\(\): boolean;\s*\n\}/,
    );
  });

  it("4. structural: isConnected() is synchronous (no async keyword) on both NullRelay and WebSocketRelay", () => {
    expect(nullRelaySource).toMatch(/\n {2}isConnected\(\): boolean \{/);
    expect(nullRelaySource).not.toMatch(/async isConnected/);
    expect(websocketRelaySource).toMatch(/\n {2}isConnected\(\): boolean \{/);
    expect(websocketRelaySource).not.toMatch(/async isConnected/);
  });

  it("5. the design doc's own Alpha 215 prose and 'does NOT do' list confirm publish() was not yet this Stage's own deliverable (a frozen, point-in-time record; Alpha 216 of this same Arc adds it)", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add `publish\(\)` to `FedosRelay`, `NullRelay`, or\s*\n\s*`WebSocketRelay` — Alpha 216's own deliverable\./,
    );
  });

  it("6. the design doc cross-references Alpha 214, Alpha 213, Alpha 212, and Alpha 117", () => {
    for (const ref of [
      "secure_runtime_alpha_214_websocket_relay_connection_only",
      "secure_runtime_alpha_213_null_relay",
      "secure_runtime_alpha_212_relay_interface",
      "secure_runtime_alpha_117_desktop_bootstrap_state",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: NullRelay
  // ---------------------------------------------------------------------

  it("7. behavioral: NullRelay.isConnected() is false before connect(), true after, false after disconnect()", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await relay.disconnect();
    expect(relay.isConnected()).toBe(false);
  });

  it("8. behavioral: NullRelay.disconnect() is safe to call when never connected", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await expect(relay.disconnect()).resolves.toBeUndefined();
    expect(relay.isConnected()).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Behavioral: WebSocketRelay
  // ---------------------------------------------------------------------

  it("9. behavioral: WebSocketRelay.isConnected() is false before connect(), true after, false after disconnect()", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    expect(relay.isConnected()).toBe(false);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    await relay.disconnect();
    expect(relay.isConnected()).toBe(false);
  });

  it("10. behavioral: WebSocketRelay.disconnect() calls socket.close() exactly once when connected", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    await relay.disconnect();
    expect(socket.close).toHaveBeenCalledTimes(1);
  });

  it("11. behavioral: WebSocketRelay.disconnect() is safe to call when never connected -- no socket.close() call", async () => {
    const { socket } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await expect(relay.disconnect()).resolves.toBeUndefined();
    expect(socket.close).not.toHaveBeenCalled();
  });

  it("12. behavioral: an unexpected socket 'close' event flips isConnected() to false", async () => {
    const { socket, listeners } = fakeSocket();
    const factory = vi.fn().mockResolvedValue(socket);
    const relay = new WebSocketRelay("wss://relay.example.test", factory);
    await relay.connect();
    expect(relay.isConnected()).toBe(true);
    for (const listener of listeners.close) listener();
    expect(relay.isConnected()).toBe(false);
  });
});

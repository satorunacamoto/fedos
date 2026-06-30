import { describe, it, expect } from "vitest";
import {
  WebSocketRelayAdapter,
  type RelaySocketEvent,
  type RelaySocketEventType,
  type RelaySocketLike,
} from "../src/nostr/ws_relay.js";
import type { NostrEvent } from "../src/nostr/types.js";

function event(idChar: string): NostrEvent {
  return {
    id: idChar.repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: `note-${idChar}`,
    sig: "b".repeat(128),
  };
}

/** A scriptable mock socket — no network. */
class MockSocket implements RelaySocketLike {
  sent: string[] = [];
  closed = false;
  #listeners: Partial<Record<RelaySocketEventType, ((ev: RelaySocketEvent) => void)[]>> = {};
  /** Called for every `send`; lets a test react to REQ/CLOSE. */
  onSend?: (data: string, socket: MockSocket) => void;

  send(data: string): void {
    this.sent.push(data);
    this.onSend?.(data, this);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.emit("close", {});
  }
  addEventListener(
    type: RelaySocketEventType,
    listener: (ev: RelaySocketEvent) => void,
  ): void {
    (this.#listeners[type] ??= []).push(listener);
  }
  emit(type: RelaySocketEventType, ev: RelaySocketEvent): void {
    for (const l of this.#listeners[type] ?? []) l(ev);
  }
  emitMessage(value: unknown): void {
    this.emit("message", { data: JSON.stringify(value) });
  }

  /** Index 1 of the last REQ this socket received, if any. */
  reqSubId(): string | undefined {
    for (const raw of this.sent) {
      const m = JSON.parse(raw);
      if (Array.isArray(m) && m[0] === "REQ") return m[1] as string;
    }
    return undefined;
  }
  sentTypes(): string[] {
    return this.sent.map((s) => JSON.parse(s)[0] as string);
  }
}

function adapterWith(mock: MockSocket, timeoutMs = 1000): WebSocketRelayAdapter {
  return new WebSocketRelayAdapter("wss://relay.test", {
    factory: () => mock,
    timeoutMs,
  });
}

describe("WebSocketRelayAdapter", () => {
  it("sends REQ with the filters, collects EVENTs, ends on EOSE", async () => {
    const mock = new MockSocket();
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "REQ") {
        const subId = m[1] as string;
        socket.emitMessage(["EVENT", subId, event("1")]);
        socket.emitMessage(["EVENT", subId, event("2")]);
        socket.emitMessage(["EOSE", subId]);
      }
    };
    const events = await adapterWith(mock).query([{ kinds: [1] }]);

    expect(events.map((e) => e.id)).toEqual(["1".repeat(64), "2".repeat(64)]);
    // REQ carried the filters.
    const req = JSON.parse(mock.sent[0]!);
    expect(req[0]).toBe("REQ");
    expect(req[2]).toEqual({ kinds: [1] });
  });

  it("sends CLOSE after finishing", async () => {
    const mock = new MockSocket();
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "REQ") socket.emitMessage(["EOSE", m[1]]);
    };
    await adapterWith(mock).query([{ kinds: [1] }]);
    expect(mock.sentTypes()).toContain("CLOSE");
    expect(mock.closed).toBe(true);
  });

  it("returns partial results on timeout when EOSE never arrives", async () => {
    const mock = new MockSocket();
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "REQ") socket.emitMessage(["EVENT", m[1], event("1")]);
      // No EOSE — force the timeout path.
    };
    const events = await adapterWith(mock, 25).query([{ kinds: [1] }]);
    expect(events.map((e) => e.id)).toEqual(["1".repeat(64)]);
    expect(mock.sentTypes()).toContain("CLOSE");
  });

  it("captures NOTICE messages", async () => {
    const notices: string[] = [];
    const mock = new MockSocket();
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "REQ") {
        socket.emitMessage(["NOTICE", "slow down"]);
        socket.emitMessage(["EOSE", m[1]]);
      }
    };
    const adapter = new WebSocketRelayAdapter("wss://relay.test", {
      factory: () => mock,
      timeoutMs: 1000,
      onNotice: (msg) => notices.push(msg),
    });
    await adapter.query([{ kinds: [1] }]);
    expect(notices).toEqual(["slow down"]);
    expect(adapter.lastNotices).toEqual(["slow down"]);
  });

  it("ignores malformed and foreign-subscription messages", async () => {
    const mock = new MockSocket();
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "REQ") {
        const subId = m[1] as string;
        socket.emit("message", { data: "not json {" }); // malformed
        socket.emitMessage(["EVENT", "other-sub", event("9")]); // wrong sub
        socket.emitMessage(["EVENT", subId, event("1")]); // good
        socket.emitMessage(["EOSE", subId]);
      }
    };
    const events = await adapterWith(mock).query([{ kinds: [1] }]);
    expect(events.map((e) => e.id)).toEqual(["1".repeat(64)]);
  });

  it("uses the injected factory (no real network)", async () => {
    let factoryCalls = 0;
    const mock = new MockSocket();
    mock.onSend = (data, socket) => {
      const m = JSON.parse(data);
      if (m[0] === "REQ") socket.emitMessage(["EOSE", m[1]]);
    };
    const adapter = new WebSocketRelayAdapter("wss://relay.test", {
      factory: () => {
        factoryCalls++;
        return mock;
      },
      timeoutMs: 1000,
    });
    await adapter.query([{ kinds: [1] }]);
    expect(factoryCalls).toBe(1);
  });
});

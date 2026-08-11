import { describe, it, expect } from "vitest";
import type {
  ConversationId,
  MessageHandler,
  MessageId,
  MessagePayload,
  MessageReadResult,
  MessagingPort,
  MessageSummary,
  SendResult,
  Unsubscribe,
} from "../src/os/core/ports/messaging_port.js";
import type {
  TransportConnectionStatus,
  TransportEndpointRef,
  TransportHandler,
  TransportPort,
  TransportSendResult,
  TransportUnsubscribe,
} from "../src/os/core/ports/transport_port.js";
import { createMessenger } from "../src/os/messenger/create_messenger.js";

/**
 * OS Capability Modularization — Factory/Port Completion pass. The WORKED
 * EXAMPLE `docs/architecture/ADDING-AN-ADAPTER.md` references: a minimal,
 * from-scratch `MessagingPort` implementation over an in-memory fake
 * transport (no relay, no socket, no real network), showing the full
 * Port implementation -> factory injection -> capability test pipeline a
 * new adapter author follows.
 *
 * This is example/test code only — `FakeTransportMessagingAdapter` is not
 * used anywhere outside this file and adds no new external dependency.
 *
 * NAMING NOTE (Compatibility Facade Reduction + Package Extraction
 * Readiness + Remaining Architecture Debt Closure arc, Agent P): despite
 * this file's name, `FakeTransportMessagingAdapter` above implements
 * `MessagingPort`, NOT the real `TransportPort`
 * (`../src/os/core/ports/transport_port.ts`) that Port name now names —
 * `TransportPort` did not exist when this file was first written (its own
 * `FakeInMemoryTransport` is just an internal implementation detail, never
 * exposed through a `TransportPort`-shaped surface). The second worked
 * example below, `FakeTransportPortAdapter`, is the one that actually
 * implements `TransportPort` and is what a reader following
 * `docs/architecture/ADDING-AN-ADAPTER.md` for a NEW transport backend
 * should model their own adapter on.
 */

/** A tiny in-memory "transport" — just a Map from conversationId to an ordered message list. Not a real transport. */
class FakeInMemoryTransport {
  readonly #messages = new Map<string, { messageId: string; text: string; replyTo: string | null; createdAtMs: number }[]>();
  #nextId = 1;

  deliver(conversationId: string, text: string, replyTo: string | null): { messageId: string } {
    const messageId = `fake-${this.#nextId++}`;
    const list = this.#messages.get(conversationId) ?? [];
    list.push({ messageId, text, replyTo, createdAtMs: Date.now() });
    this.#messages.set(conversationId, list);
    return { messageId };
  }

  history(conversationId: string) {
    return this.#messages.get(conversationId) ?? [];
  }

  find(conversationId: string, messageId: string) {
    return this.history(conversationId).find((m) => m.messageId === messageId) ?? null;
  }
}

/**
 * STEP 1: Port implementation. A real adapter for a genuinely new
 * transport would replace `FakeInMemoryTransport` with a real client
 * (a websocket, an HTTP client, a native binding, ...) — everything
 * below this line is transport-agnostic, mirroring the shape
 * `FedosMessengerMessagingPortAdapter` (`src/os/messenger/adapters/messaging_port_adapter.ts`)
 * already established for the real Nostr-backed coordinator.
 */
class FakeTransportMessagingAdapter implements MessagingPort {
  readonly #transport: FakeInMemoryTransport;
  readonly #handlers = new Set<MessageHandler>();

  constructor(transport: FakeInMemoryTransport) {
    this.#transport = transport;
  }

  async send(conversationId: ConversationId, payload: MessagePayload): Promise<SendResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { delivered: false, reason: "invalid-input" };
    }
    if (payload === null || typeof payload !== "object" || typeof payload.text !== "string") {
      return { delivered: false, reason: "invalid-input" };
    }
    const { messageId } = this.#transport.deliver(conversationId, payload.text, payload.replyToMessageId ?? null);
    // A real adapter would also notify any live subscribers here; this
    // fake stays purely pull-based, matching the real Messenger
    // adapter's own honestly-documented `onMessage` gap.
    return { delivered: true, messageId };
  }

  async read(conversationId: ConversationId, messageId: MessageId): Promise<MessageReadResult> {
    const found = this.#transport.find(conversationId, messageId);
    if (found === null) return { ok: false, reason: "not-found" };
    return { ok: true, plaintext: new TextEncoder().encode(found.text) };
  }

  async list(conversationId: ConversationId): Promise<readonly MessageSummary[]> {
    return this.#transport.history(conversationId).map((m) => ({
      conversationId,
      messageId: m.messageId,
      createdAtMs: m.createdAtMs,
      replyToMessageId: m.replyTo,
      retentionState: "active" as const,
    }));
  }

  onMessage(_handler: MessageHandler): Unsubscribe {
    this.#handlers.add(_handler);
    return () => this.#handlers.delete(_handler);
  }
}

describe("worked example: FakeTransportMessagingAdapter", () => {
  it("STEP 1 -- satisfies MessagingPort directly, without any factory involved", async () => {
    const adapter = new FakeTransportMessagingAdapter(new FakeInMemoryTransport());
    const sendResult = await adapter.send("c1", { text: "hello" });
    expect(sendResult.delivered).toBe(true);
  });

  it("STEP 2 -- factory injection: createMessenger({ messaging: adapter }) uses the real adapter, not the Noop default", async () => {
    const transport = new FakeInMemoryTransport();
    const adapter = new FakeTransportMessagingAdapter(transport);

    const messenger = createMessenger({ messaging: adapter });

    expect(messenger.messaging).toBe(adapter);
  });

  it("STEP 3 -- capability test: a full send -> list -> read round trip through the injected Messenger", async () => {
    const transport = new FakeInMemoryTransport();
    const messenger = createMessenger({ messaging: new FakeTransportMessagingAdapter(transport) });

    const sendResult = await messenger.messaging.send("c1", { text: "hello there" });
    expect(sendResult.delivered).toBe(true);
    if (!sendResult.delivered) throw new Error("unreachable");

    const listed = await messenger.messaging.list("c1");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.messageId).toBe(sendResult.messageId);

    const read = await messenger.messaging.read("c1", sendResult.messageId);
    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("unreachable");
    expect(new TextDecoder().decode(read.plaintext)).toBe("hello there");
  });

  it("STEP 3b -- a read for a message that was never sent fails closed, never throws", async () => {
    const messenger = createMessenger({ messaging: new FakeTransportMessagingAdapter(new FakeInMemoryTransport()) });
    const result = await messenger.messaging.read("c1", "nonexistent");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

/**
 * WORKED EXAMPLE #2 (Agent P, this arc): a minimal, from-scratch
 * `TransportPort` implementation over an in-memory fake — no relay, no
 * socket, no real network — following the exact same three-step pipeline
 * as the `MessagingPort` example above, but for the Port that pipeline
 * models: connect/disconnect/status, send, and a poll/push-agnostic
 * subscribe with a working cancel handle.
 */
class FakeTransportPortAdapter implements TransportPort {
  readonly #inboxes = new Map<TransportEndpointRef, Uint8Array[]>();
  readonly #handlers = new Map<TransportEndpointRef, Set<TransportHandler>>();
  #status: TransportConnectionStatus = "disconnected";
  #nextId = 1;

  async connect(): Promise<TransportConnectionStatus> {
    this.#status = "connected";
    return this.#status;
  }

  async disconnect(): Promise<void> {
    this.#status = "disconnected";
  }

  status(): TransportConnectionStatus {
    return this.#status;
  }

  async send(destination: TransportEndpointRef, payload: Uint8Array): Promise<TransportSendResult> {
    if (this.#status !== "connected") {
      return { sent: false, reason: "not-connected" };
    }
    if (typeof destination !== "string" || destination.length === 0) {
      return { sent: false, reason: "invalid-destination" };
    }
    const messageId = `fake-transport-${this.#nextId++}`;
    const list = this.#inboxes.get(destination) ?? [];
    list.push(payload);
    this.#inboxes.set(destination, list);
    // A real adapter would notify live subscribers here too; this fake
    // stays deliberately simple and requires a caller to `deliver()`
    // explicitly (see below) to simulate an inbound message arriving.
    return { sent: true, messageId };
  }

  subscribe(destination: TransportEndpointRef, handler: TransportHandler): TransportUnsubscribe {
    const set = this.#handlers.get(destination) ?? new Set<TransportHandler>();
    set.add(handler);
    this.#handlers.set(destination, set);
    return () => {
      this.#handlers.get(destination)?.delete(handler);
    };
  }

  /** Test-only helper: simulates an inbound message arriving for `destination`, firing every registered handler. */
  deliver(destination: TransportEndpointRef, payload: Uint8Array): void {
    const messageId = `fake-transport-inbound-${this.#nextId++}`;
    for (const handler of this.#handlers.get(destination) ?? []) {
      handler({ id: messageId, payload, receivedAtMs: Date.now() });
    }
  }
}

describe("worked example: FakeTransportPortAdapter (TransportPort)", () => {
  it("STEP 1 -- satisfies TransportPort directly, without any factory involved", async () => {
    const adapter = new FakeTransportPortAdapter();
    expect(adapter.status()).toBe("disconnected");

    const disconnectedResult = await adapter.send("peer-1", new TextEncoder().encode("hi"));
    expect(disconnectedResult).toEqual({ sent: false, reason: "not-connected" });

    await adapter.connect();
    expect(adapter.status()).toBe("connected");

    const sendResult = await adapter.send("peer-1", new TextEncoder().encode("hi"));
    expect(sendResult.sent).toBe(true);
  });

  it("STEP 2 -- factory injection: createMessenger({ transport: adapter }) uses the real adapter, not the Noop default", async () => {
    const adapter = new FakeTransportPortAdapter();
    const messenger = createMessenger({ transport: adapter });

    expect(messenger.transport).toBe(adapter);
  });

  it("STEP 3 -- capability test: connect -> subscribe -> deliver -> send round trip through the injected Messenger, and unsubscribe stops delivery", async () => {
    const adapter = new FakeTransportPortAdapter();
    const messenger = createMessenger({ transport: adapter });

    await messenger.transport.connect();

    const received: Uint8Array[] = [];
    const unsubscribe = messenger.transport.subscribe("peer-1", (message) => received.push(message.payload));

    adapter.deliver("peer-1", new TextEncoder().encode("incoming"));
    expect(received).toHaveLength(1);
    expect(new TextDecoder().decode(received[0])).toBe("incoming");

    unsubscribe();
    adapter.deliver("peer-1", new TextEncoder().encode("after unsubscribe"));
    expect(received).toHaveLength(1); // unsubscribed -- no second delivery.

    const sendResult = await messenger.transport.send("peer-1", new TextEncoder().encode("outgoing"));
    expect(sendResult.sent).toBe(true);
  });

  it("STEP 3b -- createMessenger() with zero arguments defaults transport to a safe Noop that always fails closed, never throws", async () => {
    const messenger = createMessenger();
    const result = await messenger.transport.send("peer-1", new TextEncoder().encode("hi"));
    expect(result).toEqual({ sent: false, reason: "not-connected" });
    expect(messenger.transport.status()).toBe("disconnected");
  });
});

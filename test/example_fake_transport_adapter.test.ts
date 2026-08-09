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

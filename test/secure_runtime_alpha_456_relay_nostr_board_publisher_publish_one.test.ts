import { describe, it, expect, vi } from "vitest";
import { FedosRelayNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import type { FedosNostrBoardPublishEntry } from "../src/board/publish/nostr/fedos_nostr_board_publisher.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import type { FedosRelay } from "../src/desktop/fedos_relay.js";
import type { FedosEventDescriptor } from "../src/desktop/fedos_event_descriptor.js";
import type { FedosSubscription } from "../src/desktop/fedos_subscription.js";
import type { FedosSubscriptionFilter } from "../src/desktop/fedos_subscription_filter.js";
import type {
  FedosRelayMessageListener,
  FedosSubscriptionListener,
} from "../src/desktop/fedos_relay_listeners.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts?raw";

const postId = toFedosBoardPostId("post-1")!;
const nostrIntent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1_700_000_000)!;
const activitypubIntent = createFedosBoardOutboxIntent(
  postId,
  { protocol: "activitypub", destination: null },
  1_700_000_000,
)!;

const sampleWireEvent: FedosNostrWireEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_000,
  kind: 1,
  tags: [],
  content: "hello relay",
  sig: "d".repeat(128),
};

/** A minimal, fully-controllable FedosRelay test double, independent of NullRelay's own connected-gate behavior. */
class FakeFedosRelay implements FedosRelay {
  readonly url = "wss://relay.example.test";
  readonly publishCalls: FedosEventDescriptor[] = [];
  publishImpl: (event: FedosEventDescriptor) => Promise<void> = async () => {};

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}
  isConnected(): boolean {
    return true;
  }
  async publish(event: FedosEventDescriptor): Promise<void> {
    this.publishCalls.push(event);
    return this.publishImpl(event);
  }
  async subscribe(_filters: readonly FedosSubscriptionFilter[]): Promise<FedosSubscription> {
    throw new Error("not used by this test");
  }
  async unsubscribe(_subscription: FedosSubscription): Promise<void> {}
  onSubscriptionMessage(_subscription: FedosSubscription, _listener: FedosSubscriptionListener): void {}
  onRelayMessage(_listener: FedosRelayMessageListener): void {}
}

describe("Secure Runtime Alpha 456 -- FedosRelayNostrBoardPublisher: publishOne", () => {
  it("returns false and never calls relay.publish() when the intent's protocol is not nostr", async () => {
    const relay = new FakeFedosRelay();
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entry: FedosNostrBoardPublishEntry = { intent: activitypubIntent, event: sampleWireEvent };
    await expect(publisher.publishOne(entry)).resolves.toBe(false);
    expect(relay.publishCalls).toHaveLength(0);
  });

  it("returns false, never throws, when the Relay is not connected", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entry: FedosNostrBoardPublishEntry = { intent: nostrIntent, event: sampleWireEvent };
    await expect(publisher.publishOne(entry)).resolves.toBe(false);
  });

  it("returns true and sends the correctly-converted descriptor once connected", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entry: FedosNostrBoardPublishEntry = { intent: nostrIntent, event: sampleWireEvent };
    await expect(publisher.publishOne(entry)).resolves.toBe(true);
    expect(relay.published).toEqual([
      {
        id: sampleWireEvent.id,
        provider: "nostr",
        author: sampleWireEvent.pubkey,
        createdAt: sampleWireEvent.created_at,
        kind: sampleWireEvent.kind,
        tags: sampleWireEvent.tags,
        content: sampleWireEvent.content,
        signature: sampleWireEvent.sig,
      },
    ]);
  });

  it("returns false, never rethrows, for an arbitrary Relay-side error unrelated to connection state", async () => {
    const relay = new FakeFedosRelay();
    relay.publishImpl = async () => {
      throw new Error("relay exploded");
    };
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entry: FedosNostrBoardPublishEntry = { intent: nostrIntent, event: sampleWireEvent };
    await expect(publisher.publishOne(entry)).resolves.toBe(false);
  });

  it("calls relay.publish() exactly once per invocation -- no retry", async () => {
    const relay = new FakeFedosRelay();
    const publisher = new FedosRelayNostrBoardPublisher(relay);
    const entry: FedosNostrBoardPublishEntry = { intent: nostrIntent, event: sampleWireEvent };
    await publisher.publishOne(entry);
    expect(relay.publishCalls).toHaveLength(1);
  });

  it("the constructor takes exactly one argument and performs no async work", () => {
    expect(source).toMatch(/constructor\(relay: FedosRelay\) \{\s*\n\s*this\.#relay = relay;\s*\n\s*\}/);
  });

  it("publishOne() never calls relay.isConnected() -- it relies solely on relay.publish()'s own rejection", () => {
    const publishOneBody = (source.match(/async publishOne\(entry: FedosNostrBoardPublishEntry\): Promise<boolean> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(publishOneBody.length).toBeGreaterThan(0);
    expect(publishOneBody).not.toMatch(/isConnected/);
  });

  it("names no Retry/Backoff/ACK vocabulary in code, and no ActivityPub/ATProto/Session/Ontology/p2p reference anywhere (comment prose describing what's absent doesn't count)", () => {
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/[Rr]etry|[Bb]ackoff|\bACK\b/);
    expect(codeOnly).not.toMatch(/ActivityPub|ATProto|AtProto|\bSession\b|Ontology|p2p/i);
  });
});

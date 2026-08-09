import { describe, it, expect } from "vitest";
import { FedosNostrBoardPublisherAdapter } from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import type { FedosNostrBoardPublisher, FedosNostrBoardPublishEntry } from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher_adapter.ts?raw";

class FakeNostrPublisher implements FedosNostrBoardPublisher {
  result = true;
  calls = 0;
  async publishOne(_entry: FedosNostrBoardPublishEntry): Promise<boolean> {
    this.calls++;
    return this.result;
  }
  async publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]> {
    const results: boolean[] = [];
    for (const entry of entries) results.push(await this.publishOne(entry));
    return results;
  }
}

const postId = toFedosBoardPostId("post-adapter-1")!;
const nostrIntent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
const nostrRecord = serializeFedosBoardOutboxIntent(nostrIntent);
const sessionIntent = createFedosBoardOutboxIntent(postId, { protocol: "session", destination: null }, 1)!;
const sessionRecord = serializeFedosBoardOutboxIntent(sessionIntent);

const sampleEvent: FedosNostrWireEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1,
  kind: 1,
  tags: [],
  content: "hi",
  sig: "c".repeat(128),
};

describe("Secure Runtime Alpha 496 -- Publisher Adapter", () => {
  it("non-nostr target: failed/never, eventSource never called", async () => {
    let called = false;
    const adapter = new FedosNostrBoardPublisherAdapter(new FakeNostrPublisher(), async () => {
      called = true;
      return sampleEvent;
    });
    await expect(adapter.publish(sessionRecord)).resolves.toEqual({ outcome: "failed", retryPolicy: "never" });
    expect(called).toBe(false);
  });

  it("no event available yet: failed/later, publisher never called", async () => {
    const publisher = new FakeNostrPublisher();
    const adapter = new FedosNostrBoardPublisherAdapter(publisher, async () => null);
    await expect(adapter.publish(nostrRecord)).resolves.toEqual({ outcome: "failed", retryPolicy: "later" });
    expect(publisher.calls).toBe(0);
  });

  it("successful send: delivered/never, externalReference not part of legacy shape but canonical mapping used", async () => {
    const publisher = new FakeNostrPublisher();
    publisher.result = true;
    const adapter = new FedosNostrBoardPublisherAdapter(publisher, async () => sampleEvent);
    await expect(adapter.publish(nostrRecord)).resolves.toEqual({ outcome: "delivered", retryPolicy: "never" });
    expect(publisher.calls).toBe(1);
  });

  it("failed send: failed/later, never rejected", async () => {
    const publisher = new FakeNostrPublisher();
    publisher.result = false;
    const adapter = new FedosNostrBoardPublisherAdapter(publisher, async () => sampleEvent);
    await expect(adapter.publish(nostrRecord)).resolves.toEqual({ outcome: "failed", retryPolicy: "later" });
  });

  it("publishOne is called at most once per publish() invocation", async () => {
    const publisher = new FakeNostrPublisher();
    const adapter = new FedosNostrBoardPublisherAdapter(publisher, async () => sampleEvent);
    await adapter.publish(nostrRecord);
    expect(publisher.calls).toBe(1);
  });

  it("never throws, even for a malformed record", async () => {
    const adapter = new FedosNostrBoardPublisherAdapter(new FakeNostrPublisher(), async () => sampleEvent);
    await expect(adapter.publish({ garbage: true } as never)).resolves.toEqual({
      outcome: "failed",
      retryPolicy: "never",
    });
  });

  it("imports no Scheduler, Observation, Outbox persistence, Board, or signing authority reference", () => {
    const importLines = (source as string).match(/^import .*$/gm) ?? [];
    const importBlock = importLines.join("\n");
    expect(importBlock).not.toMatch(/fedos_publish_scheduler|fedos_board_outbox_observation|fedos_delivery_observation/);
    expect(importBlock).not.toMatch(/FedosBoardOutboxPersistence|FedosBoardRepository|FedosNostrSigningAuthority/);
  });
});

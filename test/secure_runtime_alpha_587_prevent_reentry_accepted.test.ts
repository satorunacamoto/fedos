import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";

/**
 * Secure Runtime Alpha 587 -- "Prevent Already-Accepted Intents From
 * Re-Entering Scheduler": Stage 7 of the Alpha 581-600 Durable Retry
 * Registry & Delivery Recovery Arc. Unit-level, at the raw
 * `FedosPublishScheduler` -- Alpha 589 covers the full Host-level
 * "real restart" case.
 */

class CountingPublisher implements FedosBoardOutboxPublisher {
  calls = 0;
  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

function makeIntent(persistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 587 -- Prevent Already-Accepted Intents From Re-Entering Scheduler", () => {
  it("1. an intent seeded via initialDelivered is never published, on the very first tick()", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const intent = makeIntent(persistence, "post-587-1");
    const publisher = new CountingPublisher();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      initialDelivered: new Set([intent.id]),
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(0);
    expect(publisher.calls).toBe(0);
  });

  it("2. a mix of seeded-delivered and genuinely-pending intents -- only the pending one is attempted", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const delivered = makeIntent(persistence, "post-587-2-delivered");
    const pending = makeIntent(persistence, "post-587-2-pending");
    const publisher = new CountingPublisher();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      initialDelivered: new Set([delivered.id]),
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.intent.id).toBe(pending.id);
    expect(publisher.calls).toBe(1);
  });

  it("3. initialDelivered is defensively copied -- mutating the caller's own Set after construction has no effect", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const intent = makeIntent(persistence, "post-587-3");
    const publisher = new CountingPublisher();
    const seed = new Set([intent.id]);
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      initialDelivered: seed,
    });
    seed.clear(); // caller mutates its own copy after passing it in

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(0); // scheduler's own internal state is unaffected
    expect(publisher.calls).toBe(0);
  });

  it("4. omitting initialDelivered entirely reproduces the exact prior (every intent starts pending) behavior", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const intent = makeIntent(persistence, "post-587-4");
    const publisher = new CountingPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.intent.id).toBe(intent.id);
    expect(publisher.calls).toBe(1);
  });
});

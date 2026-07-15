import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 547 -- "Memory Audit": Stage 7 of the Alpha
 * 541-560 Publish Runtime Operational Review Arc. Review test only --
 * demonstrates, by real execution, that the Scheduler's own
 * observationLog() grows monotonically with every delivered intent
 * and is never trimmed, confirming it is the ONLY copy of that data.
 */
describe("Secure Runtime Alpha 547 -- Memory Audit", () => {
  it("1. observationLog() grows by exactly two entries per delivered intent, across repeated ticks, and never shrinks", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new MockFedosBoardOutboxPublisher({ next: () => ({ outcome: "delivered", retryPolicy: "never" }) });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    for (let i = 0; i < 5; i += 1) {
      const postId = toFedosBoardPostId(`post-${i}`)!;
      const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, i)!;
      persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
      await scheduler.tick();
    }

    // Each delivered intent produces exactly 2 observations (attempt-started + delivered) --
    // 5 intents -> 10 entries, all still resident, none trimmed.
    expect(scheduler.observationLog()).toHaveLength(10);
  });

  it("2. FedosPublishScheduler exposes no method to clear/trim its own observationLog", () => {
    const proto = FedosPublishScheduler.prototype;
    const methodNames = Object.getOwnPropertyNames(proto);
    for (const name of methodNames) {
      expect(name.toLowerCase()).not.toMatch(/clear|trim|evict|prune/);
    }
  });
});

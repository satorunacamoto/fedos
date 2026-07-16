import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";

class SlowPublisher implements FedosBoardOutboxPublisher {
  #release: (() => void) | null = null;
  #gate: Promise<void>;

  constructor() {
    this.#gate = new Promise((resolve) => {
      this.#release = resolve;
    });
  }

  release(): void {
    this.#release?.();
  }

  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    await this.#gate;
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

/**
 * Secure Runtime Alpha 550 -- "Observation Consistency Audit": Stage
 * 10 of the Alpha 541-560 Publish Runtime Operational Review Arc.
 * Originally demonstrated, by real execution, that the Alpha 549
 * double-publish race produced two "delivered" observation entries for
 * a single logical delivery, with no correlation id distinguishing
 * them. Test 1 was UPDATED by Secure Runtime Alpha 570 (Alpha 561-580
 * Publish Scheduler Concurrency Safety & Abandonment Policy Arc) to
 * assert the FIXED behavior, now that `tick()` is single-flight
 * (Alpha 563): the same overlapping-call scenario now produces exactly
 * ONE "delivered" observation.
 */
describe("Secure Runtime Alpha 550 -- Observation Consistency Audit", () => {
  it("1. an overlapping tick() race no longer double-observes -- exactly one 'delivered' observation for the SAME outboxId", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const publisher = new SlowPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const firstTick = scheduler.tick();
    const secondTick = scheduler.tick();
    await Promise.resolve();
    await Promise.resolve();
    publisher.release();
    await Promise.all([firstTick, secondTick]);

    const deliveredEntries = scheduler.observationLog().filter((o) => o.kind === "delivered" && o.outboxId === intent.id);
    expect(deliveredEntries).toHaveLength(1);
    expect(Object.keys(deliveredEntries[0]!).sort()).toEqual(["kind", "observedAt", "outboxId"]);
  });
});

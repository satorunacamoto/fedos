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
 * Review test only -- demonstrates, by real execution, that the same
 * Alpha 549 double-publish race produces two "delivered" observation
 * entries for a single logical delivery, with no correlation id
 * distinguishing them.
 */
describe("Secure Runtime Alpha 550 -- Observation Consistency Audit", () => {
  it("1. an overlapping tick() race produces two 'delivered' observations for the SAME outboxId, indistinguishable from two independent deliveries", async () => {
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
    expect(deliveredEntries).toHaveLength(2);

    // No field on FedosBoardOutboxObservation ties these two entries back to
    // "the same overlapping tick() window" -- confirmed structurally, not just by count.
    expect(Object.keys(deliveredEntries[0]!).sort()).toEqual(["kind", "observedAt", "outboxId"]);
  });
});

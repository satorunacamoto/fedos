import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { createFedosMaxAttemptsAbandonmentPolicy } from "../src/board/outbox/fedos_board_outbox_abandonment_policy.js";

/**
 * Secure Runtime Alpha 577 -- "Performance Review": Stage 17 of the
 * Alpha 561-580 Publish Scheduler Concurrency Safety & Abandonment
 * Policy Arc. Correctness-first, per this Stage's own instruction --
 * confirms a full tick() over 1/100/1,000 pending intents still
 * publishes every intent exactly once and completes, with the
 * abandonment policy's own O(1)-per-attempt bookkeeping (a `Map` keyed
 * by outboxId) not degrading that. No optimization or indexing is
 * added; this is a correctness-at-scale smoke test, not a benchmark.
 */

class CountingPublisher implements FedosBoardOutboxPublisher {
  readonly seen = new Set<string>();
  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.seen.add(record.id);
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

function fillOutbox(persistence: InMemoryFedosBoardOutboxPersistence, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const postId = toFedosBoardPostId(`post-577-${i}`)!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
    ids.push(intent.id);
  }
  return ids;
}

describe.each([1, 100, 1000])("Secure Runtime Alpha 577 -- Performance Review (%i intents)", (count) => {
  it(`a single tick() publishes exactly ${count} distinct intent(s), each exactly once`, async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const ids = fillOutbox(persistence, count);
    const publisher = new CountingPublisher();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      abandonmentPolicy: createFedosMaxAttemptsAbandonmentPolicy(3),
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(count);
    expect(publisher.seen.size).toBe(count);
    for (const id of ids) expect(publisher.seen.has(id)).toBe(true);

    // A second tick() sees nothing pending -- every intent was delivered.
    const second = await scheduler.tick();
    expect(second).toHaveLength(0);
  });
});

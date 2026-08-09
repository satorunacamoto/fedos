import { describe, it, expect, vi } from "vitest";
import { FedosPublishScheduler } from "../src/os/messenger/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";

/**
 * Secure Runtime Alpha 563 -- "Single-Flight Implementation": Stage 3
 * of the Alpha 561-580 Publish Scheduler Concurrency Safety &
 * Abandonment Policy Arc. Verifies `FedosPublishScheduler.tick()`'s own
 * single-flight guard directly, independent of the higher-level
 * double-publish reproduction (Alpha 549/570) and the Controller's own
 * guard (Alpha 564).
 */

class GatedPublisher implements FedosBoardOutboxPublisher {
  calls = 0;
  #release: (() => void) | null = null;
  #gate: Promise<void>;
  result: FedosBoardOutboxPublishResult = { outcome: "delivered", retryPolicy: "never" };

  constructor() {
    this.#gate = new Promise((resolve) => {
      this.#release = resolve;
    });
  }

  release(): void {
    this.#release?.();
  }

  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    await this.#gate;
    return this.result;
  }
}

function makePendingIntent(persistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 563 -- Single-Flight Implementation", () => {
  it("1. two tick() calls without an intervening await return the IDENTICAL Promise", () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-563-1");
    const publisher = new GatedPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const first = scheduler.tick();
    const second = scheduler.tick();
    expect(second).toBe(first);

    publisher.release();
    return first;
  });

  it("2. after the in-flight tick() settles, the NEXT tick() call starts a genuinely new pass (the guard releases)", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-563-2");
    const publisher = new GatedPublisher();
    publisher.result = { outcome: "failed", retryPolicy: "later" };
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const first = scheduler.tick();
    publisher.release();
    await first;
    expect(publisher.calls).toBe(1);

    const second = scheduler.tick();
    expect(second).not.toBe(first);
    publisher.release();
    await second;
    expect(publisher.calls).toBe(2);
  });

  it("3. start()'s own interval firing while a tick is still in flight does not start a second, overlapping pass", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-563-3");
    const publisher = new GatedPublisher();

    let handler: (() => void) | null = null;
    const setIntervalFn = vi.fn((h: () => void) => {
      handler = h;
      return "handle";
    });
    const clearIntervalFn = vi.fn();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      setIntervalFn,
      clearIntervalFn,
    });

    scheduler.start();
    handler!(); // first firing -- starts a tick(), blocks on the gated publish()
    await Promise.resolve();
    expect(publisher.calls).toBe(1);

    handler!(); // second firing, BEFORE the first tick() has resolved
    await Promise.resolve();
    expect(publisher.calls).toBe(1); // still 1 -- no second Publisher call was made

    publisher.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(publisher.calls).toBe(1);
  });

  it("4. a rejecting/throwing Publisher never leaves the Scheduler permanently unable to tick() again", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-563-4");
    let callCount = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        callCount++;
        throw new Error("simulated Publisher crash");
      },
    };
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    // FedosPublishScheduler.#attemptOnce() already catches a throw and maps
    // it to FAILED_LATER_RESULT (Alpha 476, unchanged) -- tick() itself
    // never rejects. This confirms the single-flight guard's own `finally`
    // still releases correctly across that path.
    await expect(scheduler.tick()).resolves.toBeDefined();
    await expect(scheduler.tick()).resolves.toBeDefined();
    expect(callCount).toBe(2);
  });
});

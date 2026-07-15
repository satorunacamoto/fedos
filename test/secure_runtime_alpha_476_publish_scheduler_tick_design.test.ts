import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_476_publish_scheduler_tick_design.md?raw";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";

function makeRecord(postId: string) {
  const intent = createFedosBoardOutboxIntent(
    toFedosBoardPostId(postId)!,
    { protocol: "nostr", destination: null },
    1_700_000_000,
  )!;
  return serializeFedosBoardOutboxIntent(intent);
}

/**
 * Secure Runtime Alpha 476 -- "Publish Scheduler Tick Design": Stage 6
 * of the Alpha 471-480 Canonical Publish Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 476 -- Publish Scheduler Tick Design", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc states tick() performs at most two publish() calls per pending intent", () => {
    expect(designDocSource).toMatch(/AT MOST two `Publisher\.publish\(\)` calls per\s*\ncurrently-pending intent/);
  });

  it("3. tick() delivers a pending intent and never re-attempts it again", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-1");
    persistence.putIntent(record);
    const publisher = new MockFedosBoardOutboxPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const first = await scheduler.tick();
    expect(first).toHaveLength(1);
    expect(first[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });

    const second = await scheduler.tick();
    expect(second).toHaveLength(0);
    expect(publisher.calls).toHaveLength(1);
  });

  it('4. "later" retry policy leaves the intent pending for the next tick()', async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-2");
    persistence.putIntent(record);
    const publisher = new MockFedosBoardOutboxPublisher({
      results: [{ outcome: "failed", retryPolicy: "later" }],
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const first = await scheduler.tick();
    expect(first[0]!.result.retryPolicy).toBe("later");

    const second = await scheduler.tick();
    expect(second).toHaveLength(1);
    expect(publisher.calls).toHaveLength(2);
  });

  it('5. "never" retry policy abandons the intent -- no future tick() attempts it again', async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-3");
    persistence.putIntent(record);
    const publisher = new MockFedosBoardOutboxPublisher({
      results: [{ outcome: "rejected", retryPolicy: "never" }],
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const first = await scheduler.tick();
    expect(first[0]!.observations.map((o) => o.kind)).toEqual(["attempt-started", "rejected", "abandoned"]);

    const second = await scheduler.tick();
    expect(second).toHaveLength(0);
    expect(publisher.calls).toHaveLength(1);
  });

  it('6. "immediate" retry policy performs exactly one same-tick re-attempt', async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-4");
    persistence.putIntent(record);
    const publisher = new MockFedosBoardOutboxPublisher({
      results: [
        { outcome: "failed", retryPolicy: "immediate" },
        { outcome: "delivered", retryPolicy: "never" },
      ],
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.result).toEqual({ outcome: "delivered", retryPolicy: "never" });
    expect(publisher.calls).toHaveLength(2);
    expect(entries[0]!.observations.map((o) => o.kind)).toEqual([
      "attempt-started",
      "failed",
      "attempt-started",
      "delivered",
    ]);
  });

  it('7. two consecutive "immediate" results are bounded to at most two attempts per tick() -- the second is downgraded to "later"', async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-5");
    persistence.putIntent(record);
    const publisher = new MockFedosBoardOutboxPublisher({
      next: () => ({ outcome: "failed", retryPolicy: "immediate" }),
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const entries = await scheduler.tick();
    expect(publisher.calls).toHaveLength(2);
    expect(entries[0]!.result).toEqual({ outcome: "failed", retryPolicy: "later" });

    const secondTick = await scheduler.tick();
    expect(secondTick).toHaveLength(1);
    expect(publisher.calls).toHaveLength(4);
  });

  it("8. a rejected Promise from the Publisher is normalized to failed/later, never thrown out of tick()", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-6");
    persistence.putIntent(record);
    const publisher = { publish: () => Promise.reject(new Error("boom")) };
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const entries = await scheduler.tick();
    expect(entries[0]!.result).toEqual({ outcome: "failed", retryPolicy: "later" });
  });

  it("9. a structurally invalid Publisher result is normalized to failed/later, never trusted", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const record = makeRecord("post-7");
    persistence.putIntent(record);
    const publisher = { publish: async () => ({ outcome: "ok" }) as never };
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    const entries = await scheduler.tick();
    expect(entries[0]!.result).toEqual({ outcome: "failed", retryPolicy: "later" });
  });

  it("10. attempts within one tick() run sequentially, in listIntents() order", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(makeRecord("post-8"));
    persistence.putIntent(makeRecord("post-9"));
    const order: string[] = [];
    const publisher = {
      publish: async (record: { id: string }) => {
        order.push(record.id);
        return { outcome: "delivered" as const, retryPolicy: "never" as const };
      },
    };
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    await scheduler.tick();
    expect(order).toEqual(persistence.listIntents().map((r) => r.id));
  });

  it("11. observationLog() accumulates across multiple tick() calls and returns a fresh array each time", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(makeRecord("post-10"));
    const publisher = new MockFedosBoardOutboxPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    await scheduler.tick();
    const log = scheduler.observationLog() as unknown[];
    expect(log).toHaveLength(2);
    log.push("intruder");
    expect(scheduler.observationLog()).toHaveLength(2);
  });
});

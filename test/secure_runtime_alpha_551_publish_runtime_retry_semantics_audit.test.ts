import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/os/messenger/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";

/**
 * Secure Runtime Alpha 551 -- "Retry Semantics Audit": Stage 11 of the
 * Alpha 541-560 Publish Runtime Operational Review Arc. Review test
 * only.
 */
describe("Secure Runtime Alpha 551 -- Retry Semantics Audit", () => {
  it("1. a Publisher that always returns immediate is called EXACTLY twice per tick(), never three times", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const publisher = new MockFedosBoardOutboxPublisher({
      next: () => ({ outcome: "failed", retryPolicy: "immediate" }),
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });
    await scheduler.tick();

    expect(publisher.calls).toHaveLength(2);
  });

  it("2. a delivered outcome paired with retryPolicy 'immediate' (a malformed-but-valid combination) never triggers a second attempt", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const publisher = new MockFedosBoardOutboxPublisher({
      next: () => ({ outcome: "delivered", retryPolicy: "immediate" }),
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });
    const entries = await scheduler.tick();

    expect(publisher.calls).toHaveLength(1);
    expect(entries[0]!.result.outcome).toBe("delivered");
  });

  it("3. a Publisher that always throws is retried on every tick() indefinitely -- never abandoned, confirmed across three ticks", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const publisher = new MockFedosBoardOutboxPublisher({
      next: () => {
        throw new Error("simulated crash");
      },
    });
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    await scheduler.tick();
    await scheduler.tick();
    const thirdEntries = await scheduler.tick();

    // Still pending after three ticks -- never marked abandoned, per this Stage's own finding.
    expect(thirdEntries).toHaveLength(1);
    expect(thirdEntries[0]!.result).toEqual({ outcome: "failed", retryPolicy: "later" });
  });

  it("4. no exponential-backoff-shaped computation exists in the Scheduler's own code (comments legitimately discuss the absence in prose)", () => {
    const code = (schedulerSource as string)
      .split("\n")
      .filter((line: string) => {
        const trimmed = line.trim();
        return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/Math\.pow|backoffMs|delayMs|setTimeout/i);
  });
});

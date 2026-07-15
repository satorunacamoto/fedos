import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { hydrateFedosBoardService } from "../src/board/persistence/fedos_board_hydration.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost } from "../src/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 545 -- "Recovery Audit": Stage 5 of the Alpha
 * 541-560 Publish Runtime Operational Review Arc. Review test only --
 * demonstrates, by real (unmodified) execution, that a fresh
 * FedosPublishScheduler re-attempts an already-delivered Outbox intent
 * after a simulated restart (a brand-new Scheduler instance over the
 * SAME durable persistence).
 */
describe("Secure Runtime Alpha 545 -- Recovery Audit", () => {
  it("1. a fresh Scheduler instance re-attempts an intent a PRIOR Scheduler instance already delivered", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const firstPublisher = new MockFedosBoardOutboxPublisher({
      next: () => ({ outcome: "delivered", retryPolicy: "never" }),
    });
    const firstScheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher: firstPublisher,
      intervalMs: 1000,
    });
    const firstEntries = await firstScheduler.tick();
    expect(firstEntries).toHaveLength(1);
    expect(firstEntries[0]!.result.outcome).toBe("delivered");
    expect(firstPublisher.calls).toHaveLength(1);

    // Simulate a process restart: a BRAND-NEW Scheduler instance, over the
    // SAME durable persistence (the intent itself survived, per Alpha 542) --
    // but the prior Scheduler's own in-memory #delivered bookkeeping did not.
    const secondPublisher = new MockFedosBoardOutboxPublisher({
      next: () => ({ outcome: "delivered", retryPolicy: "never" }),
    });
    const secondScheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher: secondPublisher,
      intervalMs: 1000,
    });
    const secondEntries = await secondScheduler.tick();

    // The already-delivered intent is attempted AGAIN by the fresh instance --
    // confirming Alpha 545's own recovery-gap finding by real execution, not assumption.
    expect(secondEntries).toHaveLength(1);
    expect(secondPublisher.calls).toHaveLength(1);
  });

  it("2. Board state DOES survive an equivalent simulated restart, via hydration -- the contrasting positive case", () => {
    const postId = toFedosBoardPostId("post-1")!;
    const post = validateFedosBoardPost({
      id: "post-1",
      boardId: "board-1",
      threadId: "post-1",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "hello",
      createdAt: 1_700_000_000,
      source: { protocol: "nostr", reference: "ref-1" },
    })!;
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(serializeFedosBoardPost(post));

    // Two independent hydrations from the SAME persistence -- simulating two separate process starts.
    const firstHydration = hydrateFedosBoardService(persistence);
    const secondHydration = hydrateFedosBoardService(persistence);
    expect(firstHydration.outcome).toBe("hydrated");
    expect(secondHydration.outcome).toBe("hydrated");
    expect(secondHydration.service!.findPost(postId)).not.toBeNull();
  });
});

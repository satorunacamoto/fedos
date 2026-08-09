import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/os/messenger/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { createFedosMaxAttemptsAbandonmentPolicy } from "../src/os/messenger/board/outbox/fedos_board_outbox_abandonment_policy.js";

/**
 * Secure Runtime Alpha 588 -- "Prevent Abandoned Intents From
 * Restarting": Stage 8 of the Alpha 581-600 Durable Retry Registry &
 * Delivery Recovery Arc. `initialAbandoned`'s own counterpart to Alpha
 * 587's `initialDelivered` verification.
 */

class CountingPublisher implements FedosBoardOutboxPublisher {
  calls = 0;
  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    return { outcome: "failed", retryPolicy: "later" };
  }
}

function makeIntent(persistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 588 -- Prevent Abandoned Intents From Restarting", () => {
  it("1. an intent seeded via initialAbandoned is never published, even though the Publisher would keep returning 'later'", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const intent = makeIntent(persistence, "post-588-1");
    const publisher = new CountingPublisher();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      initialAbandoned: new Set([intent.id]),
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(0);
    expect(publisher.calls).toBe(0);
  });

  it("2. initialCompletedAttempts is honored -- a seeded near-limit intent abandons after ONE more attempt under an injected policy", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const intent = makeIntent(persistence, "post-588-2");
    const publisher = new CountingPublisher();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      abandonmentPolicy: createFedosMaxAttemptsAbandonmentPolicy(3),
      initialCompletedAttempts: new Map([[intent.id, 2]]), // as if 2 attempts already happened before a restart
    });

    const entries = await scheduler.tick(); // this is the 3rd completed attempt -- hits the bound
    expect(publisher.calls).toBe(1);
    expect(entries[0]!.observations.some((o) => o.kind === "abandoned")).toBe(true);

    const again = await scheduler.tick();
    expect(again).toHaveLength(0);
    expect(publisher.calls).toBe(1); // no further Publish after abandonment
  });

  it("3. initialAbandoned and initialDelivered together -- each governs its own disjoint set of intents correctly", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const delivered = makeIntent(persistence, "post-588-3-delivered");
    const abandoned = makeIntent(persistence, "post-588-3-abandoned");
    const pending = makeIntent(persistence, "post-588-3-pending");
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      initialDelivered: new Set([delivered.id]),
      initialAbandoned: new Set([abandoned.id]),
    });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.intent.id).toBe(pending.id);
  });
});

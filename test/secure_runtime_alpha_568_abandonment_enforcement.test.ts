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
 * Secure Runtime Alpha 568 -- "Abandonment Enforcement": Stage 8 of the
 * Alpha 561-580 Publish Scheduler Concurrency Safety & Abandonment
 * Policy Arc. Closes Alpha 551's own finding: a permanently-crashing/
 * always-`"later"` Publisher was retried forever, with no
 * Scheduler-level bound. `createFedosMaxAttemptsAbandonmentPolicy` is
 * used here ONLY as a concrete, test-local example -- this Arc ships no
 * default policy or default `maxAttempts` (see
 * `../src/board/outbox/fedos_board_outbox_abandonment_policy.ts` and
 * `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`).
 */

class AlwaysLaterPublisher implements FedosBoardOutboxPublisher {
  readonly calls: FedosPersistedBoardOutboxRecordV1[] = [];
  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls.push(record);
    return { outcome: "failed", retryPolicy: "later" };
  }
}

function makePendingIntent(persistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 568 -- Abandonment Enforcement", () => {
  it("1. without an injected policy, a permanently-'later' Publisher is retried on every tick(), unbounded -- unchanged prior behavior", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-568-1");
    const publisher = new AlwaysLaterPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    for (let i = 0; i < 5; i++) await scheduler.tick();
    expect(publisher.calls).toHaveLength(5);
  });

  it("2. with an injected max-attempts policy, the Publisher stops being called once the bound is reached, and the intent is marked abandoned", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const intent = makePendingIntent(persistence, "post-568-2");
    const publisher = new AlwaysLaterPublisher();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      abandonmentPolicy: createFedosMaxAttemptsAbandonmentPolicy(3),
    });

    const entries1 = await scheduler.tick();
    const entries2 = await scheduler.tick();
    const entries3 = await scheduler.tick();
    expect(publisher.calls).toHaveLength(3);
    // The 3rd completed attempt trips the bound -- its own tick entry
    // already carries the "abandoned" observation.
    expect(entries3[0]!.observations.some((o) => o.kind === "abandoned")).toBe(true);
    expect(entries1[0]!.observations.some((o) => o.kind === "abandoned")).toBe(false);
    expect(entries2[0]!.observations.some((o) => o.kind === "abandoned")).toBe(false);

    // A further tick() does not call the Publisher again for this intent.
    const entries4 = await scheduler.tick();
    expect(publisher.calls).toHaveLength(3);
    expect(entries4).toHaveLength(0);
    void intent;
  });

  it("3. a Publisher-declared 'never' still abandons immediately, even with a generous policy injected -- the policy is additive, never a replacement", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-568-3");
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        return { outcome: "rejected", retryPolicy: "never" };
      },
    };
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      abandonmentPolicy: createFedosMaxAttemptsAbandonmentPolicy(100),
    });

    const entries = await scheduler.tick();
    expect(entries[0]!.observations.some((o) => o.kind === "abandoned")).toBe(true);
    const again = await scheduler.tick();
    expect(again).toHaveLength(0);
  });

  it("4. an already-delivered intent's own attempt counter is forgotten -- it never contributes to a future intent's abandonment bound", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-568-4");
    let call = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        call++;
        return call === 1
          ? { outcome: "failed", retryPolicy: "later" }
          : { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      abandonmentPolicy: createFedosMaxAttemptsAbandonmentPolicy(2),
    });

    await scheduler.tick(); // attempt 1: failed/later
    const delivered = await scheduler.tick(); // attempt 2: delivered
    expect(delivered[0]!.result.outcome).toBe("delivered");
    expect(delivered[0]!.observations.some((o) => o.kind === "abandoned")).toBe(false);
  });
});

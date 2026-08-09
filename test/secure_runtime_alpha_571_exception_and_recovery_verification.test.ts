import { describe, it, expect, vi } from "vitest";
import { FedosPublishScheduler } from "../src/os/messenger/board/outbox/fedos_publish_scheduler.js";
import { FedosHostDeliveryController } from "../src/os/messenger/desktop/host/fedos_host_delivery_controller.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.js";

/**
 * Secure Runtime Alpha 571 -- "Exception and Recovery Verification":
 * Stage 11 of the Alpha 561-580 Publish Scheduler Concurrency Safety &
 * Abandonment Policy Arc. Confirms the single-flight guard (Alpha 563/
 * 564) never leaves either class permanently unable to tick() again
 * after a failure, at every named boundary.
 */

function makePendingIntent(persistence: InMemoryFedosBoardOutboxPersistence, id: string) {
  const postId = toFedosBoardPostId(id)!;
  const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
  persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  return intent;
}

describe("Secure Runtime Alpha 571 -- Exception and Recovery Verification", () => {
  it("1. Publisher throw -- tick() resolves (never rejects), guard releases, next tick() proceeds normally", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(persistence, "post-571-1");
    let calls = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        calls++;
        throw new Error("boom");
      },
    };
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });
    await expect(scheduler.tick()).resolves.toBeDefined();
    await expect(scheduler.tick()).resolves.toBeDefined();
    expect(calls).toBe(2);
  });

  it("2. Outbox listIntents() throw -- tick() rejects, but the guard still releases and a later tick() (once the fault clears) succeeds", async () => {
    let shouldThrow = true;
    const outboxPersistence: FedosBoardOutboxPersistence = {
      listIntents() {
        if (shouldThrow) throw new Error("durable read failure");
        return [];
      },
      putIntent() {},
    } as unknown as FedosBoardOutboxPersistence;

    const publisher: FedosBoardOutboxPublisher = { async publish() { return { outcome: "delivered", retryPolicy: "never" }; } };
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 1000 });

    await expect(scheduler.tick()).rejects.toThrow("durable read failure");
    shouldThrow = false;
    await expect(scheduler.tick()).resolves.toEqual([]);
  });

  it("3. Observation Repository write throw inside the Controller -- the in-flight guard still clears, and the NEXT tick() (fault cleared) succeeds", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(outboxPersistence, "post-571-3");
    const publisher: FedosBoardOutboxPublisher = { async publish() { return { outcome: "delivered", retryPolicy: "never" }; } };
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 1000 });

    let shouldThrow = true;
    const record = vi.fn((...args: Parameters<FedosValidatingDeliveryObservationRepository["record"]>) => {
      if (shouldThrow) throw new Error("durable write failure");
      return realRepository.record(...args);
    });
    const persistence = new InMemoryFedosDeliveryObservationPersistence();
    const repository = new FedosDeliveryObservationRepository(persistence);
    const query = new FedosDeliveryObservationQuery(repository);
    const realRepository = new FedosValidatingDeliveryObservationRepository(repository, query);
    const observationRepository = { record } as unknown as FedosValidatingDeliveryObservationRepository;

    const controller = new FedosHostDeliveryController({ scheduler, observationRepository, intervalMs: 1000 });

    await expect(controller.tick()).rejects.toThrow("durable write failure");
    shouldThrow = false;
    // A SECOND pending intent for the retried tick, so there is something to persist again.
    makePendingIntent(outboxPersistence, "post-571-3b");
    await expect(controller.tick()).resolves.toBeDefined();
  });

  it("4. stop() called while an in-flight tick is about to reject still resolves cleanly (not hung, not throwing)", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    makePendingIntent(outboxPersistence, "post-571-4");
    const publisher: FedosBoardOutboxPublisher = { async publish() { return { outcome: "delivered", retryPolicy: "never" }; } };
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 999_999 });
    const observationRepository = {
      record: () => {
        throw new Error("durable write failure");
      },
    } as unknown as FedosValidatingDeliveryObservationRepository;

    let handler: (() => void) | null = null;
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository,
      intervalMs: 1000,
      setIntervalFn: (h) => {
        handler = h;
        return "handle";
      },
      clearIntervalFn: () => {
        handler = null;
      },
    });

    controller.start();
    handler!();
    await Promise.resolve();
    await expect(controller.stop()).resolves.toBeUndefined();
    expect(controller.isRunning()).toBe(false);
  });
});

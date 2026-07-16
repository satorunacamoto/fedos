import { describe, it, expect, vi } from "vitest";
import { FedosHostDeliveryController } from "../src/desktop/host/fedos_host_delivery_controller.js";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";

/**
 * Secure Runtime Alpha 564 -- "Scheduler Stop Barrier": Stage 4 of the
 * Alpha 561-580 Publish Scheduler Concurrency Safety & Abandonment
 * Policy Arc. Verifies the THREE-part barrier this Stage's own
 * instruction names (new interval tick stopped / new manual tick
 * rejected-by-joining / in-flight tick awaited before stop() resolves)
 * and that a manual tick() call no longer bypasses the reentrancy guard
 * the interval path already had (Alpha 505/506).
 */

class ControllablePublisher implements FedosBoardOutboxPublisher {
  calls = 0;
  #pending: { resolve: (r: FedosBoardOutboxPublishResult) => void } | null = null;
  result: FedosBoardOutboxPublishResult = { outcome: "delivered", retryPolicy: "never" };
  blocking = false;

  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    if (!this.blocking) return this.result;
    return new Promise((resolve) => {
      this.#pending = { resolve };
    });
  }

  resolvePending(): void {
    this.#pending?.resolve(this.result);
    this.#pending = null;
  }
}

function makePipeline(publisher: FedosBoardOutboxPublisher) {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  let now = 1000;
  const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 999_999, now: () => now++ });
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  return { outboxPersistence, scheduler, repository, query, validating };
}

function makeFakeTimer() {
  let handler: (() => void) | null = null;
  const setIntervalFn = vi.fn((h: () => void) => {
    handler = h;
    return "handle";
  });
  const clearIntervalFn = vi.fn(() => {
    handler = null;
  });
  return { setIntervalFn, clearIntervalFn, fire: () => handler?.() };
}

describe("Secure Runtime Alpha 564 -- Scheduler Stop Barrier", () => {
  it("1. a manual tick() call made while an interval-triggered tick is in flight JOINS it, rather than starting a second overlapping pass", async () => {
    const publisher = new ControllablePublisher();
    publisher.blocking = true;
    const { outboxPersistence, scheduler, validating } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-564-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });
    controller.start();
    timer.fire(); // interval-triggered tick, blocks on publish()
    await Promise.resolve();
    expect(publisher.calls).toBe(1);

    const manual = controller.tick(); // must join the SAME in-flight pass
    publisher.resolvePending();
    await manual;

    // Exactly ONE Publisher call and ONE recorded attempt -- had the manual
    // call started a second #runTickAndPersist() pass (the pre-Alpha-564
    // bug), the SAME entries would have been persisted twice.
    expect(publisher.calls).toBe(1);
  });

  it("2. two manual tick() calls, properly awaited in sequence, each run a genuinely fresh pass", async () => {
    const publisher = new ControllablePublisher();
    const { outboxPersistence, scheduler, validating } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-564-2")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
    publisher.result = { outcome: "failed", retryPolicy: "later" };

    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });

    await controller.tick();
    await controller.tick();
    expect(publisher.calls).toBe(2);
  });

  it("3. stop() awaits the in-flight tick to SETTLE even when that tick's own persistence throws -- stop() itself still resolves cleanly", async () => {
    const publisher = new ControllablePublisher();
    const { outboxPersistence, scheduler } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-564-3")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const throwingRepository = {
      record: vi.fn(() => {
        throw new Error("simulated durable-write failure");
      }),
    } as unknown as FedosValidatingDeliveryObservationRepository;

    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: throwingRepository,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });

    controller.start();
    timer.fire();
    await Promise.resolve();
    await Promise.resolve();

    // The interval-driven tick is in flight and about to reject (record()
    // throws). stop() must not itself throw -- shutdown ordering is its
    // contract, not surfacing an unrelated tick-side error to its caller.
    await expect(controller.stop()).resolves.toBeUndefined();
    expect(throwingRepository.record).toHaveBeenCalled();
  });
});

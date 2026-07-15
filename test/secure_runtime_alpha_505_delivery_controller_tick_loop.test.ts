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
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { makeFedosDeliveryAttemptSubjectId } from "../src/board/observation/fedos_delivery_attempt_subject_id.js";

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

function makeFakeTimer() {
  let handler: (() => void) | null = null;
  const setIntervalFn = vi.fn((h: () => void) => {
    handler = h;
    return "handle";
  });
  const clearIntervalFn = vi.fn(() => {
    handler = null;
  });
  return {
    setIntervalFn,
    clearIntervalFn,
    fire: () => handler?.(),
  };
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

describe("Secure Runtime Alpha 505 -- Delivery Controller Tick Loop", () => {
  it("start() throws if already running", () => {
    const publisher = new ControllablePublisher();
    const { scheduler, validating } = makePipeline(publisher);
    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });
    controller.start();
    expect(() => controller.start()).toThrow(/stopped state/);
  });

  it("does not tick immediately -- only when the interval fires", async () => {
    const publisher = new ControllablePublisher();
    const { scheduler, validating } = makePipeline(publisher);
    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });
    controller.start();
    expect(publisher.calls).toBe(0);
  });

  it("a fired interval drives scheduler.tick() and persists observations bridged from its own result", async () => {
    const publisher = new ControllablePublisher();
    const { outboxPersistence, scheduler, query, validating } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-505")!;
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
    timer.fire();
    // Allow the async tick chain to settle.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(publisher.calls).toBe(1);
    // Ripple (Alpha 531, Alpha 521-540 Durable Delivery Retry Coordination
    // Arc): observations are now recorded under an ATTEMPT-SCOPED subject
    // id (Alpha 525/529), not the flat original subject id directly -- the
    // fix for the "invalid-transition"-on-retry collision Alpha 514 found.
    // Attempt 1 of a subject with no prior attempts is deterministically
    // `${subjectId}::attempt::1`.
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const attemptSubjectId = makeFedosDeliveryAttemptSubjectId(subjectId, 1)!;
    const history = query.historyFor(attemptSubjectId);
    expect(history.map((o) => o.state)).toEqual(["publishing", "accepted"]);
  });

  it("reentrancy guard: a second interval firing while a tick is still in flight is skipped, not queued", async () => {
    const publisher = new ControllablePublisher();
    publisher.blocking = true;
    const { outboxPersistence, scheduler, validating } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-505-guard")!;
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
    timer.fire(); // starts a tick that will block on publisher.publish()
    await new Promise((r) => setTimeout(r, 0));
    expect(publisher.calls).toBe(1);

    timer.fire(); // should be a no-op -- a tick is still in flight
    await new Promise((r) => setTimeout(r, 0));
    expect(publisher.calls).toBe(1);

    publisher.resolvePending();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(publisher.calls).toBe(1);
  });

  it("isRunning() reflects start()/the reentrancy state accurately", () => {
    const publisher = new ControllablePublisher();
    const { scheduler, validating } = makePipeline(publisher);
    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });
    expect(controller.isRunning()).toBe(false);
    controller.start();
    expect(controller.isRunning()).toBe(true);
  });
});

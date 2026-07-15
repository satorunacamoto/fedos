import { describe, it, expect } from "vitest";
import { FedosHostDeliveryController } from "../src/desktop/host/fedos_host_delivery_controller.js";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { FedosDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_repository.js";
import { FedosDeliveryObservationQuery } from "../src/board/observation/fedos_delivery_observation_query.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_529_controller_retry_rewiring.md?raw";

class FailNTimesThenSucceedPublisher implements FedosBoardOutboxPublisher {
  #remainingFailures: number;
  calls = 0;
  constructor(failuresBeforeSuccess: number) {
    this.#remainingFailures = failuresBeforeSuccess;
  }
  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    if (this.#remainingFailures > 0) {
      this.#remainingFailures--;
      return { outcome: "failed", retryPolicy: "later" };
    }
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

function makePipeline(publisher: FedosBoardOutboxPublisher) {
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  // A deterministic, strictly-increasing clock -- the real Date.now() can
  // tie two observations (e.g. publishing/terminal) to the same
  // millisecond in fast synchronous test execution, and
  // FedosDeliveryObservationQuery.historyFor()'s own tie-break (Alpha 467,
  // unchanged) sorts by id on a tie, which can misreport "current state"
  // in that narrow window. Real production I/O naturally separates these
  // in time; this injected clock makes the test deterministic regardless.
  let now = 1000;
  const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 999_999, now: () => now++ });
  const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
  const query = new FedosDeliveryObservationQuery(repository);
  const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
  const controller = new FedosHostDeliveryController({ scheduler, observationRepository: validating, intervalMs: 1000 });
  return { outboxPersistence, controller, retryQuery: new FedosDeliveryRetryQuery(query) };
}

describe("Secure Runtime Alpha 529 -- Controller Retry Rewiring", () => {
  it("a single successful attempt (no prior failure) records exactly one final, accepted attempt -- zero invalid-transition collisions", async () => {
    const publisher = new FailNTimesThenSucceedPublisher(0);
    const { outboxPersistence, controller, retryQuery } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-accept")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await controller.tick();

    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(history[0]!.state).toBe("accepted");
    expect(history[0]!.isFinal).toBe(true);
  });

  it("failed then retried then accepted (two ticks, two attempts): no invalid-transition, history grows correctly", async () => {
    const publisher = new FailNTimesThenSucceedPublisher(1);
    const { outboxPersistence, controller, retryQuery } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-retry-once")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;

    await controller.tick(); // attempt 1: fails
    let history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ attemptNumber: 1, state: "failed", isFinal: false });

    await controller.tick(); // attempt 2: succeeds
    history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ attemptNumber: 1, state: "failed", isFinal: false });
    expect(history[1]).toMatchObject({ attemptNumber: 2, state: "accepted", isFinal: true });
    expect(retryQuery.currentStateFor(subjectId)).toEqual(history[1]);
  });

  it("a longer retry chain (three failures then success, four ticks/attempts): every attempt recorded, none rejected, only the last is final", async () => {
    const publisher = new FailNTimesThenSucceedPublisher(3);
    const { outboxPersistence, controller, retryQuery } = makePipeline(publisher);
    const postId = toFedosBoardPostId("post-retry-chain")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;

    for (let i = 0; i < 4; i++) {
      await controller.tick();
    }

    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(4);
    expect(history.map((a) => a.attemptNumber)).toEqual([1, 2, 3, 4]);
    expect(history.map((a) => a.state)).toEqual(["failed", "failed", "failed", "accepted"]);
    expect(history.map((a) => a.isFinal)).toEqual([false, false, false, true]);
    expect(publisher.calls).toBe(4);
  });

  it("a permanently abandoned intent (retryPolicy never after failure) is recorded as final failed, never retried again", async () => {
    class AlwaysRejectFinalPublisher implements FedosBoardOutboxPublisher {
      async publish(): Promise<FedosBoardOutboxPublishResult> {
        return { outcome: "rejected", retryPolicy: "never" };
      }
    }
    const { outboxPersistence, controller, retryQuery } = makePipeline(new AlwaysRejectFinalPublisher());
    const postId = toFedosBoardPostId("post-abandoned")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;

    await controller.tick();
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ attemptNumber: 1, state: "rejected", isFinal: true });

    // A second tick: the Scheduler itself never re-attempts an abandoned intent (Alpha 476, unchanged).
    await controller.tick();
    expect(retryQuery.historyFor(subjectId)).toHaveLength(1);
  });

  it("the doc honestly documents the same-millisecond tie-break edge case found during verification", () => {
    expect(doc).toMatch(/PRE-EXISTING property of Alpha 467's own\s*\n?\s*tie-break rule/);
  });
});

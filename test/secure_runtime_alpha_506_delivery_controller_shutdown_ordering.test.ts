import { describe, it, expect } from "vitest";
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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/desktop/host/fedos_host_delivery_controller.ts?raw";

class BlockingPublisher implements FedosBoardOutboxPublisher {
  calls = 0;
  #pending: { resolve: (r: FedosBoardOutboxPublishResult) => void } | null = null;

  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    return new Promise((resolve) => {
      this.#pending = { resolve };
    });
  }

  resolvePending(): void {
    this.#pending?.resolve({ outcome: "delivered", retryPolicy: "never" });
    this.#pending = null;
  }
}

function makeFakeTimer() {
  let handler: (() => void) | null = null;
  return {
    setIntervalFn: (h: () => void) => {
      handler = h;
      return "handle";
    },
    clearIntervalFn: () => {
      handler = null;
    },
    fire: () => handler?.(),
  };
}

describe("Secure Runtime Alpha 506 -- Delivery Controller Shutdown Ordering", () => {
  it("stop() throws if not running", async () => {
    const publisher = new BlockingPublisher();
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 999_999 });
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });
    await expect(controller.stop()).rejects.toThrow(/running state/);
  });

  it("stop() does not resolve until an in-flight tick's own publish() call resolves", async () => {
    const publisher = new BlockingPublisher();
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 999_999 });
    const postId = toFedosBoardPostId("post-506")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
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
    await new Promise((r) => setTimeout(r, 0));
    expect(publisher.calls).toBe(1); // tick is now in flight, blocked on publish()

    let stopResolved = false;
    const stopPromise = controller.stop().then(() => {
      stopResolved = true;
    });

    // Give stop() every chance to resolve prematurely if the ordering guarantee were broken.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(stopResolved).toBe(false);

    publisher.resolvePending();
    await stopPromise;
    expect(stopResolved).toBe(true);
  });

  it("after stop() resolves, no further interval firing can start a new tick (interval was cleared first)", async () => {
    const publisher = new BlockingPublisher();
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const scheduler = new FedosPublishScheduler({ outboxPersistence, publisher, intervalMs: 999_999 });
    const repository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const query = new FedosDeliveryObservationQuery(repository);
    const validating = new FedosValidatingDeliveryObservationRepository(repository, query);
    const timer = makeFakeTimer();
    const controller = new FedosHostDeliveryController({
      scheduler,
      observationRepository: validating,
      intervalMs: 1000,
      setIntervalFn: timer.setIntervalFn,
      clearIntervalFn: timer.clearIntervalFn,
    });
    controller.start();
    await controller.stop();
    timer.fire(); // the real setInterval would already be cleared; this fake fire() is a no-op post-clear anyway
    expect(publisher.calls).toBe(0);
    expect(controller.isRunning()).toBe(false);
  });

  it("structural: this.#scheduler.start()/stop() are never called in this file", () => {
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/#scheduler\.start\(\)|#scheduler\.stop\(\)/);
    expect(codeOnly).toMatch(/#scheduler\.tick\(\)/);
  });
});

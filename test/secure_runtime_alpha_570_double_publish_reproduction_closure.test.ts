import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";

/**
 * Secure Runtime Alpha 570 -- "Double-Publish Reproduction Closure":
 * Stage 10 of the Alpha 561-580 Publish Scheduler Concurrency Safety &
 * Abandonment Policy Arc. Re-runs the scenario Alpha 549 proved against
 * the unmodified code (a Publisher call that outlives one interval
 * tick) through the FULL real `FedosDesktopHost` pipeline this time,
 * not the raw `FedosPublishScheduler` alone -- closing the race at the
 * layer a real caller would actually observe it from. Alpha 564's own
 * manual-tick/interval-tick join is covered separately, directly, by
 * `test/secure_runtime_alpha_564_scheduler_stop_barrier.test.ts`.
 */

class SlowPublisher implements FedosBoardOutboxPublisher {
  readonly calls: FedosPersistedBoardOutboxRecordV1[] = [];
  #release: (() => void) | null = null;
  #gate: Promise<void>;

  constructor() {
    this.#gate = new Promise((resolve) => {
      this.#release = resolve;
    });
  }

  release(): void {
    this.#release?.();
  }

  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls.push(record);
    await this.#gate;
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 570 -- Double-Publish Reproduction Closure", () => {
  it("Publisher.publish() outliving one interval tick still calls publish() exactly ONCE for the same intent, through the real Host pipeline", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new SlowPublisher();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 5,
    });

    const postId = toFedosBoardPostId("post-570")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();

    // Let the interval fire and the (gated) Publisher call start.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(publisher.calls).toHaveLength(1);

    // Release the gate -- the in-flight tick can now complete. Prior to
    // this Arc, a second overlapping interval firing during this window
    // would already have produced a second `publish()` call; Alpha 563's
    // single-flight guard makes that structurally impossible now.
    publisher.release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host.stopDelivery();

    expect(publisher.calls).toHaveLength(1);
    expect(publisher.calls[0]!.id).toBe(intent.id);

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const history = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intent.id)!);
    expect(history).toHaveLength(1);

    await host.stop();
  });
});

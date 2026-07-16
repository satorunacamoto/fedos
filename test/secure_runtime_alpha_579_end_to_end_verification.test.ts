import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";

/**
 * Secure Runtime Alpha 579 -- "End-to-End Verification": Stage 19 of
 * the Alpha 561-580 Publish Scheduler Concurrency Safety & Abandonment
 * Policy Arc. Drives the real Host -> Scheduler -> Publisher ->
 * Observation -> Retry Registry pipeline (Alpha 566/568's own
 * `abandonmentPolicy` is exercised separately, at the raw Scheduler
 * level -- `FedosDesktopHost.startDelivery()` does not accept one, by
 * this Arc's own design; see `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`)
 * across the named case groups, composed together in one run, mirroring
 * Alpha 536's own established pattern.
 */

class PerPostOutcomePublisher implements FedosBoardOutboxPublisher {
  readonly #remainingFailures = new Map<string, number>();
  constructor(failuresBeforeSuccessByPostId: ReadonlyMap<string, number>) {
    for (const [postId, count] of failuresBeforeSuccessByPostId) this.#remainingFailures.set(postId, count);
  }
  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    const remaining = this.#remainingFailures.get(record.postId) ?? 0;
    if (remaining > 0) {
      this.#remainingFailures.set(record.postId, remaining - 1);
      return { outcome: "failed", retryPolicy: "later" };
    }
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 579 -- End-to-End Verification", () => {
  it("immediate success / fail-then-retry-then-succeed / rejected(never), composed in one real pipeline run, no cross-contamination", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const postIdA = toFedosBoardPostId("post-579-a")!;
    const postIdB = toFedosBoardPostId("post-579-b")!;
    const postIdC = toFedosBoardPostId("post-579-c")!;

    const publisherAB = new PerPostOutcomePublisher(
      new Map([
        [postIdA, 0],
        [postIdB, 2],
      ]),
    );
    // Wraps A/B's own scripted outcomes and adds a hard "rejected, never" for C.
    const publisher: FedosBoardOutboxPublisher = {
      async publish(record) {
        if (record.postId === postIdC) return { outcome: "rejected", retryPolicy: "never" };
        return publisherAB.publish(record);
      },
    };

    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 10,
    });

    const intentA = createFedosBoardOutboxIntent(postIdA, { protocol: "nostr", destination: null }, 1)!;
    const intentB = createFedosBoardOutboxIntent(postIdB, { protocol: "nostr", destination: null }, 1)!;
    const intentC = createFedosBoardOutboxIntent(postIdC, { protocol: "activitypub", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intentA));
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intentB));
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intentC));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await host.stopDelivery();

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);

    const historyA = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intentA.id)!);
    expect(historyA).toHaveLength(1);
    expect(["publishing", "accepted"]).toContain(historyA[0]!.state);

    const historyB = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intentB.id)!);
    expect(historyB.length).toBeGreaterThanOrEqual(3);
    expect(["publishing", "accepted"]).toContain(historyB[historyB.length - 1]!.state);

    const historyC = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intentC.id)!);
    expect(historyC).toHaveLength(1);
    expect(historyC[0]!.state).toBe("rejected");
    expect(historyC[0]!.isFinal).toBe(true);

    await host.stop();
  });

  it("multiple independent Hosts do not share Scheduler/Controller state -- no cross-Host contamination", async () => {
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };

    const outbox1 = new InMemoryFedosBoardOutboxPersistence();
    const outbox2 = new InMemoryFedosBoardOutboxPersistence();
    const host1 = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence: outbox1,
      publisher,
      deliveryIntervalMs: 10,
    });
    const host2 = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence: outbox2,
      publisher,
      deliveryIntervalMs: 10,
    });

    const intent1 = createFedosBoardOutboxIntent(toFedosBoardPostId("post-579-h1")!, { protocol: "nostr", destination: null }, 1)!;
    const intent2 = createFedosBoardOutboxIntent(toFedosBoardPostId("post-579-h2")!, { protocol: "nostr", destination: null }, 1)!;
    outbox1.putIntent(serializeFedosBoardOutboxIntent(intent1));
    outbox2.putIntent(serializeFedosBoardOutboxIntent(intent2));

    await host1.start();
    await host2.start();
    host1.startDelivery();
    host2.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await host1.stopDelivery();
    await host2.stopDelivery();

    const query1 = new FedosDeliveryRetryQuery(host1.observationQuery()!);
    const query2 = new FedosDeliveryRetryQuery(host2.observationQuery()!);
    expect(query1.historyFor(toFedosDeliveryObservationSubjectId(intent2.id)!)).toHaveLength(0);
    expect(query2.historyFor(toFedosDeliveryObservationSubjectId(intent1.id)!)).toHaveLength(0);
    expect(query1.historyFor(toFedosDeliveryObservationSubjectId(intent1.id)!).length).toBeGreaterThan(0);
    expect(query2.historyFor(toFedosDeliveryObservationSubjectId(intent2.id)!).length).toBeGreaterThan(0);

    await host1.stop();
    await host2.stop();
  });
});

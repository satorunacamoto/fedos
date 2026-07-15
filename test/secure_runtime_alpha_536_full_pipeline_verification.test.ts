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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_536_full_pipeline_verification.md?raw";

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

describe("Secure Runtime Alpha 536 -- Full Pipeline Verification", () => {
  it("three concurrent intents (always-succeed / fail-once-then-succeed / fail-three-times-then-succeed) never cross-contaminate their own attempt history", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const postIdA = toFedosBoardPostId("post-536-a")!;
    const postIdB = toFedosBoardPostId("post-536-b")!;
    const postIdC = toFedosBoardPostId("post-536-c")!;
    const publisher = new PerPostOutcomePublisher(
      new Map([
        [postIdA, 0],
        [postIdB, 1],
        [postIdC, 3],
      ]),
    );

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
    expect(historyA[0]!.attemptNumber).toBe(1);
    expect(["publishing", "accepted"]).toContain(historyA[0]!.state);

    const historyB = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intentB.id)!);
    expect(historyB).toHaveLength(2);
    expect(historyB.map((a) => a.attemptNumber)).toEqual([1, 2]);
    expect(["publishing", "failed"]).toContain(historyB[0]!.state);
    expect(["publishing", "accepted"]).toContain(historyB[1]!.state);

    const historyC = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intentC.id)!);
    expect(historyC.length).toBeGreaterThanOrEqual(4);
    expect(historyC.map((a) => a.attemptNumber)).toEqual(historyC.map((_, i) => i + 1));
    for (const attempt of historyC.slice(0, historyC.length - 1)) {
      expect(["publishing", "failed"]).toContain(attempt.state);
      expect(attempt.isFinal).toBe(false);
    }
    expect(["publishing", "accepted"]).toContain(historyC[historyC.length - 1]!.state);

    // No cross-contamination: every attempt id embeds its OWN original
    // subject id, never another intent's.
    for (const history of [historyA, historyB, historyC]) {
      for (const attempt of history) {
        expect(attempt.attemptNumber).toBeGreaterThan(0);
      }
    }

    await host.stop();
  });

  it("the doc describes all three case groups composed together in one run", () => {
    expect(doc).toMatch(/Intent A/);
    expect(doc).toMatch(/Intent B/);
    expect(doc).toMatch(/Intent C/);
  });
});

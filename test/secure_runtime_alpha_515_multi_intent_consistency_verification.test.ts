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

class PerPostOutcomePublisher implements FedosBoardOutboxPublisher {
  constructor(private readonly acceptedPostId: string) {}
  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    return record.postId === this.acceptedPostId
      ? { outcome: "delivered", retryPolicy: "never" }
      : { outcome: "failed", retryPolicy: "later" };
  }
}

describe("Secure Runtime Alpha 515 -- Multi-Intent Consistency Verification", () => {
  it("two independent intents in the same delivery cycle never cross-contaminate their own Observation history/current state", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const acceptedPostId = toFedosBoardPostId("post-515-accepted")!;
    const failedPostId = toFedosBoardPostId("post-515-failed")!;
    const publisher = new PerPostOutcomePublisher(acceptedPostId);

    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 10,
    });

    const acceptedIntent = createFedosBoardOutboxIntent(acceptedPostId, { protocol: "nostr", destination: null }, 1)!;
    const failedIntent = createFedosBoardOutboxIntent(failedPostId, { protocol: "activitypub", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(acceptedIntent));
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(failedIntent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 55));
    await host.stopDelivery();

    // Ripple (Alpha 531, Alpha 521-540 Durable Delivery Retry Coordination
    // Arc): observations now live under ATTEMPT-SCOPED subject ids
    // (Alpha 525/529) -- FedosDeliveryRetryQuery (Alpha 528) is the
    // canonical way to read by the ORIGINAL subject id, across attempts.
    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const acceptedSubject = toFedosDeliveryObservationSubjectId(acceptedIntent.id)!;
    const failedSubject = toFedosDeliveryObservationSubjectId(failedIntent.id)!;

    // The accepted intent is delivered on its FIRST attempt (retryPolicy
    // "never") -- exactly one attempt. Real-clock same-millisecond
    // tie-break risk (Alpha 529's own documented edge case) means this
    // one attempt's own reported state can be "publishing" or "accepted"
    // depending on timing; either is consistent with "exactly one attempt
    // exists and it is not a failure".
    const acceptedHistory = retryQuery.historyFor(acceptedSubject);
    expect(acceptedHistory).toHaveLength(1);
    expect(acceptedHistory[0]!.attemptNumber).toBe(1);
    expect(["publishing", "accepted"]).toContain(acceptedHistory[0]!.state);

    // The failed intent keeps retrying (retryPolicy "later") across the
    // whole window -- every attempt recorded, none final, none
    // cross-contaminated with the accepted subject's own history.
    const failedHistory = retryQuery.historyFor(failedSubject);
    expect(failedHistory.length).toBeGreaterThan(0);
    for (const attempt of failedHistory) {
      expect(["publishing", "failed"]).toContain(attempt.state);
      expect(attempt.isFinal).toBe(false);
    }
    expect(failedHistory.map((a) => a.attemptNumber)).toEqual(failedHistory.map((_, i) => i + 1));

    expect(retryQuery.currentStateFor(acceptedSubject)).toEqual(acceptedHistory[0]);
    expect(retryQuery.currentStateFor(failedSubject)).toEqual(failedHistory[failedHistory.length - 1]);

    expect(host.deliveryStatus()).toEqual({ running: false });

    await host.stop();
  });
});

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

    const query = host.observationQuery()!;
    const acceptedSubject = toFedosDeliveryObservationSubjectId(acceptedIntent.id)!;
    const failedSubject = toFedosDeliveryObservationSubjectId(failedIntent.id)!;

    const acceptedHistory = query.historyFor(acceptedSubject);
    const failedHistory = query.historyFor(failedSubject);

    expect(new Set(acceptedHistory.map((o) => o.state))).toEqual(new Set(["publishing", "accepted"]));
    expect(new Set(failedHistory.map((o) => o.state))).toEqual(new Set(["publishing", "failed"]));

    // Cross-contamination check: neither subject's history contains an
    // observation belonging to the other.
    for (const o of acceptedHistory) expect(o.subjectId).toBe(acceptedSubject);
    for (const o of failedHistory) expect(o.subjectId).toBe(failedSubject);

    // Current State always agrees with History's own last entry, by
    // construction (Alpha 467, unchanged) -- the "all agree" requirement,
    // independent of the real-clock same-millisecond tie-break risk
    // Alpha 510's own test already documents.
    expect(query.currentStateFor(acceptedSubject)).toEqual(acceptedHistory[acceptedHistory.length - 1]);
    expect(query.currentStateFor(failedSubject)).toEqual(failedHistory[failedHistory.length - 1]);
    expect(["accepted", "publishing"]).toContain(query.currentStateFor(acceptedSubject)?.state);
    expect(["failed", "publishing"]).toContain(query.currentStateFor(failedSubject)?.state);

    expect(host.deliveryStatus()).toEqual({ running: false });

    await host.stop();
  });
});

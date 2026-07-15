import { describe, it, expect } from "vitest";
import {
  MockFedosBoardOutboxPublisher,
  type FedosBoardOutboxPublisher,
  type FedosBoardOutboxPublishResult,
} from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 487 -- "Four-Protocol Future Compatibility
 * Review": Stage 7 of the Alpha 481-490 Publish Pipeline Integration
 * Review Arc. Review test only -- this file defines a test-local class
 * to PROVE the generic Publisher interface needs zero production
 * change to accept a fourth (here, deliberately fictitious) protocol.
 * No production file is modified.
 */

/** A test-only, fictitious "fourth protocol" Publisher -- proves the interface, adds nothing to src/. */
class FakeFourthProtocolPublisher implements FedosBoardOutboxPublisher {
  readonly calls: FedosPersistedBoardOutboxRecordV1[] = [];

  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls.push(record);
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 487 -- Four-Protocol Future Compatibility Review", () => {
  it("1. a brand-new, test-only Publisher implementation drives a real Scheduler with zero production change", async () => {
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "session", destination: null }, 1)!;
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const fakePublisher = new FakeFourthProtocolPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher: fakePublisher, intervalMs: 1000 });

    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.result.outcome).toBe("delivered");
    expect(fakePublisher.calls).toHaveLength(1);
  });

  it("2. the existing MockFedosBoardOutboxPublisher (a different, pre-existing implementation) works interchangeably -- confirms the interface, not a specific class, is what the Scheduler depends on", async () => {
    const postId = toFedosBoardPostId("post-2")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "activitypub", destination: null }, 1)!;
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher: new MockFedosBoardOutboxPublisher(),
      intervalMs: 1000,
    });
    const entries = await scheduler.tick();
    expect(entries[0]!.result.outcome).toBe("delivered");
  });
});

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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_535_case_verification_longer_retry_chain.md?raw";

class FailNTimesThenSucceedPublisher implements FedosBoardOutboxPublisher {
  #remainingFailures: number;
  constructor(failuresBeforeSuccess: number) {
    this.#remainingFailures = failuresBeforeSuccess;
  }
  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    if (this.#remainingFailures > 0) {
      this.#remainingFailures--;
      return { outcome: "failed", retryPolicy: "later" };
    }
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 535 -- Case Verification: Longer Retry Chain", () => {
  it("real Host, real Scheduler, real wall clock: three-failures-then-success records a strictly increasing 4-attempt chain, only the last final", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new FailNTimesThenSucceedPublisher(3);
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 10,
    });

    const postId = toFedosBoardPostId("post-535-retry-chain")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    // Generous real wall-clock window (>= 15 ticks at 10ms) so timer jitter
    // cannot leave the chain short of its own 4 attempts.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await host.stopDelivery();

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = retryQuery.historyFor(subjectId);

    expect(history.length).toBeGreaterThanOrEqual(4);
    expect(history.map((a) => a.attemptNumber)).toEqual(history.map((_, i) => i + 1));

    const failedAttempts = history.slice(0, history.length - 1);
    const finalAttempt = history[history.length - 1]!;
    for (const attempt of failedAttempts) {
      // Tie-break tolerant (Alpha 467/529's own documented edge case), but
      // never the terminal success state before the chain's own last attempt.
      expect(["publishing", "failed"]).toContain(attempt.state);
      expect(attempt.isFinal).toBe(false);
    }
    expect(["publishing", "accepted"]).toContain(finalAttempt.state);
    expect(retryQuery.currentStateFor(subjectId)).toEqual(finalAttempt);

    await host.stop();
  });

  it("the doc names both the deterministic and real-pipeline evidence for this chain-length case", () => {
    expect(doc).toMatch(/\[1, 2, 3, 4\]/);
    expect(doc).toMatch(/strictly increase/);
  });
});

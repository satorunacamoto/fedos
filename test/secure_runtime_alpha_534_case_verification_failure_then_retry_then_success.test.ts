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
import doc from "../docs/secure_runtime_alpha_534_case_verification_failure_then_retry_then_success.md?raw";

class FailOnceThenSucceedPublisher implements FedosBoardOutboxPublisher {
  #failed = false;
  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    if (!this.#failed) {
      this.#failed = true;
      return { outcome: "failed", retryPolicy: "later" };
    }
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 534 -- Case Verification: Failed -> Retry -> Accepted", () => {
  it("real Host, real Scheduler, real wall clock: a fail-once-then-succeed intent records exactly two attempts, in order, none rejected as invalid-transition", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new FailOnceThenSucceedPublisher();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 10,
    });

    const postId = toFedosBoardPostId("post-534-fail-then-succeed")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await host.stopDelivery();

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = retryQuery.historyFor(subjectId);

    expect(history).toHaveLength(2);
    expect(history.map((a) => a.attemptNumber)).toEqual([1, 2]);
    // Tie-break tolerant (Alpha 467/529's own documented edge case), but
    // attempt 1 is never accepted and attempt 2 is never failed -- the
    // FailOnceThenSucceedPublisher's own outcome is unambiguous per attempt.
    expect(["publishing", "failed"]).toContain(history[0]!.state);
    expect(["publishing", "accepted"]).toContain(history[1]!.state);
    expect(history[0]!.isFinal).toBe(false);
    expect(retryQuery.currentStateFor(subjectId)).toEqual(history[1]);

    await host.stop();
  });

  it("the doc names the exact invalid-transition problem this case used to hit, and how attempt-scoping resolves it", () => {
    expect(doc).toMatch(/invalid-transition/);
    expect(doc).toMatch(/failed → publishing/);
  });
});

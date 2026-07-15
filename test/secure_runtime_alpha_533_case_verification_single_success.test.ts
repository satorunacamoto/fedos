import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { MockFedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_533_case_verification_single_success.md?raw";

describe("Secure Runtime Alpha 533 -- Case Verification: Single Success (accepted)", () => {
  it("real Host, real Scheduler, real wall clock: one always-succeeding intent records exactly one non-failed attempt", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new MockFedosBoardOutboxPublisher();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 10,
    });

    const postId = toFedosBoardPostId("post-533-accept")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await host.stopDelivery();

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = retryQuery.historyFor(subjectId);

    expect(history).toHaveLength(1);
    expect(history[0]!.attemptNumber).toBe(1);
    // Tie-break tolerant (Alpha 467/529's own documented edge case): never
    // failed/rejected -- MockFedosBoardOutboxPublisher always succeeds.
    expect(["publishing", "accepted"]).toContain(history[0]!.state);
    expect(retryQuery.currentStateFor(subjectId)).toEqual(history[0]);

    await host.stop();
  });

  it("the doc references the deterministic Alpha 529 evidence for this same case rather than duplicating it", () => {
    expect(doc).toMatch(/attemptNumber: 1, state: "accepted", isFinal: true/);
    expect(doc).toContain("secure_runtime_alpha_529_controller_retry_rewiring.md");
  });
});

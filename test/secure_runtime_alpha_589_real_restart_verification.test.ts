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
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";

/**
 * Secure Runtime Alpha 589 -- "Real Restart Verification": Stage 9 of
 * the Alpha 581-600 Durable Retry Registry & Delivery Recovery Arc.
 * "Real restart," per this repository's own established convention
 * (`docs/secure_runtime_alpha_545_publish_runtime_recovery_audit.md`):
 * construct a BRAND NEW `FedosDesktopHost` instance -- a fresh process
 * would construct a fresh Host the exact same way -- over the SAME
 * injected durable `outboxPersistence`/`observationRepository` backends
 * the FIRST instance used. Neither Host instance shares any in-memory
 * field with the other; only the injected Persistence/Repository
 * objects are shared, exactly as a real process boundary would only
 * share a real durable backend.
 */

function slowDeliveredPublisher(): FedosBoardOutboxPublisher {
  return {
    async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
      await new Promise((resolve) => setTimeout(resolve, 2)); // avoid the Alpha 513/529 millisecond tie
      return { outcome: "delivered", retryPolicy: "never" };
    },
  };
}

describe("Secure Runtime Alpha 589 -- Real Restart Verification", () => {
  it("an intent delivered by the FIRST Host instance is never re-published by a SECOND, freshly-constructed Host instance sharing the same durable backends", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());

    const postId = toFedosBoardPostId("post-589-delivered")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const firstHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: slowDeliveredPublisher(),
      observationRepository,
      deliveryIntervalMs: 5,
    });
    await firstHost.start();
    firstHost.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await firstHost.stopDelivery();
    await firstHost.stop();

    // "Restart": a genuinely NEW FedosDesktopHost instance, a NEW
    // #deliveryRetryRegistry (Alpha 531, unchanged -- that field is
    // per-instance), over the SAME two durable backends above.
    let secondHostCalls = 0;
    const secondHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: {
        async publish(record) {
          secondHostCalls++;
          return { outcome: "delivered", retryPolicy: "never" };
        },
      },
      observationRepository,
      deliveryIntervalMs: 5,
    });
    await secondHost.start();
    secondHost.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await secondHost.stopDelivery();

    expect(secondHostCalls).toBe(0);
    await secondHost.stop();
  });

  it("an intent abandoned by the FIRST Host instance is never re-published by a SECOND, freshly-constructed Host instance", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());

    const postId = toFedosBoardPostId("post-589-abandoned")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const firstHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: {
        async publish() {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return { outcome: "rejected", retryPolicy: "never" };
        },
      },
      observationRepository,
      deliveryIntervalMs: 5,
    });
    await firstHost.start();
    firstHost.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await firstHost.stopDelivery();
    await firstHost.stop();

    let secondHostCalls = 0;
    const secondHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: {
        async publish() {
          secondHostCalls++;
          return { outcome: "delivered", retryPolicy: "never" };
        },
      },
      observationRepository,
      deliveryIntervalMs: 5,
    });
    await secondHost.start();
    secondHost.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await secondHost.stopDelivery();

    expect(secondHostCalls).toBe(0);
    await secondHost.stop();
  });

  it("a still-genuinely-pending intent (mid-retry, not yet terminal) IS re-attempted by a SECOND Host instance -- restart never silently drops real pending work", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());

    const postId = toFedosBoardPostId("post-589-pending")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const firstHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: {
        async publish() {
          await new Promise((resolve) => setTimeout(resolve, 2));
          return { outcome: "failed", retryPolicy: "later" }; // never terminal
        },
      },
      observationRepository,
      deliveryIntervalMs: 5,
    });
    await firstHost.start();
    firstHost.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await firstHost.stopDelivery();
    await firstHost.stop();

    let secondHostCalls = 0;
    const secondHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: {
        async publish() {
          secondHostCalls++;
          return { outcome: "delivered", retryPolicy: "never" };
        },
      },
      observationRepository,
      deliveryIntervalMs: 5,
    });
    await secondHost.start();
    secondHost.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await secondHost.stopDelivery();

    expect(secondHostCalls).toBeGreaterThan(0);
    await secondHost.stop();
  });
});

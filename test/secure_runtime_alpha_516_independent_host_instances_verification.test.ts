import { describe, it, expect } from "vitest";
import { createFedosDesktopHost } from "../src/desktop/host/create_fedos_desktop_host.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";

describe("Secure Runtime Alpha 516 -- Independent Host Instances Verification", () => {
  it("two zero-override Host instances never share Observation Repository state", async () => {
    const outboxA = new InMemoryFedosBoardOutboxPersistence();
    const outboxB = new InMemoryFedosBoardOutboxPersistence();
    const hostA = createFedosDesktopHost({ outboxPersistence: outboxA, deliveryIntervalMs: 10 });
    const hostB = createFedosDesktopHost({ outboxPersistence: outboxB, deliveryIntervalMs: 10 });

    const postId = toFedosBoardPostId("post-516")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxA.putIntent(serializeFedosBoardOutboxIntent(intent));

    await hostA.start();
    await hostB.start();
    hostA.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 55));
    await hostA.stopDelivery();

    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    expect(hostA.observationQuery()!.historyFor(subjectId).length).toBeGreaterThan(0);
    // Host B's own Observation Repository is a completely separate default instance.
    expect(hostB.observationQuery()!.historyFor(subjectId)).toEqual([]);
    expect(hostB.deliveryStatus()).toEqual({ running: false });

    await hostA.stop();
    await hostB.stop();
  });

  it("starting delivery on one instance never starts it on another", async () => {
    const hostA = createFedosDesktopHost({ deliveryIntervalMs: 1000 });
    const hostB = createFedosDesktopHost({ deliveryIntervalMs: 1000 });
    await hostA.start();
    await hostB.start();
    hostA.startDelivery();
    expect(hostA.deliveryStatus()).toEqual({ running: true });
    expect(hostB.deliveryStatus()).toEqual({ running: false });
    await hostA.stopDelivery();
    await hostA.stop();
    await hostB.stop();
  });
});

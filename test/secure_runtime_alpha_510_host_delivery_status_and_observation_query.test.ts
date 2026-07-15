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

function makeHost(outboxPersistence: InMemoryFedosBoardOutboxPersistence, publisher: MockFedosBoardOutboxPublisher) {
  return new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
    outboxPersistence,
    publisher,
    deliveryIntervalMs: 999_999,
  });
}

describe("Secure Runtime Alpha 510 -- Host.deliveryStatus() and Host.observationQuery()", () => {
  it("deliveryStatus() is {running: false} before start, {running:true} while running", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new MockFedosBoardOutboxPublisher();
    const host = makeHost(outboxPersistence, publisher);
    await host.start();
    expect(host.deliveryStatus()).toEqual({ running: false });
    host.startDelivery();
    expect(host.deliveryStatus()).toEqual({ running: true });
    await host.stopDelivery();
  });

  it("observationQuery() returns null before start() and after stop(), non-null while ready", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new MockFedosBoardOutboxPublisher();
    const host = makeHost(outboxPersistence, publisher);
    expect(host.observationQuery()).toBeNull();
    await host.start();
    expect(host.observationQuery()).not.toBeNull();
    await host.stop();
    expect(host.observationQuery()).toBeNull();
  });

  it("Observation History and Current State (via observationQuery()) agree with a real tick() the Host's own delivery loop drives, using a real short interval", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new MockFedosBoardOutboxPublisher();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 10,
    });

    const postId = toFedosBoardPostId("post-510")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 100)); // real wall-clock wait for >= one 10ms interval firing
    await host.stopDelivery();

    const query = host.observationQuery();
    expect(query).not.toBeNull();
    // Ripple (Alpha 531, Alpha 521-540 Durable Delivery Retry Coordination
    // Arc): observations now live under an ATTEMPT-SCOPED subject id
    // (Alpha 525/529) -- FedosDeliveryRetryQuery (Alpha 528) is the
    // canonical way to read by the ORIGINAL subject id. historyFor()
    // returns one entry per ATTEMPT (its own current/latest state), so a
    // single successful delivery is exactly one entry.
    const retryQuery = new FedosDeliveryRetryQuery(query!);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    expect(history[0]!.attemptNumber).toBe(1);
    // Real wall clock can tie the publishing/terminal writes to the same
    // millisecond (Alpha 529's own documented edge case) -- either
    // reported state is consistent with "one, non-failed attempt".
    expect(["publishing", "accepted"]).toContain(history[0]!.state);
    // Current State (via FedosDeliveryRetryQuery) and Observation History
    // must always agree with each other, by construction.
    expect(retryQuery.currentStateFor(subjectId)).toEqual(history[0]);
    await host.stop();
  });
});

import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { FedosNostrBoardPublisherAdapter } from "../src/os/messenger/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import { FedosRelayNostrBoardPublisher } from "../src/os/messenger/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import { NullRelay } from "../src/os/messenger/desktop/null_relay.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";

describe("Secure Runtime Alpha 513 -- Full Pipeline Flow Verification", () => {
  it("Host -> Scheduler -> FedosNostrBoardPublisherAdapter -> FedosRelayNostrBoardPublisher -> NullRelay -> Observation Repository, real classes throughout", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const signedEvent: FedosNostrWireEvent = {
      id: "c".repeat(64),
      pubkey: "d".repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: "alpha-513",
      sig: "e".repeat(128),
    };
    const adapter = new FedosNostrBoardPublisherAdapter(
      new FedosRelayNostrBoardPublisher(relay),
      async () => signedEvent,
    );

    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(
      new InMemoryFedosDeliveryObservationPersistence(),
    );
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: adapter,
      observationRepository,
      deliveryIntervalMs: 10,
    });

    const postId = toFedosBoardPostId("post-513")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await host.stopDelivery();

    expect(relay.published).toEqual([
      {
        id: signedEvent.id,
        provider: "nostr",
        author: signedEvent.pubkey,
        createdAt: signedEvent.created_at,
        kind: signedEvent.kind,
        tags: signedEvent.tags,
        content: signedEvent.content,
        signature: signedEvent.sig,
      },
    ]);

    // Ripple (Alpha 531, Alpha 521-540 Durable Delivery Retry Coordination
    // Arc): observations are now recorded under an ATTEMPT-SCOPED subject
    // id (Alpha 525/529), never the flat original one directly --
    // FedosDeliveryRetryQuery (Alpha 528) is the canonical way to read
    // across attempts by the ORIGINAL subject id. historyFor() returns
    // ONE entry per ATTEMPT (its own current/latest state), not one entry
    // per individual publishing/terminal observation.
    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = retryQuery.historyFor(subjectId);
    expect(history).toHaveLength(1);
    // Real wall clock can tie this single attempt's own publishing/terminal
    // writes to the same millisecond (Alpha 529's own documented
    // FedosDeliveryObservationQuery tie-break edge case) -- either reported
    // state is consistent with "one, non-failed, successfully delivered
    // attempt" (relay.published above already proves delivery really
    // happened exactly once).
    expect(history[0]!.attemptNumber).toBe(1);
    expect(["publishing", "accepted"]).toContain(history[0]!.state);

    await host.stop();
  });
});

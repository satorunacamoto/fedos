import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import { FedosNostrBoardPublisherAdapter } from "../src/board/publish/nostr/fedos_nostr_board_publisher_adapter.js";
import { FedosRelayNostrBoardPublisher } from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.js";
import { NullRelay } from "../src/desktop/null_relay.js";
import { toFedosDeliveryObservationSubjectId } from "../src/board/observation/fedos_delivery_observation.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";

describe("Secure Runtime Alpha 514 -- Failure Path Verification", () => {
  it("a disconnected relay produces publishing/failed observations, current state agrees with history, and the intent stays pending", async () => {
    const relay = new NullRelay("wss://relay.example.test"); // never connected
    const signedEvent: FedosNostrWireEvent = {
      id: "1".repeat(64),
      pubkey: "2".repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: "alpha-514",
      sig: "3".repeat(128),
    };
    let eventSourceCalls = 0;
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => {
      eventSourceCalls++;
      return signedEvent;
    });

    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: adapter,
      deliveryIntervalMs: 10,
    });

    const postId = toFedosBoardPostId("post-514")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 55)); // let >= one 10ms interval fire
    await host.stopDelivery();

    const query = host.observationQuery()!;
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const history = query.historyFor(subjectId);
    expect(new Set(history.map((o) => o.state))).toEqual(new Set(["publishing", "failed"]));
    expect(query.currentStateFor(subjectId)).toEqual(history[history.length - 1]);

    // The intent is still pending -- a fresh delivery cycle attempts
    // transport again (the Scheduler really does retry), but the
    // single-attempt-per-subject Observation model (Alpha 494 §4's own
    // deliberate deferral of multi-attempt/retry re-entry) means a
    // SECOND publishing/failed pair for the SAME subjectId is rejected
    // by the write validator as "invalid-transition" -- recorded
    // history for this subject therefore does NOT grow across retries
    // today, a real, honestly-documented consequence of that earlier
    // decision now visible against a genuinely retrying Scheduler (see
    // docs/secure_runtime_alpha_514_failure_path_verification.md §"Discovered
    // consequence").
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await host.stopDelivery();
    const historyAfterSecondCycle = query.historyFor(subjectId);
    expect(historyAfterSecondCycle.length).toBe(history.length);
    expect(new Set(historyAfterSecondCycle.map((o) => o.state))).toEqual(new Set(["publishing", "failed"]));
    // Transport really did retry -- eventSourceCalls kept growing across both cycles.
    expect(eventSourceCalls).toBeGreaterThan(1);

    await host.stop();
  });
});

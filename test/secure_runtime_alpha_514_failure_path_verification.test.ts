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
import { toFedosDeliveryObservationSubjectId } from "../src/os/messenger/board/observation/fedos_delivery_observation.js";
import { FedosDeliveryRetryQuery } from "../src/os/messenger/board/observation/fedos_delivery_retry_query.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";

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

    // Ripple (Alpha 531, Alpha 521-540 Durable Delivery Retry Coordination
    // Arc): this test itself is the exact scenario Alpha 514 originally
    // found "invalid-transition" on retry -- now FIXED. FedosDeliveryRetryQuery
    // (Alpha 528) reads across attempts by the ORIGINAL subject id; every
    // attempt this window's own multiple 10ms ticks produced is now
    // recorded, none rejected.
    // NOTE on "publishing" vs "failed" below: this test uses the REAL
    // wall clock (real setTimeout, no injected Scheduler `now()`), so a
    // given attempt's own publishing/terminal pair can share the exact
    // same millisecond -- the SAME known FedosDeliveryObservationQuery
    // tie-break edge case Alpha 529's own doc documents honestly
    // (docs/secure_runtime_alpha_529_controller_retry_rewiring.md
    // §"Honest edge case"). Assertions below are written to be correct
    // regardless of which side of that tie-break any one attempt lands on.
    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const subjectId = toFedosDeliveryObservationSubjectId(intent.id)!;
    const firstWindowHistory = retryQuery.historyFor(subjectId);
    expect(firstWindowHistory.length).toBeGreaterThan(0);
    for (const attempt of firstWindowHistory) {
      expect(["publishing", "failed"]).toContain(attempt.state);
      expect(attempt.isFinal).toBe(false);
    }
    expect(firstWindowHistory.map((a) => a.attemptNumber)).toEqual(
      firstWindowHistory.map((_, i) => i + 1),
    );
    expect(retryQuery.currentStateFor(subjectId)).toEqual(firstWindowHistory[firstWindowHistory.length - 1]);

    // The intent is still pending -- a fresh delivery cycle attempts
    // transport again for real, and now records MORE attempts, each its
    // own fresh attempt number, continuing the SAME sequence -- the exact
    // fix for the limitation this file's own doc used to describe as
    // unresolved (see docs/secure_runtime_alpha_529_controller_retry_rewiring.md).
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await host.stopDelivery();
    const historyAfterSecondCycle = retryQuery.historyFor(subjectId);
    expect(historyAfterSecondCycle.length).toBeGreaterThan(firstWindowHistory.length);
    for (const attempt of historyAfterSecondCycle) {
      expect(["publishing", "failed"]).toContain(attempt.state);
    }
    expect(historyAfterSecondCycle.map((a) => a.attemptNumber)).toEqual(
      historyAfterSecondCycle.map((_, i) => i + 1),
    );
    // Transport really did retry -- eventSourceCalls kept growing across both cycles.
    expect(eventSourceCalls).toBeGreaterThan(1);
    expect(eventSourceCalls).toBe(historyAfterSecondCycle.length);

    await host.stop();
  });
});

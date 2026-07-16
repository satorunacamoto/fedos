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
import { FedosDeliveryRetryQuery } from "../src/board/observation/fedos_delivery_retry_query.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";

/**
 * Secure Runtime Alpha 575 -- "Nostr Adapter Verification": Stage 15
 * of the Alpha 561-580 Publish Scheduler Concurrency Safety &
 * Abandonment Policy Arc. Confirms the single-flight guard (Alpha 563)
 * holds through the REAL Nostr Adapter (not a mock), and that the
 * Scheduler still imports nothing Nostr-specific (Alpha 486, unchanged
 * boundary, re-confirmed here after this Arc's own edits).
 */

describe("Secure Runtime Alpha 575 -- Nostr Adapter Verification", () => {
  it("Host -> Scheduler (single-flight) -> FedosNostrBoardPublisherAdapter -> FedosRelayNostrBoardPublisher -> NullRelay -- exactly one publish, real classes throughout", async () => {
    const relay = new NullRelay("wss://relay.example.test");
    await relay.connect();
    const signedEvent: FedosNostrWireEvent = {
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 1,
      kind: 1,
      tags: [],
      content: "alpha-575",
      sig: "c".repeat(128),
    };
    const adapter = new FedosNostrBoardPublisherAdapter(new FedosRelayNostrBoardPublisher(relay), async () => signedEvent);

    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher: adapter,
      deliveryIntervalMs: 5,
    });

    const postId = toFedosBoardPostId("post-575")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 40));
    await host.stopDelivery();

    expect(relay.published).toHaveLength(1);

    const retryQuery = new FedosDeliveryRetryQuery(host.observationQuery()!);
    const history = retryQuery.historyFor(toFedosDeliveryObservationSubjectId(intent.id)!);
    expect(history).toHaveLength(1);
    expect(["publishing", "accepted"]).toContain(history[0]!.state);

    await host.stop();
  });

  it("FedosPublishScheduler.ts still imports nothing Nostr-specific -- the abandonment-policy addition (Alpha 566/568) did not weaken this boundary", () => {
    const codeOnly = (schedulerSource as string)
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/nostr|WebSocket|new FedosRelay/i);
    const importLines = codeOnly.split("\n").filter((line: string) => line.trim().startsWith("import"));
    for (const line of importLines) {
      const match = line.match(/from ["']([^"']+)["']/);
      if (match === null) continue;
      expect(match[1]).toMatch(/^\.\/fedos_board_outbox_/);
    }
  });
});

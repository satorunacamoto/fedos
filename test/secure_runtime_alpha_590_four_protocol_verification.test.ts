import { describe, it, expect } from "vitest";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent, FEDOS_BOARD_OUTBOUND_PROTOCOLS } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
import { FedosDeliveryObservationQuery } from "../src/os/messenger/board/observation/fedos_delivery_observation_query.js";
import { FedosValidatingDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_write_validator.js";
import { FedosDeliveryRetryRegistry } from "../src/os/messenger/board/observation/fedos_delivery_retry_registry.js";
import { FedosHostDeliveryController } from "../src/os/messenger/desktop/host/fedos_host_delivery_controller.js";
import { createFedosDeliveryScheduler } from "../src/os/messenger/desktop/host/fedos_delivery_recovery_hydration.js";

/**
 * Secure Runtime Alpha 590 -- "Four-Protocol Verification": Stage 10
 * of the Alpha 581-600 Durable Retry Registry & Delivery Recovery Arc.
 * Confirms recovery hydration is genuinely protocol-neutral across
 * every `FedosBoardOutboundProtocol` this repository defines
 * (`nostr`/`activitypub`/`atproto`/`session`,
 * `src/board/outbox/fedos_board_outbox_types.ts`, unchanged) -- no
 * branch anywhere in the hydration/recovery path reads `target.protocol`
 * at all (re-confirmed structurally in Alpha 591-599's own regression
 * review).
 */

describe("Secure Runtime Alpha 590 -- Four-Protocol Verification", () => {
  it(`exactly ${FEDOS_BOARD_OUTBOUND_PROTOCOLS.length} protocols are exercised, one intent per protocol, all four recovering correctly across a simulated restart`, async () => {
    expect(FEDOS_BOARD_OUTBOUND_PROTOCOLS).toEqual(["nostr", "activitypub", "atproto", "session"]);

    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const retryRegistry = new FedosDeliveryRetryRegistry();

    const intents = FEDOS_BOARD_OUTBOUND_PROTOCOLS.map((protocol, i) => {
      const postId = toFedosBoardPostId(`post-590-${protocol}`)!;
      const intent = createFedosBoardOutboxIntent(postId, { protocol, destination: null }, 1)!;
      outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));
      return { protocol, intent, index: i };
    });

    // Cycle 1: nostr/activitypub deliver; atproto is rejected forever
    // (abandoned); session stays genuinely pending ("later" always).
    const outcomeByProtocol: Record<string, FedosBoardOutboxPublishResult> = {
      nostr: { outcome: "delivered", retryPolicy: "never" },
      activitypub: { outcome: "delivered", retryPolicy: "never" },
      atproto: { outcome: "rejected", retryPolicy: "never" },
      session: { outcome: "failed", retryPolicy: "later" },
    };
    const callsByProtocol: Record<string, number> = { nostr: 0, activitypub: 0, atproto: 0, session: 0 };
    const publisher1: FedosBoardOutboxPublisher = {
      async publish(record: FedosPersistedBoardOutboxRecordV1) {
        const found = intents.find((e) => e.intent.id === record.id)!;
        callsByProtocol[found.protocol]!++;
        await new Promise((resolve) => setTimeout(resolve, 2)); // avoid the Alpha 513/529 millisecond tie
        return outcomeByProtocol[found.protocol]!;
      },
    };

    const scheduler1 = createFedosDeliveryScheduler({
      outboxPersistence,
      publisher: publisher1,
      intervalMs: 1000,
      observationRepository,
      retryRegistry,
    });
    const query1 = new FedosDeliveryObservationQuery(observationRepository);
    const controller1 = new FedosHostDeliveryController({
      scheduler: scheduler1,
      observationRepository: new FedosValidatingDeliveryObservationRepository(observationRepository, query1),
      intervalMs: 1000,
      retryRegistry,
    });
    await controller1.tick();

    expect(callsByProtocol.nostr).toBe(1);
    expect(callsByProtocol.activitypub).toBe(1);
    expect(callsByProtocol.atproto).toBe(1);
    expect(callsByProtocol.session).toBe(1);

    // "Restart": a genuinely fresh Scheduler (mirroring what a NEW
    // startDelivery() call, or a real process restart, both produce),
    // re-hydrated from the SAME durable observationRepository/retryRegistry.
    const callsByProtocol2: Record<string, number> = { nostr: 0, activitypub: 0, atproto: 0, session: 0 };
    const publisher2: FedosBoardOutboxPublisher = {
      async publish(record: FedosPersistedBoardOutboxRecordV1) {
        const found = intents.find((e) => e.intent.id === record.id)!;
        callsByProtocol2[found.protocol]!++;
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const scheduler2 = createFedosDeliveryScheduler({
      outboxPersistence,
      publisher: publisher2,
      intervalMs: 1000,
      observationRepository,
      retryRegistry,
    });
    const query2 = new FedosDeliveryObservationQuery(observationRepository);
    const controller2 = new FedosHostDeliveryController({
      scheduler: scheduler2,
      observationRepository: new FedosValidatingDeliveryObservationRepository(observationRepository, query2),
      intervalMs: 1000,
      retryRegistry,
    });
    await controller2.tick();

    // nostr/activitypub: already delivered -- never re-published.
    expect(callsByProtocol2.nostr).toBe(0);
    expect(callsByProtocol2.activitypub).toBe(0);
    // atproto: already abandoned -- never re-published.
    expect(callsByProtocol2.atproto).toBe(0);
    // session: genuinely still pending -- correctly re-attempted.
    expect(callsByProtocol2.session).toBe(1);
  });

  it("hydration never reads target.protocol -- structurally confirmed, not just behaviorally", async () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const hydrationSource = (await import("../src/os/messenger/desktop/host/fedos_delivery_recovery_hydration.ts?raw")).default as string;
    const codeOnly = hydrationSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.protocol\b/);
    expect(codeOnly).not.toMatch(/nostr|activitypub|atproto|session/i);
  });
});

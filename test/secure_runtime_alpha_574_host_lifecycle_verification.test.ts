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

/**
 * Secure Runtime Alpha 574 -- "Host Lifecycle Verification": Stage 14
 * of the Alpha 561-580 Publish Scheduler Concurrency Safety &
 * Abandonment Policy Arc. Confirms `FedosDesktopHost.startDelivery()`/
 * `stopDelivery()`/`Host.stop()` still honor their own, pre-existing
 * lifecycle semantics (Alpha 505/506/510) with the Alpha 563/564
 * single-flight guard now underneath them -- this Arc changed
 * `FedosPublishScheduler`/`FedosHostDeliveryController` internals only,
 * never `FedosDesktopHost` itself.
 */

class SlowPublisher implements FedosBoardOutboxPublisher {
  calls = 0;
  #release: (() => void) | null = null;
  #gate: Promise<void>;
  constructor() {
    this.#gate = new Promise((resolve) => {
      this.#release = resolve;
    });
  }
  release(): void {
    this.#release?.();
  }
  async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls++;
    await this.#gate;
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 574 -- Host Lifecycle Verification", () => {
  it("Host.stop() does not resolve before an in-flight delivery tick completes -- no new Publish after stop, deliveryStatus() reports correctly", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher = new SlowPublisher();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 5,
    });

    const postId = toFedosBoardPostId("post-574")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    await host.start();
    host.startDelivery();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(publisher.calls).toBe(1);

    // stopDelivery() must not resolve before the in-flight tick (still
    // gated) completes -- released here, deliberately, WHILE the await
    // below is pending, to prove the ordering rather than assuming it.
    const stopping = host.stopDelivery();
    let stopped = false;
    void stopping.then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stopped).toBe(false); // still gated -- stopDelivery() has not resolved yet

    publisher.release();
    await stopping;
    expect(stopped).toBe(true);

    expect(host.deliveryStatus()).toEqual({ running: false });
    expect(publisher.calls).toBe(1); // no further Publish after the gate released post-stop

    await host.stop();
  });

  it("startDelivery()/stopDelivery() may be cycled repeatedly without wedging, and no longer re-attempts already-delivered intents (Secure Runtime Alpha 586, Alpha 581-600 Arc)", async () => {
    // `startDelivery()` (Alpha 505, unchanged) still constructs a BRAND
    // NEW `FedosPublishScheduler` every call -- but Secure Runtime
    // Alpha 586 (Alpha 581-600 Durable Retry Registry & Delivery
    // Recovery Arc) now hydrates that fresh Scheduler's own
    // `#delivered` (Alpha 476) from the Host-owned, durable Observation
    // history BEFORE it starts ticking (`createFedosDeliveryScheduler()`,
    // `fedos_delivery_recovery_hydration.ts`), closing exactly the
    // "in-memory, restart-loses-state" characteristic Alpha 573/574
    // originally found and documented as an honest limitation.
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    let calls = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        calls++;
        // A tiny real delay -- without it, the Controller's own
        // "attempt-started"/terminal writes for the SAME attempt (Alpha
        // 529) can land in the SAME Date.now() millisecond, and
        // FedosDeliveryObservationQuery's own documented id-based
        // tie-break (Alpha 513's own comment: "Real wall clock can tie
        // this single attempt's own publishing/terminal writes to the
        // same millisecond") can then report "publishing" as the
        // latest state instead of "accepted" -- itself harmless (Alpha
        // 586's own hydration fails closed toward an extra safe retry,
        // never toward a false "delivered"), but it makes THIS test's
        // own exact call count nondeterministic. A real Publisher never
        // resolves in literally 0ms, so this delay also matches real
        // conditions more closely than an instant mock would.
        await new Promise((resolve) => setTimeout(resolve, 2));
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
      publisher,
      deliveryIntervalMs: 5,
    });

    await host.start();
    for (let i = 0; i < 3; i++) {
      const postId = toFedosBoardPostId(`post-574-cycle-${i}`)!;
      const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
      outboxPersistence.putIntent(serializeFedosBoardOutboxIntent(intent));

      host.startDelivery();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await host.stopDelivery();
    }

    // Before Alpha 586: 1 + 2 + 3 = 6 calls (each cycle re-attempted
    // every prior cycle's own already-delivered intent). After Alpha
    // 586: exactly 3 -- one per cycle, its own new intent only.
    expect(calls).toBe(3);
    await host.stop();
  });
});

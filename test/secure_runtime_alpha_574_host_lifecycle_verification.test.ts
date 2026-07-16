import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";

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

  it("startDelivery()/stopDelivery() may be cycled repeatedly without wedging -- but each cycle's fresh Scheduler re-attempts EVERY still-present Outbox intent, including already-delivered ones (a pre-existing characteristic, not introduced or fixed by this Arc)", async () => {
    // `startDelivery()` (Alpha 505, unchanged) constructs a BRAND NEW
    // `FedosPublishScheduler` every call; `#delivered` (Alpha 476) is
    // in-memory, per-instance, and `FedosBoardOutboxPersistence` itself
    // is append-only (`InMemoryFedosBoardOutboxPersistence` has no
    // removal method) -- so a fresh Scheduler has no memory of a PRIOR
    // Scheduler instance's own delivered set and re-attempts every
    // intent still present in the Outbox. Confirmed here by real
    // execution, not assumed: this is exactly the same "in-memory,
    // restart-loses-state" characteristic Alpha 573 evaluates for retry/
    // abandonment tracking, now shown to also apply to "delivered"
    // itself across a startDelivery()/stopDelivery() cycle.
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    let calls = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish() {
        calls++;
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

    // Cycle 1 sees 1 pending intent, cycle 2 sees 2 (cycle 1's own intent
    // is STILL "pending" from a fresh Scheduler's own perspective), cycle
    // 3 sees 3: 1 + 2 + 3 = 6, not 3 -- proving the fresh-Scheduler
    // re-attempt characteristic above by real, counted execution.
    expect(calls).toBe(6);
    await host.stop();
  });
});

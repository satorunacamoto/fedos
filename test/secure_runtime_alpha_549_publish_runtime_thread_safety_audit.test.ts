import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";

/**
 * Secure Runtime Alpha 549 -- "Thread Safety Audit": Stage 9 of the
 * Alpha 541-560 Publish Runtime Operational Review Arc. Review test
 * only -- proves the double-publish interleaving risk by REAL
 * execution against the unmodified FedosPublishScheduler, using a
 * publisher whose publish() call is held open under test control
 * until both overlapping tick() calls have started.
 */

/** A Publisher whose publish() does not resolve until the test explicitly releases it -- lets the test force two tick() calls to overlap. */
class SlowPublisher implements FedosBoardOutboxPublisher {
  readonly calls: FedosPersistedBoardOutboxRecordV1[] = [];
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

  async publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
    this.calls.push(record);
    await this.#gate;
    return { outcome: "delivered", retryPolicy: "never" };
  }
}

describe("Secure Runtime Alpha 549 -- Thread Safety Audit", () => {
  it("1. two overlapping tick() calls both attempt the SAME pending intent -- a real, reproducible double-publish", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const postId = toFedosBoardPostId("post-1")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    persistence.putIntent(serializeFedosBoardOutboxIntent(intent));

    const publisher = new SlowPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });

    // Fire two tick() calls without awaiting the first -- simulating a Publisher call
    // that outlives one interval tick, exactly as Alpha 549's own doc describes.
    const firstTick = scheduler.tick();
    const secondTick = scheduler.tick();

    // Release the held publish() calls once both tick() calls have had a chance to start.
    await Promise.resolve();
    await Promise.resolve();
    publisher.release();

    await Promise.all([firstTick, secondTick]);

    // The SAME intent was published TWICE, concurrently -- the concrete failure this Stage names.
    expect(publisher.calls).toHaveLength(2);
    expect(publisher.calls[0]!.id).toBe(intent.id);
    expect(publisher.calls[1]!.id).toBe(intent.id);
  });

  it("2. FedosDesktopHost.submitPost() runs its entire read-check-write sequence with zero internal await -- confirmed safe by source inspection", () => {
    const submitPostStart = hostSource.indexOf("submitPost(post: FedosBoardPost)");
    const submitPostEnd = hostSource.indexOf("\n  }", submitPostStart);
    const body = hostSource.slice(submitPostStart, submitPostEnd);
    expect(body).not.toMatch(/await/);
  });

  it("3. two concurrent Host.start() calls cannot both succeed -- the second rejects immediately, its state check having run before either call's own first await", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: { start: async () => new Promise((resolve) => setTimeout(resolve, 5)) } as unknown as ConstructorParameters<typeof FedosDesktopHost>[0]["desktopApplication"],
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    const firstStart = host.start();
    const secondStart = host.start();
    await expect(secondStart).rejects.toThrow();
    await firstStart;
    expect(host.state()).toBe("ready");
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";

/**
 * Secure Runtime Alpha 612 -- "Runtime Stop Ordering": Stage 12 of the
 * Alpha 601-620 Desktop Local Runtime Entry Point & Publish Pipeline
 * Ownership Arc. Verifies the required order (new work stops -> in-flight
 * tick completes -> Host.stop() -> runtime stopped) and that a SECOND
 * `stop()` call is rejected, mirroring `FedosDesktopHost.stop()`'s own
 * non-idempotent contract rather than silently absorbing it.
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-612-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-612",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a612" },
    body: `body-${id}`,
    createdAt: 1_700_612_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

describe("Secure Runtime Alpha 612 -- Runtime Stop Ordering", () => {
  it("1. stop() awaits an in-flight delivery tick before Host.stop() runs -- no Publisher call after stop() resolves", async () => {
    const dir = freshDir();
    let calls = 0;
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const publisher: FedosBoardOutboxPublisher = {
      async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
        calls++;
        await gate;
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      observationLogPath: join(dir, "observation.jsonl"),
      deliveryEnabled: true,
      deliveryIntervalMs: 5,
      publisher,
    });

    const post = validateFedosBoardPost(rootInput("post-612-a"))!;
    runtime.host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(calls).toBe(1);

    const stopping = runtime.stop();
    let stopped = false;
    void stopping.then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stopped).toBe(false); // still gated -- stop() has not resolved yet

    release!();
    await stopping;
    expect(stopped).toBe(true);
    expect(calls).toBe(1); // no further Publish after the gate released post-stop
    expect(runtime.host.state()).toBe("stopped");
  });

  it("2. a second stop() call throws -- non-idempotent, mirroring Host.stop()'s own contract", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    await runtime.stop();
    await expect(runtime.stop()).rejects.toThrow(/only be called once/);
  });

  it("3. stop() with delivery disabled skips stopDelivery() entirely and still stops the Host cleanly", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    await expect(runtime.stop()).resolves.toBeUndefined();
    expect(runtime.host.state()).toBe("stopped");
  });
});

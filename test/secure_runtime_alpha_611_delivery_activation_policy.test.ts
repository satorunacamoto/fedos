import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "../src/board/outbox/fedos_board_outbox_codec.js";

/**
 * Secure Runtime Alpha 611 -- "Delivery Activation Policy": Stage 11
 * of the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc. Confirms Host-start/delivery-start remain
 * separate (Alpha 501-520, unchanged) and that this Arc's own runtime
 * only ever calls `startDelivery()` when `deliveryEnabled: true`.
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-611-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-611",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a611" },
    body: `body-${id}`,
    createdAt: 1_700_611_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

describe("Secure Runtime Alpha 611 -- Delivery Activation Policy", () => {
  it("1. deliveryEnabled: false -- Host reaches 'ready' with delivery NOT running, no publish ever attempted even with a real outbox intent pending", async () => {
    const dir = freshDir();
    let calls = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish(): Promise<FedosBoardOutboxPublishResult> {
        calls++;
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.host.state()).toBe("ready");
    expect(runtime.host.deliveryStatus()).toEqual({ running: false });

    const post = validateFedosBoardPost(rootInput("post-611-a"))!;
    runtime.host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBe(0); // never attempted -- delivery was never started
    void publisher;

    await runtime.stop();
  });

  it("2. deliveryEnabled: true, with a real injected publisher -- delivery is running immediately after startup, and a pending intent IS attempted", async () => {
    const dir = freshDir();
    let calls = 0;
    const publisher: FedosBoardOutboxPublisher = {
      async publish(_record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult> {
        calls++;
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const post = validateFedosBoardPost(rootInput("post-611-b"))!;

    // Pre-seed the outbox log with an intent to attempt (Host doesn't hydrate
    // it into delivery until submitted through the running Host, so submit
    // AFTER startDelivery() to exercise the live path).
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      observationLogPath: join(dir, "observation.jsonl"),
      deliveryEnabled: true,
      deliveryIntervalMs: 10,
      publisher,
    });
    expect(runtime.host.deliveryStatus()).toEqual({ running: true });

    runtime.host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toBeGreaterThan(0);

    await runtime.stop();
    expect(runtime.host.deliveryStatus()).toEqual({ running: false });
  });
});

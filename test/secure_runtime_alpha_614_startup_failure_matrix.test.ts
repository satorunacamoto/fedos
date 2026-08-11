import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/os/messenger/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 614 -- "Startup Failure Matrix": Stage 14 of
 * the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc. Every named case, exercised for real -- no
 * partial-ready state is ever produced.
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-614-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const okPublisher: FedosBoardOutboxPublisher = {
  async publish(): Promise<FedosBoardOutboxPublishResult> {
    return { outcome: "delivered", retryPolicy: "never" };
  },
};

describe("Secure Runtime Alpha 614 -- Startup Failure Matrix", () => {
  it("1. invalid board log -- rejects, no runtime handle returned", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    appendFileSync(boardLogPath, "{not json\n", "utf8");
    await expect(
      startFedosDesktopRuntime({ boardLogPath, outboxLogPath: join(dir, "outbox.jsonl"), deliveryEnabled: false }),
    ).rejects.toThrow();
  });

  it("2. invalid outbox log -- Host itself starts fine (Outbox is never hydrated at Host.start() time), but startDelivery() rejects once delivery reads it", async () => {
    const dir = freshDir();
    const outboxLogPath = join(dir, "outbox.jsonl");
    appendFileSync(outboxLogPath, "{not json\n", "utf8");
    // deliveryEnabled: false -- the corrupt Outbox log is never read, confirmed reachable.
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath,
      deliveryEnabled: false,
    });
    expect(runtime.host.state()).toBe("ready");
    await runtime.stop();

    // deliveryEnabled: true -- the SAME corrupt log now surfaces as a real failure.
    await expect(
      startFedosDesktopRuntime({
        boardLogPath: join(dir, "board2.jsonl"),
        outboxLogPath,
        observationLogPath: join(dir, "observation.jsonl"),
        deliveryEnabled: true,
        publisher: okPublisher,
      }),
    ).rejects.toThrow();
  });

  it("3. invalid observation log does NOT crash startup -- per-intent Fail Closed hydration (Alpha 584/585, inherited unchanged) safely degrades to 'treat as never delivered' instead", async () => {
    const dir = freshDir();
    const outboxLogPath = join(dir, "outbox.jsonl");
    const observationLogPath = join(dir, "observation.jsonl");

    // A real, valid, pending Outbox intent -- hydration looks up its own
    // history, which is what would read the observation log.
    const postId = toFedosBoardPostId("post-614-3")!;
    const intent = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    appendFileSync(outboxLogPath, JSON.stringify(serializeFedosBoardOutboxIntent(intent)) + "\n", "utf8");
    appendFileSync(observationLogPath, "{not json\n", "utf8");

    // This is a DELIBERATE asymmetry, not an inconsistency: Board log
    // corruption hard-fails (thread-integrity dependencies span records);
    // Outbox log corruption hard-fails (no try/catch anywhere on
    // `listIntents()`); Observation log corruption does NOT -- Alpha
    // 584/585's own "Fail Closed, per intent" rule isolates a single
    // intent's own unreadable history to that intent alone, so it is
    // simply retried, never treated as a startup blocker.
    let calls = 0;
    const countingPublisher: FedosBoardOutboxPublisher = {
      async publish(): Promise<FedosBoardOutboxPublishResult> {
        calls++;
        return { outcome: "delivered", retryPolicy: "never" };
      },
    };
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath,
      observationLogPath,
      deliveryEnabled: true,
      deliveryIntervalMs: 5,
      publisher: countingPublisher,
    });
    expect(runtime.host.state()).toBe("ready");
    expect(runtime.host.deliveryStatus()).toEqual({ running: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toBeGreaterThan(0); // the intent was retried, not silently stuck
    await runtime.stop();
  });

  it("4. delivery enabled but observationLogPath missing -- a clean, synchronous configuration error, before any Persistence backend is constructed", async () => {
    const dir = freshDir();
    await expect(
      startFedosDesktopRuntime({
        boardLogPath: join(dir, "board.jsonl"),
        outboxLogPath: join(dir, "outbox.jsonl"),
        deliveryEnabled: true,
        publisher: okPublisher,
      }),
    ).rejects.toThrow(/observationLogPath/);
  });

  it("5. delivery enabled but publisher missing -- a clean, synchronous configuration error", async () => {
    const dir = freshDir();
    await expect(
      startFedosDesktopRuntime({
        boardLogPath: join(dir, "board.jsonl"),
        outboxLogPath: join(dir, "outbox.jsonl"),
        observationLogPath: join(dir, "observation.jsonl"),
        deliveryEnabled: true,
      }),
    ).rejects.toThrow(/publisher/);
  });

  it("6. delivery disabled -- a clean, successful startup with no dependency on observationLogPath/publisher at all", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.host.state()).toBe("ready");
    expect(runtime.host.deliveryStatus()).toEqual({ running: false });
    await runtime.stop();
  });

  it("7. delivery enabled with every real dependency present -- a clean, successful startup with delivery running", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      observationLogPath: join(dir, "observation.jsonl"),
      deliveryEnabled: true,
      publisher: okPublisher,
    });
    expect(runtime.host.state()).toBe("ready");
    expect(runtime.host.deliveryStatus()).toEqual({ running: true });
    await runtime.stop();
  });
});

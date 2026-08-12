import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosBoardOutboxPublisher, FedosBoardOutboxPublishResult } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";

/**
 * Secure Runtime Alpha 618 -- "Operational Verification": Stage 18 of
 * the Alpha 601-620 Desktop Local Runtime Entry Point & Publish
 * Pipeline Ownership Arc.
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-618-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function rootInput(id: string, boardId: string): FedosBoardPostInput {
  return {
    id,
    boardId,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a618" },
    body: `body-${id}`,
    createdAt: 1_700_618_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

describe("Secure Runtime Alpha 618 -- Operational Verification", () => {
  it("clean startup -> graceful stop -> restart, in sequence, on the SAME paths", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    const outboxLogPath = join(dir, "outbox.jsonl");
    for (let i = 0; i < 3; i++) {
      const runtime = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });
      expect(runtime.host.state()).toBe("ready");
      await runtime.stop();
      expect(runtime.host.state()).toBe("stopped");
    }
  });

  it("corrupt persistence failure does not leave a half-started runtime reachable afterward", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    appendFileSync(boardLogPath, "{bad\n", "utf8");
    await expect(
      startFedosDesktopRuntime({ boardLogPath, outboxLogPath: join(dir, "outbox.jsonl"), deliveryEnabled: false }),
    ).rejects.toThrow();
    // A SUBSEQUENT, correctly-pathed runtime is unaffected by the prior failure.
    const dir2 = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir2, "board.jsonl"),
      outboxLogPath: join(dir2, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.host.state()).toBe("ready");
    await runtime.stop();
  });

  it("delivery disabled -- deliveryStatus() stays false for the entire lifetime", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.host.deliveryStatus()).toEqual({ running: false });
    await runtime.stop();
    expect(runtime.host.deliveryStatus()).toEqual({ running: false });
  });

  it("two independent runtimes, over DIFFERENT paths, share no state -- a post submitted to one is invisible to the other", async () => {
    const dirA = freshDir();
    const dirB = freshDir();
    const runtimeA = await startFedosDesktopRuntime({
      boardLogPath: join(dirA, "board.jsonl"),
      outboxLogPath: join(dirA, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    const runtimeB = await startFedosDesktopRuntime({
      boardLogPath: join(dirB, "board.jsonl"),
      outboxLogPath: join(dirB, "outbox.jsonl"),
      deliveryEnabled: false,
    });

    const postA = validateFedosBoardPost(rootInput("post-618-a", "board-618-a"))!;
    expect(runtimeA.host.submitPost(postA)).toBe("inserted");
    expect(runtimeB.host.board()!.findPost(postA.id)).toBeNull();

    await runtimeA.stop();
    await runtimeB.stop();
  });

  it("no shared module-level singleton -- constructing two runtimes over the SAME paths concurrently produces two independent Host instances", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    const outboxLogPath = join(dir, "outbox.jsonl");
    const runtime1 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });
    const runtime2 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });
    expect(runtime1.host).not.toBe(runtime2.host);
    await runtime1.stop();
    await runtime2.stop();
  });

  it("no leaked timer -- delivery disabled means no interval is ever started (structurally: FedosPublishScheduler.start()/FedosHostDeliveryController.start() are never called at all)", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.host.deliveryStatus().running).toBe(false);
    await runtime.stop();
    // No lingering timer means this test itself completes without vitest's
    // own "did not exit" warning -- observed structurally by this file's
    // own overall clean run, not asserted directly here.
  });

  it("delivery enabled then stopped -- no further Publisher call occurs after stop() resolves, confirming the timer was genuinely cleared, not merely ignored", async () => {
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
      observationLogPath: join(dir, "observation.jsonl"),
      deliveryEnabled: true,
      deliveryIntervalMs: 5,
      publisher,
    });
    await runtime.stop();
    const callsAtStop = calls;
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(calls).toBe(callsAtStop); // unchanged well after stop() -- no leaked interval firing
  });

  it("p2p/ untouched -- no file under this Arc's own runtime module IMPORTS from p2p/ (a doc comment naming the prohibition is not a reference)", async () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const assembly = (await import("../src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts?raw")).default as string;
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const config = (await import("../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.ts?raw")).default as string;
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const main = (await import("../src/os/messenger/desktop/runtime/run_fedos_desktop_runtime.ts?raw")).default as string;
    for (const source of [assembly, config, main]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/from\s+["'].*p2p\//);
    }
  });
});

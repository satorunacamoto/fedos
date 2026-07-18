import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync, existsSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { startFedosDesktopRuntime, type FedosRunningDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 606 -- "Runtime Assembly": Stage 6 of the Alpha
 * 601-620 Desktop Local Runtime Entry Point & Publish Pipeline
 * Ownership Arc. Covers Alpha 607 (Board Persistence Wiring) and Alpha
 * 608 (Outbox Persistence Wiring) together -- both are verified through
 * the SAME real `startFedosDesktopRuntime()` call, against the REAL
 * `AppendOnlyFedosBoardPersistence`/`AppendOnlyFedosBoardOutboxPersistence`
 * backends (Alpha 353/418, UNCHANGED), never a mock.
 */

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-606-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-606",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a606" },
    body: `body-${id}`,
    createdAt: 1_700_006_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

describe("Secure Runtime Alpha 606 -- Runtime Assembly (Board/Outbox Wiring, Alpha 607/608)", () => {
  it("1. a fresh runtime reaches host.state() === 'ready' against real, empty log files", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    expect(runtime.host.state()).toBe("ready");
    await runtime.stop();
  });

  it("2. a submitted post is durably written to the REAL board log file, surviving a fresh runtime instance over the same path", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    const outboxLogPath = join(dir, "outbox.jsonl");

    const runtime1 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });
    const post = validateFedosBoardPost(rootInput("post-606-a"))!;
    expect(runtime1.host.submitPost(post)).toBe("inserted");
    await runtime1.stop();

    // The log file itself is real, on disk, and contains the post.
    expect(existsSync(boardLogPath)).toBe(true);
    const raw = readFileSync(boardLogPath, "utf8") as string;
    expect(raw).toContain("post-606-a");

    // A genuinely fresh runtime, over the SAME path, recovers it.
    const runtime2 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });
    expect(runtime2.host.board()!.findPost(post.id)).not.toBeNull();
    await runtime2.stop();
  });

  it("3. submitPostWithOutbox() with an EXPLICIT target writes a real, durable Outbox intent -- no automatic target inference", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    const outboxLogPath = join(dir, "outbox.jsonl");
    const runtime = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });

    const post = validateFedosBoardPost(rootInput("post-606-b"))!;
    const result = runtime.host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    expect(result.post).toBe("inserted");
    expect(result.outbox).toHaveLength(1);
    await runtime.stop();

    expect(existsSync(outboxLogPath)).toBe(true);
    const raw = readFileSync(outboxLogPath, "utf8") as string;
    expect(raw).toContain("post-606-b");
  });

  it("4. a post submitted WITHOUT any explicit target writes NOTHING to the Outbox log -- confirms no local-only submitPost() creates one", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    const outboxLogPath = join(dir, "outbox.jsonl");
    const runtime = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });

    const post = validateFedosBoardPost(rootInput("post-606-c"))!;
    expect(runtime.host.submitPost(post)).toBe("inserted");
    await runtime.stop();

    expect(existsSync(outboxLogPath)).toBe(false);
  });

  it("5. the returned handle exposes ONLY {host, boardRuntime, conversationRuntime, privateTransport, conversationArchiveRuntime, conversationProductionCryptoCapability, stop} -- no low-level Persistence/Scheduler leaked (Secure Runtime Alpha 671-673 add boardRuntime(); Alpha 921/923 add conversationRuntime(); Alpha 1471-1540 adds privateTransport(); Alpha 1691-1760 adds conversationArchiveRuntime(); Alpha 1261-1320/1391-1470 (merged this Arc) adds conversationProductionCryptoCapability() -- see docs/secure_runtime_alpha_671_running_runtime_ownership_decision.md)", async () => {
    const dir = freshDir();
    const runtime: FedosRunningDesktopRuntime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.jsonl"),
      outboxLogPath: join(dir, "outbox.jsonl"),
      deliveryEnabled: false,
    });
    // Secure Runtime Alpha 1263/1291 -- conversationProductionCryptoCapability()
    // adds ONE coarse, non-secret capability-outcome accessor (Alpha
    // 1261-1320); no persistence port, encryption handle, or Host internal
    // is exposed by it.
    expect(Object.keys(runtime).sort()).toEqual([
      "boardRuntime",
      "conversationArchiveRuntime",
      "conversationProductionCryptoCapability",
      "conversationRuntime",
      "host",
      "privateTransport",
      "stop",
    ]);
    await runtime.stop();
  });

  it("6. a corrupt board log fails startup closed -- the error propagates, no runtime handle is ever returned (Host's own 'failed' state transition, Alpha 382, unchanged, is exercised but not re-verified here)", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.jsonl");
    // Write a genuinely unparsable line directly, bypassing the API.
    appendFileSync(boardLogPath, "not valid json\n", "utf8");

    await expect(
      startFedosDesktopRuntime({ boardLogPath, outboxLogPath: join(dir, "outbox.jsonl"), deliveryEnabled: false }),
    ).rejects.toThrow();
  });
});

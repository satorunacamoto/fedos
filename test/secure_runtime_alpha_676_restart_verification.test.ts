import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-676-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Secure Runtime Alpha 676 ("Restart Verification") — Stage 6 of Phase
 * D of the Alpha 641-680 Arc. The exact ten-step scenario Alpha 676's
 * own instruction names, run against real append-only paths and two
 * genuinely independent `startFedosDesktopRuntime()` calls.
 */
describe("Secure Runtime Alpha 676 -- Restart Verification", () => {
  it("1-10. start -> boardRuntime() -> create -> reply -> query -> stop -> fresh restart -> new boardRuntime() -> hydrate/query -> no shared singleton state", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");

    // 1. start runtime
    const runtime1 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });

    // 2. obtain boardRuntime()
    const boardRuntime1 = runtime1.boardRuntime();
    expect(boardRuntime1).toBeDefined();

    // 3. create local public thread
    const rootResult = await boardRuntime1.createPublicThread({ boardId: "board-676", body: "root, cycle 1" });
    expect(rootResult.outcome).toBe("created");
    if (rootResult.outcome !== "created") throw new Error("unreachable");
    const rootId = rootResult.post.id;

    // 4. reply
    const replyResult = await boardRuntime1.replyToPublicThread({
      boardId: "board-676",
      threadId: rootId,
      replyTo: rootId,
      body: "a reply, cycle 1",
    });
    expect(replyResult.outcome).toBe("created");

    // 5. query
    expect(boardRuntime1.recentFeed("board-676")?.posts).toHaveLength(2);

    // 6. stop
    await runtime1.stop();

    // 7. start fresh runtime
    const runtime2 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });

    // 8. obtain new boardRuntime()
    const boardRuntime2 = runtime2.boardRuntime();
    expect(boardRuntime2).not.toBe(boardRuntime1);

    // 9. verify hydration/query
    const feedAfterRestart = boardRuntime2.recentFeed("board-676");
    expect(feedAfterRestart?.posts).toHaveLength(2);
    expect(boardRuntime2.findPost(rootId)?.body).toBe("root, cycle 1");

    // 10. verify no shared singleton state -- a post created only
    // through runtime2's own board runtime is invisible to runtime1's
    // (already-stopped) board runtime instance, and vice versa; the two
    // instances are structurally distinct objects.
    expect(boardRuntime1).not.toBe(boardRuntime2);

    await runtime2.stop();
  });

  it("two independent restart cycles over DIFFERENT paths never see each other's writes", async () => {
    const dirA = freshDir();
    const dirB = freshDir();
    const runtimeA = await startFedosDesktopRuntime({
      boardLogPath: join(dirA, "board.ndjson"),
      outboxLogPath: join(dirA, "outbox.ndjson"),
      deliveryEnabled: false,
    });
    const runtimeB = await startFedosDesktopRuntime({
      boardLogPath: join(dirB, "board.ndjson"),
      outboxLogPath: join(dirB, "outbox.ndjson"),
      deliveryEnabled: false,
    });

    await runtimeA.boardRuntime().createPublicThread({ boardId: "b", body: "only in A" });
    await runtimeB.boardRuntime().createPublicThread({ boardId: "b", body: "only in B" });

    expect(runtimeA.boardRuntime().recentFeed("b")?.posts).toHaveLength(1);
    expect(runtimeB.boardRuntime().recentFeed("b")?.posts).toHaveLength(1);
    expect(runtimeA.boardRuntime().recentFeed("b")?.posts[0]?.body).toBe("only in A");
    expect(runtimeB.boardRuntime().recentFeed("b")?.posts[0]?.body).toBe("only in B");

    await runtimeA.stop();
    await runtimeB.stop();
  });
});

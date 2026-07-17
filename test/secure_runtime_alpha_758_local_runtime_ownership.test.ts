import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/desktop/runtime/fedos_desktop_runtime.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-758-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Secure Runtime Alpha 758 ("Local Runtime Ownership") -- Stage 18 of
 * the Alpha 741-760 Canonical Conversation Identity and Record
 * Foundation Arc.
 */
describe("Secure Runtime Alpha 758 -- Local Runtime Ownership", () => {
  it("1. omitting conversationLogPath does not create a Conversation file -- an explicit in-memory default is used", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");
    const runtime = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, deliveryEnabled: false });

    const result = await runtime.boardRuntime().createPublicThread({ boardId: "b", body: "hello" });
    expect(result.outcome).toBe("created");
    expect(runtime.boardRuntime().conversationForThread("b", (result as any).post.id)).not.toBeNull();
    expect(existsSync(join(dir, "conversation.ndjson"))).toBe(false);

    await runtime.stop();
  });

  it("2. supplying conversationLogPath persists Conversation records durably, surviving a restart", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");
    const conversationLogPath = join(dir, "conversation.ndjson");

    const runtime1 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, conversationLogPath, deliveryEnabled: false });
    const created = await runtime1.boardRuntime().createPublicThread({ boardId: "b", body: "hello" });
    expect(created.outcome).toBe("created");
    if (created.outcome !== "created") throw new Error("unreachable");
    const rootId = created.post.id;
    await runtime1.stop();

    expect(existsSync(conversationLogPath)).toBe(true);

    const runtime2 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, conversationLogPath, deliveryEnabled: false });
    const record = runtime2.boardRuntime().conversationForThread("b", rootId);
    expect(record?.rootPostId).toBe(rootId);
    await runtime2.stop();
  });

  it("3. the parent directory of conversationLogPath is created if missing", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");
    const conversationLogPath = join(dir, "nested", "deeper", "conversation.ndjson");
    const runtime = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, conversationLogPath, deliveryEnabled: false });
    await runtime.boardRuntime().createPublicThread({ boardId: "b", body: "hello" });
    expect(existsSync(conversationLogPath)).toBe(true);
    await runtime.stop();
  });

  it("4. startup fails closed on a corrupt Conversation log -- never silently starts with a partial/repaired state", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");
    const conversationLogPath = join(dir, "conversation.ndjson");
    writeFileSync(conversationLogPath, "{not valid json\n", "utf8");

    await expect(
      startFedosDesktopRuntime({ boardLogPath, outboxLogPath, conversationLogPath, deliveryEnabled: false }),
    ).rejects.toThrow();
  });

  it("5. no filesystem internal is exposed -- the running runtime handle exposes only host/boardRuntime()/conversationRuntime()/stop()", async () => {
    const dir = freshDir();
    const runtime = await startFedosDesktopRuntime({
      boardLogPath: join(dir, "board.ndjson"),
      outboxLogPath: join(dir, "outbox.ndjson"),
      deliveryEnabled: false,
    });
    // Secure Runtime Alpha 923 ADDITIVELY extended this handle with
    // `conversationRuntime()` (the private-Conversation draft runtime the
    // Local Runtime now also owns). Still NO filesystem internal is exposed
    // -- only the two Application-Runtime accessors and `stop()`.
    expect(Object.keys(runtime).sort()).toEqual(["boardRuntime", "conversationRuntime", "host", "stop"].sort());
    await runtime.stop();
  });

  it("6. two independent runtimes over different conversationLogPath values never see each other's Conversation records", async () => {
    const dirA = freshDir();
    const dirB = freshDir();
    const runtimeA = await startFedosDesktopRuntime({
      boardLogPath: join(dirA, "board.ndjson"),
      outboxLogPath: join(dirA, "outbox.ndjson"),
      conversationLogPath: join(dirA, "conversation.ndjson"),
      deliveryEnabled: false,
    });
    const runtimeB = await startFedosDesktopRuntime({
      boardLogPath: join(dirB, "board.ndjson"),
      outboxLogPath: join(dirB, "outbox.ndjson"),
      conversationLogPath: join(dirB, "conversation.ndjson"),
      deliveryEnabled: false,
    });

    await runtimeA.boardRuntime().createPublicThread({ boardId: "b", body: "only in A" });
    expect(runtimeB.boardRuntime().listBoardConversations("b")).toHaveLength(0);
    expect(runtimeA.boardRuntime().listBoardConversations("b")).toHaveLength(1);

    await runtimeA.stop();
    await runtimeB.stop();
  });
});

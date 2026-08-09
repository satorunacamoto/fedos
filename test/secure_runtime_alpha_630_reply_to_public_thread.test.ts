import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/os/messenger/board/runtime/fedos_board_runtime_id_generator.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

async function readyHost(): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 630 ("Reply to Public Thread") -- Stage 10 of
 * the Alpha 621-640 Public Board Runtime Application API Foundation
 * Arc. Thread-integrity enforcement is Host/`FedosBoardService`'s own
 * EXISTING, unmodified job -- these tests confirm the Runtime routes
 * through it correctly, never re-implementing it.
 */
describe("Secure Runtime Alpha 630 -- Reply to Public Thread", () => {
  let host: FedosDesktopHost;

  beforeEach(async () => {
    host = await readyHost();
  });

  it("1. a reply to an existing root succeeds, with the parent's own threadId and correct replyTo", async () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-1") });
    await runtime.createPublicThread({ boardId: "board-a", body: "root" });

    const replyRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-1") });
    const result = await replyRuntime.replyToPublicThread({
      boardId: "board-a",
      threadId: "root-1",
      replyTo: "root-1",
      body: "a reply",
    });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.threadId).toBe("root-1");
    expect(result.post.replyTo).toBe("root-1");
  });

  it("2. missing parent fails closed as invalid-command/missing-parent -- Host's own existing precheck, not re-implemented here", async () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-2") });
    const result = await runtime.replyToPublicThread({
      boardId: "board-a",
      threadId: "nonexistent-root",
      replyTo: "nonexistent-root",
      body: "orphan reply",
    });
    expect(result).toEqual({ outcome: "invalid-command", reason: "missing-parent" });
  });

  it("3. cross-board reply fails closed as invalid-command/cross-board-reply", async () => {
    const rootRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-3") });
    await rootRuntime.createPublicThread({ boardId: "board-a", body: "root" });

    const replyRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-3") });
    const result = await replyRuntime.replyToPublicThread({
      boardId: "board-b", // different board than the parent's own board-a
      threadId: "root-3",
      replyTo: "root-3",
      body: "wrong board reply",
    });
    expect(result).toEqual({ outcome: "invalid-command", reason: "cross-board-reply" });
  });

  it("4. a threadId mismatched from the parent's own threadId fails closed as invalid-command/invalid-thread", async () => {
    const rootRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-4") });
    await rootRuntime.createPublicThread({ boardId: "board-a", body: "root" });

    const replyRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-4") });
    const result = await replyRuntime.replyToPublicThread({
      boardId: "board-a",
      threadId: "some-other-thread-id",
      replyTo: "root-4",
      body: "mismatched thread",
    });
    expect(result).toEqual({ outcome: "invalid-command", reason: "invalid-thread" });
  });

  it("5. a reply's own source is still { protocol: 'fedos', reference: <own id> }, independent of the parent's source", async () => {
    const rootRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-5") });
    await rootRuntime.createPublicThread({ boardId: "board-a", body: "root" });

    const replyRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-5") });
    const result = await replyRuntime.replyToPublicThread({
      boardId: "board-a",
      threadId: "root-5",
      replyTo: "root-5",
      body: "reply",
    });
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.source).toEqual({ protocol: "fedos", reference: "reply-5" });
  });

  it("6. two replies to the same root, read back via thread(), are both visible and correctly ordered by createdAt", async () => {
    const clockValues = [1_700_000_000, 1_700_000_100, 1_700_000_050];
    let clockIndex = 0;
    const clock = () => clockValues[clockIndex++]!;

    const rootRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-6"), clock });
    await rootRuntime.createPublicThread({ boardId: "board-a", body: "root" });

    const replyRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-6a", "reply-6b"), clock });
    await replyRuntime.replyToPublicThread({ boardId: "board-a", threadId: "root-6", replyTo: "root-6", body: "second in time" });
    await replyRuntime.replyToPublicThread({ boardId: "board-a", threadId: "root-6", replyTo: "root-6", body: "first in time" });

    const threadResult = replyRuntime.thread("board-a", "root-6");
    expect(threadResult?.posts.map((p) => p.id)).toEqual(["root-6", "reply-6b", "reply-6a"]);
  });
});

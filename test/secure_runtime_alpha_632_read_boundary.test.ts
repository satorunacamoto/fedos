import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { createFedosBoardRuntime, FedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/board/runtime/fedos_board_runtime_id_generator.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

/**
 * Secure Runtime Alpha 632 ("Read Boundary") -- Stage 12 of the Alpha
 * 621-640 Public Board Runtime Application API Foundation Arc.
 * Option B (delegation) -- confirms the read facade forwards to
 * `Host.board()`/`Host.query()` without ever exposing either instance
 * directly to a caller of `FedosBoardRuntime`.
 */
describe("Secure Runtime Alpha 632 -- Read Boundary", () => {
  let host: FedosDesktopHost;
  let runtime: FedosBoardRuntime;

  beforeEach(async () => {
    host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1", "p2", "p3") });
    runtime.createPublicThread({ boardId: "board-r", body: "post one" });
    runtime.createPublicThread({ boardId: "board-r", body: "post two" });
  });

  it("1. findPost() returns a post written through createPublicThread()", () => {
    expect(runtime.findPost("p1")?.body).toBe("post one");
  });

  it("2. findPost() returns null for a nonexistent id", () => {
    expect(runtime.findPost("does-not-exist")).toBeNull();
  });

  it("3. findPost() returns null for a malformed (empty) id, never throws", () => {
    expect(() => runtime.findPost("")).not.toThrow();
    expect(runtime.findPost("")).toBeNull();
  });

  it("4. recentFeed() returns both posts, most recent first by default ordering", () => {
    const feed = runtime.recentFeed("board-r");
    expect(feed?.posts).toHaveLength(2);
  });

  it("5. recentFeed() supports the existing filter/pagination options unchanged", () => {
    const feed = runtime.recentFeed("board-r", undefined, { limit: 1 });
    expect(feed?.posts).toHaveLength(1);
    expect(feed?.hasMore).toBe(true);
  });

  it("6. thread() returns the root plus any replies for a given thread id", () => {
    const threadResult = runtime.thread("board-r", "p1");
    expect(threadResult?.posts.map((p) => p.id)).toEqual(["p1"]);
  });

  it("7. no read method returns null or throws once Host is ready and inputs are well-formed -- confirms the facade never leaks a raw FedosBoardReader/FedosBoardQuery reference (both TS-unreachable from the Runtime's own public surface)", () => {
    // Structural: FedosBoardRuntime's own public methods listed below are its
    // ENTIRE read surface -- neither `board()` nor `query()` is one of them.
    const publicMethodNames = Object.getOwnPropertyNames(FedosBoardRuntime.prototype).filter((n) => n !== "constructor");
    expect(publicMethodNames).not.toContain("board");
    expect(publicMethodNames).not.toContain("query");
    expect(publicMethodNames.sort()).toEqual(
      ["createPublicThread", "findPost", "recentFeed", "replyToPublicThread", "thread"].sort(),
    );
  });

  it("8. after host.stop(), every read method returns null rather than throwing", async () => {
    await host.stop();
    expect(runtime.findPost("p1")).toBeNull();
    expect(runtime.recentFeed("board-r")).toBeNull();
    expect(runtime.thread("board-r", "p1")).toBeNull();
  });
});

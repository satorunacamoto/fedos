import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/os/messenger/board/runtime/fedos_board_runtime_id_generator.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

/**
 * Secure Runtime Alpha 755 ("Reply Integration") -- Stage 15 of the
 * Alpha 741-760 Canonical Conversation Identity and Record Foundation
 * Arc.
 */
describe("Secure Runtime Alpha 755 -- Reply Integration", () => {
  let host: FedosDesktopHost;

  beforeEach(async () => {
    host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
  });

  it("1. a reply resolves the SAME, already-existing Conversation record -- never creates a second one", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1", "p2"), conversationPersistence });
    await runtime.createPublicThread({ boardId: "board-r", body: "root" });
    const reply = await runtime.replyToPublicThread({ boardId: "board-r", threadId: "p1", replyTo: "p1", body: "reply" });

    expect(reply.outcome).toBe("created");
    if (reply.outcome !== "created") throw new Error("unreachable");
    expect(reply.conversation.outcome).toBe("existing");
    if (reply.conversation.outcome !== "existing") throw new Error("unreachable");
    expect(reply.conversation.conversation.rootPostId).toBe("p1");
    expect(conversationPersistence.listConversations()).toHaveLength(1);
  });

  it("2. a reply into a thread with NO Conversation record surfaces not-found, but the Board reply itself still succeeds (legacy compatibility)", async () => {
    // Simulate legacy Board data: a thread written directly to Board
    // persistence, bypassing FedosBoardRuntime entirely -- no
    // Conversation record was ever created for it.
    const boardPersistence = new InMemoryFedosBoardPersistence();
    boardPersistence.putPost({
      schemaVersion: 1,
      id: "legacy-root",
      boardId: "board-r",
      threadId: "legacy-root",
      replyTo: null,
      author: { identityId: null, protocol: "fedos", publicIdentifier: "local-anonymous" },
      body: "legacy root, no conversation record",
      createdAt: 1_600_000_000,
      source: { protocol: "fedos", reference: "legacy-root" },
    });
    const legacyHost = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence });
    await legacyHost.start();

    const runtime = createFedosBoardRuntime({ host: legacyHost, idGenerator: fixedIdGenerator("p2") });
    const reply = await runtime.replyToPublicThread({
      boardId: "board-r",
      threadId: "legacy-root",
      replyTo: "legacy-root",
      body: "a real reply into legacy data",
    });

    expect(reply.outcome).toBe("created");
    if (reply.outcome !== "created") throw new Error("unreachable");
    expect(reply.conversation).toEqual({ outcome: "not-found" });
    expect(runtime.findPost("p2")?.body).toBe("a real reply into legacy data");
  });

  it("3. a reply never mutates the Conversation record's mode/policy/createdAt", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1", "p2"), conversationPersistence });
    await runtime.createPublicThread({ boardId: "board-r", body: "root" });
    const before = runtime.conversationForThread("board-r", "p1");
    await runtime.replyToPublicThread({ boardId: "board-r", threadId: "p1", replyTo: "p1", body: "reply" });
    const after = runtime.conversationForThread("board-r", "p1");
    expect(after).toEqual(before);
  });

  it("4. preserves existing Board thread-integrity validation unchanged -- a reply to a missing parent still fails the same way", async () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1") });
    const reply = await runtime.replyToPublicThread({
      boardId: "board-r",
      threadId: "does-not-exist",
      replyTo: "does-not-exist",
      body: "orphan reply",
    });
    expect(reply.outcome).toBe("invalid-command");
    if (reply.outcome !== "invalid-command") throw new Error("unreachable");
    expect(reply.reason).toBe("missing-parent");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { createFedosBoardRuntime, FedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/os/messenger/board/runtime/fedos_board_runtime_id_generator.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import type { FedosConversationPersistence, FedosConversationPersistenceWriteResult } from "../src/os/messenger/conversations/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

class AlwaysFailingConversationPersistence implements FedosConversationPersistence {
  putConversation(): FedosConversationPersistenceWriteResult {
    return "failed";
  }
  getConversation(): FedosPersistedConversationRecordV1 | null {
    return null;
  }
  listConversations(): readonly FedosPersistedConversationRecordV1[] {
    return [];
  }
}

/**
 * Secure Runtime Alpha 754 ("BoardRuntime Creation Integration") --
 * Stage 14 of the Alpha 741-760 Canonical Conversation Identity and
 * Record Foundation Arc.
 */
describe("Secure Runtime Alpha 754 -- BoardRuntime Creation Integration", () => {
  let host: FedosDesktopHost;

  beforeEach(async () => {
    host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
  });

  it("1. createPublicThread durably records exactly ONE Conversation record for a new root post", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1"), conversationPersistence });
    const result = await runtime.createPublicThread({ boardId: "board-r", body: "hello" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.conversation.outcome).toBe("recorded");
    if (result.conversation.outcome !== "recorded") throw new Error("unreachable");
    expect(result.conversation.conversation.rootPostId).toBe("p1");
    expect(result.conversation.conversation.rootThreadId).toBe("p1");
    expect(result.conversation.conversation.boardId).toBe("board-r");
    expect(result.conversation.conversation.mode).toBe("public");
    expect(result.conversation.conversation.policyReference).toBe("public-v1");
    expect(conversationPersistence.listConversations()).toHaveLength(1);
  });

  it("2. the Conversation record is reachable via findConversation/conversationForThread/listBoardConversations", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1"), conversationPersistence });
    await runtime.createPublicThread({ boardId: "board-r", body: "hello" });

    expect(runtime.conversationForThread("board-r", "p1")?.rootPostId).toBe("p1");
    expect(runtime.findConversation("board-r::p1")?.rootPostId).toBe("p1");
    expect(runtime.listBoardConversations("board-r")).toHaveLength(1);
  });

  it("3. defaults to InMemoryFedosConversationPersistence when none is injected", async () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1") });
    const result = await runtime.createPublicThread({ boardId: "board-r", body: "hello" });
    expect(result.outcome).toBe("created");
    expect(runtime.conversationForThread("board-r", "p1")).not.toBeNull();
  });

  it("4. no atomicity claim: a failing FedosConversationPersistence still leaves the Board post durable", async () => {
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("p1"),
      conversationPersistence: new AlwaysFailingConversationPersistence(),
    });
    const result = await runtime.createPublicThread({ boardId: "board-r", body: "hello" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.conversation).toEqual({ outcome: "persistence-failed" });
    expect(runtime.findPost("p1")?.body).toBe("hello");
  });

  it("5. an idempotent re-submission of the same logical post resolves already-recorded, never a duplicate", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    // Simulate a retried command that generates the SAME id twice (a fixed
    // generator) with a fixed clock, so both writes are structurally
    // identical -- otherwise a real clock tick between calls would make
    // the second write a genuine "conflict", not "already-present".
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("p1", "p1"),
      clock: () => 1_700_000_000,
      conversationPersistence,
    });
    const first = await runtime.createPublicThread({ boardId: "board-r", body: "hello" });
    const second = await runtime.createPublicThread({ boardId: "board-r", body: "hello" });
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("already-present");
    if (second.outcome !== "already-present") throw new Error("unreachable");
    expect(second.conversation.outcome).toBe("already-recorded");
    expect(conversationPersistence.listConversations()).toHaveLength(1);
  });

  it("6. replyToPublicThread never creates a Conversation record -- see Alpha 755's own dedicated test file", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1", "p2"), conversationPersistence });
    await runtime.createPublicThread({ boardId: "board-r", body: "root" });
    await runtime.replyToPublicThread({ boardId: "board-r", threadId: "p1", replyTo: "p1", body: "reply" });
    expect(conversationPersistence.listConversations()).toHaveLength(1);
  });

  it("7. no mode other than public is ever constructed -- unsupported modes fail closed by construction, never reachable from this command surface", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1"), conversationPersistence });
    await runtime.createPublicThread({ boardId: "board-r", body: "hello" });
    expect(conversationPersistence.listConversations().every((r) => r.mode === "public")).toBe(true);
  });
});

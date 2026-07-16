import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { FedosConversationReader } from "../src/conversation/fedos_conversation_reader.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedConversationRecordV1 } from "../src/conversation/persistence/fedos_persisted_conversation_record_v1.js";

const boardId = toFedosBoardId("board-a")!;
const threadId = toFedosThreadId("thread-1")!;

const RECORD: FedosPersistedConversationRecordV1 = {
  schemaVersion: 1,
  id: toFedosConversationId(boardId, threadId),
  mode: "public",
  boardId: "board-a",
  rootThreadId: "thread-1",
  rootPostId: "thread-1",
  policyReference: "public-v1",
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 753 ("Conversation Repository / Index Decision")
 * / Alpha 757 ("Read API") -- Stages 13/17 of the Alpha 741-760
 * Canonical Conversation Identity and Record Foundation Arc.
 */
describe("Secure Runtime Alpha 753 -- FedosConversationReader", () => {
  it("1. findConversation resolves a persisted record by id", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation(RECORD);
    const reader = new FedosConversationReader(persistence);
    expect(reader.findConversation(RECORD.id as any)?.rootPostId).toBe("thread-1");
  });

  it("2. findConversation returns null for a nonexistent id", () => {
    const reader = new FedosConversationReader(new InMemoryFedosConversationPersistence());
    expect(reader.findConversation("does-not-exist" as any)).toBeNull();
  });

  it("3. conversationForThread resolves via deterministic id, no separate index needed", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation(RECORD);
    const reader = new FedosConversationReader(persistence);
    expect(reader.conversationForThread(boardId, threadId)?.boardId).toBe(boardId);
  });

  it("4. conversationForThread returns null for a thread with no Conversation record", () => {
    const reader = new FedosConversationReader(new InMemoryFedosConversationPersistence());
    expect(reader.conversationForThread(boardId, threadId)).toBeNull();
  });

  it("5. listBoardConversations filters by boardId, no cross-board leakage", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation(RECORD);
    const otherBoardId = toFedosBoardId("board-b")!;
    const otherThreadId = toFedosThreadId("thread-2")!;
    persistence.putConversation({
      ...RECORD,
      id: toFedosConversationId(otherBoardId, otherThreadId),
      boardId: "board-b",
      rootThreadId: "thread-2",
      rootPostId: "thread-2",
    });

    const reader = new FedosConversationReader(persistence);
    const results = reader.listBoardConversations(boardId);
    expect(results).toHaveLength(1);
    expect(results[0]?.boardId).toBe(boardId);
  });

  it("6. a corrupt persisted record is excluded from list results, not thrown", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation({ ...RECORD, mode: "not-a-real-mode" });
    const reader = new FedosConversationReader(persistence);
    expect(() => reader.listBoardConversations(boardId)).not.toThrow();
    expect(reader.listBoardConversations(boardId)).toEqual([]);
  });

  it("7. never exposes the injected persistence object itself", () => {
    const reader = new FedosConversationReader(new InMemoryFedosConversationPersistence());
    const publicMethodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(reader)).filter((n) => n !== "constructor");
    expect(publicMethodNames.sort()).toEqual(["conversationForThread", "findConversation", "listBoardConversations"].sort());
  });
});

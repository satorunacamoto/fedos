import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import type { FedosConversationPersistence } from "../src/conversation/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/conversation/persistence/fedos_persisted_conversation_record_v1.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

const RECORD: FedosPersistedConversationRecordV1 = {
  schemaVersion: 1,
  id: "board-a::thread-1",
  mode: "public",
  boardId: "board-a",
  rootThreadId: "thread-1",
  rootPostId: "thread-1",
  policyReference: "public-v1",
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 751 ("In-Memory Persistence") -- Stage 11 of the
 * Alpha 741-760 Canonical Conversation Identity and Record Foundation
 * Arc.
 */
describe("Secure Runtime Alpha 751 -- InMemoryFedosConversationPersistence", () => {
  it("1. insert: a genuinely new id is accepted", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    expect(persistence.putConversation(RECORD)).toBe("inserted");
    expect(persistence.getConversation(RECORD.id as FedosConversationId)).toEqual(RECORD);
  });

  it("2. idempotent duplicate: the same id written again with identical content returns already-present", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation(RECORD);
    expect(persistence.putConversation({ ...RECORD })).toBe("already-present");
  });

  it("3. conflict never overwrites: the same id written again with different content is rejected, original preserved", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation(RECORD);
    expect(persistence.putConversation({ ...RECORD, createdAt: 1 })).toBe("conflict");
    expect(persistence.getConversation(RECORD.id as FedosConversationId)?.createdAt).toBe(RECORD.createdAt);
  });

  it("4. independent instances never share state", () => {
    const a = new InMemoryFedosConversationPersistence();
    const b = new InMemoryFedosConversationPersistence();
    a.putConversation(RECORD);
    expect(b.getConversation(RECORD.id as FedosConversationId)).toBeNull();
    expect(b.listConversations()).toEqual([]);
  });

  it("5. listConversations returns a NEW array every call", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    persistence.putConversation(RECORD);
    const first = persistence.listConversations();
    const second = persistence.listConversations();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("6. getConversation returns null for a nonexistent id", () => {
    const persistence = new InMemoryFedosConversationPersistence();
    expect(persistence.getConversation("does-not-exist" as FedosConversationId)).toBeNull();
  });

  it("7. type-level: satisfies FedosConversationPersistence", () => {
    const persistence: FedosConversationPersistence = new InMemoryFedosConversationPersistence();
    expect(typeof persistence.putConversation).toBe("function");
    expect(typeof persistence.getConversation).toBe("function");
    expect(typeof persistence.listConversations).toBe("function");
  });
});

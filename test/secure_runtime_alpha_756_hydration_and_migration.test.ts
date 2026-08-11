import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { hydrateFedosConversations } from "../src/os/messenger/conversations/fedos_conversation_hydration.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.js";

const RECORD: FedosPersistedConversationRecordV1 = {
  schemaVersion: 1,
  id: "board-r::p1",
  mode: "public",
  boardId: "board-r",
  rootThreadId: "p1",
  rootPostId: "p1",
  policyReference: "public-v1",
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 756 ("Hydration and Migration") -- Stage 16 of
 * the Alpha 741-760 Canonical Conversation Identity and Record
 * Foundation Arc.
 */
describe("Secure Runtime Alpha 756 -- Hydration and Migration", () => {
  let host: FedosDesktopHost;

  beforeEach(async () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence });
    await host.start();
    const post = validateFedosBoardPost({
      id: "p1",
      boardId: "board-r",
      threadId: "p1",
      replyTo: null,
      author: { identityId: null, protocol: "fedos", publicIdentifier: "local-anonymous" },
      body: "root post",
      createdAt: 1_700_000_000,
      source: { protocol: "fedos", reference: "p1" },
    })!;
    host.submitPost(post);
  });

  it("1. hydrates cleanly when every Conversation record's root matches the hydrated Board state", () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    conversationPersistence.putConversation(RECORD);
    const result = hydrateFedosConversations(conversationPersistence, host.board()!);
    expect(result.outcome).toBe("hydrated");
    expect(result.verifiedCount).toBe(1);
  });

  it("2. hydrates cleanly with zero Conversation records -- legacy Board data with no records is not corruption", () => {
    const result = hydrateFedosConversations(new InMemoryFedosConversationPersistence(), host.board()!);
    expect(result.outcome).toBe("hydrated");
    expect(result.verifiedCount).toBe(0);
  });

  it("3. fails closed on a corrupt persisted record", () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    conversationPersistence.putConversation({ ...RECORD, mode: "not-a-real-mode" });
    const result = hydrateFedosConversations(conversationPersistence, host.board()!);
    expect(result.outcome).toBe("rejected-corrupt-record");
  });

  it("4. fails closed when a record's root post does not exist in the hydrated Board state", () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    conversationPersistence.putConversation({ ...RECORD, id: "board-r::ghost", rootThreadId: "ghost", rootPostId: "ghost" });
    const result = hydrateFedosConversations(conversationPersistence, host.board()!);
    expect(result.outcome).toBe("rejected-root-mismatch");
  });

  it("5. fails closed when a record claims the wrong boardId for a real root post", () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    conversationPersistence.putConversation({ ...RECORD, boardId: "wrong-board" });
    const result = hydrateFedosConversations(conversationPersistence, host.board()!);
    expect(result.outcome).toBe("rejected-root-mismatch");
  });

  it("6. no side effect -- hydration never writes to conversationPersistence", () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    conversationPersistence.putConversation(RECORD);
    hydrateFedosConversations(conversationPersistence, host.board()!);
    expect(conversationPersistence.listConversations()).toEqual([RECORD]);
  });
});

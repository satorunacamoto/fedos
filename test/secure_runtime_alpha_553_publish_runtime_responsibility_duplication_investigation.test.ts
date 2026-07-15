import { describe, it, expect } from "vitest";
import { PersistedFedosBoardRepository } from "../src/board/persistence/persisted_fedos_board_repository.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost } from "../src/board/fedos_board_post_validator.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";

/**
 * Secure Runtime Alpha 553 -- "Responsibility Duplication
 * Investigation": Stage 13 of the Alpha 541-560 Publish Runtime
 * Operational Review Arc. Review test only -- proves, by real
 * execution, that PersistedFedosBoardRepository accepts a post that
 * violates thread integrity, which FedosBoardService would reject --
 * the divergent-semantics trap this Stage's own doc names.
 */
describe("Secure Runtime Alpha 553 -- Responsibility Duplication Investigation", () => {
  it("1. PersistedFedosBoardRepository.register() accepts a reply whose parent does not exist -- no thread-integrity check, unlike FedosBoardService", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);

    const orphanReply = validateFedosBoardPost({
      id: "reply-1",
      boardId: "board-1",
      threadId: "root-does-not-exist",
      replyTo: "root-does-not-exist",
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "an orphan reply",
      createdAt: 1_700_000_000,
      source: { protocol: "nostr", reference: "ref-orphan" },
    })!;

    // FedosBoardService.registerPost() would return "missing-parent" for this exact input --
    // PersistedFedosBoardRepository has no such check and accepts it unconditionally.
    const result = repository.register(orphanReply);
    expect(result).toBe("inserted");
    expect(repository.findPost(orphanReply.id)).not.toBeNull();
  });

  it("2. the SAME input is rejected by FedosBoardService, confirming the divergent semantics directly", () => {
    const service = new FedosBoardService();

    const orphanReply = validateFedosBoardPost({
      id: "reply-1",
      boardId: "board-1",
      threadId: "root-does-not-exist",
      replyTo: "root-does-not-exist",
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "an orphan reply",
      createdAt: 1_700_000_000,
      source: { protocol: "nostr", reference: "ref-orphan" },
    })!;

    expect(service.registerPost(orphanReply)).toBe("missing-parent");
  });
});

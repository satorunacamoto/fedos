import { describe, it, expect } from "vitest";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { PersistedFedosBoardRepository } from "../src/os/messenger/board/persistence/persisted_fedos_board_repository.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost } from "../src/os/messenger/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 557 -- "State Machine Contradiction
 * Investigation": Stage 17 of the Alpha 541-560 Publish Runtime
 * Operational Review Arc. Review test only -- checks the ONE plausible
 * wiring path (injecting PersistedFedosBoardRepository as
 * FedosBoardService's own repository dependency) and confirms
 * FedosBoardService's own precheck still protects the seven-token
 * contract even through that injection, by real execution.
 */
describe("Secure Runtime Alpha 557 -- State Machine Contradiction Investigation", () => {
  it("1. FedosBoardService still returns missing-parent for an orphan reply, EVEN when its own repository is a PersistedFedosBoardRepository", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const persistedRepository = new PersistedFedosBoardRepository(persistence);
    const service = new FedosBoardService(persistedRepository);

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

    // FedosBoardService's own precheck runs BEFORE ever calling
    // persistedRepository.register() -- the seven-token contract holds
    // even through this specific injection, confirming Alpha 557's own claim.
    expect(service.registerPost(orphanReply)).toBe("missing-parent");
    expect(persistedRepository.listPosts()).toEqual([]);
  });

  it("2. a directly-called PersistedFedosBoardRepository.register(), bypassing FedosBoardService, accepts the SAME orphan reply -- the real risk lives at the bypass, not the injection", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const persistedRepository = new PersistedFedosBoardRepository(persistence);

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

    expect(persistedRepository.register(orphanReply)).toBe("inserted");
  });
});

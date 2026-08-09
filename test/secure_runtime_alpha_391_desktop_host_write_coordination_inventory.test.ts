import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_391_desktop_host_write_coordination_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/os/messenger/board/repository/fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistedRepositorySource from "../src/os/messenger/board/persistence/persisted_fedos_board_repository.ts?raw";

import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { PersistedFedosBoardRepository } from "../src/os/messenger/board/persistence/persisted_fedos_board_repository.js";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { hydrateFedosBoardService } from "../src/os/messenger/board/persistence/fedos_board_hydration.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";

const INPUT: FedosBoardPostInput = {
  id: "post-391",
  boardId: "board-391",
  threadId: "post-391",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1inv" },
  body: "inventory fixture",
  createdAt: 1_700_003_000,
  source: { protocol: "nostr", reference: "inv-ref" },
};

/**
 * Secure Runtime Alpha 391 -- "Existing Write Flow Inventory": Stage 1
 * of the Alpha 391-400 Desktop Host Durable Write Coordination Arc.
 * Review only. Inventories the actual write responsibilities of every
 * file this Arc touches before any implementation.
 */
describe("Secure Runtime Alpha 391 -- Desktop Host Write Coordination Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. structural: FedosBoardRepository's own frozen contract carries zero diff -- register/findPost/listPosts only", () => {
    expect(repositorySource).toMatch(/register\(post: FedosBoardPost\): FedosBoardRepositoryWriteResult;/);
    expect(repositorySource).toMatch(/findPost\(id: FedosBoardPostId\): FedosBoardPost \| null;/);
    expect(repositorySource).toMatch(/listPosts\(\): readonly FedosBoardPost\[\];/);
  });

  it("3. structural: FedosBoardPersistence's own frozen port carries zero diff -- putPost/getPost/listPosts only", () => {
    expect(persistenceSource).toMatch(/putPost\(record: FedosPersistedBoardPostRecordV1\): FedosBoardPersistenceWriteResult;/);
    expect(persistenceSource).not.toMatch(/deletePost|removePost/);
  });

  it("4. behavioral: PersistedFedosBoardRepository already bridges Persistence to the Repository contract, confirming Section 4's own finding", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const post = validateFedosBoardPost(INPUT)!;
    expect(repository.register(post)).toBe("inserted");
    expect(persistence.listPosts()).toHaveLength(1);
  });

  it("5. behavioral: the confirmed gap -- FedosBoardService.registerPost() never reaches FedosBoardPersistence", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const service = new FedosBoardService(); // default: in-memory repository, NOT PersistedFedosBoardRepository
    const post = validateFedosBoardPost(INPUT)!;
    expect(service.registerPost(post)).toBe("inserted");
    // The write never touched `persistence` -- it was never given to `service`.
    expect(persistence.listPosts()).toHaveLength(0);
  });

  it("6. behavioral: hydrateFedosBoardService() always constructs a FedosBoardService with the default in-memory repository, confirming Section 2's own finding", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(INPUT)!;
    persistence.putPost(serializeFedosBoardPost(post));
    const hydration = hydrateFedosBoardService(persistence);
    expect(hydration.outcome).toBe("hydrated");
    // Writing directly into the hydrated service's repository still never
    // reaches `persistence` -- confirming the gap survives hydration.
    const secondInput: FedosBoardPostInput = { ...INPUT, id: "post-391b", threadId: "post-391b", source: { protocol: "nostr", reference: "inv-ref-2" } };
    const second = validateFedosBoardPost(secondInput)!;
    expect(hydration.service!.registerPost(second)).toBe("inserted");
    expect(persistence.listPosts()).toHaveLength(1); // only the ORIGINAL hydrated post, not the new one.
  });

  it("7. structural: PersistedFedosBoardRepository is not constructed anywhere in src/desktop/host/", () => {
    // Confirmed by direct inspection (Section 4): zero construction site
    // outside this class's own file and its own Alpha 317 test.
    expect(persistedRepositorySource).not.toMatch(/FedosDesktopHost|desktop\/host/);
  });

  it("8. the design doc names the exact gap and does not propose a fix yet", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "Closing the gap requires exactly one new coordinating write path that touches BOTH `FedosBoardPersistence` and `FedosBoardService`'s own Repository in the correct order",
    );
  });

  it("9. the design doc cross-references Alpha 390, Alpha 367, Alpha 317, and Alpha 315", () => {
    for (const ref of [
      "secure_runtime_alpha_390_host_query_integration_completion",
      "secure_runtime_alpha_367_host_restart_verification",
      "secure_runtime_alpha_317_persisted_board_repository",
      "secure_runtime_alpha_315_board_persistence_port",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

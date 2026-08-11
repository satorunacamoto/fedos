import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_317_persisted_board_repository.md?raw";
import { PersistedFedosBoardRepository } from "../src/os/messenger/board/persistence/persisted_fedos_board_repository.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/os/messenger/board/persistence/fedos_persisted_board_post_v1.js";

const INPUT: FedosBoardPostInput = {
  id: "post-1",
  boardId: "board-1",
  threadId: "post-1",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "abc123" },
};

/**
 * Secure Runtime Alpha 317 -- "Persisted Board Repository Adapter":
 * Stage 7 of the Canonical Board Persistence Boundary Arc. Adds
 * src/board/persistence/persisted_fedos_board_repository.ts, exporting
 * PersistedFedosBoardRepository -- implements the frozen
 * FedosBoardRepository contract, Option B strict listPosts, Option C
 * diagnostic supplement.
 */
describe("Secure Runtime Alpha 317 -- Persisted Board Repository Adapter", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: register serializes and writes through the persistence port", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const post = validateFedosBoardPost(INPUT)!;
    expect(repository.register(post)).toBe("inserted");
    expect(persistence.getPost(post.id)).not.toBeNull();
  });

  it("3. behavioral: register returns already-present for an idempotent re-registration", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const postA = validateFedosBoardPost(INPUT)!;
    const postB = validateFedosBoardPost({ ...INPUT })!;
    expect(repository.register(postA)).toBe("inserted");
    expect(repository.register(postB)).toBe("already-present");
  });

  it("4. behavioral: register returns conflict for the same id with different content, original preserved", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const original = validateFedosBoardPost(INPUT)!;
    const different = validateFedosBoardPost({ ...INPUT, body: "a different message" })!;
    expect(repository.register(original)).toBe("inserted");
    expect(repository.register(different)).toBe("conflict");
    expect(repository.findPost(original.id)!.body).toBe(INPUT.body);
  });

  it("5. behavioral: findPost deserializes and validates, returns null for an unregistered id", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const registered = validateFedosBoardPost(INPUT)!;
    const neverRegistered = validateFedosBoardPost({ ...INPUT, id: "post-never-registered" })!;
    repository.register(registered);
    expect(repository.findPost(neverRegistered.id)).toBeNull();
    expect(repository.findPost(registered.id)).not.toBeNull();
  });

  it("6. behavioral: findPost returns null for a corrupt record at that id", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const post = validateFedosBoardPost(INPUT)!;
    const record = serializeFedosBoardPost(post);
    // Plant a corrupt record directly (schemaVersion 2) bypassing register().
    const corrupt = { ...record, schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1;
    // Use a fresh persistence with the corrupt record already present.
    const corruptPersistence = new InMemoryFedosBoardPersistence();
    corruptPersistence.putPost(corrupt);
    const corruptRepository = new PersistedFedosBoardRepository(corruptPersistence);
    expect(corruptRepository.findPost(post.id)).toBeNull();
  });

  it("7. behavioral: listPosts (Option B) returns an empty array if ANY persisted record is corrupt", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const validPost = validateFedosBoardPost(INPUT)!;
    repository.register(validPost);
    const corruptRecord = { ...serializeFedosBoardPost(validPost), id: "post-2", schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1;
    persistence.putPost(corruptRecord);
    expect(repository.listPosts()).toEqual([]);
  });

  it("8. behavioral: listPostsDiagnostic (Option C) returns partial posts plus an honest corruption count", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const validPost = validateFedosBoardPost(INPUT)!;
    repository.register(validPost);
    const corruptRecord = { ...serializeFedosBoardPost(validPost), id: "post-2", schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1;
    persistence.putPost(corruptRecord);
    const diagnostic = repository.listPostsDiagnostic();
    expect(diagnostic.posts).toHaveLength(1);
    expect(diagnostic.corruptRecordCount).toBe(1);
  });

  it("9. behavioral: listPosts returns all posts when none are corrupt", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const repository = new PersistedFedosBoardRepository(persistence);
    const postA = validateFedosBoardPost(INPUT)!;
    const postB = validateFedosBoardPost({ ...INPUT, id: "post-2", threadId: "post-2", source: { protocol: "nostr", reference: "other" } })!;
    repository.register(postA);
    repository.register(postB);
    expect(repository.listPosts()).toHaveLength(2);
  });

  it("10. the design doc documents the failed-to-conflict mapping as deliberate and currently unreachable", () => {
    expect(designDocSource).toMatch(/Mapping `"failed"` to `"conflict"` — a documented, currently/);
  });

  it("11. the design doc cross-references Alpha 313, Alpha 314, Alpha 315, Alpha 316, and Alpha 302", () => {
    for (const ref of [
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_314_board_serialization_boundary",
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_316_in_memory_board_persistence",
      "secure_runtime_alpha_302_board_repository_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

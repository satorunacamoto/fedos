import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_316_in_memory_board_persistence.md?raw";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/os/messenger/board/persistence/fedos_persisted_board_post_v1.js";

const RECORD: FedosPersistedBoardPostRecordV1 = {
  schemaVersion: 1,
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
 * Secure Runtime Alpha 316 -- "In-Memory Board Persistence Backend":
 * Stage 6 of the Canonical Board Persistence Boundary Arc. Adds
 * src/board/persistence/in_memory_fedos_board_persistence.ts, exporting
 * InMemoryFedosBoardPersistence -- deterministic, no constructor side
 * effects, independent instances, fresh listPosts() array each call.
 */
describe("Secure Runtime Alpha 316 -- In-Memory Board Persistence Backend", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: new record -> inserted", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    expect(persistence.putPost(RECORD)).toBe("inserted");
    expect(persistence.getPost(RECORD.id)).toEqual(RECORD);
  });

  it("3. behavioral: identical record -> already-present, no mutation", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(RECORD);
    expect(persistence.putPost({ ...RECORD, author: { ...RECORD.author }, source: { ...RECORD.source } })).toBe(
      "already-present",
    );
  });

  it("4. behavioral: same ID, different record -> conflict, never overwritten", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(RECORD);
    const different: FedosPersistedBoardPostRecordV1 = { ...RECORD, body: "a different message" };
    expect(persistence.putPost(different)).toBe("conflict");
    expect(persistence.getPost(RECORD.id)!.body).toBe(RECORD.body);
  });

  it("5. behavioral: getPost returns null for an unregistered id", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    expect(persistence.getPost("unknown-id")).toBeNull();
  });

  it("6. behavioral: listPosts returns a NEW array each call", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(RECORD);
    const first = persistence.listPosts();
    const second = persistence.listPosts();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("7. behavioral: independent instances do not share state", () => {
    const a = new InMemoryFedosBoardPersistence();
    const b = new InMemoryFedosBoardPersistence();
    a.putPost(RECORD);
    expect(a.listPosts()).toHaveLength(1);
    expect(b.listPosts()).toHaveLength(0);
  });

  it("8. the design doc confirms this is NOT the same as InMemoryFedosBoardRepository", () => {
    expect(designDocSource).toMatch(/Persistence stores plain\s+persisted/);
    expect(designDocSource).toMatch(/Repository stores validated/);
  });

  it("9. the design doc cross-references Alpha 315, Alpha 303, Alpha 313, and Alpha 317", () => {
    for (const ref of [
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_303_in_memory_board_repository",
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_317_persisted_board_repository",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

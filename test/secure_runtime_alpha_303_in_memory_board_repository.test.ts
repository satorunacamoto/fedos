import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_303_in_memory_board_repository.md?raw";
import { InMemoryFedosBoardRepository } from "../src/os/messenger/board/repository/in_memory_fedos_board_repository.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

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
 * Secure Runtime Alpha 303 -- "In-Memory Board Repository": Stage 3 of
 * the Canonical Board Repository, Index & Feed Foundation Arc. Adds
 * src/board/repository/in_memory_fedos_board_repository.ts, exporting
 * InMemoryFedosBoardRepository -- deterministic, no constructor side
 * effects, independent instances, fresh listPosts() array each call.
 */
describe("Secure Runtime Alpha 303 -- In-Memory Board Repository", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: new ID + new post -> inserted", () => {
    const repo = new InMemoryFedosBoardRepository();
    const post = validateFedosBoardPost(INPUT)!;
    expect(repo.register(post)).toBe("inserted");
    expect(repo.findPost(post.id)).toBe(post);
  });

  it("3. behavioral: same ID + structurally identical post -> already-present, no mutation", () => {
    const repo = new InMemoryFedosBoardRepository();
    const postA = validateFedosBoardPost(INPUT)!;
    const postB = validateFedosBoardPost({ ...INPUT })!;
    expect(repo.register(postA)).toBe("inserted");
    expect(repo.register(postB)).toBe("already-present");
    expect(repo.findPost(postA.id)).toBe(postA); // original reference preserved
  });

  it("4. behavioral: same ID + different post -> conflict, original preserved, never overwritten", () => {
    const repo = new InMemoryFedosBoardRepository();
    const original = validateFedosBoardPost(INPUT)!;
    const different = validateFedosBoardPost({ ...INPUT, body: "a completely different message" })!;
    expect(repo.register(original)).toBe("inserted");
    expect(repo.register(different)).toBe("conflict");
    expect(repo.findPost(original.id)).toBe(original);
    expect(repo.findPost(original.id)!.body).toBe(INPUT.body);
  });

  it("5. behavioral: findPost returns null for an unregistered id", () => {
    const repo = new InMemoryFedosBoardRepository();
    const registered = validateFedosBoardPost(INPUT)!;
    const neverRegistered = validateFedosBoardPost({ ...INPUT, id: "post-never-registered" })!;
    repo.register(registered);
    expect(repo.findPost(neverRegistered.id)).toBeNull();
  });

  it("6. behavioral: listPosts returns a NEW array each call; mutating the returned array does not affect the repository", () => {
    const repo = new InMemoryFedosBoardRepository();
    const post = validateFedosBoardPost(INPUT)!;
    repo.register(post);
    const first = repo.listPosts();
    const second = repo.listPosts();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    (first as unknown as unknown[]).push("mutated");
    expect(repo.listPosts()).toHaveLength(1);
  });

  it("7. behavioral: independent instances do not share state", () => {
    const repoA = new InMemoryFedosBoardRepository();
    const repoB = new InMemoryFedosBoardRepository();
    const post = validateFedosBoardPost(INPUT)!;
    repoA.register(post);
    expect(repoA.listPosts()).toHaveLength(1);
    expect(repoB.listPosts()).toHaveLength(0);
  });

  it("8. behavioral: registered posts are stored by reference, not copied -- findPost returns the exact same object", () => {
    const repo = new InMemoryFedosBoardRepository();
    const post = validateFedosBoardPost(INPUT)!;
    repo.register(post);
    expect(repo.findPost(post.id)).toBe(post);
  });

  it("9. the design doc confirms insertion order must not silently define feed ranking", () => {
    expect(designDocSource).toMatch(/Insertion order must not silently define/);
  });

  it("10. the design doc cross-references Alpha 302, Alpha 257, and Alpha 301", () => {
    for (const ref of [
      "secure_runtime_alpha_302_board_repository_contract",
      "secure_runtime_alpha_257_board_validation_boundary",
      "secure_runtime_alpha_301_existing_board_repository_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

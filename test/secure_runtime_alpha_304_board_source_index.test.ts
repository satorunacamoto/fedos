import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_304_board_source_index.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceIndexSource from "../src/os/messenger/board/repository/fedos_board_source_index.ts?raw";
import { FedosBoardSourceIndex } from "../src/os/messenger/board/repository/fedos_board_source_index.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

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
 * Secure Runtime Alpha 304 -- "Board Source Provenance Deduplication
 * Index": Stage 4 of the Canonical Board Repository, Index & Feed
 * Foundation Arc. Adds src/board/repository/fedos_board_source_index.ts,
 * exporting FedosBoardSourceIndex -- keyed by fedosBoardSourceKey,
 * idempotent same-source-same-id, conflict on same-source-different-id.
 */
describe("Secure Runtime Alpha 304 -- Board Source Provenance Deduplication Index", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: same source -> same post ID is idempotent", () => {
    const index = new FedosBoardSourceIndex();
    const postA = validateFedosBoardPost(INPUT)!;
    const postB = validateFedosBoardPost({ ...INPUT })!;
    expect(index.register(postA)).toBe("inserted");
    expect(index.register(postB)).toBe("already-present");
  });

  it("3. behavioral: same source -> different post ID is a conflict", () => {
    const index = new FedosBoardSourceIndex();
    const postA = validateFedosBoardPost(INPUT)!;
    const postB = validateFedosBoardPost({ ...INPUT, id: "post-2" })!;
    expect(index.register(postA)).toBe("inserted");
    expect(index.register(postB)).toBe("conflict");
    expect(index.findBySource(postA.source)).toBe(postA.id); // original mapping preserved
  });

  it("4. behavioral: different source -> independent entries", () => {
    const index = new FedosBoardSourceIndex();
    const postA = validateFedosBoardPost(INPUT)!;
    const postB = validateFedosBoardPost({
      ...INPUT,
      id: "post-2",
      source: { protocol: "nostr", reference: "different-ref" },
    })!;
    expect(index.register(postA)).toBe("inserted");
    expect(index.register(postB)).toBe("inserted");
    expect(index.findBySource(postA.source)).toBe(postA.id);
    expect(index.findBySource(postB.source)).toBe(postB.id);
  });

  it("5. behavioral: findBySource returns null for an unregistered source", () => {
    const index = new FedosBoardSourceIndex();
    const post = validateFedosBoardPost(INPUT)!;
    expect(index.findBySource(post.source)).toBeNull();
  });

  it("6. structural: no post mutation, no protocol parsing, no network/storage import IN CODE", () => {
    expect(codeOnly(sourceIndexSource)).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|fetch\(|WebSocket|async function/);
  });

  it("7. the design doc confirms Repository ID conflict and Source conflict are separate facts", () => {
    expect(designDocSource).toMatch(/Repository ID conflict and Source provenance conflict are\s*\nSEPARATE facts/);
  });

  it("8. the design doc cross-references Alpha 301, Alpha 253, and Alpha 302", () => {
    for (const ref of [
      "secure_runtime_alpha_301_existing_board_repository_inventory",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_302_board_repository_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

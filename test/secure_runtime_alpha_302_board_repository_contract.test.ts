import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_302_board_repository_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import contractSource from "../src/os/messenger/board/repository/fedos_board_repository.ts?raw";
import { fedosBoardPostsAreStructurallyEqual } from "../src/os/messenger/board/repository/fedos_board_repository.js";
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
 * Secure Runtime Alpha 302 -- "Board Repository Contract": Stage 2 of
 * the Canonical Board Repository, Index & Feed Foundation Arc. Adds
 * src/board/repository/fedos_board_repository.ts, exporting
 * FedosBoardRepository, FedosBoardRepositoryWriteResult, and
 * fedosBoardPostsAreStructurallyEqual -- no removePost in this first
 * contract.
 */
describe("Secure Runtime Alpha 302 -- Board Repository Contract", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: the contract has no removePost method IN CODE", () => {
    expect(codeOnly(contractSource)).not.toMatch(/removePost/);
  });

  it("3. structural: FedosBoardRepositoryWriteResult is a fixed three-value union, no boolean", () => {
    expect(contractSource).toMatch(
      /export type FedosBoardRepositoryWriteResult = "inserted" \| "already-present" \| "conflict";/,
    );
  });

  it("4. behavioral: fedosBoardPostsAreStructurallyEqual is true for two independently-built, field-equal posts", () => {
    const a = validateFedosBoardPost(INPUT)!;
    const b = validateFedosBoardPost({ ...INPUT })!;
    expect(a).not.toBe(b); // different object instances
    expect(fedosBoardPostsAreStructurallyEqual(a, b)).toBe(true);
  });

  it("5. behavioral: fedosBoardPostsAreStructurallyEqual is false when any single field differs", () => {
    const a = validateFedosBoardPost(INPUT)!;
    const differentBody = validateFedosBoardPost({ ...INPUT, body: "a different message" })!;
    const differentAuthor = validateFedosBoardPost({
      ...INPUT,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1other" },
    })!;
    const differentSource = validateFedosBoardPost({
      ...INPUT,
      source: { protocol: "nostr", reference: "different-ref" },
    })!;
    expect(fedosBoardPostsAreStructurallyEqual(a, differentBody)).toBe(false);
    expect(fedosBoardPostsAreStructurallyEqual(a, differentAuthor)).toBe(false);
    expect(fedosBoardPostsAreStructurallyEqual(a, differentSource)).toBe(false);
  });

  it("6. structural: the contract file has no network/storage import IN CODE", () => {
    expect(codeOnly(contractSource)).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|fetch\(|WebSocket/);
  });

  it("7. the design doc explains why removePost is excluded from the first contract", () => {
    expect(designDocSource).toMatch(/\*\*Excluded\*\*, matching the instruction's own\s*\npreferred minimal contract/);
  });

  it("8. the design doc cross-references Alpha 301, Alpha 255, Alpha 258, and Alpha 303", () => {
    for (const ref of [
      "secure_runtime_alpha_301_existing_board_repository_inventory",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_258_moderation_deletion_boundary",
      "secure_runtime_alpha_303_in_memory_board_repository",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

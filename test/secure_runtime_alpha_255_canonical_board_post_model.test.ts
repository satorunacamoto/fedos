import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_255_canonical_board_post_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModuleSource from "../src/os/messenger/board/fedos_board_post.ts?raw";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const VALID_INPUT: FedosBoardPostInput = {
  id: "post-1",
  boardId: "board-general",
  threadId: "post-1",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "abcdef0123456789" },
};

/**
 * Secure Runtime Alpha 255 -- "Canonical Board Post Model": Stage 5 of
 * the Canonical Board Model Foundation Arc. Adds
 * src/board/fedos_board_post.ts, exporting FedosBoardPost -- eight
 * readonly fields, no transport object, no title, no attachments.
 */
describe("Secure Runtime Alpha 255 -- Canonical Board Post Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: FedosBoardPost is the only export, exactly eight readonly fields", () => {
    const exportNames = [...postModuleSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosBoardPost"]);
    const fieldMatches = [...postModuleSource.matchAll(/^\s*readonly (\w+):/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldMatches).toEqual([
      "id",
      "boardId",
      "threadId",
      "replyTo",
      "author",
      "body",
      "createdAt",
      "source",
    ]);
  });

  it("3. structural: no title/subject/attachments/contentWarning/language/editedAt/deletedAt field, IN CODE", () => {
    expect(codeOnly(postModuleSource)).not.toMatch(
      /\btitle\b|\bsubject\b|\battachments?\b|contentWarning|\blanguage\b|editedAt|deletedAt/,
    );
  });

  it("4. structural: defines a TYPE ONLY -- no function, class, or construction logic IN CODE", () => {
    expect(codeOnly(postModuleSource)).not.toMatch(/\bfunction\b|\bclass\b/);
  });

  it("5. behavioral: a well-formed input constructs a frozen FedosBoardPost", () => {
    const post = validateFedosBoardPost(VALID_INPUT);
    expect(post).not.toBeNull();
    expect(post!.body).toBe("Hello board world");
    expect(post!.createdAt).toBe(1_700_000_000);
    expect(Object.isFrozen(post)).toBe(true);
  });

  it("6. the design doc explains why each of the six candidate optional fields is NOT added this Arc", () => {
    for (const field of ["subject/title", "attachments", "content warning", "language", "editedAt", "deletedAt"]) {
      expect(designDocSource.toLowerCase()).toContain(field.toLowerCase());
    }
  });

  it("7. the design doc cross-references Alpha 254, Alpha 256, Alpha 257, and Alpha 258", () => {
    for (const ref of [
      "secure_runtime_alpha_254_canonical_board_author",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_257_board_validation_boundary",
      "secure_runtime_alpha_258_moderation_deletion_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

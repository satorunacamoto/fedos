import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_363_corruption_classification.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { hydrateFedosBoardService } from "../src/os/messenger/board/persistence/fedos_board_hydration.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-363",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 363 -- "Corruption Classification": Stage 3 of
 * the Alpha 361-370 Board Recovery & Host Robustness Arc. Review
 * only. Exercises all seven categories (A-G) against the real
 * implementation, confirming each behaves per its documented handling.
 */
describe("Secure Runtime Alpha 363 -- Corruption Classification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. category A: missing/empty file is not corruption", () => {
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "missing.jsonl"));
    expect(persistence.listPosts()).toEqual([]);
  });

  it("3. category B: syntactically invalid content throws", () => {
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, "not json\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).toThrow();
  });

  it("4. category C: conflicting duplicate ids throw", () => {
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const filePath = join(dir, "board.jsonl");
    const rec1 = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    const rec2 = { ...rec1, body: "different" };
    writeFileSync(filePath, JSON.stringify(rec1) + "\n" + JSON.stringify(rec2) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).toThrow();
  });

  it("5. category D: syntactically valid but semantically invalid (unknown schema) does not throw at the persistence layer, but fails closed at hydration", () => {
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const filePath = join(dir, "board.jsonl");
    const rec = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    writeFileSync(filePath, JSON.stringify({ ...rec, schemaVersion: 2 }) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).not.toThrow();
    const hydration = hydrateFedosBoardService(persistence);
    expect(hydration.outcome).toBe("rejected-corrupt-record");
  });

  it("6. category E: a reply with a never-persisted parent fails closed at hydration, not the persistence layer", () => {
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const filePath = join(dir, "board.jsonl");
    const replyInput: FedosBoardPostInput = {
      id: "reply-orphan",
      boardId: "board-363",
      threadId: "root-never-persisted",
      replyTo: "root-never-persisted",
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "orphan",
      createdAt: 1_700_000_100,
      source: { protocol: "nostr", reference: "ref-orphan" },
    };
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(replyInput)!));
    expect(() => persistence.listPosts()).not.toThrow();
    const hydration = hydrateFedosBoardService(persistence);
    expect(hydration.outcome).toBe("rejected-unresolvable-thread-integrity");
  });

  it("7. category F: a non-ENOENT read error is never conflated with an empty file", () => {
    // Pointing the persistence at a DIRECTORY (not a file) reliably produces a
    // non-ENOENT read error (EISDIR) on both Windows and POSIX.
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const persistence = new AppendOnlyFedosBoardPersistence(dir as string);
    expect(() => persistence.listPosts()).toThrow();
  });

  it("8. category G: a write-time I/O failure returns a defined token, never throws", () => {
    dir = mkdtempSync(join(tmpdir(), "a363-"));
    const badPath = join(dir, "no-such-dir", "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(badPath);
    const rec = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    expect(() => persistence.putPost(rec)).not.toThrow();
    expect(persistence.putPost(rec)).toBe("failed");
  });

  it("9. the design doc's own table names all seven categories A-G", () => {
    for (const letter of ["A.", "B.", "C.", "D.", "E.", "F.", "G."]) {
      expect(designDocSource).toContain(`**${letter}`);
    }
  });

  it("10. the design doc cross-references Alpha 362, Alpha 361, Alpha 357, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_362_hydration_failure_policy",
      "secure_runtime_alpha_361_host_failure_inventory",
      "secure_runtime_alpha_357_crash_review",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

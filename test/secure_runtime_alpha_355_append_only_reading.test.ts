import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_355_append_only_reading.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-355",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 355 -- "Implement Reading": Stage 5 of the
 * Alpha 351-360 Append-only Durable Board Backend Arc. getPost()/
 * listPosts() rebuild state by replaying the log -- no side index.
 */
describe("Secure Runtime Alpha 355 -- Append-only Reading", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: a record appended by an EXTERNAL writer (not this instance's own putPost) is visible on the very next call -- proving no cache", () => {
    dir = mkdtempSync(join(tmpdir(), "a355-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(persistence.listPosts()).toEqual([]);

    const post = validateFedosBoardPost(rootInput("post-1"))!;
    const record = serializeFedosBoardPost(post);
    // A second, independent writer appends directly -- this instance never called putPost().
    writeFileSync(filePath, JSON.stringify(record) + "\n", "utf8");

    expect(persistence.listPosts()).toHaveLength(1);
    expect(persistence.getPost("post-1")).toEqual(record);
  });

  it("3. behavioral: appending externally between two listPosts() calls on the SAME instance changes the second result -- proving no cached snapshot", () => {
    dir = mkdtempSync(join(tmpdir(), "a355-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const post1 = validateFedosBoardPost(rootInput("post-1"))!;
    persistence.putPost(serializeFedosBoardPost(post1));

    const firstRead = persistence.listPosts();
    expect(firstRead).toHaveLength(1);

    const post2 = validateFedosBoardPost(rootInput("post-2"))!;
    appendFileSync(filePath, JSON.stringify(serializeFedosBoardPost(post2)) + "\n", "utf8");

    const secondRead = persistence.listPosts();
    expect(secondRead).toHaveLength(2);
  });

  it("4. behavioral: getPost() and listPosts() agree -- getPost() finds exactly what listPosts() returns", () => {
    dir = mkdtempSync(join(tmpdir(), "a355-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    for (const id of ["post-1", "post-2", "post-3"]) {
      persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(rootInput(id))!));
    }
    const all = persistence.listPosts();
    for (const record of all) {
      expect(persistence.getPost(record.id)).toEqual(record);
    }
    expect(persistence.getPost("does-not-exist")).toBeNull();
  });

  it("5. structural: the class holds no field beyond the file path -- confirming no in-memory index/cache", () => {
    const fieldDeclarations = implementationSource.match(/^\s*(readonly )?#\w+/gm) ?? [];
    expect(fieldDeclarations).toHaveLength(1);
    expect(fieldDeclarations[0]).toMatch(/#filePath/);
  });

  it("6. structural: getPost() delegates to listPosts(), guaranteeing identical corruption behavior", () => {
    expect(implementationSource).toMatch(/getPost\(id: string\): FedosPersistedBoardPostRecordV1 \| null \{\s*return this\.listPosts\(\)\.find/);
  });

  it("7. the design doc explains 'no side indexes yet' as a deliberate scope decision, not an oversight", () => {
    expect(designDocSource).toContain("## 3. \"No side indexes yet\" — a deliberate scope decision, not an oversight");
  });

  it("8. the design doc names the recommended future Arc where a side index belongs", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain("Append-only Compaction & Integrity Review");
  });

  it("9. the design doc cross-references Alpha 354, Alpha 353, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_354_append_semantics",
      "secure_runtime_alpha_353_append_only_persistence_implementation",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

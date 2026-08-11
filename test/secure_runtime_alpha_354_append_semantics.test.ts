import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_354_append_semantics.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function rootInput(id: string, body = `body-${id}`): FedosBoardPostInput {
  return {
    id,
    boardId: "board-354",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 354 -- "Append Semantics": Stage 4 of the
 * Alpha 351-360 Append-only Durable Board Backend Arc. putPost() must
 * append only, never rewrite, never truncate, never reorder.
 */
describe("Secure Runtime Alpha 354 -- Append Semantics", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: three genuine inserts appear on disk in call order, one line each", () => {
    dir = mkdtempSync(join(tmpdir(), "a354-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);

    for (const id of ["post-1", "post-2", "post-3"]) {
      const post = validateFedosBoardPost(rootInput(id))!;
      expect(persistence.putPost(serializeFedosBoardPost(post))).toBe("inserted");
    }

    const lines = (readFileSync(filePath, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!).id).toBe("post-1");
    expect(JSON.parse(lines[1]!).id).toBe("post-2");
    expect(JSON.parse(lines[2]!).id).toBe("post-3");
  });

  it("3. behavioral: file byte length only grows -- never shrinks -- across a sequence of writes, including no-op writes", () => {
    dir = mkdtempSync(join(tmpdir(), "a354-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);

    const post1 = validateFedosBoardPost(rootInput("post-1"))!;
    const rec1 = serializeFedosBoardPost(post1);
    persistence.putPost(rec1);
    const sizeAfterFirst = (readFileSync(filePath, "utf8") as string).length;

    persistence.putPost(rec1); // already-present -- must not shrink or grow the file
    const sizeAfterDuplicate = (readFileSync(filePath, "utf8") as string).length;
    expect(sizeAfterDuplicate).toBe(sizeAfterFirst);

    const post2 = validateFedosBoardPost(rootInput("post-2"))!;
    persistence.putPost(serializeFedosBoardPost(post2));
    const sizeAfterSecond = (readFileSync(filePath, "utf8") as string).length;
    expect(sizeAfterSecond).toBeGreaterThan(sizeAfterFirst);
  });

  it("4. behavioral: an existing byte prefix is never altered by a later write (never rewrite)", () => {
    dir = mkdtempSync(join(tmpdir(), "a354-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);

    const post1 = validateFedosBoardPost(rootInput("post-1"))!;
    persistence.putPost(serializeFedosBoardPost(post1));
    const contentsAfterFirst = readFileSync(filePath, "utf8") as string;

    const post2 = validateFedosBoardPost(rootInput("post-2"))!;
    persistence.putPost(serializeFedosBoardPost(post2));
    const contentsAfterSecond = readFileSync(filePath, "utf8") as string;

    expect(contentsAfterSecond.startsWith(contentsAfterFirst)).toBe(true);
  });

  it("5. behavioral: already-present and conflict outcomes write nothing to disk", () => {
    dir = mkdtempSync(join(tmpdir(), "a354-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);

    const post1 = validateFedosBoardPost(rootInput("post-1"))!;
    const rec1 = serializeFedosBoardPost(post1);
    persistence.putPost(rec1);
    const contentsAfterInsert = readFileSync(filePath, "utf8") as string;

    expect(persistence.putPost(rec1)).toBe("already-present");
    expect(readFileSync(filePath, "utf8")).toBe(contentsAfterInsert);

    const conflictPost = validateFedosBoardPost(rootInput("post-1", "a totally different body"))!;
    expect(persistence.putPost(serializeFedosBoardPost(conflictPost))).toBe("conflict");
    expect(readFileSync(filePath, "utf8")).toBe(contentsAfterInsert);
  });

  it("6. structural: no truncateSync/ftruncateSync/O_TRUNC/writeFileSync anywhere in this file", () => {
    expect(implementationSource).not.toMatch(/truncateSync|ftruncateSync|O_TRUNC|writeFileSync/);
  });

  it("7. structural: appendFileSync is the only fs write call in the file", () => {
    expect(implementationSource).toMatch(/appendFileSync\(/);
    expect(implementationSource).not.toMatch(/\bwriteSync\(|\bwrite\(/);
  });

  it("8. structural: putPost() reuses getPost() for its own existing-record lookup, not a bespoke scan", () => {
    const putPostMatch = implementationSource.match(/putPost\(record: FedosPersistedBoardPostRecordV1\): FedosBoardPersistenceWriteResult \{[\s\S]*?\n {2}\}/);
    expect(putPostMatch).not.toBeNull();
    expect(putPostMatch![0]).toMatch(/this\.getPost\(record\.id\)/);
  });

  it("9. the design doc cross-references Alpha 353, Alpha 352, and Alpha 315", () => {
    for (const ref of [
      "secure_runtime_alpha_353_append_only_persistence_implementation",
      "secure_runtime_alpha_352_append_only_record_format",
      "secure_runtime_alpha_315_board_persistence_port",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

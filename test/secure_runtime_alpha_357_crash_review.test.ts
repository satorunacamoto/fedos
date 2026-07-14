import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_357_crash_review.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { hydrateFedosBoardService } from "../src/board/persistence/fedos_board_hydration.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function rootInput(id: string, body = `body-${id}`): FedosBoardPostInput {
  return {
    id,
    boardId: "board-357",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 357 -- "Crash Review": Stage 7 of the Alpha
 * 351-360 Append-only Durable Board Backend Arc. Fail closed. Never
 * repair automatically. Verifies all five named corruption/edge cases.
 */
describe("Secure Runtime Alpha 357 -- Crash Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. empty file: a missing file is not corruption -- listPosts() returns []", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "does-not-exist.jsonl"));
    expect(persistence.listPosts()).toEqual([]);
  });

  it("2b. empty file: a zero-byte existing file is not corruption -- listPosts() returns []", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const filePath = join(dir, "empty.jsonl");
    writeFileSync(filePath, "", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(persistence.listPosts()).toEqual([]);
  });

  it("3. duplicate append: two structurally identical lines for the same id collapse to one record, no throw", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const filePath = join(dir, "dup.jsonl");
    const record = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    writeFileSync(filePath, JSON.stringify(record) + "\n" + JSON.stringify(record) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).not.toThrow();
    expect(persistence.listPosts()).toHaveLength(1);
  });

  it("3b. duplicate append with CONFLICTING content: two lines for the same id with different content throws -- never silently picks a winner", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const filePath = join(dir, "conflictdup.jsonl");
    const record1 = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    const record2 = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1", "a different body"))!);
    writeFileSync(filePath, JSON.stringify(record1) + "\n" + JSON.stringify(record2) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).toThrow(/conflicting duplicate/);
  });

  it("4. truncated trailing line: a non-empty malformed final line throws -- fail closed, no repair", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const filePath = join(dir, "truncated.jsonl");
    const record = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    writeFileSync(filePath, JSON.stringify(record) + "\n" + '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).toThrow();
    // The already-complete first record is not silently salvaged into a partial result.
    expect(() => persistence.getPost("post-1")).toThrow();
  });

  it("5. malformed JSON mid-file: treated identically to a trailing truncation -- no special-casing by position", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const filePath = join(dir, "malformed-mid.jsonl");
    const record1 = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    const record2 = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-2"))!);
    writeFileSync(filePath, JSON.stringify(record1) + "\nnot valid json at all\n" + JSON.stringify(record2) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).toThrow();
  });

  it("6. unknown schema version: requires no special-case code -- listPosts() succeeds, hydration fails closed one layer up", () => {
    dir = mkdtempSync(join(tmpdir(), "a357-"));
    const filePath = join(dir, "unknown-schema.jsonl");
    const record = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    writeFileSync(filePath, JSON.stringify({ ...record, schemaVersion: 2 }) + "\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(() => persistence.listPosts()).not.toThrow();
    const hydration = hydrateFedosBoardService(persistence);
    expect(hydration.outcome).toBe("rejected-corrupt-record");
    expect(hydration.service).toBeNull();
  });

  it("7. the design doc states the uniform fail-closed policy applied to every case", () => {
    expect(designDocSource).toMatch(/\*\*Fail closed\. Never repair automatically\.\*\*/);
  });

  it("8. the design doc explicitly resolves the Alpha 345 trailing-write design gap by uniform treatment", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "treated IDENTICALLY to malformed JSON anywhere else in the file",
    );
  });

  it("9. the design doc cross-references Alpha 356, Alpha 352, Alpha 345, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_356_conflict_handling",
      "secure_runtime_alpha_352_append_only_record_format",
      "secure_runtime_alpha_345_crash_recovery_review",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

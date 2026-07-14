import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_365_append_integrity_review.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
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

function inputWithBody(id: string, body: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-365",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 365 -- "Append Integrity Review": Stage 5 of
 * the Alpha 361-370 Board Recovery & Host Robustness Arc. Review
 * only. Verifies embedded control characters never break line
 * boundaries, and various trailing-newline shapes replay correctly.
 */
describe("Secure Runtime Alpha 365 -- Append Integrity Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: a body containing a literal newline round-trips intact and does not split the log into an extra line", () => {
    dir = mkdtempSync(join(tmpdir(), "a365-"));
    const filePath = join(dir, "board.jsonl");
    const bodyWithNewline = "line one\nline two\nline three";
    const post = validateFedosBoardPost(inputWithBody("post-1", bodyWithNewline))!;
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(persistence.putPost(serializeFedosBoardPost(post))).toBe("inserted");

    const rawLines = (readFileSync(filePath, "utf8") as string).split("\n").filter((l: string) => l.trim().length > 0);
    expect(rawLines).toHaveLength(1); // one record, one physical line, despite the embedded newlines

    const roundTripped = persistence.getPost("post-1");
    expect(roundTripped!.body).toBe(bodyWithNewline);
  });

  it("3. behavioral: a body containing carriage returns and tabs round-trips intact", () => {
    dir = mkdtempSync(join(tmpdir(), "a365-"));
    const filePath = join(dir, "board.jsonl");
    const bodyWithControlChars = "col1\tcol2\r\nsecond row";
    const post = validateFedosBoardPost(inputWithBody("post-1", bodyWithControlChars))!;
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    persistence.putPost(serializeFedosBoardPost(post));
    expect(persistence.getPost("post-1")!.body).toBe(bodyWithControlChars);
  });

  it("4. behavioral: multiple posts, each with embedded newlines, all replay correctly and independently", () => {
    dir = mkdtempSync(join(tmpdir(), "a365-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const bodies = ["a\nb\nc", "x\ny", "single line", "\n\n\nonly newlines then text"];
    let i = 0;
    for (const body of bodies) {
      persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(inputWithBody(`post-${i}`, body))!));
      i += 1;
    }
    const all = persistence.listPosts();
    expect(all).toHaveLength(bodies.length);
    for (let j = 0; j < bodies.length; j += 1) {
      expect(persistence.getPost(`post-${j}`)!.body).toBe(bodies[j]);
    }
  });

  it("5. behavioral: a file with no trailing newline still parses its last record correctly", () => {
    dir = mkdtempSync(join(tmpdir(), "a365-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(inputWithBody("post-1", "body-1"))!));
    // Strip the trailing newline this class itself always writes, to simulate a file with none.
    const withoutTrailingNewline = (readFileSync(filePath, "utf8") as string).replace(/\n$/, "");
    writeFileSync(filePath, withoutTrailingNewline, "utf8");
    const reader = new AppendOnlyFedosBoardPersistence(filePath);
    expect(reader.listPosts()).toHaveLength(1);
    expect(reader.getPost("post-1")!.body).toBe("body-1");
  });

  it("6. the design doc confirms JSON.stringify never emits a literal control character inside a string value", () => {
    expect(designDocSource).toContain(
      "**Confirmed safe: `JSON.stringify()` NEVER emits a literal control",
    );
  });

  it("7. the design doc names the same-process concurrency constraint without claiming it is a current defect", () => {
    expect(designDocSource).toContain(
      "## 2. Same-process concurrent-write race — reviewed, named, not fixed",
    );
  });

  it("8. the design doc cross-references Alpha 363, Alpha 357, Alpha 354, and Alpha 352", () => {
    for (const ref of [
      "secure_runtime_alpha_363_corruption_classification",
      "secure_runtime_alpha_357_crash_review",
      "secure_runtime_alpha_354_append_semantics",
      "secure_runtime_alpha_352_append_only_record_format",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

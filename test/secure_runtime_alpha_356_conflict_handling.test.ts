import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_356_conflict_handling.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import type { FedosBoardPersistence } from "../src/os/messenger/board/persistence/fedos_board_persistence.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function rootInput(id: string, body = `body-${id}`): FedosBoardPostInput {
  return {
    id,
    boardId: "board-356",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/** Runs the same sequence against any FedosBoardPersistence, returning the observed outcome tokens. */
function exerciseOutcomes(persistence: FedosBoardPersistence): string[] {
  const post1 = validateFedosBoardPost(rootInput("post-1"))!;
  const rec1 = serializeFedosBoardPost(post1);
  const outcomes: string[] = [];
  outcomes.push(persistence.putPost(rec1)); // inserted
  outcomes.push(persistence.putPost(rec1)); // already-present
  const conflictPost = validateFedosBoardPost(rootInput("post-1", "different body"))!;
  outcomes.push(persistence.putPost(serializeFedosBoardPost(conflictPost))); // conflict
  return outcomes;
}

/**
 * Secure Runtime Alpha 356 -- "Conflict Handling": Stage 6 of the
 * Alpha 351-360 Append-only Durable Board Backend Arc. Verifies
 * inserted/already-present/conflict/failed behave exactly like the
 * in-memory backend, with failed reachable for the first time.
 */
describe("Secure Runtime Alpha 356 -- Conflict Handling", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: inserted/already-present/conflict outcomes are byte-identical to InMemoryFedosBoardPersistence", () => {
    dir = mkdtempSync(join(tmpdir(), "a356-"));
    const filePath = join(dir, "board.jsonl");
    const appendOnlyOutcomes = exerciseOutcomes(new AppendOnlyFedosBoardPersistence(filePath));
    const inMemoryOutcomes = exerciseOutcomes(new InMemoryFedosBoardPersistence());
    expect(appendOnlyOutcomes).toEqual(["inserted", "already-present", "conflict"]);
    expect(appendOnlyOutcomes).toEqual(inMemoryOutcomes);
  });

  it("3. behavioral: a conflict preserves the ORIGINAL record on disk, unmodified", () => {
    dir = mkdtempSync(join(tmpdir(), "a356-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const post1 = validateFedosBoardPost(rootInput("post-1"))!;
    const rec1 = serializeFedosBoardPost(post1);
    persistence.putPost(rec1);

    const conflictPost = validateFedosBoardPost(rootInput("post-1", "a hostile overwrite attempt"))!;
    persistence.putPost(serializeFedosBoardPost(conflictPost));

    expect(persistence.getPost("post-1")).toEqual(rec1);
  });

  it("4. behavioral: 'failed' is reachable -- a write to a path whose parent directory does not exist fails, without throwing", () => {
    dir = mkdtempSync(join(tmpdir(), "a356-"));
    const badPath = join(dir, "no-such-subdirectory", "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(badPath);
    const post = validateFedosBoardPost(rootInput("post-1"))!;
    expect(() => persistence.putPost(serializeFedosBoardPost(post))).not.toThrow();
    expect(persistence.putPost(serializeFedosBoardPost(post))).toBe("failed");
  });

  it("5. behavioral: InMemoryFedosBoardPersistence can never produce 'failed' -- confirming this outcome is genuinely new to this backend", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const post1 = validateFedosBoardPost(rootInput("post-1"))!;
    const post2 = validateFedosBoardPost(rootInput("post-2"))!;
    const post3 = validateFedosBoardPost(rootInput("post-1", "conflicting"))!;
    const outcomes = [
      persistence.putPost(serializeFedosBoardPost(post1)),
      persistence.putPost(serializeFedosBoardPost(post1)),
      persistence.putPost(serializeFedosBoardPost(post2)),
      persistence.putPost(serializeFedosBoardPost(post3)),
    ];
    expect(outcomes).not.toContain("failed");
  });

  it("6. the design doc explains 'failed' is reachable for the first time in this repository's own history", () => {
    expect(designDocSource).toContain("## 4. `\"failed\"` — REACHABLE for the first time in this repository");
  });

  it("7. the design doc cross-references Alpha 355, Alpha 317, Alpha 315, and Alpha 316", () => {
    for (const ref of [
      "secure_runtime_alpha_355_append_only_reading",
      "secure_runtime_alpha_317_persisted_board_repository",
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_316_in_memory_board_persistence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

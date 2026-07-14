import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_358_hydration_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { hydrateFedosBoardService } from "../src/board/persistence/fedos_board_hydration.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/board/fedos_board_identifiers.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function root(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-358",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `root ${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

function reply(id: string, replyTo: string, threadId: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-358",
    threadId,
    replyTo,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `reply ${id}`,
    createdAt: 1_700_000_100,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 358 -- "Hydration Review": Stage 8 of the
 * Alpha 351-360 Append-only Durable Board Backend Arc. Hydrates
 * AppendOnlyFedosBoardPersistence through the existing
 * hydrateFedosBoardService() -- zero modification.
 */
describe("Secure Runtime Alpha 358 -- Hydration Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: hydrating an empty append-only log yields a hydrated, empty, usable service", () => {
    dir = mkdtempSync(join(tmpdir(), "a358-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "board.jsonl"));
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    expect(result.registeredCount).toBe(0);
  });

  it("3. behavioral: a root-only log hydrates that root into the feed", () => {
    dir = mkdtempSync(join(tmpdir(), "a358-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "board.jsonl"));
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(root("root-1"))!));
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    const boardId = toFedosBoardId("board-358") as FedosBoardId;
    expect(result.service!.listBoardPosts(boardId).map((p) => p.id)).toEqual(["root-1"]);
  });

  it("4. behavioral: root + reply hydrate correctly regardless of on-disk append order", () => {
    dir = mkdtempSync(join(tmpdir(), "a358-"));

    const forwardPath = join(dir, "forward.jsonl");
    const forward = new AppendOnlyFedosBoardPersistence(forwardPath);
    forward.putPost(serializeFedosBoardPost(validateFedosBoardPost(root("root-1"))!));
    forward.putPost(serializeFedosBoardPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1"))!));

    const reversePath = join(dir, "reverse.jsonl");
    const reverse = new AppendOnlyFedosBoardPersistence(reversePath);
    reverse.putPost(serializeFedosBoardPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1"))!));
    reverse.putPost(serializeFedosBoardPost(validateFedosBoardPost(root("root-1"))!));

    for (const persistence of [forward, reverse]) {
      const result = hydrateFedosBoardService(persistence);
      expect(result.outcome).toBe("hydrated");
      const boardId = toFedosBoardId("board-358") as FedosBoardId;
      const threadId = toFedosThreadId("root-1") as FedosThreadId;
      expect(result.service!.listThreadPosts(boardId, threadId).map((p) => p.id).sort()).toEqual(["reply-1", "root-1"]);
    }
  });

  it("5. behavioral: a corrupt append-only log causes listPosts() itself to throw, before hydration's own corruption check ever runs -- no FedosBoardService is ever produced either way", () => {
    dir = mkdtempSync(join(tmpdir(), "a358-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "board.jsonl"));
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(root("root-1"))!));
    // Externally corrupt the file with a malformed trailing line.
    appendFileSync(join(dir, "board.jsonl"), '{"schemaVersion":1,"id":"trunc', "utf8");
    expect(() => hydrateFedosBoardService(persistence)).toThrow();
  });

  it("6. behavioral: identical hydration outcome shape from an append-only-backed and an in-memory-backed persistence given the same fixtures", () => {
    dir = mkdtempSync(join(tmpdir(), "a358-"));
    const appendOnly = new AppendOnlyFedosBoardPersistence(join(dir, "board.jsonl"));
    const inMemory = new InMemoryFedosBoardPersistence();
    const record = serializeFedosBoardPost(validateFedosBoardPost(root("root-1"))!);
    appendOnly.putPost(record);
    inMemory.putPost(record);

    const appendOnlyResult = hydrateFedosBoardService(appendOnly);
    const inMemoryResult = hydrateFedosBoardService(inMemory);
    expect(appendOnlyResult.outcome).toBe(inMemoryResult.outcome);
    expect(appendOnlyResult.registeredCount).toBe(inMemoryResult.registeredCount);
  });

  it("7. structural: hydrateFedosBoardService's own file carries zero diff -- no reference to AppendOnlyFedosBoardPersistence or node:fs", () => {
    expect(hydrationSource).not.toMatch(/AppendOnlyFedosBoardPersistence|node:fs/);
  });

  it("8. the design doc states this Stage adds zero lines to fedos_board_hydration.ts", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain("this Stage adds ZERO lines to that file");
  });

  it("9. the design doc cross-references Alpha 357, Alpha 351, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_357_crash_review",
      "secure_runtime_alpha_351_existing_persistence_layer_inventory",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

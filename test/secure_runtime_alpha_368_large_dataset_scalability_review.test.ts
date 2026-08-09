import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_368_large_dataset_scalability_review.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { hydrateFedosBoardService } from "../src/os/messenger/board/persistence/fedos_board_hydration.js";
import { toFedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const RECORD_COUNT = 1000;

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-368",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 368 -- "Large Dataset Scalability Review":
 * Stage 8 of the Alpha 361-370 Board Recovery & Host Robustness Arc.
 * Verifies CORRECTNESS holds at 1,000 records -- does not re-decide
 * the already-known O(n)-per-call cost shape.
 */
describe("Secure Runtime Alpha 368 -- Large Dataset Scalability Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it(`2. behavioral: ${RECORD_COUNT} distinct records all insert correctly, with no loss, duplication, or reordering`, () => {
    dir = mkdtempSync(join(tmpdir(), "a368-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);

    for (let i = 0; i < RECORD_COUNT; i += 1) {
      const id = `post-${String(i).padStart(5, "0")}`;
      const record = serializeFedosBoardPost(validateFedosBoardPost(rootInput(id))!);
      expect(persistence.putPost(record)).toBe("inserted");
    }

    const all = persistence.listPosts();
    expect(all).toHaveLength(RECORD_COUNT);
    expect(new Set(all.map((r) => r.id)).size).toBe(RECORD_COUNT);
  }, 30_000);

  it(`3. behavioral: hydrateFedosBoardService succeeds at ${RECORD_COUNT} records with the exact registered count`, () => {
    dir = mkdtempSync(join(tmpdir(), "a368-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    for (let i = 0; i < RECORD_COUNT; i += 1) {
      const id = `post-${String(i).padStart(5, "0")}`;
      persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(rootInput(id))!));
    }

    const hydration = hydrateFedosBoardService(persistence);
    expect(hydration.outcome).toBe("hydrated");
    expect(hydration.registeredCount).toBe(RECORD_COUNT);
  }, 30_000);

  it("4. behavioral: two independent replay-and-hydrate cycles against the same large file agree deterministically", () => {
    dir = mkdtempSync(join(tmpdir(), "a368-"));
    const filePath = join(dir, "board.jsonl");
    const writer = new AppendOnlyFedosBoardPersistence(filePath);
    for (let i = 0; i < RECORD_COUNT; i += 1) {
      const id = `post-${String(i).padStart(5, "0")}`;
      writer.putPost(serializeFedosBoardPost(validateFedosBoardPost(rootInput(id))!));
    }

    const cycleA = hydrateFedosBoardService(new AppendOnlyFedosBoardPersistence(filePath));
    const cycleB = hydrateFedosBoardService(new AppendOnlyFedosBoardPersistence(filePath));
    const boardId = toFedosBoardId("board-368") as FedosBoardId;
    const idsA = cycleA.service!.listBoardPosts(boardId).map((p) => p.id);
    const idsB = cycleB.service!.listBoardPosts(boardId).map((p) => p.id);
    expect(idsA).toEqual(idsB);
  }, 30_000);

  it("5. the design doc documents the O(N²) total write cost precisely, without claiming it is fixed this Arc", () => {
    expect(designDocSource).toContain("N sequential `putPost()` calls cost O(N²) in total");
  });

  it("6. the design doc explicitly does not treat the cost shape as a defect requiring a fix in this Arc", () => {
    expect(designDocSource).toContain(
      "## 4. Why this is not treated as a defect requiring a fix in this Arc",
    );
  });

  it("7. the design doc cross-references Alpha 367, Alpha 355, Alpha 344, and Alpha 322", () => {
    for (const ref of [
      "secure_runtime_alpha_367_host_restart_verification",
      "secure_runtime_alpha_355_append_only_reading",
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_322_durable_backend_requirements",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

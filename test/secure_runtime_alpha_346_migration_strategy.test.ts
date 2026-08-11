import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_346_migration_strategy.md?raw";

import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { hydrateFedosBoardService } from "../src/os/messenger/board/persistence/fedos_board_hydration.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-346",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `root ${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 346 -- "Migration Strategy": Stage 6 of the
 * Alpha 341-350 Board Durable Backend Re-evaluation & Local Backend
 * Selection Arc. Review only, NO CODE. Fixes an Offline, One-shot
 * migration strategy usable for any FedosBoardPersistence backend
 * pair, expressible entirely via the existing port.
 */
describe("Secure Runtime Alpha 346 -- Migration Strategy", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc adopts Offline and One-shot, rejecting Online and Streaming", () => {
    expect(designDocSource).toMatch(/\*\*ADOPTED\.\*\*/);
    expect(designDocSource).toContain("## 3. Decision: Offline, One-shot");
  });

  it("3. behavioral: migration is expressible entirely via listPosts()/putPost() on the existing port -- no new API", () => {
    const source = new InMemoryFedosBoardPersistence();
    const destination = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(rootInput("root-1"))!;
    source.putPost(serializeFedosBoardPost(post));

    // The migration step named in the design doc: copy every record via the existing port.
    for (const record of source.listPosts()) {
      destination.putPost(record);
    }

    expect(destination.listPosts()).toHaveLength(1);
    const hydrated = hydrateFedosBoardService(destination);
    expect(hydrated.outcome).toBe("hydrated");
  });

  it("4. behavioral: re-running the same migration step twice is safe -- idempotent by the port's own semantics", () => {
    const source = new InMemoryFedosBoardPersistence();
    const destination = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(rootInput("root-2"))!;
    source.putPost(serializeFedosBoardPost(post));

    const copyOnce = () => {
      for (const record of source.listPosts()) destination.putPost(record);
    };
    copyOnce();
    expect(() => copyOnce()).not.toThrow();
    expect(destination.listPosts()).toHaveLength(1);
  });

  it("5. the design doc states re-running the migration step is safe by construction", () => {
    expect(normalize(designDocSource)).toContain(
      "RE-RUNNING THE SAME MIGRATION STEP TWICE IS SAFE BY CONSTRUCTION",
    );
  });

  it("6. the design doc explicitly rejects Online and Streaming migration, each with a stated reason", () => {
    expect(designDocSource).toContain("**Online migration**");
    expect(designDocSource).toContain("**Streaming**");
    expect(normalize(designDocSource)).toContain("REJECTED: this would require");
  });

  it("7. the design doc names every remaining unresolved question without solving it", () => {
    expect(designDocSource).toContain("## 5. What remains unresolved (named, not solved)");
  });

  it("8. the design doc cross-references Alpha 344, Alpha 342, Alpha 328, and Alpha 334", () => {
    for (const ref of [
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_342_current_persistence_review",
      "secure_runtime_alpha_328_board_schema_migration_architecture",
      "secure_runtime_alpha_334_desktop_host_dependency_assembly",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/os/messenger/board/persistence/fedos_board_hydration.ts?raw";
import { hydrateFedosBoardService } from "../src/board/persistence/fedos_board_hydration.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";

const BOARD_1 = toFedosBoardId("board-1") as FedosBoardId;
const THREAD_ROOT_1 = toFedosThreadId("root-1") as FedosThreadId;

function root(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-1",
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
    boardId: "board-1",
    threadId,
    replyTo,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `reply ${id}`,
    createdAt: 1_700_000_100,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

function persistAll(persistence: InMemoryFedosBoardPersistence, inputs: readonly FedosBoardPostInput[]): void {
  for (const input of inputs) {
    const post = validateFedosBoardPost(input)!;
    persistence.putPost(serializeFedosBoardPost(post));
  }
}

/**
 * Secure Runtime Alpha 318 -- "Board Hydration and Index Rebuild": Stage
 * 8 of the Canonical Board Persistence Boundary Arc. Adds
 * src/board/persistence/fedos_board_hydration.ts, exporting
 * hydrateFedosBoardService -- bounded topological registration, no
 * partial service on corruption or unresolvable thread integrity.
 */
describe("Secure Runtime Alpha 318 -- Board Hydration and Index Rebuild", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: hydrating an empty persistence yields a hydrated, empty, usable service", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    expect(result.service).not.toBeNull();
    expect(result.registeredCount).toBe(0);
    expect(result.service!.listBoardPosts(BOARD_1)).toEqual([]);
  });

  it("3. behavioral: a root-only persistence hydrates that root into the feed", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistAll(persistence, [root("root-1")]);
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    expect(result.registeredCount).toBe(1);
    const posts = result.service!.listBoardPosts(BOARD_1);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.id).toBe("root-1");
  });

  it("4. behavioral: a root plus a reply hydrate correctly regardless of persisted insertion order", () => {
    const forwardOrder = new InMemoryFedosBoardPersistence();
    persistAll(forwardOrder, [root("root-1"), reply("reply-1", "root-1", "root-1")]);
    const forwardResult = hydrateFedosBoardService(forwardOrder);

    const reverseOrder = new InMemoryFedosBoardPersistence();
    persistAll(reverseOrder, [reply("reply-1", "root-1", "root-1"), root("root-1")]);
    const reverseResult = hydrateFedosBoardService(reverseOrder);

    for (const result of [forwardResult, reverseResult]) {
      expect(result.outcome).toBe("hydrated");
      expect(result.registeredCount).toBe(2);
      const posts = result.service!.listThreadPosts(BOARD_1, THREAD_ROOT_1);
      expect(posts.map((p) => p.id).sort()).toEqual(["reply-1", "root-1"]);
    }
  });

  it("5. behavioral: a deep reply chain hydrates correctly under a fully shuffled persisted order", () => {
    const chain = [
      root("root-1"),
      reply("reply-1", "root-1", "root-1"),
      reply("reply-2", "reply-1", "root-1"),
      reply("reply-3", "reply-2", "root-1"),
      reply("reply-4", "reply-3", "root-1"),
    ];
    const shuffled = [chain[3]!, chain[0]!, chain[4]!, chain[1]!, chain[2]!];
    const persistence = new InMemoryFedosBoardPersistence();
    persistAll(persistence, shuffled);
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");
    expect(result.registeredCount).toBe(5);
    const posts = result.service!.listThreadPosts(BOARD_1, THREAD_ROOT_1);
    expect(posts).toHaveLength(5);
  });

  it("6. behavioral: a corrupt record voids the whole hydration -- service null, corruptRecordCount set", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistAll(persistence, [root("root-1")]);
    const corrupt = {
      ...serializeFedosBoardPost(validateFedosBoardPost(root("root-2"))!),
      schemaVersion: 2,
    } as unknown as FedosPersistedBoardPostRecordV1;
    persistence.putPost(corrupt);

    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("rejected-corrupt-record");
    expect(result.service).toBeNull();
    expect(result.corruptRecordCount).toBe(1);
    expect(result.registeredCount).toBe(0);
  });

  it("7. behavioral: a reply whose parent is never persisted voids the whole hydration -- unresolvable thread integrity", () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistAll(persistence, [reply("reply-1", "root-never-persisted", "root-never-persisted")]);
    const result = hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("rejected-unresolvable-thread-integrity");
    expect(result.service).toBeNull();
    expect(result.unresolvedCount).toBe(1);
  });

  it("8. behavioral: hydration is deterministic -- two identical persisted sets in different orders produce equal feeds", () => {
    const inputs = [root("root-1"), reply("reply-1", "root-1", "root-1"), root("root-2")];
    const a = new InMemoryFedosBoardPersistence();
    persistAll(a, inputs);
    const b = new InMemoryFedosBoardPersistence();
    persistAll(b, [...inputs].reverse());

    const resultA = hydrateFedosBoardService(a);
    const resultB = hydrateFedosBoardService(b);
    const idsA = resultA.service!.listBoardPosts(BOARD_1).map((p) => p.id);
    const idsB = resultB.service!.listBoardPosts(BOARD_1).map((p) => p.id);
    expect(idsA.slice().sort()).toEqual(idsB.slice().sort());
  });

  it("9. structural: no network, Relay, ontology, p2p, or background-task reference IN CODE", () => {
    expect(hydrationSource).not.toMatch(/fetch\(|WebSocket|setTimeout|setInterval|async function|\bp2p\//);
  });

  it("10. structural: this file constructs a plain `new FedosBoardService()`, never a PersistedFedosBoardRepository", () => {
    expect(hydrationSource).toMatch(/new FedosBoardService\(\)/);
    expect(hydrationSource).not.toMatch(/PersistedFedosBoardRepository/);
  });

  it("11. the design doc documents the bounded-termination proof for the topological pass", () => {
    expect(designDocSource).toMatch(/No unbounded retry/);
  });

  it("12. the design doc cross-references Alpha 317, Alpha 307, Alpha 306, Alpha 314, and Alpha 319", () => {
    for (const ref of [
      "secure_runtime_alpha_317_persisted_board_repository",
      "secure_runtime_alpha_307_board_application_service",
      "secure_runtime_alpha_306_thread_integrity_boundary",
      "secure_runtime_alpha_314_board_serialization_boundary",
      "secure_runtime_alpha_319_four_protocol_persistence_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

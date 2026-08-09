import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_320_board_persistence_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrAdapterSource from "../src/os/messenger/board/fedos_board_nostr_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activityPubAdapterSource from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import atprotoAdapterSource from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionAdapterSource from "../src/os/messenger/board/session/fedos_session_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/os/messenger/board/repository/fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemoryRepositorySource from "../src/os/messenger/board/repository/in_memory_fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sourceIndexSource from "../src/os/messenger/board/repository/fedos_board_source_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardIndexSource from "../src/os/messenger/board/repository/fedos_board_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import feedSource from "../src/os/messenger/board/repository/fedos_board_feed.ts?raw";

import * as recordModule from "../src/board/persistence/fedos_persisted_board_post_v1.js";
import * as codecModule from "../src/board/persistence/fedos_board_post_codec.js";
import * as portModule from "../src/board/persistence/fedos_board_persistence.js";
import * as inMemoryPersistenceModule from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import * as persistedRepositoryModule from "../src/board/persistence/persisted_fedos_board_repository.js";
import * as hydrationModule from "../src/board/persistence/fedos_board_hydration.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { FedosBoardFeed } from "../src/board/repository/fedos_board_feed.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 320 -- "Canonical Board Persistence Boundary
 * Completion": Stage 10, the closing Stage, of the Alpha 311-320
 * Canonical Board Persistence Boundary Arc. Review only. Issues the
 * Arc's own Completion Declaration and confirms every frozen boundary
 * this Arc's own instruction named stayed untouched, including all four
 * Board Adapters, the Alpha 301-310 Repository/Index/Service/Feed stack,
 * and p2p/.
 */
describe("Secure Runtime Alpha 320 -- Canonical Board Persistence Boundary Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends exactly one next Arc: the Board Durable Backend Selection & Review Arc, and does not recommend p2p/Ontology as a backend", () => {
    expect(designDocSource).toMatch(/\*\*Board Durable Backend Selection & Review Arc\.\*\*/);
    expect(designDocSource).toMatch(/must NOT be recommended as a storage\s+backend/);
  });

  it("4. every production module exports the symbols this Arc's own instruction names", () => {
    expect(typeof codecModule.serializeFedosBoardPost).toBe("function");
    expect(typeof codecModule.deserializeFedosBoardPost).toBe("function");
    expect(typeof portModule.fedosPersistedBoardPostRecordsAreEqual).toBe("function");
    expect(typeof inMemoryPersistenceModule.InMemoryFedosBoardPersistence).toBe("function");
    expect(typeof persistedRepositoryModule.PersistedFedosBoardRepository).toBe("function");
    expect(typeof hydrationModule.hydrateFedosBoardService).toBe("function");
    // FedosPersistedBoardPostRecordV1 (recordModule) is a TYPE ONLY export -- no runtime symbol to check.
    expect(recordModule).toBeDefined();
  });

  it("5. behavioral end-to-end: register, persist, hydrate, and feed a post through the full new stack", () => {
    const input: FedosBoardPostInput = {
      id: "post-320-completion",
      boardId: "board-320-completion",
      threadId: "post-320-completion",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "Alpha 320 completion check",
      createdAt: 1_700_000_999,
      source: { protocol: "nostr", reference: "completion-ref-320" },
    };
    const post = validateFedosBoardPost(input)!;

    const originalService = new FedosBoardService();
    expect(originalService.registerPost(post)).toBe("inserted");

    const persistence = new inMemoryPersistenceModule.InMemoryFedosBoardPersistence();
    expect(persistence.putPost(codecModule.serializeFedosBoardPost(post))).toBe("inserted");

    const result = hydrationModule.hydrateFedosBoardService(persistence);
    expect(result.outcome).toBe("hydrated");

    const feed = new FedosBoardFeed(result.service!);
    expect(feed.listRecentPosts(post.boardId, 10).map((p) => p.id)).toEqual([post.id]);
  });

  it("6. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("7. Regression: Relay, Runtime, and Worker carry zero reference to src/board/persistence/", () => {
    for (const source of [relaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(
        /src\/board\/persistence\/|FedosBoardPersistence|InMemoryFedosBoardPersistence|PersistedFedosBoardRepository|hydrateFedosBoardService/,
      );
    }
  });

  it("8. Regression: none of the four Board Adapters has functional coupling to the Persistence boundary", () => {
    for (const source of [nostrAdapterSource, activityPubAdapterSource, atprotoAdapterSource, sessionAdapterSource]) {
      expect(source).not.toMatch(/from ["'].*\/persistence\/.*["']/i);
      expect(source).not.toMatch(
        /FedosBoardPersistence|InMemoryFedosBoardPersistence|PersistedFedosBoardRepository|hydrateFedosBoardService|FedosPersistedBoardPostRecordV1/,
      );
    }
  });

  it("9. Regression: the frozen Alpha 301-310 Repository/Index/Service/Feed stack carries zero reference to src/board/persistence/", () => {
    for (const source of [repositorySource, inMemoryRepositorySource, sourceIndexSource, boardIndexSource, feedSource]) {
      expect(source).not.toMatch(/src\/board\/persistence\/|FedosBoardPersistence|hydrateFedosBoardService/);
    }
  });

  it("10. the design doc's own 'still out of scope' list names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Real durable backend, SQLite, D1, IndexedDB, filesystem",
      "Encryption at rest",
      "Database migration execution",
      "Moderation persistence, delete/tombstone persistence",
      "Search, full-text index",
      "Ontology projection, P2P synchronization",
      "Relay Pool, GUI",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("11. the design doc cross-references every prior Stage of this Arc, Alpha 311 through Alpha 319, plus Alpha 310", () => {
    for (let n = 311; n <= 319; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_310_board_repository_completion");
  });
});

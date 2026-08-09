import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_310_board_repository_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrAdapterSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activityPubAdapterSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import atprotoAdapterSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionAdapterSource from "../src/board/session/fedos_session_board_adapter.ts?raw";
import * as repositoryModule from "../src/board/repository/fedos_board_repository.js";
import * as inMemoryModule from "../src/board/repository/in_memory_fedos_board_repository.js";
import * as sourceIndexModule from "../src/board/repository/fedos_board_source_index.js";
import * as boardIndexModule from "../src/board/repository/fedos_board_index.js";
import * as serviceModule from "../src/board/repository/fedos_board_service.js";
import * as feedModule from "../src/board/repository/fedos_board_feed.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 310 -- "Canonical Board Repository, Index &
 * Feed Completion": Stage 10, the closing Stage, of the Alpha 301-310
 * Canonical Board Repository, Index & Feed Foundation Arc. Review only.
 * Issues the Arc's own Completion Declaration and confirms every frozen
 * boundary this Arc's own instruction named stayed untouched, including
 * all four Board Adapters and p2p/.
 */
describe("Secure Runtime Alpha 310 -- Canonical Board Repository, Index & Feed Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends exactly one next Arc: the Board Persistence Boundary Arc, and does not recommend p2p/Ontology integration yet", () => {
    expect(designDocSource).toMatch(/\*\*Board Persistence Boundary Arc\.\*\*/);
    expect(designDocSource).toMatch(/is explicitly NOT recommended next\./);
  });

  it("4. every production module exports the symbols this Arc's own instruction names", () => {
    expect(typeof repositoryModule.fedosBoardPostsAreStructurallyEqual).toBe("function");
    expect(typeof inMemoryModule.InMemoryFedosBoardRepository).toBe("function");
    expect(typeof sourceIndexModule.FedosBoardSourceIndex).toBe("function");
    expect(typeof boardIndexModule.FedosBoardIndex).toBe("function");
    expect(typeof serviceModule.FedosBoardService).toBe("function");
    expect(typeof feedModule.FedosBoardFeed).toBe("function");
    expect(feedModule.FEDOS_BOARD_FEED_MIN_LIMIT).toBe(1);
    expect(feedModule.FEDOS_BOARD_FEED_MAX_LIMIT).toBe(100);
  });

  it("5. behavioral end-to-end: register, index, and feed a post through the full stack", () => {
    const service = new serviceModule.FedosBoardService();
    const input: FedosBoardPostInput = {
      id: "post-completion",
      boardId: "board-completion",
      threadId: "post-completion",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "Alpha 310 completion check",
      createdAt: 1_700_000_999,
      source: { protocol: "nostr", reference: "completion-ref" },
    };
    const post = validateFedosBoardPost(input)!;
    expect(service.registerPost(post)).toBe("inserted");
    const feed = new feedModule.FedosBoardFeed(service);
    expect(feed.listRecentPosts(post.boardId, 10)).toEqual([post]);
  });

  it("6. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("7. Regression: Relay, Runtime, and Worker carry zero reference to src/board/repository/", () => {
    for (const source of [relaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/src\/board\/repository\/|FedosBoardService|FedosBoardRepository|FedosBoardFeed/);
    }
  });

  it("8. Regression: none of the four Board Adapters has functional coupling to the Repository/Index/Service/Feed", () => {
    for (const source of [nostrAdapterSource, activityPubAdapterSource, atprotoAdapterSource, sessionAdapterSource]) {
      expect(source).not.toMatch(/from ["'].*\/repository\/.*["']/i);
      expect(source).not.toMatch(/FedosBoardService|FedosBoardRepository|FedosBoardIndex|FedosBoardSourceIndex|FedosBoardFeed/);
    }
  });

  it("9. the design doc's own 'still out of scope' list names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Persistence, SQLite/D1/IndexedDB",
      "P2P Ontology Engine integration",
      "Search, full-text indexing",
      "Pagination cursors, ranking, recommendations",
      "Likes, reposts, notifications, moderation execution",
      "Relay Pool, GUI",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("10. the design doc cross-references every prior Stage of this Arc, Alpha 301 through Alpha 309", () => {
    for (let n = 301; n <= 309; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});

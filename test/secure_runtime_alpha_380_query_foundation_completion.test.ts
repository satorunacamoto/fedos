import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_380_query_foundation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/board/repository/fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

import { FedosBoardQuery } from "../src/board/query/fedos_board_query.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/board/fedos_board_identifiers.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-380",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 380 -- "Canonical Board Query Foundation
 * Completion": Stage 10, the closing Stage, of the Alpha 371-380 Arc.
 * Review only. Issues the Completion Declaration, confirms the
 * Repository and Persistence interfaces carry zero diff, and
 * recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 380 -- Canonical Board Query Foundation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
  });

  it("3. the design doc recommends exactly one next Arc: Canonical Board Query Host Integration", () => {
    expect(normalize(designDocSource)).toContain(
      "**Secure Runtime Alpha 381–390: Canonical Board Query Host Integration",
    );
  });

  it("4. the whole query layer is still fully functional end to end", () => {
    const service = new FedosBoardService();
    const boardId = toFedosBoardId("board-380") as FedosBoardId;
    service.registerPost(validateFedosBoardPost(rootInput("post-1"))!);
    const query = new FedosBoardQuery(service);
    const feed = query.recentFeed(boardId);
    expect(feed.posts.map((p) => p.id)).toEqual(["post-1"]);
    const thread = query.thread(boardId, toFedosThreadId("post-1") as FedosThreadId);
    expect(thread.posts.map((p) => p.id)).toEqual(["post-1"]);
  });

  it("5. Regression: FedosBoardRepository's own frozen contract carries zero diff from this Arc", () => {
    expect(repositorySource).toMatch(/export interface FedosBoardRepository \{/);
    expect(repositorySource).toMatch(/register\(post: FedosBoardPost\): FedosBoardRepositoryWriteResult;/);
    expect(repositorySource).toMatch(/findPost\(id: FedosBoardPostId\): FedosBoardPost \| null;/);
    expect(repositorySource).toMatch(/listPosts\(\): readonly FedosBoardPost\[\];/);
  });

  it("6. Regression: FedosBoardPersistence's own frozen port carries zero diff from this Arc", () => {
    expect(persistenceSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(persistenceSource).toMatch(/putPost\(record: FedosPersistedBoardPostRecordV1\): FedosBoardPersistenceWriteResult;/);
  });

  it("7. Regression: package.json dependency count remains unchanged at 2, no bin field", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("8. Regression: Cargo.toml carries no new dependency", () => {
    expect(cargoTomlSource).not.toMatch(/board.?query/i);
  });

  it("9. Regression: src/worker.ts carries zero reference to the new query layer (Host integration deliberately superseded by Alpha 383, Arc 381-390)", () => {
    expect(workerSource).not.toMatch(/FedosBoardQuery/);
    // At the time this Arc (371-380) shipped, FedosDesktopHost had no
    // reference to FedosBoardQuery either -- Alpha 380 §3 named that
    // absence explicitly as this layer's own largest gap. Alpha 383
    // (Arc 381-390) closed exactly that gap by design; hostSource is no
    // longer expected to be silent on FedosBoardQuery.
  });

  it("10. the design doc names every explicit non-decision this layer leaves for a future Arc", () => {
    expect(designDocSource).toContain("**No caller wires it in yet.**");
    expect(designDocSource).toContain("**No sort-order-aware index**");
  });

  it("11. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Relay changes, Protocol Adapter changes, Ontology integration, GUI,",
      "New package/dependency of any kind",
      "Any change to `FedosBoardRepository` or `FedosBoardPersistence`",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("12. the design doc cross-references every prior Stage of this Arc, Alpha 371 through Alpha 379, plus Alpha 341", () => {
    for (let n = 371; n <= 379; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_341_host_capability_inventory");
  });
});

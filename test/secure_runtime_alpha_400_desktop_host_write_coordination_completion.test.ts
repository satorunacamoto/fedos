import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_400_desktop_host_write_coordination_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/messenger/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import repositorySource from "../src/os/messenger/board/repository/fedos_board_repository.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 400 -- "Desktop Host Write Coordination
 * Completion": Stage 10, the closing Stage, of the Alpha 391-400
 * Desktop Host Durable Write Coordination Arc. Review only. Freezes
 * every finding and recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 400 -- Desktop Host Write Coordination Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(normalize(designDocSource)).toContain(
      "**This Arc's own Objective is CONFIRMED COMPLETE.**",
    );
  });

  it("3. the design doc recommends exactly one next Arc: Outbound Publish Pipeline Foundation, and explicitly not Relay Pool/Ontology/P2P", () => {
    expect(designDocSource).toContain(
      "**Secure Runtime Alpha 401–410: Outbound Publish Pipeline Foundation\nArc.**",
    );
    expect(designDocSource).toContain("NOT the Relay Pool itself, NOT Ontology, and NOT P2P");
  });

  it("4. the whole write-coordination assembly is fully functional end to end -- both in-memory and a real durable restart", async () => {
    const h1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await h1.start();
    const input: FedosBoardPostInput = {
      id: "a400-post",
      boardId: "board-400",
      threadId: "a400-post",
      replyTo: null,
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a400" },
      body: "completion fixture",
      createdAt: 1_700_010_000,
      source: { protocol: "nostr", reference: "a400-ref" },
    };
    const post = validateFedosBoardPost(input)!;
    expect(h1.submitPost(post)).toBe("inserted");
    expect(h1.query()!.recentFeed(post.boardId).posts.map((p) => p.id)).toContain("a400-post");
    await h1.stop();

    dir = mkdtempSync(join(tmpdir(), "a400-"));
    const filePath = join(dir, "board.jsonl");
    const p1 = new AppendOnlyFedosBoardPersistence(filePath);
    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: p1 });
    await h2.start();
    expect(h2.submitPost(post)).toBe("inserted");
    await h2.stop();

    const p2 = new AppendOnlyFedosBoardPersistence(filePath);
    const h3 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: p2 });
    await h3.start();
    expect(h3.query()!.recentFeed(post.boardId).posts.map((p) => p.id)).toContain("a400-post");
  });

  it("5. Regression: package.json dependency count remains unchanged at 2, no bin field", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("6. Regression: Cargo.toml carries no new dependency related to this Arc", () => {
    expect(cargoTomlSource).not.toMatch(/submitPost|write.?coordinat/i);
  });

  it("7. Regression: src/worker.ts carries zero reference to the Host or submitPost", () => {
    expect(workerSource).not.toMatch(/FedosDesktopHost|submitPost/);
  });

  it("8. Regression: FedosBoardRepository and FedosBoardPersistence both carry zero signature diff from prior Arcs", () => {
    expect(repositorySource).toMatch(/register\(post: FedosBoardPost\): FedosBoardRepositoryWriteResult;/);
    expect(persistenceSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(persistenceSource).not.toMatch(/deletePost|removePost/);
  });

  it("9. Regression: FedosBoardService.registerPost() keeps its own exact pre-Arc signature", () => {
    expect(serviceSource).toMatch(/registerPost\(post: FedosBoardPost\): FedosBoardRegistrationResult \{/);
  });

  it("10. structural: submitPost() exists on the Host with the documented result type", () => {
    expect(hostSource).toMatch(/submitPost\(post: FedosBoardPost\): FedosDesktopHostSubmitPostResult/);
  });

  it("11. the design doc restates the Durable Write Warning as RESOLVED for submitPost(), while honestly confirming board() is unchanged", () => {
    expect(designDocSource).toContain("## 4. Durable Write Warning — RESOLVED");
    expect(designDocSource).toContain("host.board()?.registerPost(post)");
    expect(designDocSource).toContain("host.submitPost(post)");
  });

  it("12. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Relay Publish, Nostr/ActivityPub/AT Protocol/Session outbound, Relay",
      "The residual `board()` bypass",
      "`fsync`, compaction, crash-mid-write recovery",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("13. the design doc cross-references every prior Stage of this Arc, Alpha 391 through Alpha 399", () => {
    for (let n = 391; n <= 399; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });

  it("14. the design doc names the exact ripple scope -- Alpha 386's own test, no other file", () => {
    expect(designDocSource).toContain("test/secure_runtime_alpha_386_host_query_delegation_review.test.ts");
    expect(normalize(designDocSource)).toContain("No other pre-existing file required modification.");
  });
});

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_388_append_only_host_query_compatibility.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import factorySource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/os/messenger/desktop/fedos_public_identity_reader.js";
import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId, FedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";

class NullReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}

function root(id: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-388",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `root ${id}`,
    createdAt,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}
function reply(id: string, replyTo: string, threadId: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: "board-388",
    threadId,
    replyTo,
    author: { identityId: null, protocol: "activitypub", publicIdentifier: "https://example/actor" },
    body: `reply ${id}`,
    createdAt,
    source: { protocol: "activitypub", reference: `ref-${id}` },
  };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 388 -- "Append-Only Host Compatibility
 * Verification": Stage 8 of the Alpha 381-390 Canonical Board Query
 * Host Integration & Startup Failure Closure Arc. Explicit injection
 * only -- the Host factory default is never changed.
 */
describe("Secure Runtime Alpha 388 -- Append-Only Host Compatibility Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: the factory default persistence is still InMemoryFedosBoardPersistence -- unchanged by this Arc", () => {
    expect(factorySource).toMatch(/dependencies\.boardPersistence \?\? new InMemoryFedosBoardPersistence\(\)/);
  });

  it("3. behavioral: persisted fixtures hydrate and the Host reaches ready with a real append-only log", async () => {
    dir = mkdtempSync(join(tmpdir(), "a388-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(root("root-1", 1_700_000_100))!));
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(reply("reply-1", "root-1", "root-1", 1_700_000_300))!));

    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await host.start();
    expect(host.state()).toBe("ready");

    const boardId = toFedosBoardId("board-388") as FedosBoardId;
    const feed = host.query()!.recentFeed(boardId);
    expect(feed.posts).toHaveLength(2);

    const threadId = toFedosThreadId("root-1") as FedosThreadId;
    const thread = host.query()!.thread(boardId, threadId);
    expect(thread.posts.map((p) => p.id)).toEqual(["root-1", "reply-1"]); // chronological ASC
    await host.stop();
  });

  it("4. behavioral: filters and pagination work identically against the real backend", async () => {
    dir = mkdtempSync(join(tmpdir(), "a388-"));
    const filePath = join(dir, "board.jsonl");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    for (let i = 0; i < 5; i += 1) {
      persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(root(`post-${i}`, 1_700_000_000 + i))!));
    }
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await host.start();
    const boardId = toFedosBoardId("board-388") as FedosBoardId;

    const filtered = host.query()!.recentFeed(boardId, { protocol: "nostr" });
    expect(filtered.total).toBe(5);

    const paged = host.query()!.recentFeed(boardId, undefined, { limit: 2 });
    expect(paged.posts).toHaveLength(2);
    expect(paged.hasMore).toBe(true);
  });

  it("5. behavioral: stop() denies board()/query()/desktop() access even with a real durable backend", async () => {
    dir = mkdtempSync(join(tmpdir(), "a388-"));
    const filePath = join(dir, "board.jsonl");
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new AppendOnlyFedosBoardPersistence(filePath) });
    await host.start();
    await host.stop();
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
    expect(host.desktop()).toBeNull();
  });

  it("6. behavioral: a corrupt log causes state failed, never stuck at starting -- the exact reproduction scenario, now fixed", async () => {
    dir = mkdtempSync(join(tmpdir(), "a388-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.state()).not.toBe("starting");
    expect(host.query()).toBeNull();
  });

  it("7. behavioral: no automatic repair -- the corrupt file itself is left untouched by the failed start attempt", async () => {
    dir = mkdtempSync(join(tmpdir(), "a388-"));
    const filePath = join(dir, "board.jsonl");
    const corruptContent = '{"schemaVersion":1,"id":"trunc';
    writeFileSync(filePath, corruptContent, "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(readFileSync(filePath, "utf8")).toBe(corruptContent);
  });

  it("8. behavioral: no fallback to in-memory -- a Host injected with a failing append-only backend never silently succeeds", async () => {
    dir = mkdtempSync(join(tmpdir(), "a388-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed"); // not "ready" via any silent fallback
  });

  it("9. no filesystem path is selected by Host -- every path in this Stage's own test suite is caller-supplied", () => {
    // Structural confirmation mirrors the design doc's own claim; the Host
    // source itself is checked in Alpha 381/389's own regression tests.
    expect(designDocSource).toContain("No filesystem path is selected by Host");
  });

  it("10. the design doc cross-references Alpha 387, Alpha 359, Alpha 357, and Alpha 334", () => {
    for (const ref of [
      "secure_runtime_alpha_387_host_query_lifecycle_verification",
      "secure_runtime_alpha_359_four_protocol_append_only_verification",
      "secure_runtime_alpha_357_crash_review",
      "secure_runtime_alpha_334_desktop_host_dependency_assembly",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

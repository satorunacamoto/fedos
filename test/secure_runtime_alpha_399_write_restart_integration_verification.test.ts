import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_399_write_restart_integration_verification.md?raw";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BOARD_ID = "board-399";

function rootInput(id: string, ref: string, createdAt: number): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a399" },
    body: `body-${id}`,
    createdAt,
    source: { protocol: "nostr", reference: ref },
  };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 399 -- "Integration Verification": Stage 9 of
 * the Alpha 391-400 Desktop Host Durable Write Coordination Arc.
 * Verification only. Real end-to-end: write via submitPost() -> stop
 * -> restart with a fresh Host over the same durable file -> hydrate
 * -> query. Everything preserved.
 */
describe("Secure Runtime Alpha 399 -- Write Restart Integration Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a post written via submitPost() survives a real restart onto a fresh Host instance", async () => {
    dir = mkdtempSync(join(tmpdir(), "a399-"));
    const filePath = join(dir, "board.jsonl");

    const persistence1 = new AppendOnlyFedosBoardPersistence(filePath);
    const host1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence1 });
    await host1.start();

    const root = validateFedosBoardPost(rootInput("root", "ref-root", 1_700_007_000))!;
    expect(host1.submitPost(root)).toBe("inserted");
    const reply = validateFedosBoardPost({
      id: "reply",
      boardId: BOARD_ID,
      threadId: "root",
      replyTo: "root",
      author: { identityId: null, protocol: "atproto", publicIdentifier: "did:plc:a399" },
      body: "reply body",
      createdAt: 1_700_007_500,
      source: { protocol: "atproto", reference: "at://a399/reply" },
    })!;
    expect(host1.submitPost(reply)).toBe("inserted");

    await host1.stop();

    // Fresh, independent second instance over the SAME file -- simulating a real process restart.
    const persistence2 = new AppendOnlyFedosBoardPersistence(filePath);
    const host2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence2 });
    await host2.start();

    const feed = host2.query()!.recentFeed(root.boardId, undefined, { limit: 100 });
    expect(feed.posts.map((p) => p.id).sort()).toEqual(["reply", "root"]);

    const thread = host2.query()!.thread(root.boardId, root.threadId);
    expect(thread.posts.map((p) => p.id)).toEqual(["root", "reply"]);
  });

  it("3. behavioral: filters remain correct across the restart", async () => {
    dir = mkdtempSync(join(tmpdir(), "a399-"));
    const filePath = join(dir, "board.jsonl");

    const persistence1 = new AppendOnlyFedosBoardPersistence(filePath);
    const host1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence1 });
    await host1.start();
    let lastPost = validateFedosBoardPost(rootInput("f-0", "ref-f-0", 1_700_008_000))!;
    for (let i = 0; i < 3; i++) {
      const post = validateFedosBoardPost(rootInput(`f-${i}`, `ref-f-${i}`, 1_700_008_000 + i * 100))!;
      expect(host1.submitPost(post)).toBe("inserted");
      lastPost = post;
    }
    await host1.stop();

    const persistence2 = new AppendOnlyFedosBoardPersistence(filePath);
    const host2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence2 });
    await host2.start();
    const filtered = host2.query()!.recentFeed(lastPost.boardId, { since: 1_700_008_100 });
    expect(filtered.total).toBe(2);
  });

  it("4. behavioral: a second, unrelated fresh-file Host started after the restart stays empty -- no cross-file leakage", async () => {
    dir = mkdtempSync(join(tmpdir(), "a399-"));
    const filePath = join(dir, "board.jsonl");
    const otherPath = join(dir, "other.jsonl");

    const persistence1 = new AppendOnlyFedosBoardPersistence(filePath);
    const host1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence1 });
    await host1.start();
    const post = validateFedosBoardPost(rootInput("isolated", "ref-isolated", 1_700_009_000))!;
    expect(host1.submitPost(post)).toBe("inserted");
    await host1.stop();

    const otherPersistence = new AppendOnlyFedosBoardPersistence(otherPath);
    const otherHost = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: otherPersistence });
    await otherHost.start();
    expect(otherHost.query()!.recentFeed(post.boardId).total).toBe(0);
  });

  it("5. the design doc names the exact scenario this closes, referencing Alpha 390's own required success condition", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "coordinate persistence and `FedosBoardService` registration atomically, as ONE Host-owned write boundary.",
    );
  });

  it("6. the design doc cross-references Alpha 398, Alpha 395, Alpha 390, and Alpha 367", () => {
    for (const ref of [
      "secure_runtime_alpha_398_write_atomicity_verification",
      "secure_runtime_alpha_395_host_write_api_implementation",
      "secure_runtime_alpha_390_host_query_integration_completion",
      "secure_runtime_alpha_367_host_restart_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

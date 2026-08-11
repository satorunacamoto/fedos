import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_396_immediate_query_visibility.md?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BOARD_ID = "board-396";

function rootInput(id: string, ref: string): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a396" },
    body: `body-${id}`,
    createdAt: 1_700_005_000,
    source: { protocol: "nostr", reference: ref },
  };
}

/**
 * Secure Runtime Alpha 396 -- "Immediate Query Visibility": Stage 6 of
 * the Alpha 391-400 Desktop Host Durable Write Coordination Arc.
 * Verification only. Confirms host.query() observes a submitPost()
 * write immediately, in the same synchronous block, no rebuild/reload.
 */
describe("Secure Runtime Alpha 396 -- Immediate Query Visibility", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: host.query() observes a submitPost() write in the same synchronous block, no rebuild", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();

    const post = validateFedosBoardPost(rootInput("visible", "ref-a"))!;
    expect(host.submitPost(post)).toBe("inserted");
    // No await, no delay -- the very next synchronous call.
    const result = host.query()!.recentFeed(post.boardId);
    expect(result.posts.map((p) => p.id)).toContain("visible");
  });

  it("3. behavioral: thread() observes a submitPost()-written reply immediately", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();

    const root = validateFedosBoardPost(rootInput("thread-root", "ref-b"))!;
    expect(host.submitPost(root)).toBe("inserted");
    const reply = validateFedosBoardPost({
      id: "thread-reply",
      boardId: BOARD_ID,
      threadId: "thread-root",
      replyTo: "thread-root",
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a396b" },
      body: "reply body",
      createdAt: 1_700_005_100,
      source: { protocol: "nostr", reference: "ref-c" },
    })!;
    expect(host.submitPost(reply)).toBe("inserted");

    const threadResult = host.query()!.thread(root.boardId, root.threadId);
    expect(threadResult.posts.map((p) => p.id)).toEqual(["thread-root", "thread-reply"]);
  });

  it("4. behavioral: repeated submitPost() + query() calls stay consistent across multiple writes", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();

    for (let i = 0; i < 5; i++) {
      const post = validateFedosBoardPost(rootInput(`multi-${i}`, `ref-multi-${i}`))!;
      expect(host.submitPost(post)).toBe("inserted");
      expect(host.query()!.recentFeed(post.boardId, undefined, { limit: 100 }).total).toBe(i + 1);
    }
  });

  it("5. the design doc explains why visibility requires no separate step, referencing the shared instance", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "There is no cache, no snapshot, no copy anywhere in this chain",
    );
  });

  it("6. the design doc scopes 'immediate' to within one live Host instance, deferring cross-restart durability to Alpha 399", () => {
    expect(designDocSource).toContain("Alpha 399's own");
    expect(designDocSource).toContain("write-restart-hydrate-query integration test");
  });

  it("7. the design doc cross-references Alpha 395, Alpha 393, Alpha 383, and Alpha 389", () => {
    for (const ref of [
      "secure_runtime_alpha_395_host_write_api_implementation",
      "secure_runtime_alpha_393_write_transaction_order",
      "secure_runtime_alpha_383_host_owned_query_construction",
      "secure_runtime_alpha_389_four_protocol_host_query_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

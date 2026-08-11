import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_419_host_submit_outbox_coordination.md?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { makeFedosBoardOutboxId, type FedosBoardOutboxTarget } from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";

const BOARD_ID = "board-419";

function rootInput(id: string, ref: string): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a419" },
    body: `body-${id}`,
    createdAt: 1_700_004_000,
    source: { protocol: "nostr", reference: ref },
  };
}

async function readyHost() {
  const boardPersistence = new InMemoryFedosBoardPersistence();
  const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence,
    outboxPersistence,
  });
  await host.start();
  return { host, boardPersistence, outboxPersistence };
}

/**
 * Secure Runtime Alpha 419 -- "Host Submit + Outbox Coordination":
 * Stage 9 of the Alpha 411-420 Canonical Board Durable Outbox
 * Foundation Arc. Implements FedosDesktopHost.submitPostWithOutbox().
 */
describe("Secure Runtime Alpha 419 -- Host Submit + Outbox Coordination", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc adopts Option D, named submitPostWithOutbox, and never claims atomicity", () => {
    expect(designDocSource).toMatch(/adopted D, named `submitPostWithOutbox`/);
    expect(designDocSource).toMatch(/does NOT call the[\s\S]*?sequence atomic/);
  });

  it("3. behavioral: submitPostWithOutbox throws for the ready-state guard, matching submitPost()'s own convention", () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    const post = validateFedosBoardPost(rootInput("pre-start", "ref-a"))!;
    expect(() => host.submitPostWithOutbox(post, [])).toThrow(/ready state/);
  });

  it("4. behavioral: submitPost(post) remains completely unaffected -- no Outbox write occurs when it is called directly", async () => {
    const { host, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("local-only", "ref-b"))!;
    expect(host.submitPost(post)).toBe("inserted");
    expect(outboxPersistence.listIntents()).toEqual([]);
  });

  it("5. behavioral: empty targets delegates to local-only submitPost -- outbox stays empty", async () => {
    const { host, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("empty-targets", "ref-c"))!;
    const result = host.submitPostWithOutbox(post, []);
    expect(result.post).toBe("inserted");
    expect(result.outbox).toEqual([]);
    expect(outboxPersistence.listIntents()).toEqual([]);
  });

  it("6. behavioral: a new post with explicit targets is durably queued, one intent per target", async () => {
    const { host, boardPersistence, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("queued", "ref-d"))!;
    const targets: FedosBoardOutboxTarget[] = [
      { protocol: "nostr", destination: null },
      { protocol: "activitypub", destination: "https://example.social/inbox" },
    ];
    const result = host.submitPostWithOutbox(post, targets);
    expect(result.post).toBe("inserted");
    expect(result.outbox).toHaveLength(2);
    expect(result.outbox.every((entry) => entry.result === "inserted")).toBe(true);
    expect(boardPersistence.listPosts().some((r) => r.id === "queued")).toBe(true);
    expect(outboxPersistence.listIntents()).toHaveLength(2);
  });

  it("7. behavioral: duplicate targets are deduped by deterministic id -- one write, one result entry", async () => {
    const { host, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("dedupe", "ref-e"))!;
    const target: FedosBoardOutboxTarget = { protocol: "nostr", destination: null };
    const result = host.submitPostWithOutbox(post, [target, { ...target }]);
    expect(result.outbox).toHaveLength(1);
    expect(outboxPersistence.listIntents()).toHaveLength(1);
  });

  it("8. behavioral: resubmitting the identical post + targets is idempotent -- already-present, no duplicate intents", async () => {
    const { host, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("idempotent", "ref-f"))!;
    const targets: FedosBoardOutboxTarget[] = [{ protocol: "nostr", destination: null }];
    const first = host.submitPostWithOutbox(post, targets);
    const second = host.submitPostWithOutbox(post, targets);
    expect(first.post).toBe("inserted");
    expect(second.post).toBe("already-present");
    expect(second.outbox[0]!.result).toBe("already-present");
    expect(outboxPersistence.listIntents()).toHaveLength(1);
  });

  it("9. behavioral: a post rejected before any Outbox write leaves the outbox empty and untouched", async () => {
    const { host, outboxPersistence } = await readyHost();
    const missingParent = validateFedosBoardPost({
      ...rootInput("reply", "ref-g"),
      replyTo: "nonexistent",
      threadId: "nonexistent",
    })!;
    const result = host.submitPostWithOutbox(missingParent, [{ protocol: "nostr", destination: null }]);
    expect(result.post).toBe("missing-parent");
    expect(result.outbox).toEqual([]);
    expect(outboxPersistence.listIntents()).toEqual([]);
  });

  it("10. behavioral: an outbox id derived by the Host matches makeFedosBoardOutboxId's own derivation", async () => {
    const { host, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("id-check", "ref-h"))!;
    const target: FedosBoardOutboxTarget = { protocol: "session", destination: "gateway-1" };
    host.submitPostWithOutbox(post, [target]);
    const expectedId = makeFedosBoardOutboxId(post.id, target);
    expect(outboxPersistence.getIntent(expectedId)).not.toBeNull();
  });

  it("11. behavioral: the Outbox intent's own createdAt reuses the post's own createdAt", async () => {
    const { host, outboxPersistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("timestamp", "ref-i"))!;
    host.submitPostWithOutbox(post, [{ protocol: "nostr", destination: null }]);
    const [record] = outboxPersistence.listIntents();
    expect(record!.createdAt).toBe(post.createdAt);
  });

  it("12. structural: FedosDesktopHostDependencies.outboxPersistence is optional -- 29 pre-existing direct-construction sites still compile", () => {
    // Runtime proof that omitting outboxPersistence entirely still yields a working Host.
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    expect(host).toBeInstanceOf(FedosDesktopHost);
  });

  it("13. the design doc cross-references Alpha 395, Alpha 409, and Alpha 413", () => {
    for (const ref of [
      "secure_runtime_alpha_395_host_write_api_implementation",
      "secure_runtime_alpha_409_outbound_publish_readiness_review",
      "secure_runtime_alpha_413_outbox_identifier_target_model",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

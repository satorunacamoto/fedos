import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/board/runtime/fedos_board_runtime_id_generator.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import type { FedosBoardSourceProtocol } from "../src/board/fedos_board_source.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/board/runtime/fedos_board_runtime.ts?raw";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

function inboundPostInput(id: string, boardId: string, protocol: FedosBoardSourceProtocol): FedosBoardPostInput {
  return {
    id,
    boardId,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol, publicIdentifier: `${protocol}-author-1` },
    body: `an inbound ${protocol} post`,
    createdAt: 1_700_000_000,
    source: { protocol, reference: `${protocol}-native-ref-1` },
  };
}

/**
 * Secure Runtime Alpha 637 ("Four-Protocol Boundary Review") -- Stage
 * 17 of the Alpha 621-640 Public Board Runtime Application API
 * Foundation Arc. `FedosBoardRuntime` never calls a Protocol Adapter
 * itself (it only ever WRITES a local, "fedos"-sourced post) -- these
 * tests confirm inbound posts registered by the FOUR existing protocol
 * adapters (simulated here via their own shared final construction
 * step, `validateFedosBoardPost`, exactly as every real adapter itself
 * calls) coexist correctly in the SAME feed/thread this Runtime reads,
 * without this Runtime ever re-publishing them.
 */
describe("Secure Runtime Alpha 637 -- Four-Protocol Boundary Review", () => {
  it("1. local public posts and inbound Nostr/ActivityPub/AT Protocol/Session posts all appear in the SAME board feed", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();

    for (const protocol of ["nostr", "activitypub", "atproto", "session"] as const) {
      const post = validateFedosBoardPost(inboundPostInput(`${protocol}-post`, "shared-board", protocol))!;
      expect(host.submitPost(post)).toBe("inserted");
    }

    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("local-post") });
    await runtime.createPublicThread({ boardId: "shared-board", body: "a local public post" });

    const feed = runtime.recentFeed("shared-board");
    expect(feed?.posts.map((p) => p.id).sort()).toEqual(
      ["nostr-post", "activitypub-post", "atproto-post", "session-post", "local-post"].sort(),
    );
  });

  it("2. Runtime.findPost() reads an inbound protocol post exactly like a local one -- no protocol discrimination in the read facade", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const nostrPost = validateFedosBoardPost(inboundPostInput("nostr-post-2", "board-x", "nostr"))!;
    host.submitPost(nostrPost);

    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("unused") });
    const found = runtime.findPost("nostr-post-2");
    expect(found?.source).toEqual({ protocol: "nostr", reference: "nostr-native-ref-1" });
  });

  it("3. Runtime never re-publishes an inbound post it reads -- creating an outbound Outbox intent requires an EXPLICIT createPublicThread/replyToPublicThread call, never a side effect of a read", async () => {
    const outboxPersistence = new InMemoryFedosBoardOutboxPersistence();
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence,
    });
    await host.start();
    const nostrPost = validateFedosBoardPost(inboundPostInput("nostr-post-3", "board-x", "nostr"))!;
    host.submitPost(nostrPost);

    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("unused") });
    runtime.findPost("nostr-post-3");
    runtime.recentFeed("board-x");
    runtime.thread("board-x", "nostr-post-3");

    expect(outboxPersistence.listIntents()).toHaveLength(0);
  });

  it("4. no protocol-specific command method exists on FedosBoardRuntime -- its own public surface names no protocol", async () => {
    for (const protocolWord of ["Nostr", "ActivityPub", "Atproto", "AtProto", "Session"]) {
      expect(runtimeSource as string).not.toMatch(new RegExp(`create${protocolWord}|reply${protocolWord}|publish${protocolWord}`, "i"));
    }
  });

  it("5. FedosBoardRuntime's own source imports no Protocol Adapter file -- confirmed by source inspection", async () => {
    const code = runtimeSource as string;
    expect(code).not.toMatch(/fedos_board_nostr_adapter|fedos_activitypub_board_adapter|fedos_atproto_board_adapter|fedos_session_board_adapter/);
  });
});

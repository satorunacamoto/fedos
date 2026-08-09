import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_339_desktop_host_integration_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostStateSource from "../src/os/messenger/desktop/host/fedos_desktop_host_state.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import factorySource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";

import { createFedosDesktopHost } from "../src/desktop/host/create_fedos_desktop_host.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";
import { toFedosBoardId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/board/fedos_board_identifiers.js";

import { validateNostrBoardPost } from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";
import { validateActivityPubBoardPost } from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";
import { validateAtprotoBoardPost } from "../src/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";
import { validateSessionBoardPost } from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const BOARD_ID = "board-339";

const nostrRoot: FedosValidatedNostrEvent = {
  id: "a".repeat(64),
  pubkey: "b".repeat(64),
  created_at: 1_700_000_100,
  kind: 1,
  tags: [],
  content: "Hello from Nostr",
  sig: "c".repeat(128),
};

const activityPubRoot: FedosValidatedActivityPubPost = {
  objectId: "https://mastodon.example/users/alice/statuses/1",
  actorId: "https://mastodon.example/users/alice",
  content: "Hello from Mastodon",
  published: 1_700_000_200,
  inReplyTo: null,
  conversationRoot: null,
};

const atprotoRootUri = "at://did:plc:abc123/app.bsky.feed.post/root1";
const atprotoRoot: FedosValidatedAtprotoPost = {
  uri: atprotoRootUri,
  cid: "bafyroot1",
  authorDid: "did:plc:abc123",
  text: "Hello from Bluesky",
  createdAt: 1_700_000_300,
  replyRootUri: null,
  replyParentUri: null,
};
const atprotoReply: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc123/app.bsky.feed.post/reply1",
  cid: "bafyreply1",
  authorDid: "did:plc:abc123",
  text: "Reply on Bluesky",
  createdAt: 1_700_000_800,
  replyRootUri: atprotoRootUri,
  replyParentUri: atprotoRootUri,
};

const sessionRoot: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello from Session",
  createdAt: 1_700_000_600,
  replyTo: null,
};

/** A fully valid FedosPublicIdentityReader that always resolves null -- mirrors the Alpha 048 default. */
class NullPublicIdentityReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}

/** A conforming FedosPublicIdentityReader whose own read always rejects -- used to fail Desktop startup for real. */
class ThrowingPublicIdentityReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<never> {
    throw new Error("simulated Reader failure");
  }
}

function fourProtocolPersistence(): InMemoryFedosBoardPersistence {
  const persistence = new InMemoryFedosBoardPersistence();
  persistence.putPost(serializeFedosBoardPost(validateNostrBoardPost(nostrRoot, BOARD_ID)!));
  persistence.putPost(serializeFedosBoardPost(validateActivityPubBoardPost(activityPubRoot, BOARD_ID)!));
  persistence.putPost(serializeFedosBoardPost(validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!));
  persistence.putPost(serializeFedosBoardPost(validateAtprotoBoardPost(atprotoReply, BOARD_ID)!));
  persistence.putPost(serializeFedosBoardPost(validateSessionBoardPost(sessionRoot, BOARD_ID)!));
  return persistence;
}

/**
 * Secure Runtime Alpha 339 -- "End-to-End Host Verification": Stage 9
 * of the Alpha 331-340 Desktop Host Runtime Foundation Arc. Verifies
 * FedosDesktopHost/createFedosDesktopHost by real execution with
 * injected dependencies -- real fixtures through all four real,
 * unmodified Board Adapters, a real DesktopApplication, never a mock
 * of either owned class.
 */
describe("Secure Runtime Alpha 339 -- End-to-End Host Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. successful startup: state constructed -> ready, four-protocol posts, thread, and feed all reachable", async () => {
    const persistence = fourProtocolPersistence();
    const desktopApplication = new DesktopApplication(new NullPublicIdentityReader());
    const host = createFedosDesktopHost({ desktopApplication, boardPersistence: persistence });

    expect(host.state()).toBe("constructed");
    await host.start();
    expect(host.state()).toBe("ready");

    const board = host.board()!;
    expect(board).not.toBeNull();
    const posts = board.listBoardPosts(validateNostrBoardPost(nostrRoot, BOARD_ID)!.boardId);
    expect(posts).toHaveLength(5);

    const atprotoRootPost = validateAtprotoBoardPost(atprotoRoot, BOARD_ID)!;
    const thread = board.listThreadPosts(atprotoRootPost.boardId, atprotoRootPost.threadId);
    expect(thread.map((p) => p.id).sort()).toEqual(
      [atprotoRootPost.id, validateAtprotoBoardPost(atprotoReply, BOARD_ID)!.id].sort(),
    );
  });

  it("3. successful startup: DesktopApplication itself is started -- bootstrapped and reachable via desktop()", async () => {
    const desktopApplication = new DesktopApplication(new NullPublicIdentityReader());
    const host = createFedosDesktopHost({ desktopApplication, boardPersistence: fourProtocolPersistence() });
    await host.start();
    expect(host.desktop()).toBe(desktopApplication);
    expect(desktopApplication.isBootstrapped()).toBe(true);
  });

  it("4. hydration failure: start() rejects, state failed, DesktopApplication.start() never reached, no Board exposed", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const valid = serializeFedosBoardPost(validateNostrBoardPost(nostrRoot, BOARD_ID)!);
    const corrupt: FedosPersistedBoardPostRecordV1 = { ...valid, schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1;
    persistence.putPost(corrupt);
    const desktopApplication = new DesktopApplication(new NullPublicIdentityReader());
    const host = createFedosDesktopHost({ desktopApplication, boardPersistence: persistence });

    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(desktopApplication.isBootstrapped()).toBe(false);
    expect(host.board()).toBeNull();
    expect(host.desktop()).toBeNull();
  });

  it("5. Desktop startup failure: start() rejects, state failed, hydrated Board is discarded, never exposed", async () => {
    const persistence = fourProtocolPersistence();
    const desktopApplication = new DesktopApplication(new ThrowingPublicIdentityReader());
    const host = createFedosDesktopHost({ desktopApplication, boardPersistence: persistence });

    await expect(host.start()).rejects.toThrow(/simulated Reader failure/);
    expect(host.state()).toBe("failed");
    expect(host.board()).toBeNull();
    expect(host.desktop()).toBeNull();
  });

  it("6. lifecycle: a second start() call rejects", async () => {
    const host = createFedosDesktopHost({ boardPersistence: fourProtocolPersistence() });
    await host.start();
    await expect(host.start()).rejects.toThrow();
  });

  it("7. lifecycle: a second start() call on a failed instance also rejects -- no failed -> ready without a new instance", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const valid = serializeFedosBoardPost(validateNostrBoardPost(nostrRoot, BOARD_ID)!);
    persistence.putPost({ ...valid, schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1);
    const host = createFedosDesktopHost({ boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    await expect(host.start()).rejects.toThrow();
  });

  it("8. lifecycle: stop() from ready succeeds, and a stopped Host denies application/Board access", async () => {
    const host = createFedosDesktopHost({ boardPersistence: fourProtocolPersistence() });
    await host.start();
    await host.stop();
    expect(host.state()).toBe("stopped");
    expect(host.desktop()).toBeNull();
    expect(host.board()).toBeNull();
  });

  it("9. lifecycle: no restart after stopped", async () => {
    const host = createFedosDesktopHost({ boardPersistence: fourProtocolPersistence() });
    await host.start();
    await host.stop();
    await expect(host.start()).rejects.toThrow();
  });

  it("10. lifecycle: independent Hosts do not share state", async () => {
    const hostA = createFedosDesktopHost({ boardPersistence: fourProtocolPersistence() });
    const hostB = createFedosDesktopHost({ boardPersistence: new InMemoryFedosBoardPersistence() });
    await hostA.start();
    await hostB.start();
    const boardId = toFedosBoardId(BOARD_ID) as FedosBoardId;
    expect(hostA.board()!.listBoardPosts(boardId).length).toBeGreaterThan(0);
    expect(hostB.board()!.listBoardPosts(boardId).length).toBe(0);
  });

  it("11. lifecycle: factory construction has no side effect -- no error, no state beyond constructed, no persisted record", () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const host = createFedosDesktopHost({ boardPersistence });
    expect(host).toBeInstanceOf(FedosDesktopHost);
    expect(host.state()).toBe("constructed");
    expect(boardPersistence.listPosts()).toEqual([]);
  });

  it("12. boundaries: no Worker, createRuntime, Relay Pool, StorageBackend, p2p, GUI, process.exit, or process.env reference anywhere in src/desktop/host/", () => {
    for (const source of [hostSource, hostStateSource, factorySource]) {
      const code = codeOnly(source);
      expect(code).not.toMatch(/src\/worker\.ts|from ["'].*worker\.js["']/);
      expect(code).not.toMatch(/createRuntime/);
      expect(code).not.toMatch(/RelayPool|FedosRelay|WebSocket/);
      expect(code).not.toMatch(/StorageBackend/);
      expect(code).not.toMatch(/from ["'].*\bp2p\//);
      expect(code).not.toMatch(/window\.|document\./);
      expect(code).not.toMatch(/process\.exit/);
      expect(code).not.toMatch(/process\.env/);
    }
  });

  it("13. the design doc cross-references Alpha 337, Alpha 309, and Alpha 318", () => {
    for (const ref of [
      "secure_runtime_alpha_337_desktop_host_shutdown_contract",
      "secure_runtime_alpha_309_four_protocol_board_integration",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_335_board_hydration_ownership.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-335",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `root ${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 335 -- "Board Hydration Ownership": Stage 5 of
 * the Alpha 331-340 Desktop Host Runtime Foundation Arc. Wires Board
 * hydration into FedosDesktopHost.start() -- hydrate first, fail
 * closed on any non-"hydrated" outcome, never start
 * DesktopApplication on a hydration failure.
 */
describe("Secure Runtime Alpha 335 -- Board Hydration Ownership", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: a valid persistence hydrates successfully, and the Board is reachable after start()", () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(rootInput("root-1"))!;
    boardPersistence.putPost(serializeFedosBoardPost(post));
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence });

    return host.start().then(() => {
      expect(host.state()).toBe("ready");
      const board = host.board();
      expect(board).not.toBeNull();
      expect(board!.findPost(post.id)?.id).toBe(post.id);
    });
  });

  it("3. behavioral: a corrupt persisted record fails hydration -- start() rejects, state is failed", async () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(rootInput("root-corrupt"))!;
    const corrupt = { ...serializeFedosBoardPost(post), schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1;
    boardPersistence.putPost(corrupt);
    const desktopApplication = new DesktopApplication();
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence });

    await expect(host.start()).rejects.toThrow(/hydrate/);
    expect(host.state()).toBe("failed");
    expect(host.board()).toBeNull();
  });

  it("4. behavioral: a corrupt persisted record means DesktopApplication.start() is never reached", async () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const post = validateFedosBoardPost(rootInput("root-corrupt-2"))!;
    const corrupt = { ...serializeFedosBoardPost(post), schemaVersion: 2 } as unknown as FedosPersistedBoardPostRecordV1;
    boardPersistence.putPost(corrupt);
    const desktopApplication = new DesktopApplication();
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence });

    await expect(host.start()).rejects.toThrow();
    // DesktopApplication.start() is the only path that can ever bootstrap Identity.
    expect(desktopApplication.isBootstrapped()).toBe(false);
  });

  it("5. behavioral: an unresolvable thread (missing parent) also fails hydration and rejects start()", async () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const replyInput: FedosBoardPostInput = {
      id: "reply-orphan",
      boardId: "board-335",
      threadId: "root-never-persisted",
      replyTo: "root-never-persisted",
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "orphan reply",
      createdAt: 1_700_000_100,
      source: { protocol: "nostr", reference: "ref-orphan" },
    };
    const post = validateFedosBoardPost(replyInput)!;
    boardPersistence.putPost(serializeFedosBoardPost(post));
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence });

    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
  });

  it("6. structural: start() calls hydrateFedosBoardService before DesktopApplication.start()", () => {
    const code = codeOnly(hostSource);
    const hydrateIndex = code.indexOf("hydrateFedosBoardService(");
    const desktopStartIndex = code.indexOf("this.#desktopApplication.start()");
    expect(hydrateIndex).toBeGreaterThan(-1);
    expect(desktopStartIndex).toBeGreaterThan(-1);
    expect(hydrateIndex).toBeLessThan(desktopStartIndex);
  });

  it("7. structural: #boardService is assigned a non-null value in exactly one place -- start()'s own final statements, immediately before entering ready", () => {
    // Updated by Alpha 383 (Arc 381-390): #boardQuery is now assigned between
    // #boardService and the "ready" transition -- same single-assignment-site
    // guarantee, one more statement in the fixed final sequence.
    const nonNullAssignments = hostSource.match(/this\.#boardService = (?!null)/g) ?? [];
    expect(nonNullAssignments).toHaveLength(1);
    expect(hostSource).toMatch(
      /this\.#boardService = hydration\.service;\s*\n\s*this\.#boardQuery = boardQuery;\s*\n\s*this\.#state = "ready";/,
    );
  });

  it("8. structural: no setTimeout/setInterval/background task anywhere in this file", () => {
    expect(hostSource).not.toMatch(/setTimeout|setInterval/);
  });

  it("9. the design doc cross-references Alpha 334, Alpha 318, and Alpha 136", () => {
    for (const ref of [
      "secure_runtime_alpha_334_desktop_host_dependency_assembly",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_136_startup_sequence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

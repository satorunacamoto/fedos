import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { createFedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/board/runtime/fedos_board_runtime_id_generator.js";
import { FEDOS_BOARD_POST_MAX_BODY_LENGTH } from "../src/board/fedos_board_post_validator.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import type { FedosBoardOutboxPersistence } from "../src/board/outbox/fedos_board_outbox_persistence.js";
import type { FedosBoardPersistence } from "../src/board/persistence/fedos_board_persistence.js";
import { validateFedosBoardPost } from "../src/board/fedos_board_post_validator.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

function readerResolvingToNostr(publicIdentifier: string): FedosPublicIdentityReader {
  return { readPublicIdentity: async () => ({ id: "id-1", provider: "nostr", publicIdentifier }) };
}

async function readyHost(outboxPersistence?: FedosBoardOutboxPersistence): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
    outboxPersistence,
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 636 ("Failure Matrix") -- Stage 16 of the Alpha
 * 621-640 Public Board Runtime Application API Foundation Arc. Every
 * scenario the Arc's own instruction names, verified individually, no
 * partial-success outcome hidden behind a coarser one.
 */
describe("Secure Runtime Alpha 636 -- Failure Matrix", () => {
  it("1. Host not ready (never started) -> unavailable", () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x") });
    expect(runtime.createPublicThread({ boardId: "b", body: "hi" })).toEqual({ outcome: "unavailable" });
  });

  it("2. Host stopped after being ready -> unavailable", async () => {
    const host = await readyHost();
    await host.stop();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x") });
    expect(runtime.createPublicThread({ boardId: "b", body: "hi" })).toEqual({ outcome: "unavailable" });
  });

  it("3. invalid (empty) body -> invalid-command/malformed-post", async () => {
    const host = await readyHost();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x") });
    expect(runtime.createPublicThread({ boardId: "b", body: "" })).toEqual({
      outcome: "invalid-command",
      reason: "malformed-post",
    });
  });

  it("4. oversized body -> invalid-command/malformed-post", async () => {
    const host = await readyHost();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x") });
    const oversized = "a".repeat(FEDOS_BOARD_POST_MAX_BODY_LENGTH + 1);
    expect(runtime.createPublicThread({ boardId: "b", body: oversized })).toEqual({
      outcome: "invalid-command",
      reason: "malformed-post",
    });
  });

  it("5. invalid (empty) board ID -> invalid-command/malformed-post", async () => {
    const host = await readyHost();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x") });
    expect(runtime.createPublicThread({ boardId: "", body: "hi" })).toEqual({
      outcome: "invalid-command",
      reason: "malformed-post",
    });
  });

  it("6. missing parent (reply) -> invalid-command/missing-parent", async () => {
    const host = await readyHost();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x") });
    expect(
      runtime.replyToPublicThread({ boardId: "b", threadId: "ghost", replyTo: "ghost", body: "hi" }),
    ).toEqual({ outcome: "invalid-command", reason: "missing-parent" });
  });

  it("7. cross-board reply -> invalid-command/cross-board-reply", async () => {
    const host = await readyHost();
    const rootRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-7") });
    rootRuntime.createPublicThread({ boardId: "board-a", body: "root" });
    const replyRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("reply-7") });
    expect(
      replyRuntime.replyToPublicThread({ boardId: "board-b", threadId: "root-7", replyTo: "root-7", body: "hi" }),
    ).toEqual({ outcome: "invalid-command", reason: "cross-board-reply" });
  });

  it("8. identity unavailable does NOT fail the command -- Option B's own point: succeeds anonymously (Alpha 627)", async () => {
    const host = await readyHost();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x8") });
    const result = runtime.createPublicThread({ boardId: "b", body: "hi" });
    expect(result.outcome).toBe("created");
  });

  it("9. ID collision (source-conflict path): a rigged generator reusing a source key a DIFFERENT post already claims -> conflict/source-conflict", async () => {
    const host = await readyHost();
    // Plant a raw post (id "C") whose OWN source deliberately claims "fedos:B" --
    // an unusual shape validateFedosBoardPost permits (it does not enforce
    // source.reference === id; only this Arc's OWN Runtime convention does).
    const planted = validateFedosBoardPost({
      id: "C",
      boardId: "b",
      threadId: "C",
      replyTo: null,
      author: { identityId: null, protocol: "fedos", publicIdentifier: "local-anonymous" },
      body: "planted",
      createdAt: 1_700_000_000,
      source: { protocol: "fedos", reference: "B" },
    })!;
    expect(host.submitPost(planted)).toBe("inserted");

    // A rigged generator mints "B" for a real Runtime-authored post: its OWN
    // source becomes { protocol: "fedos", reference: "B" }, colliding with the
    // planted post's source, while its OWN id ("B") differs from the planted
    // post's id ("C") -- the precise shape FedosBoardService's own precheck
    // recognizes as source-conflict rather than post-id-conflict.
    const collidingRuntime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("B") });
    const result = collidingRuntime.createPublicThread({ boardId: "b", body: "colliding" });
    expect(result).toEqual({ outcome: "conflict", reason: "source-conflict" });
  });

  it("10. ID collision (post-id-conflict path): a rigged generator reusing an EXISTING Runtime-authored post's own id with different content -> conflict/post-id-conflict", async () => {
    const host = await readyHost();
    const first = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("dup-id") });
    first.createPublicThread({ boardId: "b", body: "first body" });

    const second = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("dup-id") });
    const result = second.createPublicThread({ boardId: "b", body: "different body" });
    expect(result).toEqual({ outcome: "conflict", reason: "post-id-conflict" });
  });

  it("11. persistence failure -> persistence-failed, surfaced verbatim, no raw Error object", async () => {
    const failingPersistence: FedosBoardPersistence = {
      putPost: () => "failed",
      getPost: () => null,
      listPosts: () => [],
    };
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: failingPersistence,
    });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x11") });
    const result = runtime.createPublicThread({ boardId: "b", body: "hi" });
    expect(result).toEqual({ outcome: "persistence-failed" });
  });

  it("12. Outbox partial failure -- one eligible target durably fails at the persistence layer, surfaced, not hidden", async () => {
    let calls = 0;
    const flakyOutbox: FedosBoardOutboxPersistence = {
      putIntent: () => (calls++ === 0 ? "failed" : "inserted"),
      getIntent: () => null,
      listIntents: () => [],
    };
    const desktopApplication = new DesktopApplication(readerResolvingToNostr("npub1flaky"));
    const host = new FedosDesktopHost({
      desktopApplication,
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence: flakyOutbox,
    });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x12") });
    const result = runtime.createPublicThread({
      boardId: "b",
      body: "hi",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "failed" }]);
  });

  it("13. unsupported/unrecognized target protocol string is treated as ineligible, never throws", async () => {
    const desktopApplication = new DesktopApplication(readerResolvingToNostr("npub1x"));
    const host = new FedosDesktopHost({
      desktopApplication,
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence: new InMemoryFedosBoardOutboxPersistence(),
    });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("x13") });
    const result = runtime.createPublicThread({
      boardId: "b",
      body: "hi",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outboundTargets: [{ protocol: "unknown-protocol" as any, destination: null }],
    });
    expect(result.outcome).toBe("outbox-partial-failure");
    if (result.outcome !== "outbox-partial-failure") throw new Error("unreachable");
    expect(result.outbox[0]?.result).toBe("ineligible");
  });
});

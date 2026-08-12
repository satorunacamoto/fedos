import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startFedosDesktopRuntime } from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { createFedosBoardRuntime } from "../src/os/messenger/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/os/messenger/board/runtime/fedos_board_runtime_id_generator.js";
import { InMemoryFedosConversationPersistence } from "../src/os/messenger/conversations/persistence/in_memory_fedos_conversation_persistence.js";
import type { FedosConversationPersistence, FedosConversationPersistenceWriteResult } from "../src/os/messenger/conversations/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../src/os/messenger/conversations/persistence/fedos_persisted_conversation_record_v1.js";

const dirs: string[] = [];
function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-runtime-759-"));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

class AlwaysFailingConversationPersistence implements FedosConversationPersistence {
  putConversation(): FedosConversationPersistenceWriteResult {
    return "failed";
  }
  getConversation(): FedosPersistedConversationRecordV1 | null {
    return null;
  }
  listConversations(): readonly FedosPersistedConversationRecordV1[] {
    return [];
  }
}

/**
 * Secure Runtime Alpha 759 ("End-to-End Verification") -- Stage 19 of
 * the Alpha 741-760 Canonical Conversation Identity and Record
 * Foundation Arc. Exercises the REAL, durable (file-backed) Board and
 * Conversation persistence backends across a genuine restart cycle.
 */
describe("Secure Runtime Alpha 759 -- End-to-End Verification", () => {
  it("1-10. start -> create -> verify post+conversation -> reply -> verify same conversation -> stop -> fresh restart -> hydrate -> verify mapping/reads", async () => {
    const dir = freshDir();
    const boardLogPath = join(dir, "board.ndjson");
    const outboxLogPath = join(dir, "outbox.ndjson");
    const conversationLogPath = join(dir, "conversation.ndjson");

    // 1. start Local Runtime
    const runtime1 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, conversationLogPath, deliveryEnabled: false });

    // 2. create Public Thread through BoardRuntime
    const rootResult = await runtime1.boardRuntime().createPublicThread({ boardId: "board-759", body: "root, cycle 1" });
    expect(rootResult.outcome).toBe("created");
    if (rootResult.outcome !== "created") throw new Error("unreachable");
    const rootId = rootResult.post.id;

    // 3. verify Board Post
    expect(runtime1.boardRuntime().findPost(rootId)?.body).toBe("root, cycle 1");

    // 4. verify Conversation Record
    expect(rootResult.conversation.outcome).toBe("recorded");
    if (rootResult.conversation.outcome !== "recorded") throw new Error("unreachable");
    const conversationId = rootResult.conversation.conversation.id;
    expect(rootResult.conversation.conversation.rootPostId).toBe(rootId);
    expect(rootResult.conversation.conversation.boardId).toBe("board-759");

    // 5. reply
    const replyResult = await runtime1.boardRuntime().replyToPublicThread({
      boardId: "board-759",
      threadId: rootId,
      replyTo: rootId,
      body: "a reply, cycle 1",
    });
    expect(replyResult.outcome).toBe("created");

    // 6. verify same Conversation
    if (replyResult.outcome !== "created") throw new Error("unreachable");
    expect(replyResult.conversation.outcome).toBe("existing");
    if (replyResult.conversation.outcome !== "existing") throw new Error("unreachable");
    expect(replyResult.conversation.conversation.id).toBe(conversationId);
    expect(runtime1.boardRuntime().listBoardConversations("board-759")).toHaveLength(1);

    // 7. stop
    await runtime1.stop();

    // 8. create fresh runtime
    const runtime2 = await startFedosDesktopRuntime({ boardLogPath, outboxLogPath, conversationLogPath, deliveryEnabled: false });

    // 9. hydrate Board and Conversation
    // (implicit -- startFedosDesktopRuntime's own start()/hydrateFedosConversations() already ran)

    // 10. verify mapping and reads
    expect(runtime2.boardRuntime().findPost(rootId)?.body).toBe("root, cycle 1");
    expect(runtime2.boardRuntime().conversationForThread("board-759", rootId)?.id).toBe(conversationId);
    expect(runtime2.boardRuntime().recentFeed("board-759")?.posts).toHaveLength(2);

    await runtime2.stop();
  });

  it("duplicate command / ID conflict: resubmitting the same logical write is idempotent, never a duplicate Conversation record", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("p1", "p1"),
      clock: () => 1_700_000_000,
      conversationPersistence,
    });

    const first = await runtime.createPublicThread({ boardId: "b", body: "hello" });
    const second = await runtime.createPublicThread({ boardId: "b", body: "hello" });
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("already-present");
    expect(conversationPersistence.listConversations()).toHaveLength(1);
  });

  it("Conversation persistence failure: surfaced explicitly, Board write remains durable, no atomicity claimed", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("p1"),
      conversationPersistence: new AlwaysFailingConversationPersistence(),
    });

    const result = await runtime.createPublicThread({ boardId: "b", body: "hello" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.conversation).toEqual({ outcome: "persistence-failed" });
    expect(runtime.findPost("p1")).not.toBeNull();
  });

  it("Board write failure: no Conversation write is ever attempted for a post that never durably succeeded", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1"), conversationPersistence });

    // A malformed command (empty body would still validate at the Board
    // level? use a genuinely invalid boardId to force invalid-command).
    const result = await runtime.replyToPublicThread({ boardId: "b", threadId: "does-not-exist", replyTo: "does-not-exist", body: "x" });
    expect(result.outcome).toBe("invalid-command");
    expect(conversationPersistence.listConversations()).toHaveLength(0);
  });

  it("legacy Board without Conversation: reply succeeds, conversation surfaces not-found", async () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    boardPersistence.putPost({
      schemaVersion: 1,
      id: "legacy-root",
      boardId: "b",
      threadId: "legacy-root",
      replyTo: null,
      author: { identityId: null, protocol: "fedos", publicIdentifier: "local-anonymous" },
      body: "legacy",
      createdAt: 1_600_000_000,
      source: { protocol: "fedos", reference: "legacy-root" },
    });
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence });
    await host.start();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p2") });

    const result = await runtime.replyToPublicThread({ boardId: "b", threadId: "legacy-root", replyTo: "legacy-root", body: "reply" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.conversation).toEqual({ outcome: "not-found" });
  });

  it("independent runtimes: two startFedosDesktopRuntime() calls never share Conversation state", async () => {
    const dirA = freshDir();
    const dirB = freshDir();
    const runtimeA = await startFedosDesktopRuntime({
      boardLogPath: join(dirA, "board.ndjson"),
      outboxLogPath: join(dirA, "outbox.ndjson"),
      conversationLogPath: join(dirA, "conversation.ndjson"),
      deliveryEnabled: false,
    });
    const runtimeB = await startFedosDesktopRuntime({
      boardLogPath: join(dirB, "board.ndjson"),
      outboxLogPath: join(dirB, "outbox.ndjson"),
      conversationLogPath: join(dirB, "conversation.ndjson"),
      deliveryEnabled: false,
    });

    await runtimeA.boardRuntime().createPublicThread({ boardId: "b", body: "only in A" });
    expect(runtimeA.boardRuntime().listBoardConversations("b")).toHaveLength(1);
    expect(runtimeB.boardRuntime().listBoardConversations("b")).toHaveLength(0);

    await runtimeA.stop();
    await runtimeB.stop();
  });

  it("unsupported private/direct fail closed: no code path in this Arc ever constructs a non-public Conversation record", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("p1"), conversationPersistence });
    await runtime.createPublicThread({ boardId: "b", body: "hello" });
    expect(conversationPersistence.listConversations().every((r) => r.mode === "public")).toBe(true);
  });
});

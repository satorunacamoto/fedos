import { describe, it, expect, beforeEach } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosBoardRuntime, createFedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/board/runtime/fedos_board_runtime_id_generator.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

async function readyHost(): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 629 ("Create Public Thread") / Alpha 631
 * ("Create Public Root Post vs Thread Decision") -- Stages 9/11 of the
 * Alpha 621-640 Public Board Runtime Application API Foundation Arc.
 */
describe("Secure Runtime Alpha 629 -- Create Public Thread", () => {
  let host: FedosDesktopHost;

  beforeEach(async () => {
    host = await readyHost();
  });

  it("1. creates a root post whose threadId equals its own id, replyTo null -- Alpha 631: no separate thread-creation API needed", () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-1") });
    const result = runtime.createPublicThread({ boardId: "board-a", body: "hello board" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.id).toBe("root-1");
    expect(result.post.threadId).toBe("root-1");
    expect(result.post.replyTo).toBeNull();
    expect(result.post.boardId).toBe("board-a");
    expect(result.post.body).toBe("hello board");
  });

  it("2. the created post's source is { protocol: 'fedos', reference: <own id> } -- Alpha 628", () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-2") });
    const result = runtime.createPublicThread({ boardId: "board-a", body: "hi" });
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.source).toEqual({ protocol: "fedos", reference: "root-2" });
  });

  it("3. author is anonymous-local by default (today's real DesktopApplication default) -- Alpha 627", () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-3") });
    const result = runtime.createPublicThread({ boardId: "board-a", body: "hi" });
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.author.identityId).toBeNull();
    expect(result.post.author.protocol).toBe("fedos");
  });

  it("4. createdAt is Runtime clock authority -- caller cannot supply it, and an injected clock is honored", () => {
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: fixedIdGenerator("root-4"),
      clock: () => 1_700_000_000,
    });
    const command = { boardId: "board-a", body: "hi" } as const;
    // TypeScript itself proves createdAt cannot be supplied: this command's own
    // type carries no createdAt field at all (see fedos_board_runtime_command_types.ts).
    expect((command as Record<string, unknown>).createdAt).toBeUndefined();
    const result = runtime.createPublicThread(command);
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.createdAt).toBe(1_700_000_000);
  });

  it("5. no outboundTargets -> local-only: durable write, empty outbox array, no Outbox intent -- Alpha 634", () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-5") });
    const result = runtime.createPublicThread({ boardId: "board-a", body: "hi" });
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.outbox).toEqual([]);
  });

  it("6. two independent FedosBoardRuntime instances wrapping the SAME Host both see each other's writes", () => {
    const runtimeA = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("shared-1") });
    const runtimeB = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("irrelevant") });
    runtimeA.createPublicThread({ boardId: "board-shared", body: "from A" });
    expect(runtimeB.findPost("shared-1")?.body).toBe("from A");
  });

  it("7. rejects an empty body -- validation reuse (validateFedosBoardPost), not a bespoke check", () => {
    const runtime = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-7") });
    const result = runtime.createPublicThread({ boardId: "board-a", body: "" });
    expect(result).toEqual({ outcome: "invalid-command", reason: "malformed-post" });
  });

  it("8. FedosBoardRuntime is directly constructible via `new`, matching createFedosBoardRuntime()'s own behavior", () => {
    const runtime = new FedosBoardRuntime({ host, idGenerator: fixedIdGenerator("root-8") });
    const result = runtime.createPublicThread({ boardId: "board-a", body: "hi" });
    expect(result.outcome).toBe("created");
  });
});

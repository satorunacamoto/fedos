import { describe, it, expect, beforeEach, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { AppendOnlyFedosBoardOutboxPersistence } from "../src/board/outbox/append_only_fedos_board_outbox_persistence.js";
import { createFedosBoardRuntime } from "../src/board/runtime/fedos_board_runtime.js";
import type { FedosBoardRuntimeIdGenerator } from "../src/board/runtime/fedos_board_runtime_id_generator.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";

function fixedIdGenerator(...ids: string[]): FedosBoardRuntimeIdGenerator {
  let i = 0;
  return { generatePostId: () => ids[i++] ?? `overflow-${i}` };
}

function readerResolvingToNostr(publicIdentifier: string): FedosPublicIdentityReader {
  return { readPublicIdentity: async () => ({ id: "id-1", provider: "nostr", publicIdentifier }) };
}

/**
 * Secure Runtime Alpha 639 ("End-to-End Verification") -- Stage 19 of
 * the Alpha 621-640 Public Board Runtime Application API Foundation
 * Arc. Exercises the REAL, durable (file-backed) persistence backends
 * -- not in-memory stand-ins -- across a genuine Host stop/restart
 * cycle, confirming the Application layer this Arc adds survives a
 * real process-restart-shaped scenario end to end.
 */
describe("Secure Runtime Alpha 639 -- End-to-End Verification", () => {
  let dir: string;
  let boardFilePath: string;
  let outboxFilePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir() as string, "alpha639-") as string) as string;
    boardFilePath = join(dir, "board.ndjson") as string;
    outboxFilePath = join(dir, "outbox.ndjson") as string;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("1. full lifecycle: start -> construct Runtime -> create thread -> reply -> read/query -> local-only -> explicit Nostr Outbox -> stop -> fresh Host restart -> hydrate -> same thread/feed", async () => {
    // --- Cycle 1: real Host, real durable persistence, real DesktopApplication with a resolved Nostr identity.
    const desktopApplication = new DesktopApplication(readerResolvingToNostr("npub1e2euser"));
    const host1 = new FedosDesktopHost({
      desktopApplication,
      boardPersistence: new AppendOnlyFedosBoardPersistence(boardFilePath),
      outboxPersistence: new AppendOnlyFedosBoardOutboxPersistence(outboxFilePath),
    });
    await host1.start();

    // Distinct, increasing timestamps -- with the REAL default clock, two
    // calls in the same test can tie on the same Unix second, making
    // thread()'s own createdAt-ASC-then-id-ASC tiebreak order the id
    // alphabetically rather than by creation order; injecting a clock here
    // makes this test's own ordering assertion deterministic, not the
    // real-clock default's own fault.
    let clockValue = 1_700_000_000;
    const clock = () => clockValue++;
    const runtime1 = createFedosBoardRuntime({
      host: host1,
      idGenerator: fixedIdGenerator("e2e-root", "e2e-reply"),
      clock,
    });

    // Local-only public post (Alpha 634).
    const rootResult = runtime1.createPublicThread({ boardId: "e2e-board", body: "root post, local-only" });
    expect(rootResult.outcome).toBe("created");

    // Reply, still local-only.
    const replyResult = runtime1.replyToPublicThread({
      boardId: "e2e-board",
      threadId: "e2e-root",
      replyTo: "e2e-root",
      body: "a reply, also local-only",
    });
    expect(replyResult.outcome).toBe("created");

    // Read/query while ready.
    expect(runtime1.findPost("e2e-root")?.body).toBe("root post, local-only");
    expect(runtime1.recentFeed("e2e-board")?.posts).toHaveLength(2);
    expect(runtime1.thread("e2e-board", "e2e-root")?.posts.map((p) => p.id)).toEqual(["e2e-root", "e2e-reply"]);

    // Explicit Nostr Outbox intent on a THIRD post.
    const outboxRuntime = createFedosBoardRuntime({ host: host1, idGenerator: fixedIdGenerator("e2e-outbound") });
    const outboundResult = outboxRuntime.createPublicThread({
      boardId: "e2e-board",
      body: "explicitly federated to nostr",
      outboundTargets: [{ protocol: "nostr", destination: null }],
    });
    expect(outboundResult.outcome).toBe("created");
    if (outboundResult.outcome !== "created") throw new Error("unreachable");
    expect(outboundResult.outbox).toEqual([{ target: { protocol: "nostr", destination: null }, result: "inserted" }]);

    await host1.stop();

    // --- Cycle 2: a GENUINELY FRESH Host, fresh DesktopApplication, fresh
    // durable persistence instances pointed at the SAME on-disk files -- the
    // real shape of a process restart, not merely a second constructor call.
    const host2 = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(readerResolvingToNostr("npub1e2euser")),
      boardPersistence: new AppendOnlyFedosBoardPersistence(boardFilePath),
      outboxPersistence: new AppendOnlyFedosBoardOutboxPersistence(outboxFilePath),
    });
    await host2.start();

    const runtime2 = createFedosBoardRuntime({ host: host2, idGenerator: fixedIdGenerator("irrelevant-after-restart") });

    // Same thread/feed, hydrated from durable storage, visible through a
    // BRAND NEW FedosBoardRuntime instance wrapping a BRAND NEW Host instance.
    const feedAfterRestart = runtime2.recentFeed("e2e-board");
    expect(feedAfterRestart?.posts.map((p) => p.id).sort()).toEqual(
      ["e2e-root", "e2e-reply", "e2e-outbound"].sort(),
    );
    expect(runtime2.thread("e2e-board", "e2e-root")?.posts.map((p) => p.id)).toEqual(["e2e-root", "e2e-reply"]);
    expect(runtime2.findPost("e2e-outbound")?.body).toBe("explicitly federated to nostr");

    await host2.stop();
  });

  it("2. independent Runtime/Host isolation: two SEPARATE Hosts (separate persistence, separate files) never see each other's writes", async () => {
    const dirA = mkdtempSync(join(tmpdir() as string, "alpha639-a-") as string) as string;
    const dirB = mkdtempSync(join(tmpdir() as string, "alpha639-b-") as string) as string;
    try {
      const hostA = new FedosDesktopHost({
        desktopApplication: new DesktopApplication(),
        boardPersistence: new AppendOnlyFedosBoardPersistence(join(dirA, "board.ndjson") as string),
      });
      const hostB = new FedosDesktopHost({
        desktopApplication: new DesktopApplication(),
        boardPersistence: new AppendOnlyFedosBoardPersistence(join(dirB, "board.ndjson") as string),
      });
      await hostA.start();
      await hostB.start();

      const runtimeA = createFedosBoardRuntime({ host: hostA, idGenerator: fixedIdGenerator("only-in-a") });
      const runtimeB = createFedosBoardRuntime({ host: hostB, idGenerator: fixedIdGenerator("only-in-b") });

      runtimeA.createPublicThread({ boardId: "board", body: "belongs to host A" });
      runtimeB.createPublicThread({ boardId: "board", body: "belongs to host B" });

      expect(runtimeA.findPost("only-in-b")).toBeNull();
      expect(runtimeB.findPost("only-in-a")).toBeNull();
      expect(runtimeA.findPost("only-in-a")?.body).toBe("belongs to host A");
      expect(runtimeB.findPost("only-in-b")?.body).toBe("belongs to host B");

      await hostA.stop();
      await hostB.stop();
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  it("3. two independent FedosBoardRuntime instances constructed around the SAME Host remain independent objects with no shared mutable state of their own", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new AppendOnlyFedosBoardPersistence(boardFilePath),
    });
    await host.start();
    const runtimeX = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("shared-host-x") });
    const runtimeY = createFedosBoardRuntime({ host, idGenerator: fixedIdGenerator("shared-host-y") });
    expect(runtimeX).not.toBe(runtimeY);
    runtimeX.createPublicThread({ boardId: "b", body: "from X" });
    // Both see it -- they share the SAME underlying Host, by design, but are
    // themselves two structurally distinct instances (no singleton).
    expect(runtimeY.findPost("shared-host-x")?.body).toBe("from X");
    await host.stop();
  });
});

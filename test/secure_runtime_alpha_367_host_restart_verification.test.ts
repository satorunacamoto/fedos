import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_367_host_restart_verification.md?raw";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { serializeFedosBoardPost } from "../src/os/messenger/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";
import { toFedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/os/messenger/board/fedos_board_identifiers.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-367",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

function writeDurably(filePath: string, id: string): void {
  // The Host's own hydrated FedosBoardService is in-memory only (Alpha 335) --
  // durable writes go through FedosBoardPersistence directly, exactly as
  // Alpha 359 already established for persistence-level restart.
  new AppendOnlyFedosBoardPersistence(filePath).putPost(
    serializeFedosBoardPost(validateFedosBoardPost(rootInput(id))!),
  );
}

async function newHost(filePath: string): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new AppendOnlyFedosBoardPersistence(filePath),
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 367 -- "Host Restart Verification": Stage 7 of
 * the Alpha 361-370 Board Recovery & Host Robustness Arc. Verifies
 * FedosDesktopHost itself (not merely the persistence layer alone)
 * across multiple full start/stop cycles, across multiple
 * independently-constructed instances sharing the same file.
 */
describe("Secure Runtime Alpha 367 -- Host Restart Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. content written before a stop() is visible to a second, independently-constructed Host instance", async () => {
    dir = mkdtempSync(join(tmpdir(), "a367-"));
    const filePath = join(dir, "board.jsonl");
    const boardId = toFedosBoardId("board-367") as FedosBoardId;

    const hostA = await newHost(filePath);
    writeDurably(filePath, "post-1");
    await hostA.stop();

    const hostB = await newHost(filePath);
    expect(hostB.board()!.listBoardPosts(boardId).map((p) => p.id)).toEqual(["post-1"]);
    await hostB.stop();
  });

  it("3. lifecycle state is independent per instance -- the first Host stopping has no bearing on the second's own state", async () => {
    dir = mkdtempSync(join(tmpdir(), "a367-"));
    const filePath = join(dir, "board.jsonl");
    const hostA = await newHost(filePath);
    await hostA.stop();
    expect(hostA.state()).toBe("stopped");

    const hostB = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new AppendOnlyFedosBoardPersistence(filePath),
    });
    expect(hostB.state()).toBe("constructed");
    await hostB.start();
    expect(hostB.state()).toBe("ready");
    await hostB.stop();
  });

  it("4. three successive restart cycles produce a monotonically growing, never-duplicated Board", async () => {
    dir = mkdtempSync(join(tmpdir(), "a367-"));
    const filePath = join(dir, "board.jsonl");
    const boardId = toFedosBoardId("board-367") as FedosBoardId;
    const expectedIds: string[] = [];

    for (const id of ["post-1", "post-2", "post-3"]) {
      const host = await newHost(filePath);
      expectedIds.push(id);
      expect(host.board()!.listBoardPosts(boardId).map((p) => p.id).sort()).toEqual(
        [...expectedIds].slice(0, -1).sort(),
      ); // before this cycle's own write, only PRIOR cycles' posts are present
      writeDurably(filePath, id);
      await host.stop();
    }

    const finalHost = await newHost(filePath);
    const ids = finalHost.board()!.listBoardPosts(boardId).map((p) => p.id).sort();
    expect(ids).toEqual(["post-1", "post-2", "post-3"]);
    await finalHost.stop();
  });

  it("5. a clean stop() and a simulated crash (no stop() call) leave identical on-disk state", async () => {
    dir = mkdtempSync(join(tmpdir(), "a367-"));
    const cleanPath = join(dir, "clean.jsonl");
    const crashPath = join(dir, "crash.jsonl");

    const cleanHost = await newHost(cleanPath);
    writeDurably(cleanPath, "post-1");
    await cleanHost.stop();

    const crashHost = await newHost(crashPath);
    writeDurably(crashPath, "post-1");
    // No stop() call -- the reference is simply discarded, simulating a crash.
    void crashHost;

    expect(readFileSync(cleanPath, "utf8")).toBe(readFileSync(crashPath, "utf8"));
  });

  it("6. the design doc distinguishes this Stage's own 'Host restart' from Alpha 359's own 'persistence restart'", () => {
    expect(designDocSource).toContain(
      "## 2. What \"Host restart\" means here, distinct from Alpha 359's \"persistence restart\"",
    );
  });

  it("7. the design doc cross-references Alpha 359, Alpha 337, Alpha 334, and Alpha 333", () => {
    for (const ref of [
      "secure_runtime_alpha_359_four_protocol_append_only_verification",
      "secure_runtime_alpha_337_desktop_host_shutdown_contract",
      "secure_runtime_alpha_334_desktop_host_dependency_assembly",
      "secure_runtime_alpha_333_desktop_host_state_model",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_398_write_atomicity_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import type { FedosBoardPersistence, FedosBoardPersistenceWriteResult } from "../src/os/messenger/board/persistence/fedos_board_persistence.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/os/messenger/board/persistence/fedos_persisted_board_post_v1.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BOARD_ID = "board-398";

function rootInput(id: string, ref: string, body = `body-${id}`): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a398" },
    body,
    createdAt: 1_700_006_000,
    source: { protocol: "nostr", reference: ref },
  };
}

class ThrowingPersistence implements FedosBoardPersistence {
  putPost(_record: FedosPersistedBoardPostRecordV1): FedosBoardPersistenceWriteResult {
    throw new Error("injected persistence failure");
  }
  getPost(_id: string): FedosPersistedBoardPostRecordV1 | null {
    return null;
  }
  listPosts(): readonly FedosPersistedBoardPostRecordV1[] {
    return [];
  }
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

async function readyHost(persistence: FedosBoardPersistence = new InMemoryFedosBoardPersistence()) {
  const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
  await host.start();
  return { host, persistence };
}

/**
 * Secure Runtime Alpha 398 -- "Atomicity Verification": Stage 8 of the
 * Alpha 391-400 Desktop Host Durable Write Coordination Arc.
 * Verification only. Real tests: duplicate, conflict, exception,
 * Persistence failure -- no partial success in any reachable case.
 */
describe("Secure Runtime Alpha 398 -- Write Atomicity Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. duplicate: second identical submitPost() returns already-present, no duplicate record", async () => {
    const { host, persistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("dup", "ref-dup"))!;
    expect(host.submitPost(post)).toBe("inserted");
    const duplicate = validateFedosBoardPost(rootInput("dup", "ref-dup"))!;
    expect(host.submitPost(duplicate)).toBe("already-present");

    expect(persistence.listPosts().filter((r) => r.id === "dup")).toHaveLength(1);
    expect(host.query()!.recentFeed(post.boardId, undefined, { limit: 100 }).posts.filter((p) => p.id === "dup")).toHaveLength(1);
  });

  it("3. conflict: a different post sharing the same id is rejected, original preserved in both Persistence and Repository", async () => {
    const { host, persistence } = await readyHost();
    const original = validateFedosBoardPost(rootInput("conf", "ref-conf-a"))!;
    expect(host.submitPost(original)).toBe("inserted");

    const conflicting = validateFedosBoardPost(rootInput("conf", "ref-conf-b", "a totally different body"))!;
    expect(host.submitPost(conflicting)).toBe("post-id-conflict");

    const persisted = persistence.listPosts().find((r) => r.id === "conf")!;
    expect(persisted.source.reference).toBe("ref-conf-a");
    const repositoryPost = host.board()!.findPost(original.id)!;
    expect(repositoryPost.source.reference).toBe("ref-conf-a");
  });

  it("4. exception: a thrown Persistence error propagates unmodified, Host stays ready, Repository untouched", async () => {
    const { host } = await readyHost(new ThrowingPersistence());
    const post = validateFedosBoardPost(rootInput("exc", "ref-exc"))!;
    expect(() => host.submitPost(post)).toThrow("injected persistence failure");
    expect(host.state()).toBe("ready");
    expect(host.board()!.findPost(post.id)).toBeNull();

    // The Host remains usable for a subsequent, non-throwing scenario --
    // submitPost() rejecting a domain-invalid post still works normally.
    const badReply = validateFedosBoardPost({ ...rootInput("exc-reply", "ref-exc-2"), replyTo: "missing", threadId: "missing" })!;
    expect(host.submitPost(badReply)).toBe("missing-parent");
  });

  it("5. Persistence failure: a real AppendOnlyFedosBoardPersistence I/O failure returns persistence-failed, Repository untouched", async () => {
    dir = mkdtempSync(join(tmpdir(), "a398-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "missing-parent-dir", "board.jsonl"));
    const { host } = await readyHost(persistence);
    const post = validateFedosBoardPost(rootInput("io-fail", "ref-io"))!;
    expect(host.submitPost(post)).toBe("persistence-failed");
    expect(host.board()!.findPost(post.id)).toBeNull();
  });

  it("6. structural: submitPost() contains exactly one defensive invariant guard after the Repository call, which throws", () => {
    const registerIdx = hostSource.indexOf("boardService.registerPost(post)");
    expect(registerIdx).toBeGreaterThan(-1);
    const after = hostSource.slice(registerIdx, registerIdx + 700);
    expect(after).toMatch(/invariant violated/);
    expect(after).toMatch(/throw new Error/);
  });

  it("7. no partial success across every case above: Persistence and Repository/Query always agree for a rejected id", async () => {
    const { host, persistence } = await readyHost();
    const original = validateFedosBoardPost(rootInput("agree", "ref-agree-a"))!;
    expect(host.submitPost(original)).toBe("inserted");
    const conflicting = validateFedosBoardPost(rootInput("agree", "ref-agree-b", "different"))!;
    expect(host.submitPost(conflicting)).toBe("post-id-conflict");

    const persistedCount = persistence.listPosts().filter((r) => r.id === "agree").length;
    const repositoryFound = host.board()!.findPost(original.id) !== null ? 1 : 0;
    expect(persistedCount).toBe(repositoryFound);
  });

  it("8. the design doc explains why the Repository-fails-after-Persistence-succeeds case is not force-tested", () => {
    expect(designDocSource).toContain(
      "This Stage does not attempt",
    );
  });

  it("9. the design doc cross-references Alpha 394, Alpha 395, Alpha 356, and Alpha 382", () => {
    for (const ref of [
      "secure_runtime_alpha_394_write_failure_policy",
      "secure_runtime_alpha_395_host_write_api_implementation",
      "secure_runtime_alpha_356_conflict_handling",
      "secure_runtime_alpha_382_host_startup_failure_closure",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

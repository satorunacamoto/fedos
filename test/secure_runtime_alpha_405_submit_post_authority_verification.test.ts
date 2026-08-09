import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_405_submit_post_authority_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/messenger/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import type { FedosBoardPersistence, FedosBoardPersistenceWriteResult } from "../src/board/persistence/fedos_board_persistence.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

const BOARD_ID = "board-405";

function rootInput(id: string, ref: string, body = `body-${id}`): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a405" },
    body,
    createdAt: 1_700_013_000,
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
 * Secure Runtime Alpha 405 -- "submitPost Authority Verification":
 * Stage 5 of the Alpha 401-410 Desktop Host Canonical Write Boundary
 * Closure Arc. Verification only. Reconfirms every submitPost()
 * property survives Alpha 404's own board() rewiring.
 */
describe("Secure Runtime Alpha 405 -- submitPost Authority Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: Persistence is still written before Repository in source order", () => {
    const putPostIdx = hostSource.indexOf("this.#boardPersistence.putPost(");
    const registerPostIdx = hostSource.indexOf("boardService.registerPost(", putPostIdx);
    expect(putPostIdx).toBeGreaterThan(-1);
    expect(registerPostIdx).toBeGreaterThan(putPostIdx);
  });

  it("3. behavioral: duplicate stays idempotent", async () => {
    const { host, persistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("dup", "ref-dup"))!;
    expect(host.submitPost(post)).toBe("inserted");
    expect(host.submitPost(validateFedosBoardPost(rootInput("dup", "ref-dup"))!)).toBe("already-present");
    expect(persistence.listPosts().filter((r) => r.id === "dup")).toHaveLength(1);
  });

  it("4. behavioral: post-ID conflict stays fail closed", async () => {
    const { host, persistence } = await readyHost();
    const original = validateFedosBoardPost(rootInput("conf", "ref-a"))!;
    expect(host.submitPost(original)).toBe("inserted");
    const conflicting = validateFedosBoardPost(rootInput("conf", "ref-b", "different body"))!;
    expect(host.submitPost(conflicting)).toBe("post-id-conflict");
    expect(persistence.listPosts().find((r) => r.id === "conf")!.source.reference).toBe("ref-a");
  });

  it("5. behavioral: source conflict stays fail closed, before Persistence is touched", async () => {
    const { host, persistence } = await readyHost();
    const original = validateFedosBoardPost(rootInput("src-a", "shared-ref"))!;
    expect(host.submitPost(original)).toBe("inserted");
    const conflicting = validateFedosBoardPost(rootInput("src-b", "shared-ref"))!;
    expect(host.submitPost(conflicting)).toBe("source-conflict");
    expect(persistence.listPosts().some((r) => r.id === "src-b")).toBe(false);
  });

  it("6. behavioral: Persistence failure does not mutate BoardService", async () => {
    dir = mkdtempSync(join(tmpdir(), "a405-"));
    const persistence = new AppendOnlyFedosBoardPersistence(join(dir, "missing-dir", "board.jsonl"));
    const { host } = await readyHost(persistence);
    const post = validateFedosBoardPost(rootInput("io-fail", "ref-io"))!;
    expect(host.submitPost(post)).toBe("persistence-failed");
    expect(host.board()!.findPost(post.id)).toBeNull();
  });

  it("7. behavioral: Persistence exception does not mutate BoardService, Host stays ready", async () => {
    const { host } = await readyHost(new ThrowingPersistence());
    const post = validateFedosBoardPost(rootInput("exc", "ref-exc"))!;
    expect(() => host.submitPost(post)).toThrow("injected persistence failure");
    expect(host.state()).toBe("ready");
    expect(host.board()!.findPost(post.id)).toBeNull();
  });

  it("8. behavioral: successful registration is immediately visible to BOTH Reader (board()) and Query", async () => {
    const { host } = await readyHost();
    const post = validateFedosBoardPost(rootInput("visible", "ref-visible"))!;
    expect(host.submitPost(post)).toBe("inserted");
    expect(host.board()!.findPost(post.id)?.id).toBe("visible");
    expect(host.query()!.recentFeed(post.boardId).posts.map((p) => p.id)).toContain("visible");
  });

  it("9. structural: no protocol-specific branch, no Relay/Publish import or call, anywhere in the Host or Service's own CODE (doc comments naming what is absent are not a reference)", () => {
    function codeOnly(source: string): string {
      return source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
        .join("\n");
    }
    expect(codeOnly(hostSource)).not.toMatch(/"nostr"|"activitypub"|"atproto"|"session"|Relay|Publish/i);
    expect(codeOnly(serviceSource)).not.toMatch(/"nostr"|"activitypub"|"atproto"|"session"|Relay|Publish/i);
  });

  it("10. the design doc confirms no correctness defect was found and no redesign was performed", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain("no defect was found, so no redesign was performed or considered.");
  });

  it("11. the design doc cross-references Alpha 404, Alpha 398, Alpha 396, and Alpha 394", () => {
    for (const ref of [
      "secure_runtime_alpha_404_host_board_access_rewiring",
      "secure_runtime_alpha_398_write_atomicity_verification",
      "secure_runtime_alpha_396_immediate_query_visibility",
      "secure_runtime_alpha_394_write_failure_policy",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

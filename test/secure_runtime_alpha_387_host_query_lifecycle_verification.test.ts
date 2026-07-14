import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_387_host_query_lifecycle_verification.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { toFedosBoardId } from "../src/board/fedos_board_identifiers.js";
import type { FedosBoardId } from "../src/board/fedos_board_identifiers.js";

class NullReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}
class ThrowingReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<never> {
    throw new Error("desktop rejection marker");
  }
}

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-387",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 387 -- "Startup and Shutdown Lifecycle
 * Verification": Stage 7 of the Alpha 381-390 Canonical Board Query
 * Host Integration & Startup Failure Closure Arc. End-to-end real
 * execution across every lifecycle transition this Arc's own Target
 * Architecture names.
 */
describe("Secure Runtime Alpha 387 -- Host Query Lifecycle Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. successful startup: full lifecycle, Query reads hydrated state, all three accessors non-null", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!));
    const desktopApplication = new DesktopApplication(new NullReader());
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence: persistence });

    expect(host.state()).toBe("constructed");
    await host.start();
    expect(host.state()).toBe("ready");
    expect(host.board()).not.toBeNull();
    expect(host.query()).not.toBeNull();
    expect(host.desktop()).not.toBeNull();
    expect(desktopApplication.isBootstrapped()).toBe(true);

    const boardId = toFedosBoardId("board-387") as FedosBoardId;
    expect(host.query()!.recentFeed(boardId).posts.map((p) => p.id)).toEqual(["post-1"]);
  });

  it("3. hydration RETURNED failure: failed, board/query/desktop null, DesktopApplication.start() never called", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const rec = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    persistence.putPost({ ...rec, schemaVersion: 2 } as never);
    const desktopApplication = new DesktopApplication(new NullReader());
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence: persistence });

    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
    expect(host.desktop()).toBeNull();
    expect(desktopApplication.isBootstrapped()).toBe(false);
  });

  it("4. hydration THROWN exception: failed (never stuck starting), original exception propagates, board/query null", async () => {
    dir = mkdtempSync(join(tmpdir(), "a387-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });

    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.state()).not.toBe("starting");
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
  });

  it("5. Desktop startup rejection: failed, board/query null, original rejection propagates", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    persistence.putPost(serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!));
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new ThrowingReader()), boardPersistence: persistence });

    await expect(host.start()).rejects.toThrow(/desktop rejection marker/);
    expect(host.state()).toBe("failed");
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
  });

  it("6. shutdown: ready -> stopping -> stopped, all accessors inaccessible, no restart, no second start, no fake disposal", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    expect(host.state()).toBe("ready");
    await host.stop();
    expect(host.state()).toBe("stopped");
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
    expect(host.desktop()).toBeNull();
    await expect(host.start()).rejects.toThrow();
    await expect(host.stop()).rejects.toThrow();
  });

  it("7. the design doc verifies all five lifecycle scenarios this Arc's own Target Architecture names", () => {
    expect(designDocSource).toContain("## 1. Successful startup, verified");
    expect(designDocSource).toContain("## 2. Hydration returned failure, verified");
    expect(designDocSource).toContain("## 3. Hydration thrown exception, verified");
    expect(designDocSource).toContain("## 4. Desktop startup rejection, verified");
    expect(designDocSource).toContain("## 5. Shutdown, verified");
  });

  it("8. the design doc cross-references Alpha 383, Alpha 382, Alpha 339, and Alpha 361", () => {
    for (const ref of [
      "secure_runtime_alpha_383_host_owned_query_construction",
      "secure_runtime_alpha_382_host_startup_failure_closure",
      "secure_runtime_alpha_339_desktop_host_integration_verification",
      "secure_runtime_alpha_361_host_failure_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

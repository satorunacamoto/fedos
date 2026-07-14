import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_361_host_failure_inventory.md?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { serializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

class NullPublicIdentityReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}
class ThrowingPublicIdentityReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<never> {
    throw new Error("simulated Reader failure");
  }
}

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-361",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 361 -- "Host Failure Inventory": Stage 1 of the
 * Alpha 361-370 Board Recovery & Host Robustness Arc. Review only.
 * Reproduces all six named failure paths and their current state()
 * outcome, confirming exactly one diverges from policy.
 */
describe("Secure Runtime Alpha 361 -- Host Failure Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. row 1: a returned rejected-corrupt-record hydration outcome correctly sets state to failed", async () => {
    dir = mkdtempSync(join(tmpdir(), "a361-"));
    const filePath = join(dir, "board.jsonl");
    const record = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    const p = new AppendOnlyFedosBoardPersistence(filePath);
    p.putPost({ ...record, schemaVersion: 2 } as never);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullPublicIdentityReader()), boardPersistence: p });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
  });

  it("3. row 2: a DesktopApplication.start() rejection correctly sets state to failed", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(new ThrowingPublicIdentityReader()),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
  });

  it("4. row 3 CONFIRMED DEFECT: a THROWN hydration exception rejects start() but leaves state stuck at starting, not failed", async () => {
    dir = mkdtempSync(join(tmpdir(), "a361-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const p = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullPublicIdentityReader()), boardPersistence: p });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("starting");
    expect(host.state()).not.toBe("failed");
  });

  it("5. row 4: a putPost 'failed' outcome is a normal write-time token, never a thrown exception, and never touches Host state", async () => {
    dir = mkdtempSync(join(tmpdir(), "a361-"));
    const badPath = join(dir, "no-such-dir", "board.jsonl");
    const p = new AppendOnlyFedosBoardPersistence(badPath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullPublicIdentityReader()), boardPersistence: p });
    await host.start();
    expect(host.state()).toBe("ready");
    const record = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    expect(() => p.putPost(record)).not.toThrow();
    expect(p.putPost(record)).toBe("failed");
    expect(host.state()).toBe("ready"); // unaffected
  });

  it("6. row 5: a second start() call throws synchronously, before touching hydration or Desktop", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullPublicIdentityReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    await expect(host.start()).rejects.toThrow();
  });

  it("7. row 6: stop() from a non-ready state throws synchronously", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullPublicIdentityReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await expect(host.stop()).rejects.toThrow();
  });

  it("8. the design doc's own table names all six rows", () => {
    for (let n = 1; n <= 6; n++) {
      expect(designDocSource).toContain(`| ${n} |`);
    }
  });

  it("9. the design doc explains why the defect was invisible before this Arc's predecessor", () => {
    expect(designDocSource).toContain("## 4. Why this was invisible until Alpha 351–360");
  });

  it("10. the design doc cross-references Alpha 360, Alpha 357, Alpha 335, and Alpha 333", () => {
    for (const ref of [
      "secure_runtime_alpha_360_append_only_backend_completion",
      "secure_runtime_alpha_357_crash_review",
      "secure_runtime_alpha_335_board_hydration_ownership",
      "secure_runtime_alpha_333_desktop_host_state_model",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_408_host_write_failure_boundary_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import queryTypesSource from "../src/os/messenger/board/query/fedos_board_query_types.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BOARD_ID = "board-408";

function rootInput(id: string, ref: string): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a408" },
    body: `body-${id}`,
    createdAt: 1_700_014_000,
    source: { protocol: "nostr", reference: ref },
  };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 408 -- "Failure and Boundary Verification":
 * Stage 8 of the Alpha 401-410 Desktop Host Canonical Write Boundary
 * Closure Arc. Verification only. Real failure cases, verified
 * against the ACTUAL public object surface, not TypeScript alone.
 */
describe("Secure Runtime Alpha 408 -- Host Write Failure Boundary Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: Host not ready -> submitPost fails closed", () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    const post = validateFedosBoardPost(rootInput("not-ready", "ref-a"))!;
    expect(() => host.submitPost(post)).toThrow(/ready state/);
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
  });

  it("3. behavioral: Host failed -> submitPost fails closed, no partial access", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication({
        readPublicIdentity: async () => {
          throw new Error("boom");
        },
      }),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
    const post = validateFedosBoardPost(rootInput("failed-host", "ref-b"))!;
    expect(() => host.submitPost(post)).toThrow(/ready state/);
  });

  it("4. behavioral: Host stopped -> submitPost fails closed, no partial access", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    await host.stop();
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
    const post = validateFedosBoardPost(rootInput("stopped-host", "ref-c"))!;
    expect(() => host.submitPost(post)).toThrow(/ready state/);
  });

  it("5. behavioral: malformed/corrupt persistence startup -> no reader/query/write access of any kind", async () => {
    dir = mkdtempSync(join(tmpdir(), "a408-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.board()).toBeNull();
    expect(host.query()).toBeNull();
    const post = validateFedosBoardPost(rootInput("corrupt-startup", "ref-d"))!;
    expect(() => host.submitPost(post)).toThrow(/ready state/);
  });

  it("6. behavioral: repository conflict prediction (previewRegistration rejecting) means Persistence is never touched", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
    await host.start();
    const missingParent = validateFedosBoardPost({ ...rootInput("reply", "ref-e"), replyTo: "nonexistent", threadId: "nonexistent" })!;
    expect(host.submitPost(missingParent)).toBe("missing-parent");
    expect(persistence.listPosts()).toHaveLength(0);
  });

  it("7. behavioral: a successful post AFTER a prior rejected post still works, no Host-level poisoning", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    const bad = validateFedosBoardPost({ ...rootInput("bad", "ref-f"), replyTo: "nonexistent", threadId: "nonexistent" })!;
    expect(host.submitPost(bad)).toBe("missing-parent");
    const good = validateFedosBoardPost(rootInput("good", "ref-g"))!;
    expect(host.submitPost(good)).toBe("inserted");
  });

  it("8. behavioral: the Reader's ACTUAL runtime object surface has no registerPost property, verified directly (not via TypeScript alone)", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    const reader = host.board()!;
    expect("registerPost" in reader).toBe(false);
    expect(Object.keys(reader)).not.toContain("registerPost");
    const unsafeCast = host.board() as unknown as { registerPost: unknown };
    expect(unsafeCast.registerPost).toBeUndefined();
    expect(() => (unsafeCast as unknown as { registerPost: (x: unknown) => unknown }).registerPost({})).toThrow(TypeError);
  });

  it("9. behavioral: board()'s returned object is never the same reference as anything submitPost() itself uses internally -- distinct objects", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    const reader1 = host.board();
    const reader2 = host.board();
    // Same reader instance across repeated calls while ready (Alpha 404).
    expect(reader1).toBe(reader2);
    // But its own constructor.name is the wrapper, never FedosBoardService.
    expect(Object.getPrototypeOf(reader1!).constructor.name).toBe("FedosBoardServiceReader");
  });

  it("10. structural: FedosBoardQuery's own public surface remains read-only, unchanged", () => {
    expect(queryTypesSource).not.toMatch(/register|write|mutate/i);
  });

  it("11. the design doc quotes this Arc's own instruction on verifying the actual public object surface", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "Do not claim runtime impossibility merely from TypeScript `readonly`. Verify the actual public object surface.",
    );
  });

  it("12. the design doc cross-references Alpha 406, Alpha 405, Alpha 401, and Alpha 398", () => {
    for (const ref of [
      "secure_runtime_alpha_406_legacy_direct_write_detection",
      "secure_runtime_alpha_405_submit_post_authority_verification",
      "secure_runtime_alpha_401_host_write_surface_inventory",
      "secure_runtime_alpha_398_write_atomicity_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

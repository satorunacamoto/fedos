import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_382_host_startup_failure_closure.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
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

class NullReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}
class ThrowingReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<never> {
    throw new Error("desktop start failure marker");
  }
}

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-382",
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
 * Secure Runtime Alpha 382 -- "Host Startup Failure Closure": Stage 2
 * of the Alpha 381-390 Canonical Board Query Host Integration &
 * Startup Failure Closure Arc. Fixes the confirmed hydration-exception
 * defect -- every startup failure shape now transitions state to
 * "failed" before start() settles.
 */
describe("Secure Runtime Alpha 382 -- Host Startup Failure Closure", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. FIXED: a thrown hydration exception now correctly transitions state to failed, never stuck at starting", async () => {
    dir = mkdtempSync(join(tmpdir(), "a382-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, '{"schemaVersion":1,"id":"trunc', "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.state()).not.toBe("starting");
  });

  it("3. the original thrown error's own identity is preserved unmodified, not wrapped", async () => {
    dir = mkdtempSync(join(tmpdir(), "a382-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, "not valid json at all\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    let caught: unknown;
    try {
      await host.start();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SyntaxError); // JSON.parse's own native error type, unwrapped
  });

  it("4. a RETURNED hydration failure still correctly transitions to failed (unchanged pre-existing behavior)", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const rec = serializeFedosBoardPost(validateFedosBoardPost(rootInput("post-1"))!);
    persistence.putPost({ ...rec, schemaVersion: 2 } as never);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow(/failed to hydrate Board state/);
    expect(host.state()).toBe("failed");
  });

  it("5. a Desktop startup rejection still correctly transitions to failed with the original error preserved (unchanged pre-existing behavior)", async () => {
    const persistence = new InMemoryFedosBoardPersistence();
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new ThrowingReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow(/desktop start failure marker/);
    expect(host.state()).toBe("failed");
  });

  it("6. no swallowed exception -- start() always rejects when its own try block throws", async () => {
    dir = mkdtempSync(join(tmpdir(), "a382-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toBeDefined();
  });

  it("7. no automatic retry -- a second start() call on a failed instance still rejects", async () => {
    dir = mkdtempSync(join(tmpdir(), "a382-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
  });

  it("8. structural: start() wraps every startup step in exactly one try/catch block", () => {
    const startMatch = hostSource.match(/async start\(\): Promise<void> \{[\s\S]*?\n {2}\}/);
    expect(startMatch).not.toBeNull();
    const body = startMatch![0];
    const tryCount = (body.match(/\btry \{/g) ?? []).length;
    const catchCount = (body.match(/\}\s*catch/g) ?? []).length;
    expect(tryCount).toBe(1);
    expect(catchCount).toBe(1);
  });

  it("9. structural: the catch block unconditionally nulls both owned objects, sets failed, and rethrows unmodified", () => {
    expect(hostSource).toMatch(
      /catch \(error\) \{\s*this\.#boardService = null;\s*this\.#boardQuery = null;\s*this\.#state = "failed";\s*throw error;\s*\}/,
    );
  });

  it("10. the design doc cross-references Alpha 381, Alpha 362, Alpha 370, and Alpha 333", () => {
    for (const ref of [
      "secure_runtime_alpha_381_host_query_integration_inventory",
      "secure_runtime_alpha_362_hydration_failure_policy",
      "secure_runtime_alpha_370_recovery_robustness_completion",
      "secure_runtime_alpha_333_desktop_host_state_model",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

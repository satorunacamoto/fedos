import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_395_host_write_api_implementation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/messenger/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosBoardService } from "../src/os/messenger/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BOARD_ID = "board-395";

function rootInput(id: string, ref: string): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a395" },
    body: `body-${id}`,
    createdAt: 1_700_004_000,
    source: { protocol: "nostr", reference: ref },
  };
}

async function readyHost(persistence = new InMemoryFedosBoardPersistence()) {
  const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: persistence });
  await host.start();
  return { host, persistence };
}

/**
 * Secure Runtime Alpha 395 -- "Implement Host Write API": Stage 5 of
 * the Alpha 391-400 Desktop Host Durable Write Coordination Arc.
 * Implements FedosBoardService.previewRegistration() and
 * FedosDesktopHost.submitPost() exactly as Alpha 393/394 designed.
 */
describe("Secure Runtime Alpha 395 -- Host Write API Implementation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosBoardService.previewRegistration() exists and is a pure read -- no repository/index register call anywhere in its own body", () => {
    expect(serviceSource).toMatch(/previewRegistration\(post: FedosBoardPost\): FedosBoardRegistrationResult \| null \{/);
    const methodMatch = serviceSource.match(/previewRegistration\(post: FedosBoardPost\): FedosBoardRegistrationResult \| null \{([\s\S]*?)\n {2}\}/);
    expect(methodMatch).not.toBeNull();
    expect(methodMatch![1]).not.toMatch(/\.register\(/);
  });

  it("3. structural: FedosBoardService gains zero new import beyond fedosBoardPostsAreStructurallyEqual, and zero Persistence import", () => {
    const importLines = serviceSource.match(/^import .*$/gm) ?? [];
    for (const line of importLines) {
      expect(line).not.toMatch(/FedosBoardPersistence|fedos_board_persistence/);
    }
    expect(serviceSource).toMatch(/fedosBoardPostsAreStructurallyEqual/);
  });

  it("4. behavioral: previewRegistration() predicts registerPost()'s own outcome exactly, for every rejection shape, without mutating", () => {
    const service = new FedosBoardService();
    const root = validateFedosBoardPost(rootInput("root", "ref-a"))!;
    expect(service.previewRegistration(root)).toBeNull();
    expect(service.registerPost(root)).toBe("inserted");

    const duplicate = validateFedosBoardPost(rootInput("root", "ref-a"))!;
    expect(service.previewRegistration(duplicate)).toBeNull(); // would be already-present
    expect(service.registerPost(duplicate)).toBe("already-present");

    const conflicting = validateFedosBoardPost({ ...rootInput("root", "ref-b"), body: "different body" })!;
    expect(service.previewRegistration(conflicting)).toBe("post-id-conflict");

    const sourceConflict = validateFedosBoardPost(rootInput("other-id", "ref-a"))!;
    expect(service.previewRegistration(sourceConflict)).toBe("source-conflict");

    const missingParent = validateFedosBoardPost({ ...rootInput("reply", "ref-c"), replyTo: "nonexistent", threadId: "nonexistent" })!;
    expect(service.previewRegistration(missingParent)).toBe("missing-parent");

    // previewRegistration() never mutated -- only "root" is registered.
    expect(service.listBoardPosts(root.boardId).map((p) => p.id)).toEqual(["root"]);
  });

  it("5. structural: FedosDesktopHost.submitPost() exists with the documented signature", () => {
    expect(hostSource).toMatch(/submitPost\(post: FedosBoardPost\): FedosDesktopHostSubmitPostResult \{/);
    expect(hostSource).toMatch(/export type FedosDesktopHostSubmitPostResult = FedosBoardRegistrationResult \| "persistence-failed";/);
  });

  it("6. behavioral: submitPost() throws for the ready-state guard, matching start()/stop()'s own convention", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    const post = validateFedosBoardPost(rootInput("pre-start", "ref-d"))!;
    expect(() => host.submitPost(post)).toThrow(/ready state/);
  });

  it("7. behavioral: a valid submitPost() writes to BOTH Persistence and Repository, and returns 'inserted'", async () => {
    const { host, persistence } = await readyHost();
    const post = validateFedosBoardPost(rootInput("live", "ref-e"))!;
    expect(host.submitPost(post)).toBe("inserted");
    expect(persistence.listPosts().some((r) => r.id === "live")).toBe(true);
    expect(host.board()!.findPost(post.id)).not.toBeNull();
  });

  it("8. behavioral: every domain rejection returned by submitPost() leaves Persistence untouched", async () => {
    const { host, persistence } = await readyHost();
    const root = validateFedosBoardPost(rootInput("root2", "ref-f"))!;
    expect(host.submitPost(root)).toBe("inserted");

    const missingParent = validateFedosBoardPost({ ...rootInput("reply2", "ref-g"), replyTo: "nonexistent", threadId: "nonexistent" })!;
    expect(host.submitPost(missingParent)).toBe("missing-parent");
    expect(persistence.listPosts()).toHaveLength(1); // only "root2"
  });

  it("9. the design doc names the ripple scope -- Alpha 386's own six-method assertion, updated", () => {
    expect(designDocSource).toContain("test/secure_runtime_alpha_386_host_query_delegation_review.test.ts");
  });

  it("10. the design doc cross-references Alpha 394, Alpha 393, Alpha 392, and Alpha 307", () => {
    for (const ref of [
      "secure_runtime_alpha_394_write_failure_policy",
      "secure_runtime_alpha_393_write_transaction_order",
      "secure_runtime_alpha_392_write_coordination_ownership_decision",
      "secure_runtime_alpha_307_board_application_service",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

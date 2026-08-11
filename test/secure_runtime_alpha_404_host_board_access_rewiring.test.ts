import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_404_host_board_access_rewiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/os/messenger/board/fedos_board_post_validator.js";

const BOARD_ID = "board-404";

function rootInput(id: string, ref: string): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a404" },
    body: `body-${id}`,
    createdAt: 1_700_012_000,
    source: { protocol: "nostr", reference: ref },
  };
}

/**
 * Secure Runtime Alpha 404 -- "Host Board Access Rewiring": Stage 4 of
 * the Alpha 401-410 Desktop Host Canonical Write Boundary Closure Arc.
 * Rewires board() to FedosBoardReader | null -- no readBoard(), no
 * deprecated legacy accessor.
 */
describe("Secure Runtime Alpha 404 -- Host Board Access Rewiring", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: board() returns FedosBoardReader | null", () => {
    expect(hostSource).toMatch(/board\(\): FedosBoardReader \| null \{/);
  });

  it("3. behavioral: null before ready", () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    expect(host.board()).toBeNull();
  });

  it("4. behavioral: a reader while ready", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    expect(host.board()).not.toBeNull();
  });

  it("5. behavioral: null after failed", async () => {
    const throwingHost = new FedosDesktopHost({
      desktopApplication: new DesktopApplication({
        readPublicIdentity: async () => {
          throw new Error("boom");
        },
      }),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await expect(throwingHost.start()).rejects.toThrow();
    expect(throwingHost.state()).toBe("failed");
    expect(throwingHost.board()).toBeNull();
  });

  it("6. behavioral: null after stopped", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    await host.stop();
    expect(host.board()).toBeNull();
  });

  it("7. behavioral: board() never throws, in any state", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    expect(() => host.board()).not.toThrow();
    await host.start();
    expect(() => host.board()).not.toThrow();
    await host.stop();
    expect(() => host.board()).not.toThrow();
  });

  it("8. behavioral: the reader observes the SAME live BoardService the Host owns -- not a stale snapshot", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    const readerObtainedEarly = host.board()!;
    expect(readerObtainedEarly.findPost("late-post" as never)).toBeNull();

    const post = validateFedosBoardPost(rootInput("late-post", "ref-late"))!;
    expect(host.submitPost(post)).toBe("inserted");

    // The SAME, already-obtained reader reference now observes the write.
    expect(readerObtainedEarly.findPost(post.id)?.id).toBe("late-post");
  });

  it("9. behavioral: the previously-demonstrated bypass no longer exists at the object level", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    const reader = host.board() as unknown as Record<string, unknown>;
    expect(reader.registerPost).toBeUndefined();
    expect(reader.previewRegistration).toBeUndefined();
  });

  it("10. the design doc names the exact seven-file ripple scope from Alpha 401's own prediction", () => {
    expect(designDocSource).toContain("secure_runtime_alpha_385_board_service_access_review.test.ts");
    expect(designDocSource).toContain("secure_runtime_alpha_389_four_protocol_host_query_verification.test.ts");
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "Five files asserted `board()`'s own exact return type/body",
    );
  });

  it("11. the design doc confirms #boardService remains internally used by submitPost(), unremoved", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "`#boardService` itself is NOT removed and NOT nulled anywhere new",
    );
  });

  it("12. the design doc cross-references Alpha 403, Alpha 402, Alpha 401, and Alpha 396", () => {
    for (const ref of [
      "secure_runtime_alpha_403_read_only_board_access_model",
      "secure_runtime_alpha_402_canonical_host_write_authority_decision",
      "secure_runtime_alpha_401_host_write_surface_inventory",
      "secure_runtime_alpha_396_immediate_query_visibility",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

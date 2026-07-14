import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_385_board_service_access_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import queryTypesSource from "../src/board/query/fedos_board_query_types.ts?raw";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";

function rootInput(id: string): FedosBoardPostInput {
  return {
    id,
    boardId: "board-385",
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
    body: `body-${id}`,
    createdAt: 1_700_000_000,
    source: { protocol: "nostr", reference: `ref-${id}` },
  };
}

/**
 * Secure Runtime Alpha 385 -- "Board Service Access Review": Stage 5
 * of the Alpha 381-390 Canonical Board Query Host Integration &
 * Startup Failure Closure Arc. Review only -- board() is byte-for-byte
 * unchanged. Freezes board() (write) vs. query() (read) as a
 * permanent distinction.
 */
describe("Secure Runtime Alpha 385 -- Board Service Access Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: board()'s own signature is byte-for-byte unchanged from Alpha 336", () => {
    expect(hostSource).toMatch(/board\(\): FedosBoardService \| null \{\s*return this\.#state === "ready" \? this\.#boardService : null;\s*\}/);
  });

  it("3. behavioral: board() remains the only write path -- registerPost() works exactly as before", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    const post = validateFedosBoardPost(rootInput("post-1"))!;
    expect(host.board()!.registerPost(post)).toBe("inserted");
  });

  it("4. structural: FedosBoardQuery's own contract has no write method -- query() could never serve as a write façade", () => {
    expect(queryTypesSource).not.toMatch(/register|write|mutate/i);
  });

  it("5. type-level: FedosBoardService itself is unaffected by this Arc -- registerPost/findPost/listBoardPosts/listThreadPosts all present", () => {
    const service = new FedosBoardService();
    expect(typeof service.registerPost).toBe("function");
    expect(typeof service.findPost).toBe("function");
    expect(typeof service.listBoardPosts).toBe("function");
    expect(typeof service.listThreadPosts).toBe("function");
  });

  it("6. the design doc freezes the exact board()/query() distinction", () => {
    expect(designDocSource).toContain("Host.board()");
    expect(designDocSource).toContain("Host.query()");
    expect(designDocSource).toContain("application writes and direct canonical lookup");
    expect(designDocSource).toContain("filtering, ordering, pagination, feed and thread reads");
  });

  it("7. the design doc rejects Options B, C, and D with a stated reason each", () => {
    expect(designDocSource).toContain("**Option B — deprecate `board()` but do not remove it.** Rejected:");
    expect(designDocSource).toContain("**Option C — remove `board()` and expose Query only.** Rejected");
    expect(designDocSource).toContain(
      "**Option D — expose separate read/write boundaries.** This IS,",
    );
  });

  it("8. the design doc cross-references Alpha 384, Alpha 381, Alpha 336, and Alpha 372", () => {
    for (const ref of [
      "secure_runtime_alpha_384_host_query_access_boundary",
      "secure_runtime_alpha_381_host_query_integration_inventory",
      "secure_runtime_alpha_336_desktop_host_access_boundary",
      "secure_runtime_alpha_372_canonical_board_query_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

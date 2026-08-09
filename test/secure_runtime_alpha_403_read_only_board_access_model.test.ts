import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_403_read_only_board_access_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/os/messenger/board/repository/fedos_board_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/messenger/board/repository/fedos_board_service.ts?raw";

import { FedosBoardServiceReader, type FedosBoardReader } from "../src/board/repository/fedos_board_reader.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

const BOARD_ID = "board-403";

function rootInput(id: string, ref: string): FedosBoardPostInput {
  return {
    id,
    boardId: BOARD_ID,
    threadId: id,
    replyTo: null,
    author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1a403" },
    body: `body-${id}`,
    createdAt: 1_700_011_000,
    source: { protocol: "nostr", reference: ref },
  };
}

/**
 * Secure Runtime Alpha 403 -- "Read-Only Board Access Model": Stage 3
 * of the Alpha 401-410 Desktop Host Canonical Write Boundary Closure
 * Arc. Implements FedosBoardReader and its one real implementation,
 * FedosBoardServiceReader -- a genuine forwarding object, not a type
 * narrowing.
 */
describe("Secure Runtime Alpha 403 -- Read-Only Board Access Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosBoardReader declares exactly three methods, no registerPost/previewRegistration", () => {
    const interfaceMatch = readerSource.match(/export interface FedosBoardReader \{([\s\S]*?)\n\}/);
    expect(interfaceMatch).not.toBeNull();
    const body = interfaceMatch![1];
    expect(body).toMatch(/findPost\(id: FedosBoardPostId\): FedosBoardPost \| null;/);
    expect(body).toMatch(/listBoardPosts\(boardId: FedosBoardId\): readonly FedosBoardPost\[\];/);
    expect(body).toMatch(/listThreadPosts\(boardId: FedosBoardId, threadId: FedosThreadId\): readonly FedosBoardPost\[\];/);
    expect(body).not.toMatch(/registerPost|previewRegistration/);
  });

  it("3. structural: FedosBoardReader's own import list has zero Repository/Index/Persistence/network reference", () => {
    const importLines = readerSource.match(/^import .*$/gm) ?? [];
    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) {
      expect(line).not.toMatch(/Repository|Index|Persistence|node:|fetch|http/i);
    }
  });

  it("4. behavioral: FedosBoardServiceReader forwards all three reads to its source, live -- not a snapshot", () => {
    const service = new FedosBoardService();
    const reader = new FedosBoardServiceReader(service);
    const root = validateFedosBoardPost(rootInput("root", "ref-a"))!;
    expect(reader.findPost(root.id)).toBeNull(); // not yet registered

    expect(service.registerPost(root)).toBe("inserted");
    // The SAME reader instance, constructed BEFORE the write, now sees it --
    // confirming this is a live view, not a snapshot taken at construction.
    expect(reader.findPost(root.id)?.id).toBe("root");
    expect(reader.listBoardPosts(root.boardId).map((p) => p.id)).toEqual(["root"]);
  });

  it("5. behavioral: the actual public object surface of FedosBoardServiceReader has no registerPost property at all -- closes the bypass at the object level, not merely the type level", () => {
    const service = new FedosBoardService();
    const reader = new FedosBoardServiceReader(service);
    expect(typeof (reader as unknown as Record<string, unknown>).registerPost).toBe("undefined");
    expect(typeof (reader as unknown as Record<string, unknown>).previewRegistration).toBe("undefined");
    expect(Object.getPrototypeOf(reader).constructor.name).toBe("FedosBoardServiceReader");
  });

  it("6. structural: FedosBoardService declares 'implements FedosBoardReader', a purely additive change", () => {
    expect(serviceSource).toMatch(/export class FedosBoardService implements FedosBoardReader \{/);
  });

  it("7. behavioral: FedosBoardService itself is unaffected -- registerPost/previewRegistration remain present and functional", () => {
    const service = new FedosBoardService();
    expect(typeof service.registerPost).toBe("function");
    expect(typeof service.previewRegistration).toBe("function");
    const root = validateFedosBoardPost(rootInput("still-works", "ref-b"))!;
    expect(service.registerPost(root)).toBe("inserted");
  });

  it("8. type-level: FedosBoardService is directly assignable to a FedosBoardReader-typed variable, confirming structural compatibility", () => {
    const service = new FedosBoardService();
    const reader: FedosBoardReader = service;
    expect(reader.findPost).toBeDefined();
  });

  it("9. the design doc explains why FedosBoardServiceReader (not a re-typed #boardService) closes the hidden-exposure finding", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "NOT `#boardService` itself, re-typed.",
    );
  });

  it("10. the design doc cross-references Alpha 402, Alpha 401, and Alpha 373", () => {
    for (const ref of [
      "secure_runtime_alpha_402_canonical_host_write_authority_decision",
      "secure_runtime_alpha_401_host_write_surface_inventory",
      "secure_runtime_alpha_373_recent_feed_query",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

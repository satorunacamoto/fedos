import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_252_canonical_board_identifiers.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identifiersSource from "../src/board/fedos_board_identifiers.ts?raw";
import {
  toFedosBoardId,
  toFedosThreadId,
  toFedosBoardPostId,
  toFedosExternalReference,
  type FedosBoardId,
  type FedosThreadId,
} from "../src/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 252 -- "Canonical Board Identifiers": Stage 2 of
 * the Canonical Board Model Foundation Arc. Adds
 * src/board/fedos_board_identifiers.ts, exporting four branded
 * identifier types ("Option C") and their brand-casting functions --
 * no random generation, no protocol parsing.
 */
describe("Secure Runtime Alpha 252 -- Canonical Board Identifiers", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc adopts Option C, with rationale", () => {
    expect(designDocSource).toMatch(/\*\*Adopted: Option C\*\*/);
  });

  it("3. toFedosBoardId brands a non-empty string, rejects empty/whitespace", () => {
    expect(toFedosBoardId("board-general")).toBe("board-general");
    expect(toFedosBoardId("")).toBeNull();
    expect(toFedosBoardId("   ")).toBeNull();
  });

  it("4. toFedosThreadId / toFedosBoardPostId / toFedosExternalReference behave identically", () => {
    expect(toFedosThreadId("thread-1")).toBe("thread-1");
    expect(toFedosThreadId("")).toBeNull();
    expect(toFedosBoardPostId("post-1")).toBe("post-1");
    expect(toFedosBoardPostId("")).toBeNull();
    expect(toFedosExternalReference("ext-1")).toBe("ext-1");
    expect(toFedosExternalReference("")).toBeNull();
  });

  it("5. structural: the four branded types are structurally distinct at compile time (no runtime check needed here -- confirmed by tsc)", () => {
    const boardId = toFedosBoardId("board-1") as FedosBoardId;
    const threadId = toFedosThreadId("thread-1") as FedosThreadId;
    // @ts-expect-error a FedosBoardId is not assignable to FedosThreadId without a cast.
    const _shouldNotAssign: FedosThreadId = boardId;
    expect(boardId).not.toBe(threadId);
  });

  it("6. structural: no random-generation call exists anywhere in the module -- every function only brands an already-chosen string", () => {
    expect(identifiersSource).not.toMatch(/Math\.random|crypto\.getRandomValues|randomUUID/);
    const exportedFunctionNames = [...identifiersSource.matchAll(/^export function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportedFunctionNames).toEqual([
      "toFedosBoardId",
      "toFedosThreadId",
      "toFedosBoardPostId",
      "toFedosExternalReference",
    ]);
  });

  it("7. the design doc cross-references Alpha 251, Alpha 253, and Alpha 257", () => {
    for (const ref of [
      "secure_runtime_alpha_251_existing_board_model_inventory",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_257_board_validation_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

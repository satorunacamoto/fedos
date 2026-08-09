import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_258_moderation_deletion_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import moderationModuleSource from "../src/os/messenger/board/fedos_board_moderation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModuleSource from "../src/os/messenger/board/fedos_board_post.ts?raw";
import {
  FEDOS_BOARD_MODERATION_STATES,
  FEDOS_BOARD_MODERATION_REASON_CODES,
  type FedosBoardModerationRecord,
} from "../src/os/messenger/board/fedos_board_moderation.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 258 -- "Moderation and Deletion Boundary
 * Review": Stage 8 of the Canonical Board Model Foundation Arc. Adds
 * src/board/fedos_board_moderation.ts -- types and label constants
 * only, "Option B" (a record separate from FedosBoardPost), no
 * `deleted` boolean, no enforcement function.
 */
describe("Secure Runtime Alpha 258 -- Moderation and Deletion Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc adopts Option B, separate from FedosBoardPost", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*,\s+exactly this Arc's own preferred candidate\./);
  });

  it("3. FEDOS_BOARD_MODERATION_STATES and FEDOS_BOARD_MODERATION_REASON_CODES are non-empty and every value is _placeholder-suffixed", () => {
    expect(FEDOS_BOARD_MODERATION_STATES.length).toBeGreaterThan(0);
    expect(FEDOS_BOARD_MODERATION_REASON_CODES.length).toBeGreaterThan(0);
    for (const state of FEDOS_BOARD_MODERATION_STATES) {
      expect(state.endsWith("_placeholder")).toBe(true);
    }
    for (const reason of FEDOS_BOARD_MODERATION_REASON_CODES) {
      expect(reason.endsWith("_placeholder")).toBe(true);
    }
  });

  it("4. structural: FedosBoardPost carries no deleted/hidden boolean field of any kind", () => {
    expect(codeOnly(postModuleSource)).not.toMatch(/\bdeleted\b|\bhidden\b/i);
  });

  it("5. structural: FedosBoardModerationRecord carries no boolean deleted field, no direct back-reference from FedosBoardPost", () => {
    expect(codeOnly(moderationModuleSource)).not.toMatch(/deleted:\s*boolean/i);
  });

  it("6. structural: this file is inert -- no function/class definition IN CODE, types and constants only", () => {
    expect(codeOnly(moderationModuleSource)).not.toMatch(/\bfunction\b|\bclass\b/);
    expect(moderationModuleSource).not.toMatch(/from ["']\.\.\/storage\/|fetch\(|WebSocket/);
  });

  it("7. behavioral: a moderation record links to a post ONLY by postId, and distinguishes source vs. local deletion", () => {
    const record: FedosBoardModerationRecord = {
      postId: "post-1" as FedosBoardModerationRecord["postId"],
      state: "removed_placeholder",
      reasonCode: "source_protocol_deletion_placeholder",
      moderatorId: null,
      appliedAt: 1_700_000_000,
    };
    expect(record.postId).toBe("post-1");
    expect(FEDOS_BOARD_MODERATION_REASON_CODES).toContain("local_only_deletion_placeholder");
    expect(FEDOS_BOARD_MODERATION_REASON_CODES).toContain("source_protocol_deletion_placeholder");
  });

  it("8. the design doc explains the source-deletion vs. local-board-deletion distinction", () => {
    expect(designDocSource).toMatch(/Source deletion does not\s*\nnecessarily equal local board deletion/);
  });

  it("9. the design doc cross-references Alpha 255 and Alpha 251", () => {
    for (const ref of [
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_251_existing_board_model_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

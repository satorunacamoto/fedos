import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardRuntimeSource from "../../../src/os/messenger/board/runtime/fedos_board_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import commandTypesSource from "../../../src/os/messenger/board/runtime/fedos_board_runtime_command_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import authorAuthoritySource from "../../../src/os/messenger/board/runtime/fedos_board_runtime_author_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboundEligibilitySource from "../../../src/os/messenger/board/runtime/fedos_board_runtime_outbound_eligibility.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../../../src/os/messenger/board/fedos_board_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import moderationSource from "../../../src/os/messenger/board/fedos_board_moderation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identifiersSource from "../../../src/os/messenger/board/fedos_board_identifiers.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPersistenceSource from "../../../src/os/messenger/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxTypesSource from "../../../src/os/messenger/board/outbox/fedos_board_outbox_types.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync } from "node:fs";

/**
 * Canonical Conversation Foundation V1 review -- source alignment.
 *
 * Verifies, against this worktree's own REAL checked-out `src/` tree
 * (== current `master`), the "current implementation reality" claims
 * `01_decision_reconciliation.md` and `04_conversation_record_v1.md`
 * make.
 *
 * Alpha 1051-1110 (Conversation Runtime Consolidation Arc) has since
 * merged the Policy/Nostr-binding Arcs this file's tests 9/10 originally
 * documented as absent -- those two tests now assert the opposite,
 * current fact instead of deleting the historical record.
 */

function allSrcBoardFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  let files: string[] = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files = files.concat(allSrcBoardFiles(path));
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

describe("Conversation Foundation V1 -- source alignment (master reality)", () => {
  it("1. FedosBoardRuntime exists with exactly the public-mode read/write surface this spec's 06 maps against", () => {
    for (const method of ["createPublicThread(", "replyToPublicThread(", "findPost(", "recentFeed(", "thread("]) {
      expect(boardRuntimeSource, method).toMatch(new RegExp(method.replace("(", "\\(")));
    }
  });

  it("2. CreatePublicThreadCommand/ReplyToPublicThreadCommand carry no Authority-derived field (id/author/source/createdAt) on the caller-facing surface", () => {
    const interfaceStart = commandTypesSource.indexOf("export interface CreatePublicThreadCommand");
    const interfaceBody = commandTypesSource.slice(interfaceStart, commandTypesSource.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/readonly (id|author|source|createdAt):/);
  });

  it("3. master's real FedosBoardPost has exactly 8 fields, none visibility/mode/encryption-shaped -- the record 04 recommends is additive, not a Board-model change", () => {
    const interfaceStart = boardPostSource.indexOf("export interface FedosBoardPost");
    const interfaceBody = boardPostSource.slice(interfaceStart, boardPostSource.indexOf("}", interfaceStart));
    const fieldCount = (interfaceBody.match(/readonly \w+[?:]/g) ?? []).length;
    expect(fieldCount).toBe(8);
    expect(interfaceBody).not.toMatch(/mode|visibility|encrypt|conversationId/i);
  });

  it("4. FedosBoardModerationRecord remains types-only with no 'deleted' boolean -- 09's lifecycle/deletion separation is not contradicted by real source", () => {
    expect(moderationSource).toMatch(/types only|TYPES ONLY/);
    expect(moderationSource).not.toMatch(/deleted\s*:\s*boolean/);
  });

  it("5. neither FedosBoardPersistence nor FedosBoardOutboxIntent expose a delete method -- 09's 'no physical deletion is promised' claim matches real source", () => {
    expect(boardPersistenceSource).not.toMatch(/\bdelete\w*\s*\(/i);
    expect(outboxTypesSource).not.toMatch(/\bdelete\w*\s*\(/i);
  });

  it("6. FedosBoardId/FedosThreadId/FedosBoardPostId are opaque branded strings with no ID-generation logic -- 03's 'wrap, do not replace' design is compatible with how these are already constructed", () => {
    expect(identifiersSource).toMatch(/No random ID generator exists anywhere in this file/i);
    expect(identifiersSource).toMatch(/export type FedosBoardId = string & \{ readonly __brand: "FedosBoardId" \}/);
    expect(identifiersSource).toMatch(/export type FedosThreadId = string & \{ readonly __brand: "FedosThreadId" \}/);
  });

  it("7. outbound eligibility today (master) is public-mode only, three checks, fail-closed -- 13's 'unchanged in V1' claim matches real source", () => {
    expect(outboundEligibilitySource).toMatch(/Public mode ONLY/);
    expect(outboundEligibilitySource).toMatch(/export function isEligibleForPublicOutboundTarget/);
  });

  it("8. resolvePublicAuthorReference() always falls back to anonymous-local today (no default identity source wired) -- 07's 'Identity' row matches real source", () => {
    expect(authorAuthoritySource).toMatch(/ALWAYS falls back/);
  });

  it("9. FedosConversationPolicy/FedosConversationMode/FedosConversationRecord now exist under src/board/ -- the Policy Arc landed via the Alpha 1051-1110 Conversation Runtime Consolidation Arc, superseding this review's original 'master truly lacks it' finding", () => {
    const files = allSrcBoardFiles("src/board");
    const matches: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8") as string;
      if (/\bFedosConversationPolicy\b|\bFedosConversationMode\b|\bFedosConversationRecord\b/.test(text)) {
        matches.push(file);
      }
    }
    expect(matches.length).toBeGreaterThan(0);
  });

  it("10. src/board/runtime/policy, src/board/runtime/identity, and src/board/runtime/eligibility now exist -- the Policy Arc's own subdirectories, merged by the Alpha 1051-1110 Conversation Runtime Consolidation Arc", () => {
    const files = allSrcBoardFiles("src/board/runtime");
    for (const dir of ["policy", "identity", "eligibility"]) {
      expect(files.some((file) => file.includes(`/runtime/${dir}/`))).toBe(true);
    }
  });
});

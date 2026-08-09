import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_293_session_author_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/session/fedos_session_board_adapter.ts?raw";
import { mapValidatedSessionPostToBoardPostInput } from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const POST: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello Session board world",
  createdAt: 1_700_000_000,
  replyTo: null,
};

/**
 * Secure Runtime Alpha 293 -- "Session Author Mapping": Stage 3 of the
 * Session Canonical Board Gateway Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- authorId -> publicIdentifier verbatim,
 * identityId always null, sessionId never used as author identity, no
 * network.
 */
describe("Secure Runtime Alpha 293 -- Session Author Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: authorId is copied verbatim into publicIdentifier, NOT sessionId", () => {
    const input = mapValidatedSessionPostToBoardPostInput(POST, "board-1");
    expect(input!.author.publicIdentifier).toBe(POST.authorId);
    expect(input!.author.publicIdentifier).not.toBe(POST.sessionId);
  });

  it("3. behavioral: identityId is always null, protocol is the fixed literal 'session'", () => {
    const input = mapValidatedSessionPostToBoardPostInput(POST, "board-1");
    expect(input!.author.identityId).toBeNull();
    expect(input!.author.protocol).toBe("session");
  });

  it("4. structural: no profile/displayName/avatar/identity-resolution reference IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/displayName|avatar|profile|resolveIdentity/i);
  });

  it("5. structural: no fetch/network reference anywhere in the adapter, IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/fetch\(|WebSocket|async function|await /);
  });

  it("6. behavioral: a different authorId produces a different publicIdentifier, all else equal", () => {
    const other: FedosValidatedSessionPost = { ...POST, authorId: "05" + "c".repeat(64) };
    const inputA = mapValidatedSessionPostToBoardPostInput(POST, "board-1");
    const inputB = mapValidatedSessionPostToBoardPostInput(other, "board-1");
    expect(inputA!.author.publicIdentifier).not.toBe(inputB!.author.publicIdentifier);
  });

  it("7. the design doc confirms sessionId is not used as author identity", () => {
    expect(designDocSource).toMatch(/`post\.sessionId` \(Alpha 292 §3\) is NOT used here/);
  });

  it("8. the design doc cross-references Alpha 292, Alpha 254, and Alpha 284", () => {
    for (const ref of [
      "secure_runtime_alpha_292_normalized_session_post_model",
      "secure_runtime_alpha_254_canonical_board_author",
      "secure_runtime_alpha_284_atproto_author_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

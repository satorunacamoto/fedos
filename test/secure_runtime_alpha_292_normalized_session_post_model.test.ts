import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_292_normalized_session_post_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModelSource from "../src/board/session/fedos_validated_session_post.ts?raw";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 292 -- "Normalized Session Post Model": Stage 2
 * of the Session Canonical Board Gateway Adapter Arc. Adds
 * src/board/session/fedos_validated_session_post.ts, exporting
 * FedosValidatedSessionPost -- exactly six readonly fields, no
 * Attachment/Group/Reaction/Voice/Typing field.
 */
describe("Secure Runtime Alpha 292 -- Normalized Session Post Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: FedosValidatedSessionPost is the only export, exactly six readonly fields", () => {
    const exportNames = [...postModelSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosValidatedSessionPost"]);
    const fieldMatches = [...postModelSource.matchAll(/^\s*readonly (\w+):/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldMatches).toEqual(["messageId", "sessionId", "authorId", "body", "createdAt", "replyTo"]);
  });

  it("3. structural: no Attachment/Group/Reaction/Voice/Typing field, IN CODE", () => {
    expect(codeOnly(postModelSource)).not.toMatch(
      /\battachment\b|\bgroup\b|\breaction\b|\bvoice\b|\btyping\b/i,
    );
  });

  it("4. structural: defines a TYPE ONLY -- no function, class, or Session/Oxen network logic IN CODE", () => {
    expect(codeOnly(postModelSource)).not.toMatch(/\bfunction\b|\bclass\b|oxen|onion/i);
  });

  it("5. behavioral: a well-formed root value satisfies the type", () => {
    const post: FedosValidatedSessionPost = {
      messageId: "sess-msg-1",
      sessionId: "05" + "a".repeat(64),
      authorId: "05" + "b".repeat(64),
      body: "Hello Session board world",
      createdAt: 1_700_000_000,
      replyTo: null,
    };
    expect(Number.isInteger(post.createdAt)).toBe(true);
    expect(post.replyTo).toBeNull();
  });

  it("6. the design doc explains sessionId vs. authorId are two different identifiers, not a redundancy", () => {
    expect(designDocSource).toMatch(/two different identifiers, not a\s*\nredundancy/);
  });

  it("7. the design doc cross-references Alpha 291, Alpha 255, Alpha 282, and Alpha 296", () => {
    for (const ref of [
      "secure_runtime_alpha_291_existing_session_inventory",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_282_normalized_atproto_post_model",
      "secure_runtime_alpha_296_session_source_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModelSource from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.ts?raw";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 272 -- "Normalized ActivityPub Post Model":
 * Stage 2 of the ActivityPub Canonical Board Adapter Arc. Adds
 * src/board/activitypub/fedos_validated_activitypub_post.ts, exporting
 * FedosValidatedActivityPubPost -- six readonly fields, content
 * contractually plain text (Option A), no optional speculative fields.
 */
describe("Secure Runtime Alpha 272 -- Normalized ActivityPub Post Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosValidatedActivityPubPost is the only export, exactly six readonly fields", () => {
    const exportNames = [...postModelSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosValidatedActivityPubPost"]);
    const fieldMatches = [...postModelSource.matchAll(/^\s*readonly (\w+):/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldMatches).toEqual(["objectId", "actorId", "content", "published", "inReplyTo", "conversationRoot"]);
  });

  it("3. structural: no summary/sensitive/language/attachment/updated field, IN CODE", () => {
    expect(codeOnly(postModelSource)).not.toMatch(
      /\bsummary\b|\bsensitive\b|\blanguage\b|\battachments?\b|\bupdated\b/,
    );
  });

  it("4. structural: defines a TYPE ONLY -- no function, class, or HTML parsing logic IN CODE", () => {
    expect(codeOnly(postModelSource)).not.toMatch(/\bfunction\b|\bclass\b|sanitize|DOMPurify|parseHtml/i);
  });

  it("5. behavioral: a well-formed value satisfies the type with plain-text content and Unix-seconds timestamp", () => {
    const post: FedosValidatedActivityPubPost = {
      objectId: "https://example.social/users/alice/statuses/1",
      actorId: "https://example.social/users/alice",
      content: "Hello ActivityPub board world",
      published: 1_700_000_000,
      inReplyTo: null,
      conversationRoot: null,
    };
    expect(post.content).not.toMatch(/[<>]/);
    expect(Number.isInteger(post.published)).toBe(true);
  });

  it("6. the design doc adopts Option A (sanitized plain text), with rationale", () => {
    expect(designDocSource).toMatch(/\*\*Adopted: Option A — sanitized plain text\.\*\*/);
  });

  it("7. the design doc names the required upstream normalization boundary explicitly", () => {
    expect(designDocSource).toMatch(/\*\*The required upstream normalization boundary, named explicitly:\*\*/);
  });

  it("8. the design doc cross-references Alpha 271, Alpha 255, Alpha 242, and Alpha 275", () => {
    for (const ref of [
      "secure_runtime_alpha_271_existing_activitypub_inventory",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_242_validated_nostr_event_model",
      "secure_runtime_alpha_275_activitypub_body_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

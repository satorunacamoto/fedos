import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_282_normalized_atproto_post_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModelSource from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.ts?raw";
import type { FedosValidatedAtprotoPost } from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 282 -- "Normalized AT Protocol Post Model":
 * Stage 2 of the AT Protocol Canonical Board Adapter Arc. Adds
 * src/board/atproto/fedos_validated_atproto_post.ts, exporting
 * FedosValidatedAtprotoPost -- seven readonly fields, no optional
 * speculative fields, plain-text content by protocol design.
 */
describe("Secure Runtime Alpha 282 -- Normalized AT Protocol Post Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: FedosValidatedAtprotoPost is the only export, exactly seven readonly fields", () => {
    const exportNames = [...postModelSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosValidatedAtprotoPost"]);
    const fieldMatches = [...postModelSource.matchAll(/^\s*readonly (\w+):/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldMatches).toEqual([
      "uri",
      "cid",
      "authorDid",
      "text",
      "createdAt",
      "replyRootUri",
      "replyParentUri",
    ]);
  });

  it("3. structural: no langs/facets/embed/labels/collection/rkey field, IN CODE", () => {
    expect(codeOnly(postModelSource)).not.toMatch(
      /\blangs\b|\bfacets\b|\bembed\b|\blabels\b|\bcollection\b|\brkey\b/,
    );
  });

  it("4. structural: defines a TYPE ONLY -- no function, class, or DID/URI/CID parsing logic IN CODE", () => {
    expect(codeOnly(postModelSource)).not.toMatch(/\bfunction\b|\bclass\b|parseDid|parseAtUri|parseCid/i);
  });

  it("5. behavioral: a well-formed root value satisfies the type with plain text and Unix-seconds createdAt", () => {
    const post: FedosValidatedAtprotoPost = {
      uri: "at://did:plc:abc123/app.bsky.feed.post/xyz789",
      cid: "bafyabc123",
      authorDid: "did:plc:abc123",
      text: "Hello AT Protocol board world",
      createdAt: 1_700_000_000,
      replyRootUri: null,
      replyParentUri: null,
    };
    expect(post.text).not.toMatch(/[<>]/);
    expect(Number.isInteger(post.createdAt)).toBe(true);
  });

  it("6. the design doc adopts the default rule: no optional field merely because Bluesky supports it", () => {
    expect(designDocSource).toMatch(/Do not include optional fields merely\s*\nbecause Bluesky supports them/);
  });

  it("7. the design doc explains why cid is retained but never appears on FedosBoardPost", () => {
    expect(designDocSource).toMatch(/`cid` is retained on `FedosValidatedAtprotoPost`/);
  });

  it("8. the design doc cross-references Alpha 281, Alpha 255, Alpha 272, and Alpha 283", () => {
    for (const ref of [
      "secure_runtime_alpha_281_existing_atproto_inventory",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_272_normalized_activitypub_post_model",
      "secure_runtime_alpha_283_atproto_source_provenance",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_284_atproto_author_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
import { mapValidatedAtprotoPostToBoardPostInput } from "../src/board/atproto/fedos_atproto_board_adapter.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const POST: FedosValidatedAtprotoPost = {
  uri: "at://did:plc:abc123/app.bsky.feed.post/xyz789",
  cid: "bafyabc123",
  authorDid: "did:plc:abc123",
  text: "Hello AT Protocol board world",
  createdAt: 1_700_000_000,
  replyRootUri: null,
  replyParentUri: null,
};

/**
 * Secure Runtime Alpha 284 -- "AT Protocol Author Mapping": Stage 4 of
 * the AT Protocol Canonical Board Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- authorDid -> publicIdentifier verbatim,
 * identityId always null, the DID (never a handle) as identity, no
 * profile resolution, no network calls.
 */
describe("Secure Runtime Alpha 284 -- AT Protocol Author Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: authorDid is copied verbatim into publicIdentifier", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(POST, "board-1");
    expect(input!.author.publicIdentifier).toBe(POST.authorDid);
  });

  it("3. behavioral: identityId is always null, protocol is the fixed literal 'atproto'", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(POST, "board-1");
    expect(input!.author.identityId).toBeNull();
    expect(input!.author.protocol).toBe("atproto");
  });

  it("4. structural: no handle/displayName/avatar/description/labels/followers/PDS field IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(
      /\bhandle\b|\bdisplayName\b|\bavatar\b|\bdescription\b|\bfollowers\b|\bPDS\b/,
    );
  });

  it("5. structural: no fetch/network/DID-resolution reference anywhere in the adapter, IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/fetch\(|WebSocket|async function|await /);
  });

  it("6. the design doc states the DID, not the handle, is the canonical identity", () => {
    expect(designDocSource).toMatch(/\*\*"The stable DID is the author identifier\./);
    expect(designDocSource).toMatch(/Handles are mutable\s*\npresentation data/);
  });

  it("7. the design doc lists all six permanent prohibitions verbatim", () => {
    for (const item of [
      "app password",
      "access token",
      "refresh token",
      "OAuth token",
      "session credential",
      "private signing key",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("8. the design doc cross-references Alpha 282, Alpha 254, and Alpha 274", () => {
    for (const ref of [
      "secure_runtime_alpha_282_normalized_atproto_post_model",
      "secure_runtime_alpha_254_canonical_board_author",
      "secure_runtime_alpha_274_activitypub_author_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

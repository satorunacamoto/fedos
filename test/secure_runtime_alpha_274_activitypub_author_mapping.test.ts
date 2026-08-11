import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_274_activitypub_author_mapping.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
import { mapValidatedActivityPubPostToBoardPostInput } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const POST: FedosValidatedActivityPubPost = {
  objectId: "https://example.social/users/alice/statuses/1",
  actorId: "https://example.social/users/alice",
  content: "Hello ActivityPub board world",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

/**
 * Secure Runtime Alpha 274 -- "ActivityPub Author Mapping": Stage 4 of
 * the ActivityPub Canonical Board Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- actorId -> publicIdentifier verbatim,
 * identityId always null, no profile resolution, no network calls.
 */
describe("Secure Runtime Alpha 274 -- ActivityPub Author Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: actorId is copied verbatim into publicIdentifier", () => {
    const input = mapValidatedActivityPubPostToBoardPostInput(POST, "board-1");
    expect(input!.author.publicIdentifier).toBe(POST.actorId);
  });

  it("3. behavioral: identityId is always null, protocol is the fixed literal 'activitypub'", () => {
    const input = mapValidatedActivityPubPostToBoardPostInput(POST, "board-1");
    expect(input!.author.identityId).toBeNull();
    expect(input!.author.protocol).toBe("activitypub");
  });

  it("4. structural: no preferredUsername/name/icon/image/summary/followers/following field IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(
      /preferredUsername|\bicon\b|\bimage\b|\bfollowers\b|\bfollowing\b/,
    );
  });

  it("5. structural: no fetch/network/Actor-resolution reference anywhere in the adapter, IN CODE", () => {
    expect(codeOnly(adapterModuleSource)).not.toMatch(/fetch\(|WebSocket|async function|await /);
  });

  it("6. the design doc lists all six permanent prohibitions verbatim", () => {
    for (const item of [
      "HTTP Signature private key",
      "OAuth token",
      "bearer token",
      "session cookie",
      "Mastodon application secret",
      "Actor private metadata",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("7. the design doc cross-references Alpha 272, Alpha 254, and Alpha 262", () => {
    for (const ref of [
      "secure_runtime_alpha_272_normalized_activitypub_post_model",
      "secure_runtime_alpha_254_canonical_board_author",
      "secure_runtime_alpha_262_nostr_author_mapping",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

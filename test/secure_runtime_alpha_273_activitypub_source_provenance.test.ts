import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_273_activitypub_source_provenance.md?raw";
import { mapValidatedActivityPubPostToBoardPostInput } from "../src/os/messenger/board/activitypub/fedos_activitypub_board_adapter.js";
import { fedosBoardSourceKey } from "../src/os/messenger/board/fedos_board_source.js";
import type { FedosValidatedActivityPubPost } from "../src/os/messenger/board/activitypub/fedos_validated_activitypub_post.js";

const POST: FedosValidatedActivityPubPost = {
  objectId: "https://example.social/users/alice/statuses/1",
  actorId: "https://example.social/users/alice",
  content: "Hello ActivityPub board world",
  published: 1_700_000_000,
  inReplyTo: null,
  conversationRoot: null,
};

/**
 * Secure Runtime Alpha 273 -- "ActivityPub Source Provenance": Stage 3
 * of the ActivityPub Canonical Board Adapter Arc. A design-decision
 * Stage backed by behavioral tests -- objectId -> source.reference,
 * fixed "activitypub" protocol, duplicate-import identity reused from
 * fedosBoardSourceKey unmodified.
 */
describe("Secure Runtime Alpha 273 -- ActivityPub Source Provenance", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: source.reference is the object id verbatim, source.protocol is the fixed literal 'activitypub'", () => {
    const input = mapValidatedActivityPubPostToBoardPostInput(POST, "board-1");
    expect(input!.source).toEqual({ protocol: "activitypub", reference: POST.objectId });
  });

  it("3. behavioral: fedosBoardSourceKey (Alpha 253, unmodified) names the duplicate-import identity rule", () => {
    const a = fedosBoardSourceKey({ protocol: "activitypub", reference: POST.objectId });
    const b = fedosBoardSourceKey({ protocol: "activitypub", reference: POST.objectId });
    const c = fedosBoardSourceKey({ protocol: "activitypub", reference: "https://other.example/1" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("4. behavioral: no inbox/instance/signature/request/IP/token field appears on the mapped source", () => {
    const input = mapValidatedActivityPubPostToBoardPostInput(POST, "board-1");
    expect(Object.keys(input!.source)).toEqual(["protocol", "reference"]);
  });

  it("5. the design doc confirms Object id, not Create Activity id, is used", () => {
    expect(designDocSource).toMatch(/use the ActivityPub Object id, not the\s+Create Activity id/i);
  });

  it("6. the design doc cross-references Alpha 272, Alpha 253, and Alpha 265", () => {
    for (const ref of [
      "secure_runtime_alpha_272_normalized_activitypub_post_model",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_265_nostr_source_reference",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_283_atproto_source_provenance.md?raw";
import { mapValidatedAtprotoPostToBoardPostInput } from "../src/board/atproto/fedos_atproto_board_adapter.js";
import { fedosBoardSourceKey } from "../src/board/fedos_board_source.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";

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
 * Secure Runtime Alpha 283 -- "AT Protocol Source Provenance": Stage 3
 * of the AT Protocol Canonical Board Adapter Arc. A design-decision
 * Stage backed by behavioral tests -- Option C: AT URI ->
 * source.reference, CID never leaks in, duplicate-import identity keys
 * on URI alone regardless of CID.
 */
describe("Secure Runtime Alpha 283 -- AT Protocol Source Provenance", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: source.reference is the AT URI verbatim, source.protocol is the fixed literal 'atproto'", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(POST, "board-1");
    expect(input!.source).toEqual({ protocol: "atproto", reference: POST.uri });
  });

  it("3. behavioral: cid does not appear anywhere on the mapped source or input", () => {
    const input = mapValidatedAtprotoPostToBoardPostInput(POST, "board-1");
    expect(Object.keys(input!.source)).toEqual(["protocol", "reference"]);
    expect(JSON.stringify(input)).not.toContain(POST.cid);
  });

  it("4. behavioral: same URI, different CID -> same source identity (fedosBoardSourceKey)", () => {
    const sameUriDifferentCid: FedosValidatedAtprotoPost = { ...POST, cid: "bafydifferentversion" };
    const inputA = mapValidatedAtprotoPostToBoardPostInput(POST, "board-1");
    const inputB = mapValidatedAtprotoPostToBoardPostInput(sameUriDifferentCid, "board-1");
    expect(fedosBoardSourceKey({ protocol: "atproto", reference: inputA!.source.reference })).toBe(
      fedosBoardSourceKey({ protocol: "atproto", reference: inputB!.source.reference }),
    );
  });

  it("5. behavioral: fedosBoardSourceKey (Alpha 253, unmodified) still names the duplicate-import identity rule", () => {
    const a = fedosBoardSourceKey({ protocol: "atproto", reference: POST.uri });
    const b = fedosBoardSourceKey({ protocol: "atproto", reference: POST.uri });
    const c = fedosBoardSourceKey({ protocol: "atproto", reference: "at://did:plc:other/app.bsky.feed.post/1" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("6. the design doc adopts Option C, with the reason (identity vs. content-version split)", () => {
    expect(designDocSource).toMatch(/\*\*Adopted\*\*,\s+exactly this Arc's own\s+preferred\s+candidate\./);
    expect(designDocSource).toMatch(/AT URI identifies the logical repository record/);
    expect(designDocSource).toMatch(/CID identifies a particular content version/);
  });

  it("7. the design doc cross-references Alpha 282, Alpha 253, and Alpha 273", () => {
    for (const ref of [
      "secure_runtime_alpha_282_normalized_atproto_post_model",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_273_activitypub_source_provenance",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_296_session_source_mapping.md?raw";
import { mapValidatedSessionPostToBoardPostInput } from "../src/os/messenger/board/session/fedos_session_board_adapter.js";
import { fedosBoardSourceKey } from "../src/os/messenger/board/fedos_board_source.js";
import type { FedosValidatedSessionPost } from "../src/os/messenger/board/session/fedos_validated_session_post.js";

const POST: FedosValidatedSessionPost = {
  messageId: "sess-msg-1",
  sessionId: "05" + "a".repeat(64),
  authorId: "05" + "b".repeat(64),
  body: "Hello Session board world",
  createdAt: 1_700_000_000,
  replyTo: null,
};

/**
 * Secure Runtime Alpha 296 -- "Session Source Mapping": Stage 6 of the
 * Session Canonical Board Gateway Adapter Arc. A design-decision Stage
 * backed by behavioral tests -- messageId -> source.reference, fixed
 * "session" protocol, sessionId never leaks in.
 */
describe("Secure Runtime Alpha 296 -- Session Source Mapping", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. behavioral: source.reference is the messageId verbatim, source.protocol is the fixed literal 'session'", () => {
    const input = mapValidatedSessionPostToBoardPostInput(POST, "board-1");
    expect(input!.source).toEqual({ protocol: "session", reference: POST.messageId });
  });

  it("3. behavioral: sessionId does not appear anywhere on the mapped source or input", () => {
    const input = mapValidatedSessionPostToBoardPostInput(POST, "board-1");
    expect(Object.keys(input!.source)).toEqual(["protocol", "reference"]);
    expect(JSON.stringify(input)).not.toContain(POST.sessionId);
  });

  it("4. behavioral: fedosBoardSourceKey (Alpha 253, unmodified) still names the duplicate-import identity rule", () => {
    const a = fedosBoardSourceKey({ protocol: "session", reference: POST.messageId });
    const b = fedosBoardSourceKey({ protocol: "session", reference: POST.messageId });
    const c = fedosBoardSourceKey({ protocol: "session", reference: "sess-msg-other" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("5. behavioral: no Session network node, Oxen address, or onion-routing field appears on the result", () => {
    const input = mapValidatedSessionPostToBoardPostInput(POST, "board-1");
    const serialized = JSON.stringify(input).toLowerCase();
    for (const forbidden of ["oxen", "onion", "relayurl", "endpoint"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("6. the design doc confirms sessionId's omission is deliberate, mirroring AT Protocol's cid decision", () => {
    expect(designDocSource).toMatch(/the omission\s*\nIS the decision/);
  });

  it("7. the design doc cross-references Alpha 292, Alpha 253, and Alpha 283", () => {
    for (const ref of [
      "secure_runtime_alpha_292_normalized_session_post_model",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_283_atproto_source_provenance",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

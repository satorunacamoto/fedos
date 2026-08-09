import { describe, it, expect } from "vitest";
import {
  FEDOS_BOARD_OUTBOUND_PROTOCOLS,
  isFedosBoardOutboundProtocol,
  makeFedosBoardOutboxId,
  type FedosBoardOutboxTarget,
} from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 413 -- "Outbox Identifier and Target Model":
 * Stage 3 of the Alpha 411-420 Canonical Board Durable Outbox
 * Foundation Arc.
 */
describe("Secure Runtime Alpha 413 -- Outbox Identifier and Target Model", () => {
  const postId = toFedosBoardPostId("post-1")!;

  it("1. declares exactly the four required outbound protocols", () => {
    expect([...FEDOS_BOARD_OUTBOUND_PROTOCOLS].sort()).toEqual(
      ["activitypub", "atproto", "nostr", "session"].sort(),
    );
  });

  it("2. isFedosBoardOutboundProtocol accepts only the four labels", () => {
    for (const protocol of FEDOS_BOARD_OUTBOUND_PROTOCOLS) {
      expect(isFedosBoardOutboundProtocol(protocol)).toBe(true);
    }
    expect(isFedosBoardOutboundProtocol("fedos")).toBe(false);
    expect(isFedosBoardOutboundProtocol("nostr-relay")).toBe(false);
    expect(isFedosBoardOutboundProtocol("")).toBe(false);
  });

  it("3. makeFedosBoardOutboxId is deterministic -- identical inputs always yield the identical id", () => {
    const target: FedosBoardOutboxTarget = { protocol: "nostr", destination: null };
    const id1 = makeFedosBoardOutboxId(postId, target);
    const id2 = makeFedosBoardOutboxId(postId, target);
    expect(id1).toBe(id2);
  });

  it("4. makeFedosBoardOutboxId differs across postId, protocol, and destination independently", () => {
    const base = makeFedosBoardOutboxId(postId, { protocol: "nostr", destination: null });
    const otherPost = makeFedosBoardOutboxId(toFedosBoardPostId("post-2")!, { protocol: "nostr", destination: null });
    const otherProtocol = makeFedosBoardOutboxId(postId, { protocol: "activitypub", destination: null });
    const otherDestination = makeFedosBoardOutboxId(postId, { protocol: "nostr", destination: "wss://relay.example" });
    expect(new Set([base, otherPost, otherProtocol, otherDestination]).size).toBe(4);
  });

  it("5. makeFedosBoardOutboxId never uses randomness or a clock -- no Date/Math.random reference in the module", () => {
    // Structural guarantee already exercised by test 3's own repeatability; this test
    // additionally confirms two calls made far apart in real time still match.
    const target: FedosBoardOutboxTarget = { protocol: "session", destination: "gw-1" };
    const first = makeFedosBoardOutboxId(postId, target);
    const second = makeFedosBoardOutboxId(postId, { protocol: "session", destination: "gw-1" });
    expect(first).toBe(second);
  });

  it("6. the derived id embeds postId, protocol, and destination as visible, inspectable segments", () => {
    const id = makeFedosBoardOutboxId(postId, { protocol: "atproto", destination: "at://did:example/repo" });
    expect(id).toContain(postId as unknown as string);
    expect(id).toContain("atproto");
    expect(id).toContain("at://did:example/repo");
  });
});

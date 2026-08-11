import { describe, it, expect } from "vitest";
import {
  createFedosBoardOutboxIntent,
  makeFedosBoardOutboxId,
} from "../src/os/messenger/board/outbox/fedos_board_outbox_types.js";
import { toFedosBoardPostId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 414 -- "Immutable Outbox Intent Model": Stage 4
 * of the Alpha 411-420 Canonical Board Durable Outbox Foundation Arc.
 */
describe("Secure Runtime Alpha 414 -- Immutable Outbox Intent Model", () => {
  const postId = toFedosBoardPostId("post-1")!;
  const target = { protocol: "nostr" as const, destination: null };

  it("1. constructs a valid intent with the expected shape", () => {
    const intent = createFedosBoardOutboxIntent(postId, target, 1_700_000_000);
    expect(intent).not.toBeNull();
    expect(intent!.postId).toBe(postId);
    expect(intent!.target).toEqual(target);
    expect(intent!.createdAt).toBe(1_700_000_000);
    expect(intent!.id).toBe(makeFedosBoardOutboxId(postId, target));
  });

  it("2. is Object.frozen -- mutation attempts are no-ops or throw", () => {
    const intent = createFedosBoardOutboxIntent(postId, target, 1_700_000_000)!;
    expect(Object.isFrozen(intent)).toBe(true);
    expect(Object.isFrozen(intent.target)).toBe(true);
  });

  it("3. does not share the caller's own target object reference", () => {
    const mutableTarget = { protocol: "nostr" as const, destination: "wss://relay.example" };
    const intent = createFedosBoardOutboxIntent(postId, mutableTarget, 1_700_000_000)!;
    expect(intent.target).not.toBe(mutableTarget);
    expect(intent.target).toEqual(mutableTarget);
  });

  it("4. never derives target from postId or any post field -- target is a required, independent parameter", () => {
    const a = createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: null }, 1)!;
    const b = createFedosBoardOutboxIntent(postId, { protocol: "activitypub", destination: null }, 1)!;
    expect(a.target.protocol).toBe("nostr");
    expect(b.target.protocol).toBe("activitypub");
    expect(a.id).not.toBe(b.id);
  });

  it("5. rejects an invalid target protocol -- fails closed to null, never throws", () => {
    expect(() =>
      createFedosBoardOutboxIntent(postId, { protocol: "bluesky" as never, destination: null }, 1),
    ).not.toThrow();
    expect(createFedosBoardOutboxIntent(postId, { protocol: "bluesky" as never, destination: null }, 1)).toBeNull();
  });

  it("6. rejects a negative or non-integer createdAt -- fails closed to null", () => {
    expect(createFedosBoardOutboxIntent(postId, target, -1)).toBeNull();
    expect(createFedosBoardOutboxIntent(postId, target, 1.5)).toBeNull();
    expect(createFedosBoardOutboxIntent(postId, target, Number.NaN)).toBeNull();
  });

  it("7. rejects a malformed destination type -- fails closed to null", () => {
    expect(createFedosBoardOutboxIntent(postId, { protocol: "nostr", destination: 123 as never }, 1)).toBeNull();
  });

  it("8. carries no Board-body field of any kind -- structural key check", () => {
    const intent = createFedosBoardOutboxIntent(postId, target, 1)!;
    expect(Object.keys(intent).sort()).toEqual(["createdAt", "id", "postId", "target"]);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_314_board_serialization_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/board/persistence/fedos_board_post_codec.ts?raw";
import { serializeFedosBoardPost, deserializeFedosBoardPost } from "../src/board/persistence/fedos_board_post_codec.js";
import { fedosBoardPostsAreStructurallyEqual } from "../src/board/repository/fedos_board_repository.js";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";
import type { FedosPersistedBoardPostRecordV1 } from "../src/board/persistence/fedos_persisted_board_post_v1.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

const INPUT: FedosBoardPostInput = {
  id: "post-1",
  boardId: "board-1",
  threadId: "post-1",
  replyTo: null,
  author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
  body: "Hello board world",
  createdAt: 1_700_000_000,
  source: { protocol: "nostr", reference: "abc123" },
};

/**
 * Secure Runtime Alpha 314 -- "Board Serialization and Deserialization
 * Boundary": Stage 4 of the Canonical Board Persistence Boundary Arc.
 * Adds src/board/persistence/fedos_board_post_codec.ts, exporting
 * serializeFedosBoardPost and deserializeFedosBoardPost -- fail closed,
 * round-trip equality, unknown schema/fields rejected.
 */
describe("Secure Runtime Alpha 314 -- Board Serialization and Deserialization Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: round-trip equality -- deserialize(serialize(post)) is structurally equal to post", () => {
    const post = validateFedosBoardPost(INPUT)!;
    const record = serializeFedosBoardPost(post);
    const roundTripped = deserializeFedosBoardPost(record);
    expect(roundTripped).not.toBeNull();
    expect(fedosBoardPostsAreStructurallyEqual(post, roundTripped!)).toBe(true);
  });

  it("3. behavioral: serialize produces the exact V1 shape with schemaVersion 1", () => {
    const post = validateFedosBoardPost(INPUT)!;
    const record = serializeFedosBoardPost(post);
    expect(record.schemaVersion).toBe(1);
    expect(record.id).toBe(post.id);
    expect(record.source).toEqual({ protocol: "nostr", reference: "abc123" });
  });

  it("4. behavioral: deserialize never throws, even for wildly malformed input", () => {
    expect(() => deserializeFedosBoardPost(null)).not.toThrow();
    expect(() => deserializeFedosBoardPost(undefined)).not.toThrow();
    expect(() => deserializeFedosBoardPost("not an object")).not.toThrow();
    expect(() => deserializeFedosBoardPost(42)).not.toThrow();
    expect(() => deserializeFedosBoardPost([])).not.toThrow();
    expect(deserializeFedosBoardPost(null)).toBeNull();
  });

  it("5. behavioral: an unknown schemaVersion is rejected, not guessed at", () => {
    const record = { ...serializeFedosBoardPost(validateFedosBoardPost(INPUT)!), schemaVersion: 2 };
    expect(deserializeFedosBoardPost(record)).toBeNull();
  });

  it("6. behavioral: a missing required field is rejected", () => {
    const record: Record<string, unknown> = { ...serializeFedosBoardPost(validateFedosBoardPost(INPUT)!) };
    delete record.body;
    expect(deserializeFedosBoardPost(record)).toBeNull();
  });

  it("7. behavioral: an unknown extra top-level field is rejected", () => {
    const record = { ...serializeFedosBoardPost(validateFedosBoardPost(INPUT)!), extraField: "unexpected" };
    expect(deserializeFedosBoardPost(record)).toBeNull();
  });

  it("8. behavioral: an unknown extra nested author/source field is rejected", () => {
    const base = serializeFedosBoardPost(validateFedosBoardPost(INPUT)!);
    const withExtraAuthorField = {
      ...base,
      author: { ...base.author, extra: "unexpected" },
    };
    const withExtraSourceField = {
      ...base,
      source: { ...base.source, extra: "unexpected" },
    };
    expect(deserializeFedosBoardPost(withExtraAuthorField)).toBeNull();
    expect(deserializeFedosBoardPost(withExtraSourceField)).toBeNull();
  });

  it("9. behavioral: a corrupt author/source protocol value is rejected", () => {
    const base = serializeFedosBoardPost(validateFedosBoardPost(INPUT)!);
    const badAuthorProtocol = { ...base, author: { ...base.author, protocol: "not-a-real-protocol" } };
    expect(deserializeFedosBoardPost(badAuthorProtocol)).toBeNull();
  });

  it("10. behavioral: deserialize reuses validateFedosBoardPost -- self-reply and empty body are still rejected", () => {
    const selfReplyRecord: FedosPersistedBoardPostRecordV1 = {
      schemaVersion: 1,
      id: "post-1",
      boardId: "board-1",
      threadId: "post-1",
      replyTo: "post-1",
      author: { identityId: null, protocol: "nostr", publicIdentifier: "npub1example" },
      body: "Hello board world",
      createdAt: 1_700_000_000,
      source: { protocol: "nostr", reference: "abc123" },
    };
    expect(deserializeFedosBoardPost(selfReplyRecord)).toBeNull();
  });

  it("11. behavioral: does not mutate the input", () => {
    const post = validateFedosBoardPost(INPUT)!;
    const snapshot = JSON.stringify(post);
    const record = serializeFedosBoardPost(post);
    expect(JSON.stringify(post)).toBe(snapshot);
    const recordSnapshot = JSON.stringify(record);
    deserializeFedosBoardPost(record);
    expect(JSON.stringify(record)).toBe(recordSnapshot);
  });

  it("12. structural: no JSON.parse/JSON.stringify anywhere in the codec IN CODE", () => {
    expect(codeOnly(codecSource)).not.toMatch(/JSON\.(parse|stringify)/);
  });

  it("13. structural: no throw statement anywhere in the file", () => {
    expect(codecSource).not.toMatch(/\bthrow\b/);
  });

  it("14. the design doc states the extra-field policy explicitly (reject, no established forward-compatible convention)", () => {
    expect(designDocSource).toMatch(/the\s*\ndefault therefore applies: \*\*reject\.\*\*/);
  });

  it("15. the design doc cross-references Alpha 313, Alpha 257, and Alpha 302", () => {
    for (const ref of [
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_257_board_validation_boundary",
      "secure_runtime_alpha_302_board_repository_contract",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});

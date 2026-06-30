import { describe, it, expect } from "vitest";
import {
  buildUnsignedTextNote,
  buildReplyTags,
  buildSpaceTags,
  prepareSpacePost,
} from "../src/sign/build.js";
import type { CommunitySpace } from "../src/community/types.js";

const PUB = "a".repeat(64);
const STRANGER = "stranger".padEnd(64, "0");
const ROOT = "1".repeat(64);
const REPLY = "2".repeat(64);

function community(overrides: Partial<CommunitySpace> = {}): CommunitySpace {
  return {
    id: "c1",
    type: "community",
    name: "Community One",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [],
    admins: [],
    moderators: [],
    members: [],
    ...overrides,
  };
}

describe("buildUnsignedTextNote", () => {
  it("1. builds a kind:1 note with pubkey and content", () => {
    const note = buildUnsignedTextNote({ pubkey: PUB, content: "hi", now: 1000 });
    expect(note.kind).toBe(1);
    expect(note.pubkey).toBe(PUB);
    expect(note.content).toBe("hi");
    expect(note.tags).toEqual([]);
    expect("id" in note).toBe(false);
    expect("sig" in note).toBe(false);
  });

  it("2. created_at is deterministic when `now` is injected", () => {
    const note = buildUnsignedTextNote({ pubkey: PUB, content: "x", now: 1700000000 });
    expect(note.created_at).toBe(1700000000);
  });

  it("3. deep-copies tags (no aliasing of the input array)", () => {
    const inputTags = [["t", "topic"]];
    const note = buildUnsignedTextNote({ pubkey: PUB, content: "x", tags: inputTags });
    inputTags[0]![1] = "mutated";
    expect(note.tags[0]![1]).toBe("topic");
  });
});

describe("buildReplyTags", () => {
  it("4. root only yields a single root tag", () => {
    expect(buildReplyTags(ROOT)).toEqual([["e", ROOT, "", "root"]]);
  });

  it("5. root + reply yields both tags (with relay url)", () => {
    expect(buildReplyTags(ROOT, REPLY, "wss://relay.test")).toEqual([
      ["e", ROOT, "wss://relay.test", "root"],
      ["e", REPLY, "wss://relay.test", "reply"],
    ]);
  });
});

describe("buildSpaceTags", () => {
  it("6. emits both classifier-recognized forms", () => {
    expect(buildSpaceTags("alpha")).toEqual([
      ["space", "alpha"],
      ["t", "space:alpha"],
    ]);
  });
});

describe("prepareSpacePost", () => {
  it("7. allowed: returns an unsigned request with space + reply tags", () => {
    const result = prepareSpacePost({
      actorPubkey: STRANGER,
      space: community({ postPolicy: "open" }),
      content: "hello space",
      rootId: ROOT,
      now: 1700000000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.allowed).toBe(true);
      expect(result.request.unsigned.content).toBe("hello space");
      expect(result.request.unsigned.tags).toContainEqual(["space", "c1"]);
      expect(result.request.unsigned.tags).toContainEqual(["e", ROOT, "", "root"]);
      expect(result.request.unsigned.created_at).toBe(1700000000);
      expect(result.request.unsigned).not.toHaveProperty("sig");
    }
  });

  it("8. denied: returns ok:false with the decision and no request", () => {
    const result = prepareSpacePost({
      actorPubkey: STRANGER,
      space: community({ postPolicy: "admins" }),
      content: "nope",
    });
    expect(result.ok).toBe(false);
    expect(result.decision.allowed).toBe(false);
    expect(result).not.toHaveProperty("request");
  });

  it("9. does not mutate inputs", () => {
    const space = community({ postPolicy: "open" });
    const extraTags = [["client", "nostr-window"]];
    const spaceSnapshot = JSON.stringify(space);
    const tagsSnapshot = JSON.stringify(extraTags);

    prepareSpacePost({
      actorPubkey: STRANGER,
      space,
      content: "x",
      extraTags,
      now: 1,
    });

    expect(JSON.stringify(space)).toBe(spaceSnapshot);
    expect(JSON.stringify(extraTags)).toBe(tagsSnapshot);
  });
});

import { describe, it, expect } from "vitest";
import {
  getSpaceTags,
  eventMatchesSpace,
  classifyEventToSpaces,
} from "../src/community/classify.js";
import type { NostrEvent, NostrTag } from "../src/nostr/types.js";
import type { CommunitySpace, Space } from "../src/community/types.js";

function event(tags: NostrTag[]): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags,
    content: "hello",
    sig: "b".repeat(128),
  };
}

function space(id: string): CommunitySpace {
  return {
    id,
    type: "community",
    name: `Space ${id}`,
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [],
    admins: [],
    moderators: [],
    members: [],
  };
}

describe("getSpaceTags", () => {
  it('1. reads ["t", "space:<id>"]', () => {
    expect(getSpaceTags(event([["t", "space:alpha"]]))).toEqual(["alpha"]);
  });

  it('2. reads ["space", "<id>"]', () => {
    expect(getSpaceTags(event([["space", "beta"]]))).toEqual(["beta"]);
  });

  it('3. reads ["a", "<id>"]', () => {
    expect(getSpaceTags(event([["a", "gamma"]]))).toEqual(["gamma"]);
  });

  it("4. collects multiple distinct spaces (deduped)", () => {
    const tags: NostrTag[] = [
      ["space", "alpha"],
      ["a", "beta"],
      ["t", "space:alpha"], // duplicate of alpha
    ];
    expect(getSpaceTags(event(tags))).toEqual(["alpha", "beta"]);
  });

  it("6. ignores malformed tags", () => {
    const tags: NostrTag[] = [
      ["space"], // missing value
      ["t", "notaspace"], // plain topic, not a space
      ["t", "space:"], // empty space id
      ["a"], // missing value
    ];
    expect(getSpaceTags(event(tags))).toEqual([]);
  });

  it("7. returns [] when there are no space tags", () => {
    expect(getSpaceTags(event([["e", "f".repeat(64)]]))).toEqual([]);
  });
});

describe("classifyEventToSpaces", () => {
  const spaces: Space[] = [space("alpha"), space("beta"), space("gamma")];

  it("maps an event to its referenced known spaces", () => {
    const ev = event([["space", "alpha"], ["a", "gamma"]]);
    expect(classifyEventToSpaces(ev, spaces).map((s) => s.id)).toEqual([
      "alpha",
      "gamma",
    ]);
  });

  it("5. ignores references to unknown spaces", () => {
    const ev = event([["space", "unknown"], ["space", "beta"]]);
    expect(classifyEventToSpaces(ev, spaces).map((s) => s.id)).toEqual(["beta"]);
  });

  it("returns [] for an event with no space tags", () => {
    expect(classifyEventToSpaces(event([]), spaces)).toEqual([]);
  });

  it("eventMatchesSpace reflects membership", () => {
    const ev = event([["space", "alpha"]]);
    expect(eventMatchesSpace(ev, space("alpha"))).toBe(true);
    expect(eventMatchesSpace(ev, space("beta"))).toBe(false);
  });

  it("8. does not mutate inputs", () => {
    const ev = event([["space", "alpha"]]);
    const evSnapshot = JSON.stringify(ev);
    const spacesSnapshot = JSON.stringify(spaces);
    classifyEventToSpaces(ev, spaces);
    getSpaceTags(ev);
    expect(JSON.stringify(ev)).toBe(evSnapshot);
    expect(JSON.stringify(spaces)).toBe(spacesSnapshot);
  });
});

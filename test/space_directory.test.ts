import { describe, it, expect } from "vitest";
import {
  InMemorySpaceDirectory,
  findSpaceById,
  listReadableSpaces,
  filterEventsForSpace,
} from "../src/os/_legacy_prototype/community/directory.js";
import type { CommunitySpace, GroupSpace, Space } from "../src/os/_legacy_prototype/community/types.js";
import type { NostrEvent, NostrTag } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import type { IngestedEvent } from "../src/os/_legacy_prototype/ingest/types.js";

const MEMBER = "member".padEnd(64, "0");
const STRANGER = "stranger".padEnd(64, "0");

function publicCommunity(id: string): CommunitySpace {
  return {
    id,
    type: "community",
    name: `Public ${id}`,
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [],
    admins: [],
    moderators: [],
    members: [],
  };
}

function privateGroup(id: string, members: string[] = []): GroupSpace {
  return {
    id,
    type: "group",
    name: `Private ${id}`,
    visibility: "private",
    membershipPolicy: "invite_only",
    postPolicy: "members",
    owners: [],
    admins: [],
    moderators: [],
    members,
  };
}

function unlisted(id: string): CommunitySpace {
  return { ...publicCommunity(id), visibility: "unlisted" };
}

function ingested(tags: NostrTag[]): IngestedEvent {
  const event: NostrEvent = {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1,
    kind: 1,
    tags,
    content: "x",
    sig: "b".repeat(128),
  };
  return { event, relayUrl: "wss://relay.test", ingestedAt: 1 };
}

describe("findSpaceById", () => {
  it("1. finds by id, or returns undefined", () => {
    const spaces: Space[] = [publicCommunity("a"), publicCommunity("b")];
    expect(findSpaceById(spaces, "b")?.id).toBe("b");
    expect(findSpaceById(spaces, "z")).toBeUndefined();
  });

  it("InMemorySpaceDirectory exposes list/get", () => {
    const dir = new InMemorySpaceDirectory([publicCommunity("a")]);
    expect(dir.list()).toHaveLength(1);
    expect(dir.get("a")?.id).toBe("a");
    expect(dir.get("nope")).toBeUndefined();
  });
});

describe("listReadableSpaces", () => {
  const spaces: Space[] = [
    publicCommunity("pub"),
    unlisted("unl"),
    privateGroup("priv", [MEMBER]),
  ];

  it("2. a guest sees public and unlisted spaces", () => {
    const ids = listReadableSpaces(spaces, STRANGER).map((s) => s.id);
    expect(ids).toContain("pub");
    expect(ids).toContain("unl");
  });

  it("3. a guest does not see private spaces", () => {
    expect(listReadableSpaces(spaces, STRANGER).map((s) => s.id)).not.toContain("priv");
  });

  it("4. a member sees the private space they belong to", () => {
    expect(listReadableSpaces(spaces, MEMBER).map((s) => s.id)).toContain("priv");
  });

  it("treats an omitted actor as a guest", () => {
    expect(listReadableSpaces(spaces).map((s) => s.id)).not.toContain("priv");
  });
});

describe("filterEventsForSpace", () => {
  const space = publicCommunity("alpha");

  it("5. keeps only events tagged for the space", () => {
    const events = [
      ingested([["space", "alpha"]]),
      ingested([["t", "space:alpha"]]),
      ingested([["space", "beta"]]),
      ingested([]),
    ];
    expect(filterEventsForSpace(events, space)).toHaveLength(2);
  });

  it("6. returns [] when nothing matches", () => {
    expect(filterEventsForSpace([ingested([["space", "other"]])], space)).toEqual([]);
  });

  it("7. does not mutate inputs", () => {
    const events = [ingested([["space", "alpha"]])];
    const snapshot = JSON.stringify(events);
    filterEventsForSpace(events, space);
    expect(JSON.stringify(events)).toBe(snapshot);
  });
});

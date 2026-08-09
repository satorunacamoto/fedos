import { describe, it, expect } from "vitest";
import {
  buildIndexedEvents,
  buildIndexedThreads,
  buildIndexedSpaceRefs,
  previewContent,
  MAX_CONTENT_PREVIEW,
} from "../src/os/_legacy_prototype/indexer/build.js";
import { buildThreads } from "../src/os/_legacy_prototype/thread/thread.js";
import type { NostrEvent, NostrTag } from "../src/nostr/types.js";
import type { IngestedEvent } from "../src/os/_legacy_prototype/ingest/types.js";
import type { CommunitySpace } from "../src/os/_legacy_prototype/community/types.js";

function event(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "hello",
    sig: "c".repeat(128),
    ...overrides,
  };
}

function ingested(
  ev: NostrEvent,
  relayUrl = "wss://relay.test",
  ingestedAt = 1700000001000,
): IngestedEvent {
  return { event: ev, relayUrl, ingestedAt };
}

function community(overrides: Partial<CommunitySpace> = {}): CommunitySpace {
  return {
    id: "general",
    type: "community",
    name: "General",
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

const ROOT = "1".repeat(64);
const REPLY = "2".repeat(64);

describe("buildIndexedEvents", () => {
  it("1. projects ingested events into compact records", () => {
    const [rec] = buildIndexedEvents([ingested(event({ content: "hi" }))]);
    expect(rec).toMatchObject({
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      kind: 1,
      created_at: 1700000000,
      contentPreview: "hi",
      relayUrl: "wss://relay.test",
      ingestedAt: 1700000001000,
    });
    expect(rec!.spaceIds).toEqual([]);
    // No reply/root for a plain root note.
    expect(rec).not.toHaveProperty("replyTo");
    expect(rec).not.toHaveProperty("rootId");
  });

  it("2. truncates contentPreview to the max length", () => {
    const long = "x".repeat(MAX_CONTENT_PREVIEW + 50);
    const [rec] = buildIndexedEvents([ingested(event({ content: long }))]);
    expect(rec!.contentPreview).toHaveLength(MAX_CONTENT_PREVIEW);
    expect(previewContent(long)).toHaveLength(MAX_CONTENT_PREVIEW);
    expect(previewContent("short")).toBe("short");
  });

  it("3. extracts reply/root targets from NIP-10 e tags", () => {
    const tags: NostrTag[] = [
      ["e", ROOT, "", "root"],
      ["e", REPLY, "", "reply"],
    ];
    const [rec] = buildIndexedEvents([ingested(event({ id: REPLY, tags }))]);
    expect(rec!.rootId).toBe(ROOT);
    expect(rec!.replyTo).toBe(REPLY);
  });

  it("4. extracts space ids from space tags", () => {
    const tags: NostrTag[] = [
      ["space", "general"],
      ["t", "space:lounge"],
    ];
    const [rec] = buildIndexedEvents([ingested(event({ tags }))]);
    expect(rec!.spaceIds).toEqual(["general", "lounge"]);
  });

  it("7. does not mutate inputs", () => {
    const input = ingested(event({ tags: [["space", "general"]] }));
    const snapshot = JSON.stringify(input);
    buildIndexedEvents([input]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("buildIndexedThreads", () => {
  it("5. rolls up reply count and last reply time", () => {
    const root = event({ id: ROOT, created_at: 1000 });
    const reply = event({
      id: REPLY,
      created_at: 2000,
      tags: [["e", ROOT, "", "reply"]],
    });
    const result = buildThreads([ingested(root), ingested(reply)]);
    const [thread] = buildIndexedThreads(result);
    expect(thread!.rootId).toBe(ROOT);
    expect(thread!.replyCount).toBe(1);
    expect(thread!.lastReplyAt).toBe(2000);
  });

  it("a root with no replies has count 0 and no lastReplyAt", () => {
    const result = buildThreads([ingested(event({ id: ROOT }))]);
    const [thread] = buildIndexedThreads(result);
    expect(thread!.replyCount).toBe(0);
    expect(thread).not.toHaveProperty("lastReplyAt");
  });
});

describe("buildIndexedSpaceRefs", () => {
  it("6. builds (space, event) refs only for known spaces", () => {
    const inSpace = event({ id: ROOT, tags: [["space", "general"]] });
    const unknownSpace = event({ id: REPLY, tags: [["space", "ghost"]] });
    const refs = buildIndexedSpaceRefs(
      [ingested(inSpace), ingested(unknownSpace)],
      [community({ id: "general" })],
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      spaceId: "general",
      eventId: ROOT,
      pubkey: "b".repeat(64),
    });
  });

  it("does not mutate inputs", () => {
    const input = ingested(event({ tags: [["space", "general"]] }));
    const snapshot = JSON.stringify(input);
    buildIndexedSpaceRefs([input], [community()]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

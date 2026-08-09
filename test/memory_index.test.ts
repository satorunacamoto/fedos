import { describe, it, expect } from "vitest";
import { InMemoryMetadataIndex } from "../src/os/_legacy_prototype/indexer/memory_index.js";
import type { IndexedEvent } from "../src/os/_legacy_prototype/indexer/types.js";

function idxEvent(overrides: Partial<IndexedEvent> = {}): IndexedEvent {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    kind: 1,
    created_at: 1700000000,
    contentPreview: "hello",
    spaceIds: [],
    ingestedAt: 1700000001000,
    ...overrides,
  };
}

describe("InMemoryMetadataIndex", () => {
  it("1. put then get an event", async () => {
    const index = new InMemoryMetadataIndex();
    const e = idxEvent({ id: "1".repeat(64) });
    await index.putEvents([e]);
    expect(await index.getEvent("1".repeat(64))).toEqual(e);
    expect(await index.getEvent("missing")).toBeNull();
  });

  it("2. upserts an event by id (latest write wins)", async () => {
    const index = new InMemoryMetadataIndex();
    const id = "1".repeat(64);
    await index.putEvents([idxEvent({ id, contentPreview: "v1" })]);
    await index.putEvents([idxEvent({ id, contentPreview: "v2" })]);
    const got = await index.getEvent(id);
    expect(got!.contentPreview).toBe("v2");
    const all = await index.queryEvents({});
    expect(all.total).toBe(1);
  });

  it("3. queries by author", async () => {
    const index = new InMemoryMetadataIndex();
    await index.putEvents([
      idxEvent({ id: "1".repeat(64), pubkey: "a".repeat(64) }),
      idxEvent({ id: "2".repeat(64), pubkey: "c".repeat(64) }),
    ]);
    const res = await index.queryEvents({ author: "a".repeat(64) });
    expect(res.total).toBe(1);
    expect(res.rows[0]!.id).toBe("1".repeat(64));
  });

  it("4. queries by spaceId", async () => {
    const index = new InMemoryMetadataIndex();
    await index.putEvents([
      idxEvent({ id: "1".repeat(64), spaceIds: ["general"] }),
      idxEvent({ id: "2".repeat(64), spaceIds: ["lounge"] }),
    ]);
    const res = await index.queryEvents({ spaceId: "general" });
    expect(res.total).toBe(1);
    expect(res.rows[0]!.id).toBe("1".repeat(64));
  });

  it("5. filters by since/until", async () => {
    const index = new InMemoryMetadataIndex();
    await index.putEvents([
      idxEvent({ id: "1".repeat(64), created_at: 1000 }),
      idxEvent({ id: "2".repeat(64), created_at: 2000 }),
      idxEvent({ id: "3".repeat(64), created_at: 3000 }),
    ]);
    const res = await index.queryEvents({ since: 1500, until: 2500 });
    expect(res.total).toBe(1);
    expect(res.rows[0]!.created_at).toBe(2000);
  });

  it("6. paginates with limit/offset and reports total", async () => {
    const index = new InMemoryMetadataIndex();
    // created_at descending order => newest first.
    await index.putEvents([
      idxEvent({ id: "1".repeat(64), created_at: 1000 }),
      idxEvent({ id: "2".repeat(64), created_at: 2000 }),
      idxEvent({ id: "3".repeat(64), created_at: 3000 }),
    ]);
    const page = await index.queryEvents({ limit: 1, offset: 1 });
    expect(page.total).toBe(3);
    expect(page.limit).toBe(1);
    expect(page.offset).toBe(1);
    // newest (3000) is index 0, so offset 1 => created_at 2000.
    expect(page.rows[0]!.created_at).toBe(2000);
  });

  it("7. deletes an event", async () => {
    const index = new InMemoryMetadataIndex();
    const id = "1".repeat(64);
    await index.putEvents([idxEvent({ id })]);
    await index.deleteEvent(id);
    expect(await index.getEvent(id)).toBeNull();
    expect((await index.queryEvents({})).total).toBe(0);
  });

  it("queries threads by space and author", async () => {
    const index = new InMemoryMetadataIndex();
    await index.putThreads([
      {
        rootId: "1".repeat(64),
        rootPubkey: "a".repeat(64),
        rootCreatedAt: 1000,
        replyCount: 2,
        spaceIds: ["general"],
      },
      {
        rootId: "2".repeat(64),
        rootPubkey: "c".repeat(64),
        rootCreatedAt: 2000,
        replyCount: 0,
        spaceIds: ["lounge"],
      },
    ]);
    expect((await index.queryThreads({ spaceId: "general" })).total).toBe(1);
    expect((await index.queryThreads({ author: "c".repeat(64) })).rows[0]!.rootId).toBe(
      "2".repeat(64),
    );
  });
});

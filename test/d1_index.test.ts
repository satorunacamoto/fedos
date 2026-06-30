import { describe, it, expect } from "vitest";
import {
  D1MetadataIndex,
  type D1LikeDatabase,
  type D1LikePreparedStatement,
} from "../src/indexer/d1_index.js";
import type { IndexedEvent } from "../src/indexer/types.js";

interface Recorded {
  sql: string;
  binds: unknown[];
}

class MockStatement implements D1LikePreparedStatement {
  binds: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly db: MockD1,
  ) {}
  bind(...values: unknown[]): D1LikePreparedStatement {
    this.binds = values;
    return this;
  }
  run(): Promise<unknown> {
    this.db.runs.push({ sql: this.sql, binds: this.binds });
    return Promise.resolve({});
  }
  all<T = unknown>(): Promise<{ results?: T[] }> {
    this.db.queries.push({ sql: this.sql, binds: this.binds });
    return Promise.resolve({ results: this.db.nextAll as T[] });
  }
  first<T = unknown>(): Promise<T | null> {
    this.db.queries.push({ sql: this.sql, binds: this.binds });
    if (/COUNT/.test(this.sql)) return Promise.resolve({ n: this.db.nextCount } as T);
    return Promise.resolve((this.db.nextFirst as T) ?? null);
  }
}

class MockD1 implements D1LikeDatabase {
  runs: Recorded[] = [];
  queries: Recorded[] = [];
  batched: Recorded[] = [];
  nextAll: unknown[] = [];
  nextFirst: unknown = null;
  nextCount = 0;

  prepare(sql: string): D1LikePreparedStatement {
    return new MockStatement(sql, this);
  }
  batch(statements: D1LikePreparedStatement[]): Promise<unknown[]> {
    for (const s of statements as MockStatement[]) {
      this.batched.push({ sql: s.sql, binds: s.binds });
    }
    return Promise.resolve([]);
  }

  /** All SQL text ever prepared (for injection assertions). */
  allSql(): string {
    return [...this.runs, ...this.queries, ...this.batched]
      .map((r) => r.sql)
      .join("\n");
  }
  /** All bound values ever passed. */
  allBinds(): unknown[] {
    return [...this.runs, ...this.queries, ...this.batched].flatMap((r) => r.binds);
  }
}

function idxEvent(overrides: Partial<IndexedEvent> = {}): IndexedEvent {
  return {
    id: "a".repeat(64),
    pubkey: "b".repeat(64),
    kind: 1,
    created_at: 1700000000,
    contentPreview: "hello",
    spaceIds: ["general"],
    ingestedAt: 1700000001000,
    ...overrides,
  };
}

describe("D1MetadataIndex", () => {
  it("1. putEvents uses a prepared upsert with bound values", async () => {
    const db = new MockD1();
    await new D1MetadataIndex(db).putEvents([idxEvent({ id: "1".repeat(64) })]);
    expect(db.batched).toHaveLength(1);
    const stmt = db.batched[0]!;
    expect(stmt.sql).toContain("INSERT INTO nostr_events_index");
    expect(stmt.sql).toContain("ON CONFLICT(id)");
    expect(stmt.sql).toContain("?");
    // space_ids is stored as a JSON string, not raw event data.
    expect(stmt.binds).toContain("1".repeat(64));
    expect(stmt.binds).toContain(JSON.stringify(["general"]));
  });

  it("2. putThreads uses a prepared upsert with bound values", async () => {
    const db = new MockD1();
    await new D1MetadataIndex(db).putThreads([
      {
        rootId: "1".repeat(64),
        rootPubkey: "b".repeat(64),
        rootCreatedAt: 1000,
        replyCount: 3,
        spaceIds: ["general"],
      },
    ]);
    const stmt = db.batched[0]!;
    expect(stmt.sql).toContain("INSERT INTO nostr_threads_index");
    expect(stmt.sql).toContain("?");
    expect(stmt.binds).toContain("1".repeat(64));
    expect(stmt.binds).toContain(3);
  });

  it("3. putSpaceRefs uses a prepared upsert with bound values", async () => {
    const db = new MockD1();
    await new D1MetadataIndex(db).putSpaceRefs([
      {
        spaceId: "general",
        eventId: "1".repeat(64),
        created_at: 1000,
        pubkey: "b".repeat(64),
      },
    ]);
    const stmt = db.batched[0]!;
    expect(stmt.sql).toContain("INSERT INTO nostr_space_refs");
    expect(stmt.sql).toContain("?");
    expect(stmt.binds).toContain("general");
    expect(stmt.binds).toContain("1".repeat(64));
  });

  it("4. getEvent maps a row back to an IndexedEvent", async () => {
    const db = new MockD1();
    db.nextFirst = {
      id: "1".repeat(64),
      pubkey: "b".repeat(64),
      kind: 1,
      created_at: 1700000000,
      content_preview: "hi",
      reply_to: null,
      root_id: "r".repeat(64),
      space_ids: JSON.stringify(["general", "lounge"]),
      relay_url: "wss://relay.test",
      ingested_at: 1700000001000,
    };
    const got = await new D1MetadataIndex(db).getEvent("1".repeat(64));
    expect(got).toEqual({
      id: "1".repeat(64),
      pubkey: "b".repeat(64),
      kind: 1,
      created_at: 1700000000,
      contentPreview: "hi",
      rootId: "r".repeat(64),
      spaceIds: ["general", "lounge"],
      relayUrl: "wss://relay.test",
      ingestedAt: 1700000001000,
    });
    // reply_to was null -> omitted.
    expect(got).not.toHaveProperty("replyTo");
    // The id was bound, not interpolated.
    expect(db.queries[0]!.binds).toEqual(["1".repeat(64)]);
  });

  it("5. queryEvents by author + space joins refs and binds all values", async () => {
    const db = new MockD1();
    db.nextCount = 1;
    db.nextAll = [
      {
        id: "1".repeat(64),
        pubkey: "b".repeat(64),
        kind: 1,
        created_at: 1700000000,
        content_preview: "hi",
        reply_to: null,
        root_id: null,
        space_ids: "[]",
        relay_url: null,
        ingested_at: 1000,
      },
    ];
    const res = await new D1MetadataIndex(db).queryEvents({
      author: "b".repeat(64),
      spaceId: "general",
      limit: 10,
      offset: 5,
    });
    expect(res.total).toBe(1);
    expect(res.rows[0]!.id).toBe("1".repeat(64));
    expect(res.limit).toBe(10);
    expect(res.offset).toBe(5);

    const listQuery = db.queries.find((q) => q.sql.includes("LIMIT"))!;
    expect(listQuery.sql).toContain("JOIN nostr_space_refs");
    expect(listQuery.sql).toContain("WHERE");
    // binds: spaceId, author, limit, offset.
    expect(listQuery.binds).toEqual(["general", "b".repeat(64), 10, 5]);
  });

  it("6. queryThreads by space joins refs on root_id", async () => {
    const db = new MockD1();
    db.nextCount = 1;
    db.nextAll = [
      {
        root_id: "1".repeat(64),
        root_pubkey: "b".repeat(64),
        root_created_at: 1000,
        reply_count: 2,
        last_reply_at: 2000,
        space_ids: JSON.stringify(["general"]),
      },
    ];
    const res = await new D1MetadataIndex(db).queryThreads({ spaceId: "general" });
    expect(res.total).toBe(1);
    expect(res.rows[0]!.rootId).toBe("1".repeat(64));
    expect(res.rows[0]!.lastReplyAt).toBe(2000);
    const listQuery = db.queries.find((q) => q.sql.includes("LIMIT"))!;
    expect(listQuery.sql).toContain("JOIN nostr_space_refs r ON r.root_id = t.root_id");
  });

  it("7. deleteEvent runs a prepared DELETE bound by id", async () => {
    const db = new MockD1();
    await new D1MetadataIndex(db).deleteEvent("1".repeat(64));
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0]!.sql).toContain("DELETE FROM nostr_events_index");
    expect(db.runs[0]!.sql).toContain("?");
    expect(db.runs[0]!.binds).toEqual(["1".repeat(64)]);
  });

  it("8. never interpolates a malicious query value into SQL text", async () => {
    const db = new MockD1();
    const evil = "x'; DROP TABLE nostr_events_index;--";
    await new D1MetadataIndex(db).queryEvents({ author: evil, spaceId: evil });
    // The malicious string must appear ONLY in bound params, never in SQL.
    expect(db.allSql()).not.toContain("DROP TABLE");
    expect(db.allBinds()).toContain(evil);
  });
});

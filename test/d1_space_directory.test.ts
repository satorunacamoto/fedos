import { describe, it, expect } from "vitest";
import {
  D1SpaceDirectory,
  rowsToSpace,
  spaceToRows,
  type SpaceMemberRow,
  type SpaceRow,
} from "../src/os/_legacy_prototype/community/d1_directory.js";
import type {
  D1LikeDatabase,
  D1LikePreparedStatement,
} from "../src/os/_legacy_prototype/indexer/d1_index.js";
import type {
  ChannelSpace,
  CommunitySpace,
  GroupSpace,
  Space,
} from "../src/os/_legacy_prototype/community/types.js";

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
    return Promise.resolve({ results: this.db.nextAllFor(this.sql) as T[] });
  }
  first<T = unknown>(): Promise<T | null> {
    this.db.queries.push({ sql: this.sql, binds: this.binds });
    return Promise.resolve((this.db.nextFirst as T) ?? null);
  }
}

class MockD1 implements D1LikeDatabase {
  runs: Recorded[] = [];
  queries: Recorded[] = [];
  batched: Recorded[] = [];
  nextFirst: unknown = null;
  /** `all()` results keyed by a substring of the SQL. */
  allBySql: { match: string; rows: unknown[] }[] = [];

  prepare(sql: string): D1LikePreparedStatement {
    return new MockStatement(sql, this);
  }
  batch(statements: D1LikePreparedStatement[]): Promise<unknown[]> {
    for (const s of statements as MockStatement[]) {
      this.batched.push({ sql: s.sql, binds: s.binds });
    }
    return Promise.resolve([]);
  }

  nextAllFor(sql: string): unknown[] {
    const hit = this.allBySql.find((e) => sql.includes(e.match));
    return hit ? hit.rows : [];
  }

  /** All SQL text ever seen (for injection assertions). */
  allSql(): string {
    return [...this.runs, ...this.queries, ...this.batched].map((r) => r.sql).join("\n");
  }
  /** All bound values ever passed. */
  allBinds(): unknown[] {
    return [...this.runs, ...this.queries, ...this.batched].flatMap((r) => r.binds);
  }
}

const OWNER = "a".repeat(64);
const ADMIN = "b".repeat(64);
const MEMBER = "c".repeat(64);

function community(): CommunitySpace {
  return {
    id: "general",
    type: "community",
    name: "General",
    description: "Public board.",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [MEMBER],
  };
}

describe("spaceToRows", () => {
  it("1. maps base fields", () => {
    const { space } = spaceToRows(community(), 1234);
    expect(space).toEqual<SpaceRow>({
      id: "general",
      type: "community",
      name: "General",
      description: "Public board.",
      visibility: "public",
      membership_policy: "open",
      post_policy: "open",
      created_at: 1234,
      updated_at: 1234,
    });
  });

  it("maps a missing description to null", () => {
    const space: GroupSpace = { ...community(), type: "group", description: undefined };
    expect(spaceToRows(space, 1).space.description).toBeNull();
  });

  it("2. maps members with the highest role per pubkey", () => {
    // OWNER also listed under members + admins -> must collapse to "owner".
    const space: CommunitySpace = {
      ...community(),
      owners: [OWNER],
      admins: [OWNER, ADMIN],
      moderators: [],
      members: [OWNER, ADMIN, MEMBER],
    };
    const { members } = spaceToRows(space, 1);
    const byPubkey = new Map(members.map((m) => [m.pubkey, m.role]));
    expect(members).toHaveLength(3);
    expect(byPubkey.get(OWNER)).toBe("owner");
    expect(byPubkey.get(ADMIN)).toBe("admin");
    expect(byPubkey.get(MEMBER)).toBe("member");
  });

  it("12. does not mutate the input space", () => {
    const space = community();
    const snapshot = JSON.stringify(space);
    spaceToRows(space, 1);
    expect(JSON.stringify(space)).toBe(snapshot);
  });
});

describe("rowsToSpace", () => {
  function spaceRow(overrides: Partial<SpaceRow> = {}): SpaceRow {
    return {
      id: "general",
      type: "community",
      name: "General",
      description: "Public board.",
      visibility: "public",
      membership_policy: "open",
      post_policy: "open",
      created_at: 1,
      updated_at: 1,
      ...overrides,
    };
  }

  it("3. restores a community with its members by role", () => {
    const members: SpaceMemberRow[] = [
      { space_id: "general", pubkey: OWNER, role: "owner" },
      { space_id: "general", pubkey: MEMBER, role: "member" },
    ];
    const space = rowsToSpace(spaceRow(), members) as CommunitySpace;
    expect(space.type).toBe("community");
    expect(space.owners).toEqual([OWNER]);
    expect(space.members).toEqual([MEMBER]);
    expect(space.admins).toEqual([]);
    expect(space.description).toBe("Public board.");
  });

  it("4. restores channel and group types", () => {
    const channel = rowsToSpace(
      spaceRow({ id: "ann", type: "channel", post_policy: "admins" }),
      [{ space_id: "ann", pubkey: ADMIN, role: "admin" }],
    ) as ChannelSpace;
    expect(channel.type).toBe("channel");
    expect(channel.admins).toEqual([ADMIN]);

    const group = rowsToSpace(
      spaceRow({ id: "lounge", type: "group", visibility: "private", post_policy: "members" }),
      [{ space_id: "lounge", pubkey: MEMBER, role: "member" }],
    ) as GroupSpace;
    expect(group.type).toBe("group");
    expect(group.visibility).toBe("private");
    expect(group.members).toEqual([MEMBER]);
  });

  it("omits description when the column is null", () => {
    const space = rowsToSpace(spaceRow({ description: null }), []);
    expect(space).not.toHaveProperty("description");
  });

  it("5. ignores member rows with an invalid role (incl. guest)", () => {
    const members: SpaceMemberRow[] = [
      { space_id: "general", pubkey: OWNER, role: "owner" },
      { space_id: "general", pubkey: ADMIN, role: "guest" }, // not stored
      { space_id: "general", pubkey: MEMBER, role: "superuser" }, // unknown
    ];
    const space = rowsToSpace(spaceRow(), members);
    expect(space.owners).toEqual([OWNER]);
    expect(space.admins).toEqual([]);
    expect(space.moderators).toEqual([]);
    expect(space.members).toEqual([]);
  });

  it("throws on an invalid space-level enum rather than defaulting", () => {
    expect(() => rowsToSpace(spaceRow({ visibility: "secret" }), [])).toThrow(/visibility/);
    expect(() => rowsToSpace(spaceRow({ type: "forum" }), [])).toThrow(/space type/);
    expect(() => rowsToSpace(spaceRow({ post_policy: "anyone" }), [])).toThrow(/post policy/);
  });

  it("does not mutate the input member rows", () => {
    const members: SpaceMemberRow[] = [{ space_id: "general", pubkey: OWNER, role: "owner" }];
    const snapshot = JSON.stringify(members);
    rowsToSpace(spaceRow(), members);
    expect(JSON.stringify(members)).toBe(snapshot);
  });
});

describe("D1SpaceDirectory", () => {
  it("6. list() uses prepared statements and joins members per space", async () => {
    const db = new MockD1();
    db.allBySql = [
      {
        match: "FROM nostr_spaces",
        rows: [
          {
            id: "general",
            type: "community",
            name: "General",
            description: null,
            visibility: "public",
            membership_policy: "open",
            post_policy: "open",
            created_at: 1,
            updated_at: 1,
          } satisfies SpaceRow,
        ],
      },
      {
        match: "FROM nostr_space_members",
        rows: [{ space_id: "general", pubkey: OWNER, role: "owner" }] satisfies SpaceMemberRow[],
      },
    ];
    const spaces = await new D1SpaceDirectory({ db }).list();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.owners).toEqual([OWNER]);
    expect(db.allSql()).toContain("SELECT");
    expect(db.allSql()).toContain("FROM nostr_spaces");
    expect(db.allSql()).not.toContain(";--");
  });

  it("7. get() binds the id and returns undefined when absent", async () => {
    const db = new MockD1();
    db.nextFirst = null;
    const got = await new D1SpaceDirectory({ db }).get("general");
    expect(got).toBeUndefined();
    const spaceQuery = db.queries.find((q) => q.sql.includes("FROM nostr_spaces"))!;
    expect(spaceQuery.sql).toContain("WHERE id = ?");
    expect(spaceQuery.binds).toEqual(["general"]);
  });

  it("get() returns the space with its member rows", async () => {
    const db = new MockD1();
    db.nextFirst = {
      id: "general",
      type: "community",
      name: "General",
      description: null,
      visibility: "public",
      membership_policy: "open",
      post_policy: "open",
      created_at: 1,
      updated_at: 1,
    } satisfies SpaceRow;
    db.allBySql = [
      {
        match: "FROM nostr_space_members",
        rows: [{ space_id: "general", pubkey: OWNER, role: "owner" }] satisfies SpaceMemberRow[],
      },
    ];
    const got = await new D1SpaceDirectory({ db }).get("general");
    expect(got?.owners).toEqual([OWNER]);
  });

  it("8. put() upserts the space and replaces members in one batch", async () => {
    const db = new MockD1();
    await new D1SpaceDirectory({ db, now: () => 777 }).put(community());
    const sql = db.batched.map((b) => b.sql).join("\n");
    expect(sql).toContain("INSERT INTO nostr_spaces");
    expect(sql).toContain("ON CONFLICT(id)");
    expect(sql).toContain("DELETE FROM nostr_space_members WHERE space_id = ?");
    expect(sql).toContain("INSERT INTO nostr_space_members");
    // No literal values in SQL; everything bound. created_at is the injected clock.
    const allBinds = db.batched.flatMap((b) => b.binds);
    expect(allBinds).toContain(777);
    expect(allBinds).toContain("general");
    expect(allBinds).toContain(OWNER);
  });

  it("9. delete() removes members and the space, both bound by id", async () => {
    const db = new MockD1();
    await new D1SpaceDirectory({ db }).delete("general");
    expect(db.batched).toHaveLength(2);
    expect(db.batched[0]!.sql).toContain("DELETE FROM nostr_space_members WHERE space_id = ?");
    expect(db.batched[0]!.binds).toEqual(["general"]);
    expect(db.batched[1]!.sql).toContain("DELETE FROM nostr_spaces WHERE id = ?");
    expect(db.batched[1]!.binds).toEqual(["general"]);
  });

  it("10. listByMember() binds the pubkey and resolves each space", async () => {
    const db = new MockD1();
    db.allBySql = [
      {
        match: "FROM nostr_space_members WHERE pubkey = ?",
        rows: [{ space_id: "general" }],
      },
      {
        match: "FROM nostr_space_members WHERE space_id = ?",
        rows: [{ space_id: "general", pubkey: MEMBER, role: "member" }] satisfies SpaceMemberRow[],
      },
    ];
    db.nextFirst = {
      id: "general",
      type: "community",
      name: "General",
      description: null,
      visibility: "public",
      membership_policy: "open",
      post_policy: "open",
      created_at: 1,
      updated_at: 1,
    } satisfies SpaceRow;
    const spaces = await new D1SpaceDirectory({ db }).listByMember(MEMBER);
    expect(spaces).toHaveLength(1);
    expect(spaces[0]!.id).toBe("general");
    const memberQuery = db.queries.find((q) => q.sql.includes("WHERE pubkey = ?"))!;
    expect(memberQuery.binds).toEqual([MEMBER]);
  });

  it("11. a SQL-injection id stays a bound value, never SQL text", async () => {
    const db = new MockD1();
    const evil = "x'; DROP TABLE nostr_spaces;--";
    const dir = new D1SpaceDirectory({ db });
    await dir.get(evil);
    await dir.delete(evil);
    await dir.put({ ...community(), id: evil });
    expect(db.allSql()).not.toContain("DROP TABLE");
    expect(db.allBinds()).toContain(evil);
  });
});

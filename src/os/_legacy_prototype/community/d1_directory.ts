/**
 * Stage 15 — Cloudflare D1 implementation of the space directory.
 *
 * Persists the Stage 9/11 space model: Community/Channel/Group DEFINITIONS and
 * their (pubkey, role) membership rows. D1 is used HERE ONLY as the storage
 * location for space definitions — it is NOT an authoritative permission oracle
 * and NOT an audit log. `canPost`/`canRead` decisions stay in the pure Stage 9
 * policy layer (`policy.ts`); a stored row records what a space looks like, not
 * who is allowed to do what.
 *
 * Persistence rules:
 * - Only the four assignable roles (owner/admin/moderator/member) are stored;
 *   "guest" is the absence of a row and is never written.
 * - A pubkey that appears under several allowlists is normalized to its highest
 *   role before writing (via `listMemberships`), matching the table's
 *   (space_id, pubkey) primary key.
 * - `rowsToSpace` ignores member rows with an unknown role and rejects rows
 *   whose space-level enums (type/visibility/membership/post policy) are invalid.
 * - Mappers never mutate their inputs.
 *
 * All access uses prepared-statement BINDINGS (`?` placeholders); no user input
 * is ever interpolated into SQL text. Schema: `schema/d1_space_directory.sql`.
 */

import { listMemberships } from "./policy.js";
import type { AsyncSpaceDirectory } from "./directory.js";
import type {
  MembershipPolicy,
  PostPolicy,
  Space,
  SpaceBase,
  SpaceRole,
  SpaceType,
  SpaceVisibility,
} from "./types.js";
import type {
  D1LikeDatabase,
  D1LikePreparedStatement,
} from "../indexer/d1_index.js";

/** Raw `nostr_spaces` row (snake_case columns). */
export interface SpaceRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  visibility: string;
  membership_policy: string;
  post_policy: string;
  created_at: number;
  updated_at: number;
}

/** Raw `nostr_space_members` row. */
export interface SpaceMemberRow {
  space_id: string;
  pubkey: string;
  role: string;
}

/** Construction options for `D1SpaceDirectory`. */
export interface D1SpaceDirectoryOptions {
  readonly db: D1LikeDatabase;
  /** Clock for created_at/updated_at (unix ms). Defaults to `Date.now`. */
  readonly now?: () => number;
}

const SPACE_TYPES: ReadonlySet<SpaceType> = new Set(["community", "channel", "group"]);
const VISIBILITIES: ReadonlySet<SpaceVisibility> = new Set(["public", "unlisted", "private"]);
const MEMBERSHIP_POLICIES: ReadonlySet<MembershipPolicy> = new Set([
  "open",
  "approval",
  "invite_only",
]);
const POST_POLICIES: ReadonlySet<PostPolicy> = new Set([
  "open",
  "members",
  "moderators",
  "admins",
  "owner_only",
]);
/** Roles that are persisted. "guest" is intentionally absent. */
const STORED_ROLES: ReadonlySet<SpaceRole> = new Set(["owner", "admin", "moderator", "member"]);

const SPACE_COLUMNS =
  "id, type, name, description, visibility, membership_policy, post_policy, created_at, updated_at";

const SPACE_UPSERT = `INSERT INTO nostr_spaces (${SPACE_COLUMNS})
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  type=excluded.type, name=excluded.name, description=excluded.description,
  visibility=excluded.visibility, membership_policy=excluded.membership_policy,
  post_policy=excluded.post_policy, updated_at=excluded.updated_at`;

const MEMBER_UPSERT = `INSERT INTO nostr_space_members (space_id, pubkey, role)
VALUES (?, ?, ?)
ON CONFLICT(space_id, pubkey) DO UPDATE SET role=excluded.role`;

/** Asserts a string is one of the allowed enum members, or throws. */
function requireEnum<T extends string>(value: string, allowed: ReadonlySet<T>, label: string): T {
  if (!allowed.has(value as T)) {
    throw new Error(`invalid ${label}: ${JSON.stringify(value)}`);
  }
  return value as T;
}

/**
 * Maps a `Space` to its storage rows. Members come from `listMemberships`, which
 * dedupes a pubkey to its highest role and never emits "guest". Does not mutate
 * the input. `now` (unix ms) fills both created_at and updated_at; on update the
 * upsert keeps the original created_at.
 */
export function spaceToRows(
  space: Space,
  now: number = Date.now(),
): { space: SpaceRow; members: SpaceMemberRow[] } {
  const members = listMemberships(space).map((m) => ({
    space_id: space.id,
    pubkey: m.pubkey,
    role: m.role,
  }));
  const row: SpaceRow = {
    id: space.id,
    type: space.type,
    name: space.name,
    description: space.description ?? null,
    visibility: space.visibility,
    membership_policy: space.membershipPolicy,
    post_policy: space.postPolicy,
    created_at: now,
    updated_at: now,
  };
  return { space: row, members };
}

/**
 * Reconstructs a `Space` from its rows. Member rows with an unknown role are
 * ignored; duplicate pubkeys collapse to the first seen (the PK forbids them in
 * a real table). Throws if a space-level enum is invalid rather than silently
 * defaulting. Does not mutate the inputs.
 */
export function rowsToSpace(
  spaceRow: SpaceRow,
  memberRows: readonly SpaceMemberRow[],
): Space {
  const type = requireEnum(spaceRow.type, SPACE_TYPES, "space type");
  const visibility = requireEnum(spaceRow.visibility, VISIBILITIES, "visibility");
  const membershipPolicy = requireEnum(
    spaceRow.membership_policy,
    MEMBERSHIP_POLICIES,
    "membership policy",
  );
  const postPolicy = requireEnum(spaceRow.post_policy, POST_POLICIES, "post policy");

  const owners: string[] = [];
  const admins: string[] = [];
  const moderators: string[] = [];
  const members: string[] = [];
  const seen = new Set<string>();
  for (const m of memberRows) {
    if (m.space_id !== spaceRow.id) continue;
    if (!STORED_ROLES.has(m.role as SpaceRole)) continue; // ignore invalid role
    if (seen.has(m.pubkey)) continue;
    seen.add(m.pubkey);
    switch (m.role as SpaceRole) {
      case "owner":
        owners.push(m.pubkey);
        break;
      case "admin":
        admins.push(m.pubkey);
        break;
      case "moderator":
        moderators.push(m.pubkey);
        break;
      case "member":
        members.push(m.pubkey);
        break;
    }
  }

  const base: SpaceBase = {
    id: spaceRow.id,
    type,
    name: spaceRow.name,
    ...(spaceRow.description !== null ? { description: spaceRow.description } : {}),
    visibility,
    membershipPolicy,
    postPolicy,
    owners,
    admins,
    moderators,
    members,
  };
  return base as Space;
}

/** Groups member rows by their `space_id`, preserving order. */
function groupBySpace(rows: readonly SpaceMemberRow[]): Map<string, SpaceMemberRow[]> {
  const map = new Map<string, SpaceMemberRow[]>();
  for (const r of rows) {
    const list = map.get(r.space_id);
    if (list) list.push(r);
    else map.set(r.space_id, [r]);
  }
  return map;
}

/**
 * D1-backed space directory. Reads/writes space definitions and membership rows
 * through prepared statements. This is a storage adapter, not an access-control
 * system — permission checks remain the job of the pure policy layer.
 */
export class D1SpaceDirectory implements AsyncSpaceDirectory {
  readonly #db: D1LikeDatabase;
  readonly #now: () => number;

  constructor(options: D1SpaceDirectoryOptions) {
    this.#db = options.db;
    this.#now = options.now ?? (() => Date.now());
  }

  async list(): Promise<readonly Space[]> {
    const spaceRes = await this.#db
      .prepare(`SELECT ${SPACE_COLUMNS} FROM nostr_spaces ORDER BY created_at ASC, id ASC`)
      .all<SpaceRow>();
    const spaceRows = spaceRes.results ?? [];
    if (spaceRows.length === 0) return [];

    const memberRes = await this.#db
      .prepare("SELECT space_id, pubkey, role FROM nostr_space_members")
      .all<SpaceMemberRow>();
    const bySpace = groupBySpace(memberRes.results ?? []);

    return spaceRows.map((row) => rowsToSpace(row, bySpace.get(row.id) ?? []));
  }

  async get(id: string): Promise<Space | undefined> {
    const row = await this.#db
      .prepare(`SELECT ${SPACE_COLUMNS} FROM nostr_spaces WHERE id = ?`)
      .bind(id)
      .first<SpaceRow>();
    if (!row) return undefined;

    const memberRes = await this.#db
      .prepare("SELECT space_id, pubkey, role FROM nostr_space_members WHERE space_id = ?")
      .bind(id)
      .all<SpaceMemberRow>();
    return rowsToSpace(row, memberRes.results ?? []);
  }

  /**
   * Upserts the space and replaces its membership rows in one batch: stale
   * members are deleted first, then the normalized set is (re)inserted.
   */
  async put(space: Space): Promise<void> {
    const { space: row, members } = spaceToRows(space, this.#now());
    const stmts: D1LikePreparedStatement[] = [
      this.#db
        .prepare(SPACE_UPSERT)
        .bind(
          row.id,
          row.type,
          row.name,
          row.description,
          row.visibility,
          row.membership_policy,
          row.post_policy,
          row.created_at,
          row.updated_at,
        ),
      this.#db.prepare("DELETE FROM nostr_space_members WHERE space_id = ?").bind(row.id),
    ];
    for (const m of members) {
      stmts.push(this.#db.prepare(MEMBER_UPSERT).bind(m.space_id, m.pubkey, m.role));
    }
    await this.#db.batch(stmts);
  }

  /** Deletes a space and all of its membership rows. */
  async delete(id: string): Promise<void> {
    await this.#db.batch([
      this.#db.prepare("DELETE FROM nostr_space_members WHERE space_id = ?").bind(id),
      this.#db.prepare("DELETE FROM nostr_spaces WHERE id = ?").bind(id),
    ]);
  }

  /** Spaces in which the given pubkey holds any stored role. */
  async listByMember(pubkey: string): Promise<readonly Space[]> {
    const idRes = await this.#db
      .prepare("SELECT DISTINCT space_id FROM nostr_space_members WHERE pubkey = ?")
      .bind(pubkey)
      .all<{ space_id: string }>();
    const ids = (idRes.results ?? []).map((r) => r.space_id);

    const spaces: Space[] = [];
    for (const id of ids) {
      const space = await this.get(id);
      if (space) spaces.push(space);
    }
    return spaces;
  }
}

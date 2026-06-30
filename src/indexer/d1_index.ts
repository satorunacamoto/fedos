/**
 * Stage 14 — Cloudflare D1 implementation of `MetadataIndex`.
 *
 * D1 is used HERE ONLY as a metadata/index store for discovery (search,
 * listing, space navigation). It does NOT store raw event bodies or signatures,
 * and it is NOT an audit log or an authoritative/durable record — the index can
 * be rebuilt from relays and may lag or be incomplete.
 *
 * All user-supplied query values are passed via prepared-statement BINDINGS
 * (`?` placeholders). No user input is ever interpolated into SQL text; the
 * only dynamic SQL is a whitelist of fixed column predicates.
 *
 * Schema: see `schema/d1_index.sql`.
 */

import { resolvePagination } from "./build.js";
import type {
  IndexQuery,
  IndexQueryResult,
  IndexedEvent,
  IndexedSpaceRef,
  IndexedThread,
  MetadataIndex,
} from "./types.js";

/** Minimal subset of the D1 prepared-statement surface this adapter uses. */
export interface D1LikePreparedStatement {
  bind(...values: unknown[]): D1LikePreparedStatement;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

/** Minimal subset of the D1 database surface. A real `D1Database` satisfies it. */
export interface D1LikeDatabase {
  prepare(sql: string): D1LikePreparedStatement;
  batch(statements: D1LikePreparedStatement[]): Promise<unknown[]>;
}

/** Raw row shapes as stored (snake_case columns). */
interface EventRow {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  content_preview: string;
  reply_to: string | null;
  root_id: string | null;
  space_ids: string | null;
  relay_url: string | null;
  ingested_at: number;
}

interface ThreadRow {
  root_id: string;
  root_pubkey: string;
  root_created_at: number;
  reply_count: number;
  last_reply_at: number | null;
  space_ids: string | null;
}

const EVENT_COLUMNS =
  "id, pubkey, kind, created_at, content_preview, reply_to, root_id, space_ids, relay_url, ingested_at";

const EVENT_UPSERT = `INSERT INTO nostr_events_index (${EVENT_COLUMNS})
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  pubkey=excluded.pubkey, kind=excluded.kind, created_at=excluded.created_at,
  content_preview=excluded.content_preview, reply_to=excluded.reply_to,
  root_id=excluded.root_id, space_ids=excluded.space_ids,
  relay_url=excluded.relay_url, ingested_at=excluded.ingested_at`;

const THREAD_UPSERT = `INSERT INTO nostr_threads_index
  (root_id, root_pubkey, root_created_at, reply_count, last_reply_at, space_ids)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(root_id) DO UPDATE SET
  root_pubkey=excluded.root_pubkey, root_created_at=excluded.root_created_at,
  reply_count=excluded.reply_count, last_reply_at=excluded.last_reply_at,
  space_ids=excluded.space_ids`;

const SPACE_REF_UPSERT = `INSERT INTO nostr_space_refs
  (space_id, event_id, root_id, created_at, pubkey)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(space_id, event_id) DO UPDATE SET
  root_id=excluded.root_id, created_at=excluded.created_at, pubkey=excluded.pubkey`;

function parseSpaceIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function mapEventRow(row: EventRow): IndexedEvent {
  return {
    id: row.id,
    pubkey: row.pubkey,
    kind: row.kind,
    created_at: row.created_at,
    contentPreview: row.content_preview,
    ...(row.reply_to !== null ? { replyTo: row.reply_to } : {}),
    ...(row.root_id !== null ? { rootId: row.root_id } : {}),
    spaceIds: parseSpaceIds(row.space_ids),
    ...(row.relay_url !== null ? { relayUrl: row.relay_url } : {}),
    ingestedAt: row.ingested_at,
  };
}

function mapThreadRow(row: ThreadRow): IndexedThread {
  return {
    rootId: row.root_id,
    rootPubkey: row.root_pubkey,
    rootCreatedAt: row.root_created_at,
    replyCount: row.reply_count,
    ...(row.last_reply_at !== null ? { lastReplyAt: row.last_reply_at } : {}),
    spaceIds: parseSpaceIds(row.space_ids),
  };
}

/** A WHERE clause built from a fixed predicate whitelist + bound values. */
interface WhereParts {
  readonly from: string;
  readonly where: string;
  readonly binds: unknown[];
}

export class D1MetadataIndex implements MetadataIndex {
  readonly #db: D1LikeDatabase;

  constructor(db: D1LikeDatabase) {
    this.#db = db;
  }

  async putEvents(events: IndexedEvent[]): Promise<void> {
    if (events.length === 0) return;
    const stmts = events.map((e) =>
      this.#db
        .prepare(EVENT_UPSERT)
        .bind(
          e.id,
          e.pubkey,
          e.kind,
          e.created_at,
          e.contentPreview,
          e.replyTo ?? null,
          e.rootId ?? null,
          JSON.stringify(e.spaceIds),
          e.relayUrl ?? null,
          e.ingestedAt,
        ),
    );
    await this.#db.batch(stmts);
  }

  async putThreads(threads: IndexedThread[]): Promise<void> {
    if (threads.length === 0) return;
    const stmts = threads.map((t) =>
      this.#db
        .prepare(THREAD_UPSERT)
        .bind(
          t.rootId,
          t.rootPubkey,
          t.rootCreatedAt,
          t.replyCount,
          t.lastReplyAt ?? null,
          JSON.stringify(t.spaceIds),
        ),
    );
    await this.#db.batch(stmts);
  }

  async putSpaceRefs(refs: IndexedSpaceRef[]): Promise<void> {
    if (refs.length === 0) return;
    const stmts = refs.map((r) =>
      this.#db
        .prepare(SPACE_REF_UPSERT)
        .bind(r.spaceId, r.eventId, r.rootId ?? null, r.created_at, r.pubkey),
    );
    await this.#db.batch(stmts);
  }

  /** Builds the events FROM/WHERE from a fixed predicate whitelist + binds. */
  #eventWhere(query: IndexQuery): WhereParts {
    const binds: unknown[] = [];
    const where: string[] = [];
    let from = "nostr_events_index e";
    if (query.spaceId !== undefined) {
      from = "nostr_events_index e JOIN nostr_space_refs r ON r.event_id = e.id";
      where.push("r.space_id = ?");
      binds.push(query.spaceId);
    }
    if (query.author !== undefined) {
      where.push("e.pubkey = ?");
      binds.push(query.author);
    }
    if (query.since !== undefined) {
      where.push("e.created_at >= ?");
      binds.push(query.since);
    }
    if (query.until !== undefined) {
      where.push("e.created_at <= ?");
      binds.push(query.until);
    }
    return { from, where: where.length ? ` WHERE ${where.join(" AND ")}` : "", binds };
  }

  async queryEvents(query: IndexQuery): Promise<IndexQueryResult<IndexedEvent>> {
    const { limit, offset } = resolvePagination(query);
    const { from, where, binds } = this.#eventWhere(query);

    const countRow = await this.#db
      .prepare(`SELECT COUNT(*) AS n FROM ${from}${where}`)
      .bind(...binds)
      .first<{ n: number }>();
    const total = countRow?.n ?? 0;

    const res = await this.#db
      .prepare(
        `SELECT ${EVENT_COLUMNS} FROM ${from}${where} ` +
          `ORDER BY e.created_at DESC, e.id ASC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<EventRow>();
    const rows = (res.results ?? []).map(mapEventRow);
    return { rows, total, limit, offset };
  }

  async queryThreads(query: IndexQuery): Promise<IndexQueryResult<IndexedThread>> {
    const { limit, offset } = resolvePagination(query);
    const binds: unknown[] = [];
    const where: string[] = [];
    let from = "nostr_threads_index t";
    if (query.spaceId !== undefined) {
      from = "nostr_threads_index t JOIN nostr_space_refs r ON r.root_id = t.root_id";
      where.push("r.space_id = ?");
      binds.push(query.spaceId);
    }
    if (query.author !== undefined) {
      where.push("t.root_pubkey = ?");
      binds.push(query.author);
    }
    if (query.since !== undefined) {
      where.push("t.root_created_at >= ?");
      binds.push(query.since);
    }
    if (query.until !== undefined) {
      where.push("t.root_created_at <= ?");
      binds.push(query.until);
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

    const countRow = await this.#db
      .prepare(`SELECT COUNT(DISTINCT t.root_id) AS n FROM ${from}${whereSql}`)
      .bind(...binds)
      .first<{ n: number }>();
    const total = countRow?.n ?? 0;

    const res = await this.#db
      .prepare(
        `SELECT DISTINCT t.root_id, t.root_pubkey, t.root_created_at, ` +
          `t.reply_count, t.last_reply_at, t.space_ids FROM ${from}${whereSql} ` +
          `ORDER BY t.root_created_at DESC, t.root_id ASC LIMIT ? OFFSET ?`,
      )
      .bind(...binds, limit, offset)
      .all<ThreadRow>();
    const rows = (res.results ?? []).map(mapThreadRow);
    return { rows, total, limit, offset };
  }

  async getEvent(id: string): Promise<IndexedEvent | null> {
    const row = await this.#db
      .prepare(`SELECT ${EVENT_COLUMNS} FROM nostr_events_index WHERE id = ?`)
      .bind(id)
      .first<EventRow>();
    return row ? mapEventRow(row) : null;
  }

  async deleteEvent(id: string): Promise<void> {
    await this.#db
      .prepare("DELETE FROM nostr_events_index WHERE id = ?")
      .bind(id)
      .run();
  }
}

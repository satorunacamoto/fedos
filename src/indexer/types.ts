/**
 * Stage 14 — lightweight metadata/index boundary (types only).
 *
 * This index is for DISCOVERY: search, listing, and space navigation. It stores
 * small derived records (id, author, a short content preview, reply/root links,
 * space refs) — NOT raw event bodies. It is a convenience index, not an audit
 * log and not a durable/authoritative store: records can be rebuilt from relays
 * and may be stale or incomplete. Signature verification is a separate concern.
 */

/** A compact, searchable projection of one event. No full content/sig. */
export interface IndexedEvent {
  readonly id: string;
  readonly pubkey: string;
  readonly kind: number;
  readonly created_at: number;
  /** Short, truncated preview of the content (see `MAX_CONTENT_PREVIEW`). */
  readonly contentPreview: string;
  /** Direct reply target (NIP-10), when this event is a reply. */
  readonly replyTo?: string;
  /** Thread root (NIP-10), when known. */
  readonly rootId?: string;
  /** Space ids this event references (deduped, may be empty). */
  readonly spaceIds: string[];
  /** Relay the event was seen on, when known. */
  readonly relayUrl?: string;
  /** Unix ms when ingested (carried from the ingest record). */
  readonly ingestedAt: number;
}

/** A compact projection of one thread (root + reply rollups). */
export interface IndexedThread {
  readonly rootId: string;
  readonly rootPubkey: string;
  readonly rootCreatedAt: number;
  /** Number of (recursive) replies under the root. */
  readonly replyCount: number;
  /** created_at of the most recent reply, when there is at least one. */
  readonly lastReplyAt?: number;
  /** Space ids referenced anywhere in the thread (deduped). */
  readonly spaceIds: string[];
}

/** A (space, event) membership row used for space-scoped listing. */
export interface IndexedSpaceRef {
  readonly spaceId: string;
  readonly eventId: string;
  readonly rootId?: string;
  readonly created_at: number;
  readonly pubkey: string;
}

/** Minimal query surface shared by events and threads. */
export interface IndexQuery {
  readonly author?: string;
  readonly spaceId?: string;
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
  readonly offset?: number;
}

/** A page of rows plus the total that matched before pagination. */
export interface IndexQueryResult<T> {
  readonly rows: T[];
  /** Total matches before `limit`/`offset` were applied. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * The index boundary. Implemented in-memory (tests/dev) and over D1
 * (`D1MetadataIndex`). All writes are upserts keyed by id/rootId/(space,event).
 */
export interface MetadataIndex {
  putEvents(events: IndexedEvent[]): Promise<void>;
  putThreads(threads: IndexedThread[]): Promise<void>;
  putSpaceRefs(refs: IndexedSpaceRef[]): Promise<void>;
  queryEvents(query: IndexQuery): Promise<IndexQueryResult<IndexedEvent>>;
  queryThreads(query: IndexQuery): Promise<IndexQueryResult<IndexedThread>>;
  getEvent(id: string): Promise<IndexedEvent | null>;
  deleteEvent(id: string): Promise<void>;
}

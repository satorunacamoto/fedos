-- Stage 14 — D1 metadata/index schema.
--
-- This database is a lightweight DISCOVERY index (search, listing, space
-- navigation). It deliberately stores only small derived metadata, never raw
-- event bodies or signatures. It is NOT an audit log and NOT an authoritative
-- or durable record: rows can be rebuilt from relays and may be stale.
--
-- All application access uses prepared statements with bound parameters; no
-- user input is interpolated into SQL text.

-- Compact, searchable projection of one event (no full content, no sig).
CREATE TABLE IF NOT EXISTS nostr_events_index (
  id              TEXT PRIMARY KEY,           -- event id (hex)
  pubkey          TEXT NOT NULL,              -- author x-only pubkey (hex)
  kind            INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,           -- unix seconds
  content_preview TEXT NOT NULL,              -- truncated preview (<= 280 chars)
  reply_to        TEXT,                       -- NIP-10 direct reply target, nullable
  root_id         TEXT,                       -- NIP-10 thread root, nullable
  space_ids       TEXT,                       -- JSON array of space ids
  relay_url       TEXT,                       -- relay first seen on, nullable
  ingested_at     INTEGER NOT NULL            -- unix ms when ingested
);

CREATE INDEX IF NOT EXISTS idx_events_pubkey     ON nostr_events_index (pubkey);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON nostr_events_index (created_at);
CREATE INDEX IF NOT EXISTS idx_events_root_id    ON nostr_events_index (root_id);

-- Compact projection of one thread (root + reply rollups).
CREATE TABLE IF NOT EXISTS nostr_threads_index (
  root_id         TEXT PRIMARY KEY,
  root_pubkey     TEXT NOT NULL,
  root_created_at INTEGER NOT NULL,
  reply_count     INTEGER NOT NULL DEFAULT 0,
  last_reply_at   INTEGER,                    -- unix seconds, nullable
  space_ids       TEXT                        -- JSON array of space ids
);

CREATE INDEX IF NOT EXISTS idx_threads_pubkey     ON nostr_threads_index (root_pubkey);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON nostr_threads_index (root_created_at);

-- (space, event) membership rows for space-scoped listing.
CREATE TABLE IF NOT EXISTS nostr_space_refs (
  space_id   TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  root_id    TEXT,                            -- thread root, nullable
  created_at INTEGER NOT NULL,                -- unix seconds
  pubkey     TEXT NOT NULL,
  PRIMARY KEY (space_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_space_refs_space    ON nostr_space_refs (space_id, created_at);
CREATE INDEX IF NOT EXISTS idx_space_refs_event    ON nostr_space_refs (event_id);
CREATE INDEX IF NOT EXISTS idx_space_refs_root     ON nostr_space_refs (root_id);

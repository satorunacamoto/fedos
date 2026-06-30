-- Stage 15 — D1 space directory schema.
--
-- Persists the Stage 9/11 space model: Community/Channel/Group definitions and
-- their (pubkey, role) membership rows. This is the storage location for space
-- DEFINITIONS only — it is NOT an authoritative permission oracle and NOT an
-- audit log. canPost/canRead decisions stay in the pure Stage 9 policy layer;
-- a row here just records what a space looks like, not who is allowed to do what.
--
-- Only the four assignable roles (owner/admin/moderator/member) are stored;
-- "guest" is the absence of a row, never persisted. All application access uses
-- prepared statements with bound parameters; no user input is interpolated into
-- SQL text.

-- One row per space definition.
CREATE TABLE IF NOT EXISTS nostr_spaces (
  id                TEXT PRIMARY KEY,           -- space id
  type              TEXT NOT NULL,              -- community | channel | group
  name              TEXT NOT NULL,
  description       TEXT,                       -- nullable
  visibility        TEXT NOT NULL,              -- public | unlisted | private
  membership_policy TEXT NOT NULL,              -- open | approval | invite_only
  post_policy       TEXT NOT NULL,              -- open | members | moderators | admins | owner_only
  created_at        INTEGER NOT NULL,           -- unix ms when first stored
  updated_at        INTEGER NOT NULL            -- unix ms of last write
);

-- One row per (space, pubkey) role assignment. The PK forbids a pubkey holding
-- two roles in the same space; the writer normalizes to the highest role first.
CREATE TABLE IF NOT EXISTS nostr_space_members (
  space_id TEXT NOT NULL,
  pubkey   TEXT NOT NULL,
  role     TEXT NOT NULL,                       -- owner | admin | moderator | member
  PRIMARY KEY (space_id, pubkey)
);

CREATE INDEX IF NOT EXISTS idx_space_members_space  ON nostr_space_members (space_id);
CREATE INDEX IF NOT EXISTS idx_space_members_pubkey ON nostr_space_members (pubkey);

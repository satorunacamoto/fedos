/**
 * Runtime Ownership Extraction Arc — Root Cause D fix (vendored copy).
 *
 * Verbatim vendored copy of `src/os/_legacy_prototype/community/policy.ts`
 * at the time of this fork, paired with `./space_types.ts`. See that file's
 * header for the full rationale.
 *
 * Stage 9 — pure permission policy over spaces.
 *
 * All functions are pure: they read the space's allowlists and settings and
 * return a `SpaceDecision`. They never mutate inputs, hit storage, or verify
 * signatures (the caller is expected to pass already-trusted pubkeys).
 *
 * Posting is governed by the space's explicit `postPolicy`. `membershipPolicy`
 * is descriptive metadata for future join/approval flows and does not affect
 * these read/post/moderate/admin checks.
 */

import type {
  PostPolicy,
  Space,
  SpaceDecision,
  SpaceMembership,
  SpaceRole,
} from "./space_types.js";

const ROLE_RANK: Record<SpaceRole, number> = {
  guest: 0,
  member: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

const POST_POLICY_MIN_RANK: Record<PostPolicy, number> = {
  open: ROLE_RANK.guest,
  members: ROLE_RANK.member,
  moderators: ROLE_RANK.moderator,
  admins: ROLE_RANK.admin,
  owner_only: ROLE_RANK.owner,
};

/** Resolves the actor's highest role in a space (owner > … > member > guest). */
export function getRole(actorPubkey: string, space: Space): SpaceRole {
  if (space.owners.includes(actorPubkey)) return "owner";
  if (space.admins.includes(actorPubkey)) return "admin";
  if (space.moderators.includes(actorPubkey)) return "moderator";
  if (space.members.includes(actorPubkey)) return "member";
  return "guest";
}

/** A normalized list of (pubkey, role), highest role per pubkey. */
export function listMemberships(space: Space): SpaceMembership[] {
  const seen = new Set<string>();
  const out: SpaceMembership[] = [];
  const add = (pubkeys: readonly string[], role: SpaceRole): void => {
    for (const pubkey of pubkeys) {
      if (seen.has(pubkey)) continue;
      seen.add(pubkey);
      out.push({ pubkey, role });
    }
  };
  add(space.owners, "owner");
  add(space.admins, "admin");
  add(space.moderators, "moderator");
  add(space.members, "member");
  return out;
}

function decide(role: SpaceRole, allowed: boolean, reason: string): SpaceDecision {
  return { allowed, role, reason };
}

/** Whether the actor may read the space, per its visibility. */
export function canRead(actorPubkey: string, space: Space): SpaceDecision {
  const role = getRole(actorPubkey, space);
  switch (space.visibility) {
    case "public":
      return decide(role, true, "public space");
    case "unlisted":
      return decide(role, true, "unlisted space (readable with the id)");
    case "private":
      return ROLE_RANK[role] >= ROLE_RANK.member
        ? decide(role, true, "member of private space")
        : decide(role, false, "private space requires membership");
  }
}

/** Whether the actor may post, per the space's postPolicy. */
export function canPost(actorPubkey: string, space: Space): SpaceDecision {
  const role = getRole(actorPubkey, space);
  const required = POST_POLICY_MIN_RANK[space.postPolicy];
  const allowed = ROLE_RANK[role] >= required;
  return decide(
    role,
    allowed,
    allowed
      ? `post policy "${space.postPolicy}" satisfied by role "${role}"`
      : `post policy "${space.postPolicy}" not met by role "${role}"`,
  );
}

/** Whether the actor may moderate (moderator and above). */
export function canModerate(actorPubkey: string, space: Space): SpaceDecision {
  const role = getRole(actorPubkey, space);
  const allowed = ROLE_RANK[role] >= ROLE_RANK.moderator;
  return decide(
    role,
    allowed,
    allowed ? "moderator or higher" : "requires moderator or higher",
  );
}

/** Whether the actor may administer the space (admin and above). */
export function canAdmin(actorPubkey: string, space: Space): SpaceDecision {
  const role = getRole(actorPubkey, space);
  const allowed = ROLE_RANK[role] >= ROLE_RANK.admin;
  return decide(
    role,
    allowed,
    allowed ? "admin or higher" : "requires admin or higher",
  );
}

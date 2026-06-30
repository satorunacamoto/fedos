/**
 * Stage 16 — bridge between Stage 9 spaces and chats.
 *
 * Derives a `GroupChat` from a space (group/channel/community) so the same
 * Community/Channel/Group definitions can drive a LINE/Telegram-style chat view.
 * The mapping is pure and does not mutate the space:
 * - participants  = every pubkey on the space (highest role per pubkey).
 * - admins        = the owners/admins (drives the channel-like `admins` policy).
 * - visibility    = private when the space is private, else public.
 * - postPolicy    = the space's post policy projected onto `ChatPostPolicy`.
 *
 * Reading the chat reuses the space's own `canRead` decision, so chat read
 * access stays consistent with the space policy rather than being re-invented.
 */

import { canRead, listMemberships } from "../community/policy.js";
import type { PostPolicy, Space } from "../community/types.js";
import type { ChatDecision, ChatPostPolicy, GroupChat } from "./types.js";

/** Projects a Stage 9 space post policy onto the coarser chat post policy. */
const CHAT_POST_POLICY: Record<PostPolicy, ChatPostPolicy> = {
  open: "open",
  members: "members",
  moderators: "admins",
  admins: "admins",
  owner_only: "admins",
};

/**
 * Builds the group chat backing a space. Channel spaces (post policy `admins`/
 * `owner_only`) become an admins-only broadcast chat; private spaces become a
 * private chat. Does not mutate the input.
 */
export function chatFromGroupSpace(space: Space): GroupChat {
  const memberships = listMemberships(space);
  const participants = memberships.map((m) => m.pubkey);
  const admins = memberships
    .filter((m) => m.role === "owner" || m.role === "admin")
    .map((m) => m.pubkey);

  return {
    id: space.id,
    kind: "group",
    visibility: space.visibility === "private" ? "private" : "public",
    postPolicy: CHAT_POST_POLICY[space.postPolicy],
    participants,
    admins,
    spaceId: space.id,
  };
}

/**
 * Whether the actor may open (read) the chat for a space. Delegates to the
 * space's `canRead` so chat access mirrors space visibility; the space reason is
 * carried through (e.g. a guest denied from a private space).
 */
export function canOpenChatFromSpace(actorPubkey: string, space: Space): ChatDecision {
  const decision = canRead(actorPubkey, space);
  return { allowed: decision.allowed, reason: decision.reason };
}

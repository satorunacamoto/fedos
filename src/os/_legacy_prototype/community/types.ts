/**
 * Stage 9 — community / channel / group space model (types only).
 *
 * These describe spaces a Nostr event can belong to and who may read/post/
 * moderate them. Everything is data; the policy decisions live in `policy.ts`
 * and are pure functions over these shapes. No storage, no posting, no signing.
 *
 * Roles are expressed as pubkey allowlists on the space. Signature verification
 * is a separate concern (Stage 8) — this layer assumes pubkeys are already
 * whatever the caller trusts them to be.
 */

export type SpaceType = "community" | "channel" | "group";

/**
 * - public:   readable by anyone (guests included).
 * - unlisted: readable by anyone who knows the id/URL (not discoverable).
 * - private:  readable by members and above only.
 */
export type SpaceVisibility = "public" | "unlisted" | "private";

/** How new members are admitted (informational here; used by future join flows). */
export type MembershipPolicy = "open" | "approval" | "invite_only";

/** Minimum role permitted to post into a space. */
export type PostPolicy =
  | "open" // anyone, including guests
  | "members" // members and above
  | "moderators" // moderators and above
  | "admins" // admins and the owner
  | "owner_only"; // owner only

export type SpaceRole = "owner" | "admin" | "moderator" | "member" | "guest";

/** A single (pubkey, role) assignment — a normalized view of the allowlists. */
export interface SpaceMembership {
  readonly pubkey: string;
  readonly role: SpaceRole;
}

/** Fields shared by every space type. */
export interface SpaceBase {
  readonly id: string;
  readonly type: SpaceType;
  readonly name: string;
  readonly description?: string;
  readonly visibility: SpaceVisibility;
  readonly membershipPolicy: MembershipPolicy;
  readonly postPolicy: PostPolicy;
  /** Role allowlists by pubkey. Highest matching role wins (owner > … > member). */
  readonly owners: readonly string[];
  readonly admins: readonly string[];
  readonly moderators: readonly string[];
  readonly members: readonly string[];
}

/** Reddit-style public board: usually open posting, public read. */
export interface CommunitySpace extends SpaceBase {
  readonly type: "community";
}

/** Broadcast channel: typically owner/admin-only posting. */
export interface ChannelSpace extends SpaceBase {
  readonly type: "channel";
}

/** Conversational group: member (or open) posting. */
export interface GroupSpace extends SpaceBase {
  readonly type: "group";
}

/** Any space. Discriminated by `type`. */
export type Space = CommunitySpace | ChannelSpace | GroupSpace;

/** Result of a permission check: the answer plus the actor's role and a reason. */
export interface SpaceDecision {
  readonly allowed: boolean;
  readonly role: SpaceRole;
  readonly reason: string;
}

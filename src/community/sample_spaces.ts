/**
 * Fixed sample spaces for the read-only demo. Not real/governed communities —
 * just enough variety (public community, admin-only channel, open group, private
 * group) to exercise the directory, landing pages, and policy hints.
 */

import type { Space } from "./types.js";

/** A pubkey that is a member of the private "vault" group (for demo read access). */
export const SAMPLE_VAULT_MEMBER = "d".repeat(64);

const SAMPLE_OWNER = "a".repeat(64);
const SAMPLE_ADMIN = "e".repeat(64);

export const SAMPLE_SPACES: Space[] = [
  {
    id: "general",
    type: "community",
    name: "General",
    description: "Public community board — anyone can post.",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [SAMPLE_OWNER],
    admins: [],
    moderators: [],
    members: [],
  },
  {
    id: "announce",
    type: "channel",
    name: "Announcements",
    description: "Read-only channel; only admins post.",
    visibility: "public",
    membershipPolicy: "invite_only",
    postPolicy: "admins",
    owners: [SAMPLE_OWNER],
    admins: [SAMPLE_ADMIN],
    moderators: [],
    members: [],
  },
  {
    id: "lounge",
    type: "group",
    name: "Lounge",
    description: "Open group — anyone can join the conversation.",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [SAMPLE_OWNER],
    admins: [],
    moderators: [],
    members: [],
  },
  {
    id: "vault",
    type: "group",
    name: "Vault",
    description: "Private group — members only.",
    visibility: "private",
    membershipPolicy: "invite_only",
    postPolicy: "members",
    owners: [SAMPLE_OWNER],
    admins: [],
    moderators: [],
    members: [SAMPLE_VAULT_MEMBER],
  },
];

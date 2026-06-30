import { describe, it, expect } from "vitest";
import {
  getRole,
  listMemberships,
  canRead,
  canPost,
  canModerate,
  canAdmin,
} from "../src/community/policy.js";
import type {
  ChannelSpace,
  CommunitySpace,
  GroupSpace,
  Space,
} from "../src/community/types.js";

const OWNER = "owner".padEnd(64, "0");
const ADMIN = "admin".padEnd(64, "0");
const MOD = "mod".padEnd(64, "0");
const MEMBER = "member".padEnd(64, "0");
const STRANGER = "stranger".padEnd(64, "0");

function community(overrides: Partial<CommunitySpace> = {}): CommunitySpace {
  return {
    id: "c1",
    type: "community",
    name: "Community One",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [OWNER],
    admins: [ADMIN],
    moderators: [MOD],
    members: [MEMBER],
    ...overrides,
  };
}

function channel(overrides: Partial<ChannelSpace> = {}): ChannelSpace {
  return {
    id: "ch1",
    type: "channel",
    name: "Channel One",
    visibility: "public",
    membershipPolicy: "invite_only",
    postPolicy: "admins",
    owners: [OWNER],
    admins: [ADMIN],
    moderators: [MOD],
    members: [MEMBER],
    ...overrides,
  };
}

function group(overrides: Partial<GroupSpace> = {}): GroupSpace {
  return {
    id: "g1",
    type: "group",
    name: "Group One",
    visibility: "private",
    membershipPolicy: "invite_only",
    postPolicy: "members",
    owners: [OWNER],
    admins: [ADMIN],
    moderators: [MOD],
    members: [MEMBER],
    ...overrides,
  };
}

describe("getRole", () => {
  it("1. resolves each role and defaults to guest", () => {
    const s = community();
    expect(getRole(OWNER, s)).toBe("owner");
    expect(getRole(ADMIN, s)).toBe("admin");
    expect(getRole(MOD, s)).toBe("moderator");
    expect(getRole(MEMBER, s)).toBe("member");
    expect(getRole(STRANGER, s)).toBe("guest");
  });

  it("prefers the highest role when a pubkey appears in multiple lists", () => {
    const s = community({ owners: [OWNER], members: [OWNER] });
    expect(getRole(OWNER, s)).toBe("owner");
  });
});

describe("canRead", () => {
  it("2. public community is readable by a guest", () => {
    expect(canRead(STRANGER, community({ visibility: "public" })).allowed).toBe(true);
  });

  it("3. private community denies a guest", () => {
    const d = canRead(STRANGER, community({ visibility: "private" }));
    expect(d.allowed).toBe(false);
    expect(d.role).toBe("guest");
  });

  it("private space allows a member", () => {
    expect(canRead(MEMBER, community({ visibility: "private" })).allowed).toBe(true);
  });

  it("unlisted space is readable by a guest (knows the id)", () => {
    expect(canRead(STRANGER, community({ visibility: "unlisted" })).allowed).toBe(true);
  });
});

describe("canPost", () => {
  it("4. open community allows a guest to post", () => {
    expect(canPost(STRANGER, community({ postPolicy: "open" })).allowed).toBe(true);
  });

  it("5. restricted community denies a guest", () => {
    expect(canPost(STRANGER, community({ postPolicy: "members" })).allowed).toBe(false);
  });

  it("6. channel allows owner and admin to post", () => {
    const ch = channel({ postPolicy: "admins" });
    expect(canPost(OWNER, ch).allowed).toBe(true);
    expect(canPost(ADMIN, ch).allowed).toBe(true);
  });

  it("7. channel denies guest and member", () => {
    const ch = channel({ postPolicy: "admins" });
    expect(canPost(STRANGER, ch).allowed).toBe(false);
    expect(canPost(MEMBER, ch).allowed).toBe(false);
  });

  it("8. open group allows guests and members", () => {
    const g = group({ postPolicy: "open" });
    expect(canPost(STRANGER, g).allowed).toBe(true);
    expect(canPost(MEMBER, g).allowed).toBe(true);
  });

  it("9. invite-only group denies guests but allows members", () => {
    const g = group({ postPolicy: "members" });
    expect(canPost(STRANGER, g).allowed).toBe(false);
    expect(canPost(MEMBER, g).allowed).toBe(true);
  });
});

describe("canModerate / canAdmin", () => {
  it("10. a moderator can moderate but not admin", () => {
    const s = community();
    expect(canModerate(MOD, s).allowed).toBe(true);
    expect(canAdmin(MOD, s).allowed).toBe(false);
  });

  it("11. owner and admin can admin", () => {
    const s = community();
    expect(canAdmin(OWNER, s).allowed).toBe(true);
    expect(canAdmin(ADMIN, s).allowed).toBe(true);
  });

  it("a member cannot moderate", () => {
    expect(canModerate(MEMBER, community()).allowed).toBe(false);
  });
});

describe("listMemberships", () => {
  it("normalizes allowlists to highest-role-per-pubkey", () => {
    const s = community({ owners: [OWNER], members: [OWNER, MEMBER] });
    const memberships = listMemberships(s);
    expect(memberships).toContainEqual({ pubkey: OWNER, role: "owner" });
    expect(memberships.filter((m) => m.pubkey === OWNER)).toHaveLength(1);
  });
});

describe("immutability", () => {
  it("12. policy checks do not mutate the space", () => {
    const s: Space = community();
    const snapshot = JSON.stringify(s);
    getRole(OWNER, s);
    canRead(STRANGER, s);
    canPost(STRANGER, s);
    canModerate(MOD, s);
    canAdmin(ADMIN, s);
    listMemberships(s);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

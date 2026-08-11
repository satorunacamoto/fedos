import { describe, it, expect } from "vitest";
import {
  canOpenChatFromSpace,
  chatFromGroupSpace,
} from "../src/os/_legacy_prototype/chat/space_bridge.js";
import { canPostChat, canReadChat } from "../src/os/_legacy_prototype/chat/policy.js";
import type {
  ChannelSpace,
  CommunitySpace,
  GroupSpace,
} from "../src/os/_legacy_prototype/community/types.js";

const OWNER = "a".repeat(64);
const ADMIN = "b".repeat(64);
const MEMBER = "c".repeat(64);
const STRANGER = "d".repeat(64);

function openGroupSpace(): CommunitySpace {
  return {
    id: "lounge",
    type: "community",
    name: "Lounge",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [MEMBER],
  };
}

function privateGroupSpace(): GroupSpace {
  return {
    id: "vault",
    type: "group",
    name: "Vault",
    visibility: "private",
    membershipPolicy: "invite_only",
    postPolicy: "members",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [MEMBER],
  };
}

function channelSpace(): ChannelSpace {
  return {
    id: "announce",
    type: "channel",
    name: "Announcements",
    visibility: "public",
    membershipPolicy: "invite_only",
    postPolicy: "admins",
    owners: [OWNER],
    admins: [ADMIN],
    moderators: [],
    members: [MEMBER],
  };
}

describe("chat space bridge", () => {
  it("1. derives a group chat from a space (participants + admins + link)", () => {
    const chat = chatFromGroupSpace(openGroupSpace());
    expect(chat.kind).toBe("group");
    expect(chat.id).toBe("lounge");
    expect(chat.spaceId).toBe("lounge");
    expect(chat.visibility).toBe("public");
    expect(chat.postPolicy).toBe("open");
    expect(chat.participants).toEqual(expect.arrayContaining([OWNER, MEMBER]));
    expect(chat.admins).toEqual([OWNER]);
  });

  it("2. reflects a private space's read policy in the chat", () => {
    const chat = chatFromGroupSpace(privateGroupSpace());
    expect(chat.visibility).toBe("private");
    // The member can read; a stranger cannot.
    expect(canReadChat(MEMBER, chat).allowed).toBe(true);
    expect(canReadChat(STRANGER, chat).allowed).toBe(false);
  });

  it("3. reflects a channel space's post policy (admins-only) in the chat", () => {
    const chat = chatFromGroupSpace(channelSpace());
    expect(chat.postPolicy).toBe("admins");
    expect(chat.admins).toEqual(expect.arrayContaining([OWNER, ADMIN]));
    expect(canPostChat(ADMIN, chat).allowed).toBe(true);
    expect(canPostChat(MEMBER, chat).allowed).toBe(false);
  });

  it("4. canOpenChatFromSpace denies a guest with the space's reason", () => {
    const decision = canOpenChatFromSpace(STRANGER, privateGroupSpace());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/private/);
    // A member is allowed in.
    expect(canOpenChatFromSpace(MEMBER, privateGroupSpace()).allowed).toBe(true);
  });

  it("5. does not mutate the input space", () => {
    const space = channelSpace();
    const snapshot = JSON.stringify(space);
    chatFromGroupSpace(space);
    canOpenChatFromSpace(STRANGER, space);
    expect(JSON.stringify(space)).toBe(snapshot);
  });
});

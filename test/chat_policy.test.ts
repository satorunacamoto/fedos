import { describe, it, expect } from "vitest";
import {
  canPostChat,
  canReadChat,
  isChatParticipant,
} from "../src/chat/policy.js";
import type { DMThread, GroupChat } from "../src/chat/types.js";

const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);
const CAROL = "c".repeat(64);

function dm(participants: string[]): DMThread {
  return {
    id: "dm-1",
    kind: "dm",
    visibility: "private",
    postPolicy: "participants",
    participants,
    admins: [],
  };
}

function openGroup(): GroupChat {
  return {
    id: "lounge",
    kind: "group",
    visibility: "public",
    postPolicy: "open",
    participants: [ALICE],
    admins: [ALICE],
  };
}

function privateGroup(participants: string[]): GroupChat {
  return {
    id: "vault",
    kind: "group",
    visibility: "private",
    postPolicy: "members",
    participants,
    admins: [],
  };
}

function channel(admins: string[], members: string[]): GroupChat {
  return {
    id: "announce",
    kind: "group",
    visibility: "public",
    postPolicy: "admins",
    participants: [...admins, ...members],
    admins,
  };
}

describe("chat policy", () => {
  it("1. a DM participant may read and post", () => {
    const thread = dm([ALICE, BOB]);
    expect(canReadChat(ALICE, thread).allowed).toBe(true);
    expect(canPostChat(BOB, thread).allowed).toBe(true);
    expect(isChatParticipant(ALICE, thread)).toBe(true);
  });

  it("2. a DM non-participant is denied read and post", () => {
    const thread = dm([ALICE, BOB]);
    expect(canReadChat(CAROL, thread).allowed).toBe(false);
    expect(canPostChat(CAROL, thread).allowed).toBe(false);
    expect(isChatParticipant(CAROL, thread)).toBe(false);
    // A guest (empty actor) is never a participant.
    expect(isChatParticipant("", thread)).toBe(false);
  });

  it("3. a group-chat participant may read and post", () => {
    const group = privateGroup([ALICE, BOB]);
    expect(canReadChat(BOB, group).allowed).toBe(true);
    expect(canPostChat(BOB, group).allowed).toBe(true);
  });

  it("an open group lets a guest post", () => {
    const group = openGroup();
    expect(canPostChat("", group).allowed).toBe(true);
    expect(canPostChat(CAROL, group).allowed).toBe(true);
  });

  it("4. a private group denies a guest/non-participant read", () => {
    const group = privateGroup([ALICE]);
    const denied = canReadChat(CAROL, group);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/private/);
  });

  it("5. a channel admin may post", () => {
    const ch = channel([ALICE], [BOB]);
    expect(canPostChat(ALICE, ch).allowed).toBe(true);
  });

  it("6. a channel member (non-admin) may not post", () => {
    const ch = channel([ALICE], [BOB]);
    const denied = canPostChat(BOB, ch);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/owners\/admins/);
    // ...but a channel is publicly readable.
    expect(canReadChat(BOB, ch).allowed).toBe(true);
  });

  it("7. does not mutate the input chat", () => {
    const thread = dm([ALICE, BOB]);
    const snapshot = JSON.stringify(thread);
    canReadChat(CAROL, thread);
    canPostChat(ALICE, thread);
    isChatParticipant(BOB, thread);
    expect(JSON.stringify(thread)).toBe(snapshot);
  });
});

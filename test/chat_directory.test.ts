import { describe, it, expect } from "vitest";
import {
  InMemoryChatDirectory,
  findChatById,
  getChatMessages,
  listReadableChats,
} from "../src/chat/directory.js";
import type { ChatMessage, ChatRoom, DMThread, GroupChat } from "../src/chat/types.js";
import type { NostrEvent } from "../src/nostr/types.js";

const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);
const CAROL = "c".repeat(64);

const PUBLIC_GROUP: GroupChat = {
  id: "lounge",
  kind: "group",
  visibility: "public",
  postPolicy: "open",
  participants: [ALICE, BOB],
  admins: [ALICE],
};

const PRIVATE_DM: DMThread = {
  id: "dm-1",
  kind: "dm",
  visibility: "private",
  postPolicy: "participants",
  participants: [ALICE, BOB],
  admins: [],
};

const ALL: ChatRoom[] = [PUBLIC_GROUP, PRIVATE_DM];

function event(id: string): NostrEvent {
  return {
    id,
    pubkey: ALICE,
    created_at: 1000,
    kind: 1,
    tags: [],
    content: "x",
    sig: "0".repeat(128),
  };
}

function msg(id: string, chatId: string): ChatMessage {
  return { id, chatId, authorPubkey: ALICE, createdAt: 1000, content: "hi", event: event(id) };
}

describe("findChatById", () => {
  it("1. finds a chat by exact id, else undefined", () => {
    expect(findChatById(ALL, "dm-1")).toBe(PRIVATE_DM);
    expect(findChatById(ALL, "nope")).toBeUndefined();
  });

  it("InMemoryChatDirectory.get/list delegate to the array", () => {
    const dir = new InMemoryChatDirectory(ALL);
    expect(dir.list()).toHaveLength(2);
    expect(dir.get("lounge")).toBe(PUBLIC_GROUP);
    expect(dir.get("missing")).toBeUndefined();
  });
});

describe("listReadableChats", () => {
  it("2. a guest sees a public group chat", () => {
    expect(listReadableChats(ALL)).toContain(PUBLIC_GROUP);
  });

  it("3. a private DM is hidden from a non-participant / guest", () => {
    expect(listReadableChats(ALL)).not.toContain(PRIVATE_DM);
    expect(listReadableChats(ALL, CAROL)).not.toContain(PRIVATE_DM);
  });

  it("4. a participant sees the private DM", () => {
    expect(listReadableChats(ALL, ALICE)).toContain(PRIVATE_DM);
    expect(listReadableChats(ALL, BOB)).toContain(PRIVATE_DM);
  });
});

describe("getChatMessages", () => {
  const messages = [msg("a", "lounge"), msg("b", "dm-1"), msg("c", "lounge")];

  it("5. selects only the messages whose chatId matches", () => {
    expect(getChatMessages(PUBLIC_GROUP, messages).map((m) => m.id)).toEqual(["a", "c"]);
    expect(getChatMessages(PRIVATE_DM, messages).map((m) => m.id)).toEqual(["b"]);
  });

  it("returns [] when no message matches", () => {
    expect(getChatMessages({ ...PUBLIC_GROUP, id: "empty" }, messages)).toEqual([]);
  });
});

describe("chat directory purity", () => {
  it("6. does not mutate its inputs", () => {
    const chats = [PUBLIC_GROUP, PRIVATE_DM];
    const messages = [msg("a", "lounge"), msg("b", "dm-1")];
    const snapChats = JSON.stringify(chats);
    const snapMessages = JSON.stringify(messages);

    listReadableChats(chats, ALICE);
    getChatMessages(PUBLIC_GROUP, messages);
    findChatById(chats, "lounge");

    expect(JSON.stringify(chats)).toBe(snapChats);
    expect(JSON.stringify(messages)).toBe(snapMessages);
  });
});

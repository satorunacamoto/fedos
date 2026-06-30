import { describe, it, expect } from "vitest";
import {
  classifyEventToChats,
  eventMatchesChat,
  getChatTags,
} from "../src/chat/classify.js";
import type { GroupChat } from "../src/chat/types.js";
import type { NostrEvent, NostrTag } from "../src/nostr/types.js";

function event(tags: NostrTag[]): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1,
    kind: 1,
    tags,
    content: "x",
    sig: "b".repeat(128),
  };
}

function group(id: string): GroupChat {
  return {
    id,
    kind: "group",
    visibility: "public",
    postPolicy: "open",
    participants: [],
    admins: [],
  };
}

describe("chat classify", () => {
  it("1. reads a [\"chat\", id] tag", () => {
    expect(getChatTags(event([["chat", "lounge"]]))).toEqual(["lounge"]);
  });

  it("2. reads a [\"t\", \"chat:<id>\"] tag", () => {
    expect(getChatTags(event([["t", "chat:lounge"]]))).toEqual(["lounge"]);
  });

  it("3. classifies an event onto multiple known chats (deduped)", () => {
    const ev = event([
      ["chat", "a"],
      ["t", "chat:b"],
      ["chat", "a"], // duplicate -> collapsed
    ]);
    expect(getChatTags(ev)).toEqual(["a", "b"]);
    const chats = [group("a"), group("b"), group("c")];
    expect(classifyEventToChats(ev, chats).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("4. ignores malformed / unrelated tags", () => {
    const ev = event([
      ["chat"], // missing value
      ["chat", ""], // empty value
      ["t", "topic"], // not a chat: prefix
      ["space", "lounge"], // a space tag, not a chat tag
      ["e", "1".repeat(64)],
    ]);
    expect(getChatTags(ev)).toEqual([]);
    expect(eventMatchesChat(ev, group("lounge"))).toBe(false);
  });

  it("5. ignores references to unknown chats", () => {
    const ev = event([["chat", "ghost"]]);
    expect(classifyEventToChats(ev, [group("lounge")])).toEqual([]);
  });

  it("returns [] for an event with no chat tags", () => {
    expect(classifyEventToChats(event([]), [group("lounge")])).toEqual([]);
  });

  it("6. does not mutate the inputs", () => {
    const ev = event([["chat", "a"]]);
    const chats = [group("a"), group("b")];
    const evSnap = JSON.stringify(ev);
    const chatsSnap = JSON.stringify(chats);
    classifyEventToChats(ev, chats);
    expect(JSON.stringify(ev)).toBe(evSnap);
    expect(JSON.stringify(chats)).toBe(chatsSnap);
  });
});

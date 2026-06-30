import { describe, it, expect } from "vitest";
import {
  renderChatAccessDenied,
  renderChatDirectory,
  renderChatLabel,
  renderChatMessage,
  renderChatNotFound,
  renderChatRoom,
} from "../src/render/chat.js";
import type { ChatDecision, ChatMessage, ChatRoom } from "../src/chat/types.js";
import type { NostrEvent } from "../src/nostr/types.js";

const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);

function group(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: "lounge",
    kind: "group",
    visibility: "public",
    postPolicy: "open",
    participants: [ALICE, BOB],
    admins: [ALICE],
    ...overrides,
  } as ChatRoom;
}

function event(id: string, content: string): NostrEvent {
  return {
    id,
    pubkey: ALICE,
    created_at: 2000,
    kind: 1,
    tags: [],
    content,
    sig: "0".repeat(128),
  };
}

function msg(content: string, id = "m1"): ChatMessage {
  return {
    id,
    chatId: "lounge",
    authorPubkey: ALICE,
    createdAt: 2000,
    content,
    event: event(id, content),
  };
}

const ALLOW: ChatDecision = { allowed: true, reason: "public chat" };
const POST_OK: ChatDecision = { allowed: true, reason: 'post policy "open" — anyone may post' };
const POST_DENIED: ChatDecision = { allowed: false, reason: "only owners/admins may post" };

describe("renderChatLabel", () => {
  it("1. renders the chat kind and id", () => {
    const html = renderChatLabel(group());
    expect(html).toContain("group");
    expect(html).toContain("lounge");
    expect(html).toContain('class="chat-label chat-group"');
  });
});

describe("renderChatDirectory", () => {
  it("2. renders the chats with links to their ?chat rooms", () => {
    const html = renderChatDirectory([group(), group({ id: "dm-1", kind: "dm", visibility: "private" })]);
    expect(html).toContain('class="chat-directory"');
    expect(html).toContain('href="?chat=lounge"');
    expect(html).toContain('href="?chat=dm-1"');
    expect(html).toContain("participant-only"); // private view-policy label
  });

  it("renders an empty state and escapes the actor pubkey", () => {
    expect(renderChatDirectory([])).toContain("No chats available.");
    const html = renderChatDirectory([group()], "<script>");
    expect(html).not.toContain("viewing as <code><script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderChatRoom", () => {
  it("3. renders the messages", () => {
    const html = renderChatRoom(group(), ALLOW, POST_OK, [msg("hello world")]);
    expect(html).toContain('class="chat-room"');
    expect(html).toContain("hello world");
    expect(html).toContain('class="chat-message-list"');
  });

  it("4. escapes message content", () => {
    const html = renderChatRoom(group(), ALLOW, POST_OK, [msg("<script>alert(1)</script>")]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("7. shows an allowed post hint and a denied post hint", () => {
    expect(renderChatRoom(group(), ALLOW, POST_OK, []).toLowerCase()).toContain("could post");
    const denied = renderChatRoom(group(), ALLOW, POST_DENIED, []);
    expect(denied).toContain("Posting restricted");
    expect(denied).toContain("only owners/admins may post");
  });

  it("8. uses no encrypted/secure wording (not a cryptographic claim)", () => {
    const html = renderChatRoom(
      group({ visibility: "private", id: "dm-1", kind: "dm" }),
      { allowed: true, reason: "participant of private chat" },
      POST_OK,
      [msg("hi")],
    ).toLowerCase();
    expect(html).not.toContain("encrypted");
    expect(html).not.toContain("secure");
    expect(html).toContain("participant-only"); // the view-policy label instead
  });

  it("9. renders no send/publish form or button", () => {
    const html = renderChatRoom(group(), ALLOW, POST_OK, [msg("hi")]).toLowerCase();
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("publish");
    expect(html).not.toContain("send message");
  });
});

describe("renderChatMessage", () => {
  it("renders the author (shortened) and escaped content", () => {
    const html = renderChatMessage(msg("plain text"));
    expect(html).toContain("plain text");
    expect(html).toContain('data-message="m1"');
    // The full pubkey is escaped into the title; the visible form is shortened.
    expect(html).toContain("…");
  });
});

describe("renderChatNotFound", () => {
  it("6. escapes the chat id", () => {
    const html = renderChatNotFound("<script>");
    expect(html).toContain("Chat not found");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderChatAccessDenied", () => {
  it("5. renders the (escaped) reason and id", () => {
    const html = renderChatAccessDenied(
      group({ id: "<id>" }),
      { allowed: false, reason: "private chat requires participation" },
    );
    expect(html).toContain("Access denied");
    expect(html).toContain("private chat requires participation");
    expect(html).not.toContain("<id>");
    expect(html).toContain("&lt;id&gt;");
  });
});

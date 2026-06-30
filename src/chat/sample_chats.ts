/**
 * Stage 27 — fixed sample chats + messages for the read-only demo.
 *
 * Not real conversations: just enough variety (an open group, a channel-like
 * broadcast group, a private members group, and a one-to-one DM) to exercise the
 * chat directory, the `?chat=<id>` room view, and the read/post policy hints.
 *
 * `ChatMessage.content` is PLAINTEXT as supplied — this layer performs no
 * NIP-04/NIP-44 decryption and sends nothing. One message deliberately contains
 * HTML-special characters to prove the render layer escapes message content.
 */

import type { NostrEvent } from "../nostr/types.js";
import type { ChatMessage, ChatRoom } from "./types.js";

const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);
const CAROL = "c".repeat(64);
const SIG = "0".repeat(128);

/** A pubkey that participates in the private "dm-alice-bob" thread (demo read). */
export const SAMPLE_DM_PARTICIPANT = ALICE;

export const SAMPLE_CHATS: ChatRoom[] = [
  {
    id: "lounge-chat",
    kind: "group",
    visibility: "public",
    postPolicy: "open",
    participants: [ALICE, BOB],
    admins: [ALICE],
    spaceId: "lounge",
  },
  {
    id: "announce-chat",
    kind: "group",
    visibility: "public",
    postPolicy: "admins",
    participants: [ALICE, BOB],
    admins: [ALICE],
    spaceId: "announce",
  },
  {
    id: "vault-chat",
    kind: "group",
    visibility: "private",
    postPolicy: "members",
    participants: [ALICE, CAROL],
    admins: [ALICE],
    spaceId: "vault",
  },
  {
    id: "dm-alice-bob",
    kind: "dm",
    visibility: "private",
    postPolicy: "participants",
    participants: [ALICE, BOB],
    admins: [],
  },
];

/** Builds a minimal source event for a sample chat message. */
function chatEvent(id: string, pubkey: string, createdAt: number, chatId: string, content: string): NostrEvent {
  return {
    id,
    pubkey,
    created_at: createdAt,
    kind: 1,
    tags: [["chat", chatId]],
    content,
    sig: SIG,
  };
}

/** Builds a `ChatMessage` plus its backing event. */
function message(id: string, chatId: string, author: string, createdAt: number, content: string): ChatMessage {
  return {
    id,
    chatId,
    authorPubkey: author,
    createdAt,
    content,
    event: chatEvent(id, author, createdAt, chatId, content),
  };
}

export const SAMPLE_CHAT_MESSAGES: ChatMessage[] = [
  message("m1".padEnd(64, "0"), "lounge-chat", ALICE, 2000, "Welcome to the lounge chat (read-only demo)."),
  message(
    "m2".padEnd(64, "0"),
    "lounge-chat",
    BOB,
    2100,
    'A message with <script> & "quotes" to prove escaping works.',
  ),
  message("m3".padEnd(64, "0"), "announce-chat", ALICE, 2200, "Official broadcast — admins only post here."),
  message("m4".padEnd(64, "0"), "vault-chat", CAROL, 2300, "Members-only group note."),
  message("m5".padEnd(64, "0"), "dm-alice-bob", ALICE, 2400, "Hey Bob — this is a one-to-one thread."),
  message("m6".padEnd(64, "0"), "dm-alice-bob", BOB, 2500, "Hi Alice, got it."),
];

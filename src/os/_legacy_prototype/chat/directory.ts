/**
 * Stage 27 — read-only chat directory + lookup helpers.
 *
 * A `ChatDirectory` is a source of `ChatRoom` definitions, mirroring the Stage 11
 * space directory and the Stage 25 product directory. The lookup/filter helpers
 * are pure functions over a chat array so callers can use them without a
 * directory instance.
 *
 * This layer is read-only: it resolves chats and the messages that belong to
 * them, but it SENDS nothing, encrypts/decrypts nothing, and opens no socket.
 */

import { canReadChat } from "./policy.js";
import type { ChatMessage, ChatRoom } from "./types.js";

/** A source of chat definitions (synchronous, process-local). */
export interface ChatDirectory {
  list(): readonly ChatRoom[];
  get(id: string): ChatRoom | undefined;
}

/** Process-local directory backed by a fixed array. */
export class InMemoryChatDirectory implements ChatDirectory {
  readonly #chats: readonly ChatRoom[];

  constructor(chats: readonly ChatRoom[]) {
    this.#chats = [...chats];
  }

  list(): readonly ChatRoom[] {
    return this.#chats;
  }

  get(id: string): ChatRoom | undefined {
    return findChatById(this.#chats, id);
  }
}

/** Finds a chat by exact id, or undefined. */
export function findChatById(
  chats: readonly ChatRoom[],
  id: string,
): ChatRoom | undefined {
  return chats.find((chat) => chat.id === id);
}

/**
 * Chats the actor may read (per `canReadChat`). A guest is an empty/omitted
 * pubkey; only public chats are readable by a guest. Does not mutate the input.
 */
export function listReadableChats(
  chats: readonly ChatRoom[],
  actorPubkey = "",
): ChatRoom[] {
  return chats.filter((chat) => canReadChat(actorPubkey, chat).allowed);
}

/**
 * The messages that belong to a chat, selected by `message.chatId`. Order follows
 * the message list. Does not mutate the input.
 */
export function getChatMessages(
  chat: ChatRoom,
  messages: readonly ChatMessage[],
): ChatMessage[] {
  return messages.filter((message) => message.chatId === chat.id);
}

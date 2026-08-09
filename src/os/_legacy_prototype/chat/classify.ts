/**
 * Stage 16 — pure event → chat classification.
 *
 * Reads chat references out of a Nostr event's tags and maps the event onto
 * known chats. The tag conventions are kept behind this adapter so it can be
 * pointed at a NIP-based scheme later without touching callers.
 *
 * Recognized chat tags (value -> chat id):
 *   ["chat", "<chatId>"]      -> "<chatId>"
 *   ["t", "chat:<chatId>"]    -> "<chatId>"
 * Anything else (including a plain ["t", "topic"] or a malformed tag) is ignored.
 */

import type { NostrEvent } from "../../messenger/adapters/nostr/protocol/types.js";
import type { ChatRoom } from "./types.js";

const T_CHAT_PREFIX = "chat:";

/** Extracts referenced chat ids from an event (deduped, first-seen order). */
export function getChatTags(event: NostrEvent): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  const push = (id: unknown): void => {
    if (typeof id === "string" && id.length > 0 && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };

  for (const tag of event.tags) {
    const name = tag[0];
    const value = tag[1];
    if (name === "chat") {
      push(value);
    } else if (name === "t" && typeof value === "string" && value.startsWith(T_CHAT_PREFIX)) {
      push(value.slice(T_CHAT_PREFIX.length));
    }
  }

  return ids;
}

/** True if the event references the given chat by id. */
export function eventMatchesChat(event: NostrEvent, chat: ChatRoom): boolean {
  return getChatTags(event).includes(chat.id);
}

/**
 * Returns the subset of `chats` the event belongs to (by id). Unknown chat
 * references are ignored; an event with no chat tags returns []. Does not mutate
 * inputs.
 */
export function classifyEventToChats(
  event: NostrEvent,
  chats: readonly ChatRoom[],
): ChatRoom[] {
  const referenced = new Set(getChatTags(event));
  if (referenced.size === 0) return [];
  return chats.filter((chat) => referenced.has(chat.id));
}

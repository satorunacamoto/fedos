/**
 * Stage 16 — pure permission policy over chats.
 *
 * All functions are pure: they read the chat's participant/admin lists and its
 * visibility/postPolicy and return a `ChatDecision`. They never mutate inputs,
 * hit storage, send anything, or verify signatures (the caller is expected to
 * pass already-trusted pubkeys).
 *
 * - DM: private + `participants` post policy → only participants read/post.
 * - Group: follows its visibility (read) and postPolicy (post). An "open" group
 *   lets guests post; a private group requires participation.
 * - Channel-like: postPolicy `admins` → only owners/admins post.
 */

import type { ChatDecision, ChatRoom } from "./types.js";

function decide(allowed: boolean, reason: string): ChatDecision {
  return { allowed, reason };
}

/** True if the actor takes part in the chat (participant or admin). */
export function isChatParticipant(actorPubkey: string, chat: ChatRoom): boolean {
  if (actorPubkey.length === 0) return false;
  return chat.participants.includes(actorPubkey) || chat.admins.includes(actorPubkey);
}

/** True if the actor is an elevated member of the chat (owner/admin). */
function isChatAdmin(actorPubkey: string, chat: ChatRoom): boolean {
  return actorPubkey.length > 0 && chat.admins.includes(actorPubkey);
}

/** Whether the actor may read the chat, per its visibility. */
export function canReadChat(actorPubkey: string, chat: ChatRoom): ChatDecision {
  if (chat.visibility === "public") {
    return decide(true, "public chat");
  }
  return isChatParticipant(actorPubkey, chat)
    ? decide(true, "participant of private chat")
    : decide(false, "private chat requires participation");
}

/** Whether the actor may post, per the chat's postPolicy. */
export function canPostChat(actorPubkey: string, chat: ChatRoom): ChatDecision {
  switch (chat.postPolicy) {
    case "open":
      return decide(true, 'post policy "open" — anyone may post');
    case "participants":
      return isChatParticipant(actorPubkey, chat)
        ? decide(true, "participant of the chat")
        : decide(false, "only participants may post");
    case "members":
      return isChatParticipant(actorPubkey, chat)
        ? decide(true, "member of the chat")
        : decide(false, "chat membership required to post");
    case "admins":
      return isChatAdmin(actorPubkey, chat)
        ? decide(true, "owner/admin of the chat")
        : decide(false, "only owners/admins may post");
  }
}

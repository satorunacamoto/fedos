/**
 * Stage 27 — read-only render helpers for chats (Stage 16 model).
 *
 * Pure string builders. Every chat-derived string (id, kind, visibility, post
 * reason, author pubkey, message content) is HTML-escaped. These views are
 * strictly read-only: there is NO send form, NO send/publish button, NO socket,
 * and NO message delivery. Messages are shown as PLAINTEXT labels exactly as the
 * Stage 16 model holds them.
 *
 * WORDING GUARDRAIL: this is NOT an encrypted or secure channel and must not be
 * described as one. A private chat is shown with a "participant-only view policy"
 * label — a visibility/access note, not a cryptographic guarantee. No NIP-04/
 * NIP-44, no key material, nothing sent.
 */

import type { ChatDecision, ChatMessage, ChatRoom } from "../chat/types.js";
import { escapeHtml, shortenHex } from "./html.js";

/** Builds a safe `?chat=<id>` href (URL-encoded then attribute-escaped). */
function chatHref(id: string, actorPubkey?: string): string {
  let href = `?chat=${encodeURIComponent(id)}`;
  if (actorPubkey) href += `&actor=${encodeURIComponent(actorPubkey)}`;
  return escapeHtml(href);
}

/** A small escaped "viewing as <pubkey>" line, or empty when guest. */
function viewingAs(actorPubkey?: string): string {
  if (!actorPubkey) return "";
  return `<p class="viewing-as">viewing as <code>${escapeHtml(shortenHex(actorPubkey))}</code></p>`;
}

/**
 * A human view-policy label (NOT a cryptographic claim): public chats are
 * "public"; private chats are "participant-only" — readable by participants per
 * the Stage 16 policy. Never "encrypted" or "secure".
 */
function viewPolicyLabel(chat: ChatRoom): string {
  return chat.visibility === "private" ? "participant-only" : "public";
}

/** A compact, escaped chat label: its kind and id. */
export function renderChatLabel(chat: ChatRoom): string {
  return (
    `<span class="chat-label chat-${escapeHtml(chat.kind)}" ` +
    `title="${escapeHtml(chat.id)}">` +
    `<span class="chat-kind">${escapeHtml(chat.kind)}</span> ` +
    `<span class="chat-id">${escapeHtml(chat.id)}</span>` +
    `</span>`
  );
}

/**
 * A read-only directory of chats, each linking to its `?chat=<id>` room.
 * Callers pass the already-filtered readable set (e.g. `listReadableChats`);
 * this helper does no access checks. All chat-derived text is escaped.
 */
export function renderChatDirectory(
  chats: readonly ChatRoom[],
  actorPubkey?: string,
): string {
  const header = `<h2>Chats</h2>${viewingAs(actorPubkey)}`;
  if (chats.length === 0) {
    return `<section class="chat-directory">${header}<p class="empty">No chats available.</p></section>`;
  }
  const items = chats
    .map((chat) => {
      const count = chat.participants.length;
      return (
        `<li class="chat-item">` +
        `<a href="${chatHref(chat.id, actorPubkey)}">${escapeHtml(chat.id)}</a> ` +
        `<span class="chat-meta">${escapeHtml(chat.kind)} · ` +
        `${escapeHtml(viewPolicyLabel(chat))} · ${count} participant(s)</span>` +
        `</li>`
      );
    })
    .join("");
  return `<section class="chat-directory">${header}<ul>${items}</ul></section>`;
}

/**
 * A single chat message: author (shortened pubkey), timestamp, and the PLAINTEXT
 * content. Content and author are escaped; there is no link, no action, and no
 * delivery — this is a label only.
 */
export function renderChatMessage(message: ChatMessage): string {
  const authorShort = escapeHtml(shortenHex(message.authorPubkey));
  const authorFull = escapeHtml(message.authorPubkey);
  return (
    `<li class="chat-message" data-message="${escapeHtml(message.id)}">` +
    `<header class="chat-msg-meta">` +
    `<span class="chat-author" title="${authorFull}">${authorShort}</span>` +
    `<span class="sep">·</span>` +
    `<time datetime="${message.createdAt}">t=${message.createdAt}</time>` +
    `</header>` +
    `<div class="chat-msg-content">${escapeHtml(message.content)}</div>` +
    `</li>`
  );
}

/** The read-only post hint: shows the policy decision but renders no form/button. */
function renderChatPostHint(postDecision: ChatDecision): string {
  const cls = postDecision.allowed ? "chat-post-hint allowed" : "chat-post-hint denied";
  const lead = postDecision.allowed
    ? "You could post here once posting ships."
    : "Posting restricted:";
  return (
    `<div class="${cls}">${lead} ${escapeHtml(postDecision.reason)} ` +
    `<span class="chat-post-note">(read-only — no posting yet)</span></div>`
  );
}

/**
 * The read-only chat room: a header label, the view-policy + read/post hints, a
 * plaintext disclaimer, and the messages. Assumes the caller already decided the
 * actor MAY read the chat (`readDecision.allowed`); a denied actor gets
 * `renderChatAccessDenied` instead. No send form, button, or message delivery.
 */
export function renderChatRoom(
  chat: ChatRoom,
  readDecision: ChatDecision,
  postDecision: ChatDecision,
  messages: readonly ChatMessage[],
): string {
  const items =
    messages.length > 0
      ? `<ul class="chat-message-list">${messages.map(renderChatMessage).join("")}</ul>`
      : `<p class="empty">No messages to display.</p>`;
  return (
    `<section class="chat-room" data-chat="${escapeHtml(chat.id)}">` +
    `<h2>${renderChatLabel(chat)}</h2>` +
    `<p class="chat-meta">view policy: ${escapeHtml(viewPolicyLabel(chat))} · ` +
    `read: ${escapeHtml(readDecision.reason)}</p>` +
    renderChatPostHint(postDecision) +
    `<p class="chat-note">Read-only view. Messages are shown as plaintext labels; ` +
    `nothing is sent and no message is delivered.</p>` +
    items +
    `<p class="chat-back"><a href="?">← back</a></p>` +
    `</section>`
  );
}

/** Shown when `?chat=<id>` names a chat that does not exist. */
export function renderChatNotFound(chatId: string): string {
  return (
    `<section class="chat-error">` +
    `<h2>Chat not found</h2>` +
    `<p>No chat with id <code>${escapeHtml(chatId)}</code>.</p>` +
    `</section>`
  );
}

/** Shown when the actor may not read the requested chat. */
export function renderChatAccessDenied(
  chat: ChatRoom,
  decision: ChatDecision,
): string {
  return (
    `<section class="chat-error">` +
    `<h2>Access denied</h2>` +
    `<p>${escapeHtml(chat.id)}: ${escapeHtml(decision.reason)}</p>` +
    `</section>`
  );
}

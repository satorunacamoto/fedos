/**
 * Stage 39 — pure helpers that build a safe `NotificationPayload` from a domain
 * event (chat / space / product) WITHOUT copying any real content.
 *
 * Each helper produces only a COARSE, generic signal: "something happened here".
 * It NEVER reads a chat message body, a space post's event content, or a product's
 * payment/download details into the payload. All helpers are pure and take
 * TYPE-ONLY dependencies on the domain models; they wire nothing into the runtime
 * or Worker and send nothing.
 */

import type { ChatRoom, ChatMessage } from "../chat/types.js";
import type { SpaceBase } from "../community/types.js";
import type { Product } from "../commerce/types.js";
import type { NostrEvent } from "../nostr/types.js";
import type { NotificationChannel, NotificationPayload } from "./types.js";

const DEFAULT_CHANNEL: NotificationChannel = "local_placeholder";

/**
 * Build a `chat_activity` notification. Deliberately omits `message.content` — the
 * body is a GENERIC label. Only the chat id (target) and the author pubkey (an
 * opaque public actor ref) and timestamp are carried.
 */
export function chatEventToNotification(
  chat: ChatRoom,
  message?: ChatMessage,
  channel: NotificationChannel = DEFAULT_CHANNEL,
): NotificationPayload {
  return {
    kind: "chat_activity",
    channel,
    title: "New chat activity",
    bodyPreview: "New chat activity",
    targetRef: chat.id,
    // The author's PUBLIC pubkey is a non-secret ref; the message body is not read.
    ...(message !== undefined ? { actorRef: message.authorPubkey } : {}),
    ...(message !== undefined ? { createdAt: message.createdAt } : {}),
  };
}

/**
 * Build a `space_activity` notification. Deliberately omits the event `content` —
 * the body is a GENERIC label. Only the space id (target) and, when supplied, the
 * event author pubkey and timestamp are carried.
 */
export function spaceEventToNotification(
  space: SpaceBase,
  event?: NostrEvent,
  channel: NotificationChannel = DEFAULT_CHANNEL,
): NotificationPayload {
  return {
    kind: "space_activity",
    channel,
    title: "New space activity",
    bodyPreview: "New space activity",
    targetRef: space.id,
    ...(event !== undefined ? { actorRef: event.pubkey } : {}),
    ...(event !== undefined ? { createdAt: event.created_at } : {}),
  };
}

/**
 * Build a `product_update` notification. Deliberately omits price, currency,
 * asset/storage refs, checksums, and any payment/download detail — the body is a
 * GENERIC label. Only the product id (target) and creator pubkey (an opaque public
 * actor ref) are carried.
 */
export function productEventToNotification(
  product: Product,
  channel: NotificationChannel = DEFAULT_CHANNEL,
): NotificationPayload {
  return {
    kind: "product_update",
    channel,
    title: "Product updated",
    bodyPreview: "Product updated",
    targetRef: product.id,
    actorRef: product.creatorPubkey,
  };
}

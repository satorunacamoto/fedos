/**
 * Stage 18 — bridge from a domain surface to a normalized `PromotionRequest`.
 *
 * Each helper maps one surface (thread / space / chat / product / search) onto a
 * placement and produces a context-filtered request ready to hand to a provider.
 * The mappings are pure and do not mutate their inputs. No selection, no I/O.
 */

import type { ChatRoom } from "../chat/types.js";
import type { Product } from "../commerce/types.js";
import type { Space } from "../community/types.js";
import {
  buildPromotionRequest,
  filterPromotionContext,
  resolvePlacement,
} from "./policy.js";
import type { PlacementType, PromotionRequest } from "./types.js";

/** Slots valid on a thread surface. */
export type ThreadPlacementType = "thread_header" | "thread_inline" | "thread_footer";
/** Slots valid on a space surface. */
export type SpacePlacementType = "space_header" | "space_sidebar" | "space_footer";
/** Slots valid on a chat surface. */
export type ChatPlacementType = "chat_header" | "chat_inline" | "chat_footer";

/** Shared targeting options for the bridge helpers. */
export interface PlacementBridgeOptions {
  readonly viewerPubkey?: string;
  readonly spaceId?: string;
  readonly tags?: readonly string[];
  readonly locale?: string;
  readonly limit?: number;
}

function build(
  type: PlacementType,
  options: {
    readonly viewerPubkey?: string;
    readonly spaceId?: string;
    readonly threadId?: string;
    readonly chatId?: string;
    readonly productId?: string;
    readonly tags?: readonly string[];
    readonly locale?: string;
    readonly limit?: number;
  },
): PromotionRequest {
  return filterPromotionContext(buildPromotionRequest(resolvePlacement(type), options));
}

/** Builds a request for a thread slot (defaults to the header). */
export function buildThreadPlacement(
  threadId: string,
  type: ThreadPlacementType = "thread_header",
  options: PlacementBridgeOptions = {},
): PromotionRequest {
  return build(type, {
    threadId,
    spaceId: options.spaceId,
    viewerPubkey: options.viewerPubkey,
    tags: options.tags,
    locale: options.locale,
    limit: options.limit,
  });
}

/** Builds a request for a space slot (defaults to the header). */
export function buildSpacePlacement(
  space: Space,
  type: SpacePlacementType = "space_header",
  options: PlacementBridgeOptions = {},
): PromotionRequest {
  return build(type, {
    spaceId: space.id,
    viewerPubkey: options.viewerPubkey,
    tags: options.tags,
    locale: options.locale,
    limit: options.limit,
  });
}

/**
 * Builds a request for a chat slot (defaults to the header). Carries the chat's
 * own `spaceId` link when the chat was opened from a space.
 */
export function buildChatPlacement(
  chat: ChatRoom,
  type: ChatPlacementType = "chat_header",
  options: PlacementBridgeOptions = {},
): PromotionRequest {
  return build(type, {
    chatId: chat.id,
    spaceId: options.spaceId ?? chat.spaceId,
    viewerPubkey: options.viewerPubkey,
    tags: options.tags,
    locale: options.locale,
    limit: options.limit,
  });
}

/**
 * Builds a request for the product sidebar. Adds a `kind:<kind>` targeting tag
 * and links the product's first linked space when present.
 */
export function buildProductPlacement(
  product: Product,
  options: PlacementBridgeOptions = {},
): PromotionRequest {
  return build("product_sidebar", {
    productId: product.id,
    spaceId: options.spaceId ?? product.linkedSpaceIds[0],
    viewerPubkey: options.viewerPubkey,
    tags: [`kind:${product.kind}`, ...(options.tags ?? [])],
    locale: options.locale,
    limit: options.limit,
  });
}

/** Builds a request for a search-result slot (tags carry the query terms). */
export function buildSearchPlacement(
  options: PlacementBridgeOptions = {},
): PromotionRequest {
  return build("search_result", {
    viewerPubkey: options.viewerPubkey,
    tags: options.tags,
    locale: options.locale,
    limit: options.limit,
  });
}

/**
 * Stage 18 — pure policy/helpers for the promotion boundary.
 *
 * All functions are pure: they assemble or normalize request shapes and never
 * mutate inputs, perform I/O, select ads, or measure anything. The actual
 * fetching of candidates is the provider's job (see `adapter.ts`).
 */

import type {
  Placement,
  PlacementContext,
  PlacementType,
  PromotionRequest,
} from "./types.js";

const DEFAULT_LIMIT = 1;

/** Which surface family each slot belongs to (exhaustive over `PlacementType`). */
const PLACEMENT_CONTEXT: Record<PlacementType, PlacementContext> = {
  thread_header: "thread",
  thread_inline: "thread",
  thread_footer: "thread",
  space_header: "space",
  space_sidebar: "space",
  space_footer: "space",
  chat_header: "chat",
  chat_inline: "chat",
  chat_footer: "chat",
  product_sidebar: "product",
  search_result: "search",
};

/**
 * Which context-id fields are meaningful for a given surface. Anything not
 * listed is dropped by `filterPromotionContext` (a space slot has no threadId,
 * a search slot carries no entity id, etc.).
 */
const CONTEXT_ID_FIELDS: Record<
  PlacementContext,
  readonly ("spaceId" | "threadId" | "chatId" | "productId")[]
> = {
  thread: ["spaceId", "threadId"],
  space: ["spaceId"],
  chat: ["spaceId", "chatId"],
  product: ["spaceId", "productId"],
  search: [],
};

/** Turns a slot id into a human label, e.g. `thread_header` -> "Thread header". */
function toLabel(type: PlacementType): string {
  const spaced = type.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Dedupes tags (first-seen order) and drops empty/non-string entries. */
function dedupeTags(tags: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (typeof tag === "string" && tag.length > 0 && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

/** Resolves a slot id into a full `Placement` (slot + surface family + label). */
export function resolvePlacement(type: PlacementType): Placement {
  return { type, context: PLACEMENT_CONTEXT[type], label: toLabel(type) };
}

/** Options accepted by `buildPromotionRequest` (all but `placement` optional). */
export interface BuildPromotionRequestOptions {
  readonly viewerPubkey?: string;
  readonly spaceId?: string;
  readonly threadId?: string;
  readonly chatId?: string;
  readonly productId?: string;
  readonly tags?: readonly string[];
  readonly locale?: string;
  readonly limit?: number;
}

/**
 * Assembles a `PromotionRequest` for a placement. `limit` defaults to 1 and is
 * floored at 0; tags are deduped. Context ids are taken as supplied here — call
 * `filterPromotionContext` to strip ones irrelevant to the placement.
 */
export function buildPromotionRequest(
  placement: Placement,
  options: BuildPromotionRequestOptions = {},
): PromotionRequest {
  const rawLimit = options.limit ?? DEFAULT_LIMIT;
  return {
    placement,
    ...(options.viewerPubkey !== undefined ? { viewerPubkey: options.viewerPubkey } : {}),
    ...(options.spaceId !== undefined ? { spaceId: options.spaceId } : {}),
    ...(options.threadId !== undefined ? { threadId: options.threadId } : {}),
    ...(options.chatId !== undefined ? { chatId: options.chatId } : {}),
    ...(options.productId !== undefined ? { productId: options.productId } : {}),
    tags: dedupeTags(options.tags ?? []),
    ...(options.locale !== undefined ? { locale: options.locale } : {}),
    limit: rawLimit > 0 ? rawLimit : 0,
  };
}

/**
 * Returns a NEW request with context ids irrelevant to the placement's surface
 * removed and tags re-deduped. Pure: the input request is not mutated.
 */
export function filterPromotionContext(request: PromotionRequest): PromotionRequest {
  const allowed = CONTEXT_ID_FIELDS[request.placement.context];
  const keep = (field: "spaceId" | "threadId" | "chatId" | "productId"): boolean =>
    allowed.includes(field) && request[field] !== undefined;

  return {
    placement: request.placement,
    ...(request.viewerPubkey !== undefined ? { viewerPubkey: request.viewerPubkey } : {}),
    ...(keep("spaceId") ? { spaceId: request.spaceId } : {}),
    ...(keep("threadId") ? { threadId: request.threadId } : {}),
    ...(keep("chatId") ? { chatId: request.chatId } : {}),
    ...(keep("productId") ? { productId: request.productId } : {}),
    tags: dedupeTags(request.tags),
    ...(request.locale !== undefined ? { locale: request.locale } : {}),
    limit: request.limit,
  };
}

/**
 * Whether a promotion may be requested for this surface at all. This is an
 * advisory gate only (e.g. the surface asked for zero slots); it does NOT decide
 * which ad shows — that stays with the external system behind a provider.
 */
export function canShowPromotion(request: PromotionRequest): boolean {
  return request.limit > 0;
}

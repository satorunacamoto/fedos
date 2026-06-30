/**
 * Stage 17 — bridge between Stage 9 spaces / Nostr events and products.
 *
 * Builds a draft `Product` linked to a space or to an event so a creator can
 * attach digital goods to an existing board/space/post, and decides whether a
 * creator may surface ("promote") their product inside a space. The mappings are
 * pure and do not mutate their inputs.
 *
 * A bridged product defaults to `status: "draft"` — newly attached goods are not
 * live until the creator activates them. No payment, listing, or publish happens
 * here; this only produces model data and permission decisions.
 */

import { canPost } from "../community/policy.js";
import type { Space } from "../community/types.js";
import type { NostrEvent } from "../nostr/types.js";
import { canEditProduct } from "./policy.js";
import type {
  AccessDecision,
  Product,
  ProductKind,
  ProductStatus,
  ProductVisibility,
} from "./types.js";

/** Caller-supplied commerce metadata for a bridged product. */
export interface ProductDraftOptions {
  readonly id: string;
  /** Defaults to the space's first owner / the event author when omitted. */
  readonly creatorPubkey?: string;
  readonly kind?: ProductKind;
  readonly title?: string;
  readonly description?: string;
  readonly priceCents?: number;
  readonly currency?: string;
  readonly status?: ProductStatus;
  readonly visibility?: ProductVisibility;
  readonly assetIds?: readonly string[];
}

function decide(allowed: boolean, reason: string): AccessDecision {
  return { allowed, reason };
}

/**
 * Builds a draft product linked to a space. The creator defaults to the space's
 * first owner and the product's visibility defaults to the space's visibility
 * (both `ProductVisibility` and `SpaceVisibility` share public/unlisted/private).
 */
export function productFromSpace(space: Space, options: ProductDraftOptions): Product {
  return {
    id: options.id,
    kind: options.kind ?? "other",
    title: options.title ?? space.name,
    description: options.description ?? space.description,
    creatorPubkey: options.creatorPubkey ?? space.owners[0] ?? "",
    priceCents: options.priceCents ?? 0,
    currency: options.currency ?? "USD",
    status: options.status ?? "draft",
    visibility: options.visibility ?? space.visibility,
    linkedSpaceIds: [space.id],
    linkedEventIds: [],
    assetIds: options.assetIds ?? [],
  };
}

/**
 * Builds a draft product linked to an event. The creator defaults to the event
 * author. Visibility defaults to `private` (a product attached to a public note
 * is not itself public until the creator opts in).
 */
export function productFromEvent(event: NostrEvent, options: ProductDraftOptions): Product {
  return {
    id: options.id,
    kind: options.kind ?? "other",
    title: options.title ?? "",
    description: options.description,
    creatorPubkey: options.creatorPubkey ?? event.pubkey,
    priceCents: options.priceCents ?? 0,
    currency: options.currency ?? "USD",
    status: options.status ?? "draft",
    visibility: options.visibility ?? "private",
    linkedSpaceIds: [],
    linkedEventIds: [event.id],
    assetIds: options.assetIds ?? [],
  };
}

/**
 * Whether the actor may promote (surface) the product inside the space. Requires
 * both that the actor is the product's creator and that the space's post policy
 * lets them post there. Does not mutate inputs.
 */
export function canPromoteProductInSpace(
  actorPubkey: string,
  product: Product,
  space: Space,
): AccessDecision {
  if (!canEditProduct(actorPubkey, product).allowed) {
    return decide(false, "only the product creator may promote it");
  }
  const post = canPost(actorPubkey, space);
  if (!post.allowed) {
    return decide(false, `cannot promote in space: ${post.reason}`);
  }
  return decide(true, "creator may promote the product in this space");
}

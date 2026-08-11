/**
 * Stage 17 — pure access policy over products and their assets.
 *
 * All functions are pure: they read the product's status/visibility/creator and
 * the supplied `PurchaseGrant`s and return an `AccessDecision`. They never mutate
 * inputs, hit storage, charge money, or verify that a payment occurred (a grant
 * is taken as an already-trusted external result).
 *
 * - View (`canViewProduct`): an active product follows its visibility — public/
 *   unlisted are viewable by anyone (unlisted only with the id), private only by
 *   the creator or a valid grant holder. A draft/archived product is visible to
 *   its creator only.
 * - Edit (`canEditProduct`): the creator only.
 * - Asset access (`canAccessAsset`): the creator or a holder of a valid (not
 *   revoked) grant only. This is an advisory gate, NOT DRM or download control.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type { AccessDecision, Product, PurchaseGrant } from "./types.js";

function decide(allowed: boolean, reason: string): AccessDecision {
  return { allowed, reason };
}

/** True if the actor is this product's creator. */
function isCreator(actorPubkey: string, product: Product): boolean {
  return actorPubkey.length > 0 && actorPubkey === product.creatorPubkey;
}

/** True if a single grant currently entitles the actor to the product. */
function grantEntitles(
  grant: PurchaseGrant,
  actorPubkey: string,
  productId: string,
): boolean {
  return (
    grant.productId === productId &&
    grant.buyerPubkey === actorPubkey &&
    grant.revokedAt === undefined
  );
}

/**
 * True if the actor holds at least one valid (non-revoked) grant for the
 * product. A guest (empty actor) never holds a grant.
 */
export function hasPurchaseGrant(
  actorPubkey: string,
  productId: string,
  grants: readonly PurchaseGrant[],
): boolean {
  if (actorPubkey.length === 0) return false;
  return grants.some((grant) => grantEntitles(grant, actorPubkey, productId));
}

/**
 * Whether the actor may view the product listing. Grants are optional and only
 * matter for a private product (a grant holder may view what they bought).
 */
export function canViewProduct(
  actorPubkey: string,
  product: Product,
  grants: readonly PurchaseGrant[] = [],
): AccessDecision {
  const creator = isCreator(actorPubkey, product);

  if (product.status !== "active") {
    return creator
      ? decide(true, `creator may view ${product.status} product`)
      : decide(false, `${product.status} product is visible to its creator only`);
  }

  switch (product.visibility) {
    case "public":
      return decide(true, "public active product");
    case "unlisted":
      return decide(true, "unlisted active product (viewable with the id)");
    case "private":
      if (creator) return decide(true, "creator of private product");
      return hasPurchaseGrant(actorPubkey, product.id, grants)
        ? decide(true, "valid purchase grant for private product")
        : decide(false, "private product requires a valid purchase grant");
  }
}

/** Whether the actor may edit the product. Creator only. */
export function canEditProduct(actorPubkey: string, product: Product): AccessDecision {
  return isCreator(actorPubkey, product)
    ? decide(true, "creator may edit the product")
    : decide(false, "only the creator may edit the product");
}

/**
 * Whether the actor may access the product's digital assets. Creator or a holder
 * of a valid (non-revoked) grant only. This is an advisory model decision — it
 * is NOT download enforcement, DRM, or any form of content protection.
 */
export function canAccessAsset(
  actorPubkey: string,
  product: Product,
  grants: readonly PurchaseGrant[],
): AccessDecision {
  if (isCreator(actorPubkey, product)) {
    return decide(true, "creator may access product assets");
  }
  return hasPurchaseGrant(actorPubkey, product.id, grants)
    ? decide(true, "valid purchase grant")
    : decide(false, "asset access requires a valid purchase grant");
}

/**
 * Stage 17 — pure event -> product classification.
 *
 * Reads product references out of a Nostr event's tags and maps the event onto
 * known products. The tag conventions are kept behind this adapter so it can be
 * pointed at a NIP-based scheme later without touching callers.
 *
 * Recognized product tags (value -> product id):
 *   ["product", "<productId>"]      -> "<productId>"
 *   ["t", "product:<productId>"]    -> "<productId>"
 * Anything else (including a plain ["t", "topic"] or a malformed tag) is ignored.
 *
 * Moved from `src/os/commerce/catalog/classify.ts` into this reserved
 * adapter directory — this file's entire purpose is reading Nostr event
 * shapes, so it belongs behind the same Nostr-adapter boundary as
 * `bridge.ts`'s `productFromEvent`, not in commerce domain logic. See
 * `docs/architecture/COMMERCE-ARCHITECTURE.md`.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type { NostrEvent } from "../../../../../nostr/types.js";
import type { Product } from "../../types.js";

const T_PRODUCT_PREFIX = "product:";

/** Extracts referenced product ids from an event (deduped, first-seen order). */
export function getProductTags(event: NostrEvent): string[] {
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
    if (name === "product") {
      push(value);
    } else if (
      name === "t" &&
      typeof value === "string" &&
      value.startsWith(T_PRODUCT_PREFIX)
    ) {
      push(value.slice(T_PRODUCT_PREFIX.length));
    }
  }

  return ids;
}

/** True if the event references the given product by id. */
export function eventMatchesProduct(event: NostrEvent, product: Product): boolean {
  return getProductTags(event).includes(product.id);
}

/**
 * Returns the subset of `products` the event references (by id). Unknown product
 * references are ignored; an event with no product tags returns []. Does not
 * mutate inputs.
 */
export function classifyEventToProducts(
  event: NostrEvent,
  products: readonly Product[],
): Product[] {
  const referenced = new Set(getProductTags(event));
  if (referenced.size === 0) return [];
  return products.filter((product) => referenced.has(product.id));
}

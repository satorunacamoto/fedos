/**
 * Nostr adapter for the catalog bridge.
 *
 * Split out of `../../bridge.ts` so `NostrEvent` (a messenger-transport type)
 * never appears in `src/os/commerce/catalog/` domain logic directly — only
 * this reserved adapter directory is allowed to know about Nostr's event
 * shape. See `docs/architecture/COMMERCE-ARCHITECTURE.md`.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type { NostrEvent } from "../../../../../nostr/types.js";
import type { ProductDraftOptions } from "../../bridge.js";
import type { Product } from "../../types.js";

/**
 * Builds a draft product linked to an event. The creator defaults to the
 * event author. Visibility defaults to `private` (a product attached to a
 * public note is not itself public until the creator opts in).
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

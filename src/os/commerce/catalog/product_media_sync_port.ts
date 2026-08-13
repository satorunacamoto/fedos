/**
 * ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
 * Truthful Completion mega-arc, Wave A) — the PORT a seller-side caller
 * (a future composition-root attach/detach handler) would depend on to
 * publish a `ProductMediaDeclaration`/`ProductMediaRetraction`
 * (`./product_media_declaration_types.ts`).
 *
 * PURE INTERFACE — no Nostr type appears here. The one real implementation
 * this wave ships, `NostrProductMediaSyncPort`
 * (`./adapters/nostr/product_media_sync_bridge.ts`), composes the
 * EXISTING, unmodified `CommerceNostrEventPort`
 * (`../events/commerce_nostr_event_port.ts`) rather than opening a new
 * transport — see that adapter file's own header and the design doc's
 * architecture diagram.
 */

import type { ProductMediaDeclaration, ProductMediaRetraction } from "./product_media_declaration_types.js";

export type ProductMediaSyncPublishOutcome =
  | "published"
  | "duplicate"
  | "rejected"
  | "transport-error"
  | "network-disabled";

export interface ProductMediaSyncPublishResult {
  readonly outcome: ProductMediaSyncPublishOutcome;
  readonly reason: string;
  readonly eventId?: string;
}

export interface ProductMediaSyncPort {
  publishDeclaration(declaration: ProductMediaDeclaration): Promise<ProductMediaSyncPublishResult>;
  publishRetraction(retraction: ProductMediaRetraction): Promise<ProductMediaSyncPublishResult>;
}

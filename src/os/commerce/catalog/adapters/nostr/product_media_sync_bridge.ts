/**
 * ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
 * Truthful Completion mega-arc, Wave A) — the ONE real
 * `ProductMediaSyncPort` (`../../product_media_sync_port.ts`)
 * implementation this wave ships. Bridges the pure domain
 * `ProductMediaDeclaration`/`ProductMediaRetraction`
 * (`../../product_media_declaration_types.ts`) into the EXISTING, wholly
 * unmodified `CommerceNostrEventPort`/`CommerceNostrEventDraft` wire
 * pipeline (`../../../events/commerce_nostr_event_port.ts`,
 * `../../../events/commerce_nostr_event_drafts.ts`) — no new transport, no
 * new signing path, no new dedup/network-gating logic. This file's only
 * job is the domain<->wire field mapping plus delegating `publish()`.
 *
 * Lives in this reserved adapter directory (`NOSTR_ADAPTER_DIR`,
 * `test/architecture_boundary_commerce.test.ts`) alongside
 * `commerce_event_bridge.ts`/`commerce_inbound_event_bridge.ts` — but,
 * notably, does NOT itself import a real `NostrEvent` type or a real
 * signing/verification primitive; it only imports the already-generic
 * `CommerceNostrEventPort`, which is what actually reaches
 * `RealCommerceNostrEventTransport` (unmodified, same file, same wave-B
 * wiring already documented there). It lives here rather than in
 * `../../product_media_sync_port.ts` itself specifically because it is
 * the ADAPTER half of the domain/port/adapter split the mandate requires
 * — see `docs/commerce/PRODUCTMEDIA-SYNC-PROTOCOL-DESIGN.md`'s
 * architecture diagram.
 */

import type { CommerceNostrEventPort } from "../../../events/commerce_nostr_event_port.js";
import type {
  ProductMediaDeclarationEventDraft,
  ProductMediaRetractionEventDraft,
} from "../../../events/commerce_nostr_event_drafts.js";
import type {
  ProductMediaSyncPort,
  ProductMediaSyncPublishResult,
} from "../../product_media_sync_port.js";
import type {
  ProductMediaDeclaration,
  ProductMediaRetraction,
} from "../../product_media_declaration_types.js";

/** Pure mapping: domain declaration -> wire draft. The two interfaces are field-content-identical (every field is already public — see design doc) but deliberately remain separate TypeScript types; this function is the one seam that connects them. */
export function productMediaDeclarationToEventDraft(
  declaration: ProductMediaDeclaration,
): ProductMediaDeclarationEventDraft {
  return {
    category: "product-media-declaration",
    formatVersion: 1,
    mediaId: declaration.mediaId,
    productId: declaration.productId,
    sellerPubkey: declaration.sellerPubkey,
    role: declaration.role,
    classification: declaration.classification,
    contentType: declaration.contentType,
    sizeClass: declaration.sizeClass,
    checksum: declaration.checksum,
    checksumSubject: declaration.checksumSubject,
    ...(declaration.altText !== undefined ? { altText: declaration.altText } : {}),
    version: declaration.version,
    declaredAt: declaration.declaredAt,
  };
}

/** Pure mapping: domain retraction -> wire draft. */
export function productMediaRetractionToEventDraft(
  retraction: ProductMediaRetraction,
): ProductMediaRetractionEventDraft {
  return {
    category: "product-media-retraction",
    formatVersion: 1,
    mediaId: retraction.mediaId,
    productId: retraction.productId,
    sellerPubkey: retraction.sellerPubkey,
    version: retraction.version,
    retractedAt: retraction.retractedAt,
  };
}

/**
 * `ProductMediaSyncPort` over an injected `CommerceNostrEventPort` — the
 * SAME Port instance a real composition root already constructs for
 * `product-publication`/`product-update` (see
 * `commerce_event_bridge.ts`'s own header: `commerceNostrOutboundPortFor()`
 * in `fedos_electron_beta_main.cts`, Wave B's integration point, not built
 * here). Publishing a `ProductMediaDeclaration`/`ProductMediaRetraction`
 * through this class inherits, for free, `CommerceNostrEventPortImpl`'s own
 * field-safety validation, publish-side de-duplication, and
 * `NetworkProfile` gating — none of that is reimplemented here.
 */
export class NostrProductMediaSyncPort implements ProductMediaSyncPort {
  readonly #port: CommerceNostrEventPort;

  constructor(port: CommerceNostrEventPort) {
    this.#port = port;
  }

  async publishDeclaration(declaration: ProductMediaDeclaration): Promise<ProductMediaSyncPublishResult> {
    const result = await this.#port.publish(productMediaDeclarationToEventDraft(declaration));
    return { outcome: result.outcome, reason: result.reason, eventId: result.eventId };
  }

  async publishRetraction(retraction: ProductMediaRetraction): Promise<ProductMediaSyncPublishResult> {
    const result = await this.#port.publish(productMediaRetractionToEventDraft(retraction));
    return { outcome: result.outcome, reason: result.reason, eventId: result.eventId };
  }
}

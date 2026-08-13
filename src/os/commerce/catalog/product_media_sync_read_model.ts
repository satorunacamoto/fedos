/**
 * ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
 * Truthful Completion mega-arc, Wave A) — pure domain ingestion logic:
 * ordering, replay-rejection, and product/signer binding for
 * `ProductMediaDeclaration`/`ProductMediaRetraction`
 * (`./product_media_declaration_types.ts`).
 *
 * See `docs/commerce/PRODUCTMEDIA-SYNC-PROTOCOL-DESIGN.md` §5–§8 for the
 * full rules and a worked example.
 *
 * PURE DOMAIN LAYER — deliberately transport-agnostic, mirroring
 * `../events/commerce_nostr_event_read_model.ts`'s own
 * `InboundCommerceNostrEnvelope` discipline: this class never imports a
 * Nostr type and never parses JSON itself. It takes an already-verified,
 * already-parsed generic envelope (`ProductMediaSyncVerifiedEnvelope`
 * below) plus an already-structurally-valid domain object — the caller
 * (the Nostr adapter, `../events/commerce_nostr_event_read_model.ts`'s own
 * `CommerceNostrProductReadModel`, in this arc's own wiring) is
 * responsible for signature verification and wire-shape parsing before
 * ever calling `ingestDeclaration()`/`ingestRetraction()`. This keeps the
 * class fully unit-testable with zero Nostr/crypto dependencies, and
 * reusable by a hypothetical future non-Nostr transport without change.
 *
 * PRODUCT BINDING (design doc §5/§9)
 * ----------------------------------------------------------------------
 * This class holds NO notion of "known products" itself — it would need to
 * duplicate `CommerceNostrProductReadModel`'s own `#products` map to do so,
 * which is exactly the "make the wire event shape the canonical model"
 * trap the mandate's architecture requirement warns against. Instead, the
 * caller passes `knownProductCreatorPubkey: string | undefined` on every
 * call — the real, already-established creator of `declaration.productId`
 * from whatever product read-model the caller already maintains, or
 * `undefined` if that productId is not yet known at all. This keeps
 * `ProductMediaSyncReadModel` genuinely reusable/testable standalone (a
 * test can assert the binding rule directly, by varying this one
 * parameter) while still composing cleanly with the real product read
 * model in production (see the adapter-layer wiring in
 * `../events/commerce_nostr_event_read_model.ts`).
 */

import {
  validateProductMediaDeclaration,
  validateProductMediaRetraction,
  type ProductMediaDeclaration,
  type ProductMediaRetraction,
} from "./product_media_declaration_types.js";

/** What ANY transport/adapter must produce before handing a candidate declaration/retraction to this class — mirrors `InboundCommerceNostrEnvelope`'s own fields exactly, deliberately, for consistency across the two read models. */
export interface ProductMediaSyncVerifiedEnvelope {
  /** Transport-assigned event id — used as the idempotent replay-dedup key. */
  readonly eventId: string;
  /** The event's REAL verified signer (hex pubkey) — never a claim read out of the payload's own `sellerPubkey` field. */
  readonly authorPubkeyHex: string;
  /** True only if a real signature+id check already passed for this exact event body. */
  readonly signatureVerified: boolean;
  /** This instance's own local-clock observation time (unix seconds). LOCAL ONLY. */
  readonly receivedAt: number;
}

export type ProductMediaSyncIngestOutcome =
  | "applied"
  | "duplicate"
  | "rejected-unverified-signature"
  | "rejected-malformed"
  | "rejected-unknown-product"
  | "rejected-product-mismatch"
  | "rejected-signer-mismatch"
  | "rejected-stale-version";

export interface ProductMediaSyncIngestResult {
  readonly outcome: ProductMediaSyncIngestOutcome;
  readonly reason: string;
  readonly mediaId?: string;
}

/** The read model's own derived view of one media declaration. Every field mirrors an already-PUBLIC declaration field, plus LOCAL-ONLY bookkeeping — see design doc's privacy table. */
export interface ProductMediaSyncView {
  readonly mediaId: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  readonly role: ProductMediaDeclaration["role"];
  readonly classification: ProductMediaDeclaration["classification"];
  readonly contentType: string;
  readonly sizeClass: ProductMediaDeclaration["sizeClass"];
  readonly checksum: string;
  readonly checksumSubject: ProductMediaDeclaration["checksumSubject"];
  readonly altText?: string;
  readonly version: number;
  readonly declaredAt: number;
  /** LOCAL ONLY — this read model's own bookkeeping of which event produced the current view. Never published. */
  readonly lastEventId: string;
  /** LOCAL ONLY — derived state, never itself a wire field. */
  readonly retracted: boolean;
}

export class ProductMediaSyncReadModel {
  readonly #appliedEventIds = new Set<string>();
  readonly #views = new Map<string, ProductMediaSyncView>();
  /** Highest `version` ever applied (declaration OR retraction) per mediaId — the sole ordering/replay-rejection watermark (design doc §6/§8). */
  readonly #versionWatermarkByMediaId = new Map<string, number>();

  ingestDeclaration(
    envelope: ProductMediaSyncVerifiedEnvelope,
    declaration: unknown,
    knownProductCreatorPubkey: string | undefined,
  ): ProductMediaSyncIngestResult {
    if (this.#appliedEventIds.has(envelope.eventId)) {
      return { outcome: "duplicate", reason: "event id already applied — idempotent no-op, state unchanged" };
    }
    if (!envelope.signatureVerified) {
      return { outcome: "rejected-unverified-signature", reason: "signature/id verification did not pass — event is untrusted, possibly tampered" };
    }

    const validation = validateProductMediaDeclaration(declaration);
    if (!validation.valid) {
      return { outcome: "rejected-malformed", reason: `malformed product-media declaration: ${validation.reason}` };
    }
    const decl = declaration as ProductMediaDeclaration;

    const bindingResult = this.#checkProductBinding(decl.productId, decl.sellerPubkey, envelope.authorPubkeyHex, knownProductCreatorPubkey);
    if (bindingResult !== null) return { ...bindingResult, mediaId: decl.mediaId };

    const watermark = this.#versionWatermarkByMediaId.get(decl.mediaId) ?? 0;
    if (decl.version <= watermark) {
      return {
        outcome: "rejected-stale-version",
        reason: "declaration version does not advance the currently-applied watermark for this mediaId — stale/replayed, ignored",
        mediaId: decl.mediaId,
      };
    }

    this.#versionWatermarkByMediaId.set(decl.mediaId, decl.version);
    this.#views.set(decl.mediaId, {
      mediaId: decl.mediaId,
      productId: decl.productId,
      sellerPubkey: decl.sellerPubkey,
      role: decl.role,
      classification: decl.classification,
      contentType: decl.contentType,
      sizeClass: decl.sizeClass,
      checksum: decl.checksum,
      checksumSubject: decl.checksumSubject,
      ...(decl.altText !== undefined ? { altText: decl.altText } : {}),
      version: decl.version,
      declaredAt: decl.declaredAt,
      lastEventId: envelope.eventId,
      retracted: false,
    });
    this.#appliedEventIds.add(envelope.eventId);
    return { outcome: "applied", reason: "product-media declaration applied", mediaId: decl.mediaId };
  }

  ingestRetraction(
    envelope: ProductMediaSyncVerifiedEnvelope,
    retraction: unknown,
    knownProductCreatorPubkey: string | undefined,
  ): ProductMediaSyncIngestResult {
    if (this.#appliedEventIds.has(envelope.eventId)) {
      return { outcome: "duplicate", reason: "event id already applied — idempotent no-op, state unchanged" };
    }
    if (!envelope.signatureVerified) {
      return { outcome: "rejected-unverified-signature", reason: "signature/id verification did not pass — event is untrusted, possibly tampered" };
    }

    const validation = validateProductMediaRetraction(retraction);
    if (!validation.valid) {
      return { outcome: "rejected-malformed", reason: `malformed product-media retraction: ${validation.reason}` };
    }
    const retr = retraction as ProductMediaRetraction;

    const bindingResult = this.#checkProductBinding(retr.productId, retr.sellerPubkey, envelope.authorPubkeyHex, knownProductCreatorPubkey);
    if (bindingResult !== null) return { ...bindingResult, mediaId: retr.mediaId };

    const watermark = this.#versionWatermarkByMediaId.get(retr.mediaId) ?? 0;
    if (retr.version <= watermark) {
      return {
        outcome: "rejected-stale-version",
        reason: "retraction version does not advance the currently-applied watermark for this mediaId — stale/replayed, ignored",
        mediaId: retr.mediaId,
      };
    }

    this.#versionWatermarkByMediaId.set(retr.mediaId, retr.version);
    const existing = this.#views.get(retr.mediaId);
    if (existing !== undefined) {
      this.#views.set(retr.mediaId, { ...existing, retracted: true, lastEventId: envelope.eventId, version: retr.version });
    }
    this.#appliedEventIds.add(envelope.eventId);
    return { outcome: "applied", reason: "product-media retraction applied", mediaId: retr.mediaId };
  }

  /** Returns a rejection result, or `null` if binding passes. */
  #checkProductBinding(
    productId: string,
    claimedSellerPubkey: string,
    realAuthorPubkeyHex: string,
    knownProductCreatorPubkey: string | undefined,
  ): { readonly outcome: ProductMediaSyncIngestOutcome; readonly reason: string } | null {
    if (knownProductCreatorPubkey === undefined) {
      return {
        outcome: "rejected-unknown-product",
        reason: `product-media event arrived before any product-publication for productId "${productId}" — out of order`,
      };
    }
    if (claimedSellerPubkey !== knownProductCreatorPubkey) {
      return {
        outcome: "rejected-product-mismatch",
        reason: "declared sellerPubkey does not match the product's already-established real creator — wrong product/wrong seller",
      };
    }
    if (realAuthorPubkeyHex !== claimedSellerPubkey) {
      return {
        outcome: "rejected-signer-mismatch",
        reason: "the event's real verified signer does not match the declaration's own claimed sellerPubkey",
      };
    }
    return null;
  }

  getView(mediaId: string): ProductMediaSyncView | undefined {
    return this.#views.get(mediaId);
  }

  listForProduct(productId: string): readonly ProductMediaSyncView[] {
    return [...this.#views.values()].filter((view) => view.productId === productId);
  }

  isRetracted(mediaId: string): boolean {
    return this.#views.get(mediaId)?.retracted ?? false;
  }

  get appliedEventCount(): number {
    return this.#appliedEventIds.size;
  }
}

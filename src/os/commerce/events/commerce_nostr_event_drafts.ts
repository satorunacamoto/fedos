/**
 * FedOS Commerce End-to-End Completion, Wave B (Agent N) — Commerce Nostr
 * event category drafts (original brief §11/§31/§16).
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as the rest of `src/os/commerce`
 * (see `../README.md`): nothing here is wired into `createCommerce()`, the
 * shipped Electron app, or any relay. It defines the SMALLEST bounded set of
 * Commerce Nostr event "drafts" Commerce domain code could ever construct,
 * plus a strict, fail-closed, allowlist-only validator for each — the single
 * most important property in this file. A draft that does not pass its
 * validator MUST NEVER reach `CommerceNostrEventPort.publish()`'s transport
 * call (`commerce_nostr_event_port.ts` enforces this at the Port boundary;
 * this file only defines what "valid" means).
 *
 * WHY SIX CATEGORIES, NO MORE (updated: now EIGHT — see below)
 * ----------------------------------------------------------------------
 * Each category below is the coarsest, smallest public artifact that still
 * lets Commerce accomplish one real thing on a public relay. ProductMedia
 * Sync Protocol (Agent M, Commerce Product-Media Sync + Truthful
 * Completion mega-arc, Wave A) added two more, `product-media-declaration`
 * / `product-media-retraction` — see their own section below and
 * `docs/commerce/PRODUCTMEDIA-SYNC-PROTOCOL-DESIGN.md` for the full design
 * (why `media-manifest-reference` below was NOT reused/repurposed for
 * this — checked directly against the requirements, does not fit).
 *   - `product-publication` / `product-update` — list/update a PUBLIC
 *     product (mirrors `../catalog/types.ts`'s `Product`, `visibility:
 *     "public"` only — see that file's own doc comment: price/description
 *     are already-public marketplace display metadata, not a secret).
 *   - `order-commitment` — proves an order exists between two pseudonymous
 *      parties WITHOUT ever naming its price or contents (original brief
 *      §11, non-negotiable).
 *   - `trade-completion-attestation` / `reputation-attestation` — publish
 *     the ALREADY-DEFINED, ALREADY-FIELD-RESTRICTED payloads from
 *     `../reputation/attestation_types.ts` (`TradeCompletionAttestationPayload`,
 *     `ReputationAttestationPayload`) verbatim, wrapped in their own signed
 *     envelope shape. This file does not redesign those payloads — it only
 *     defines how they travel as a Nostr event, and re-validates them with
 *     the SAME imported, already-reviewed field-allowlist checks (defense in
 *     depth: an attacker who somehow constructs a payload with an injected
 *     forbidden field, e.g. a raw order id or a price, is still rejected
 *     here even if some future caller skipped the reputation module's own
 *     check).
 *   - `media-manifest-reference` — references a `MediaStorePort` object by
 *     CONTENT HASH ONLY, never the bytes, never a raw storage pointer/URL
 *     (original brief §11).
 *
 * PUBLIC-SAFE FIELD ALLOWLIST PER CATEGORY (read this before adding a field)
 * ----------------------------------------------------------------------
 * See each interface's own doc comment below for its exact field list and
 * the `*_ALLOWED_KEYS` constant next to it. Every validator rejects ANY key
 * outside that constant's set — an accidentally-added extra field (a raw
 * price on an order-commitment draft, a raw buyer pubkey where only a coarse
 * digest belongs, exact payment metadata, a free-text comment) is REJECTED
 * OUTRIGHT, never silently dropped or silently passed through. This mirrors
 * `attestation_types.ts`'s own "reject unknown keys" discipline (see that
 * file's header on why: an accidental debug field must fail closed, not
 * leak).
 *
 * FIELDS THAT MUST NEVER APPEAR ANYWHERE IN THIS FILE
 * ----------------------------------------------------------------------
 * A buyer's real identity (name/address/email/phone), a raw `Order`/payment
 * id, an exact price/amount tied to a specific trade (as opposed to a
 * product's own public listing price), exact payment rail metadata
 * (invoice id, transaction id, rail name), exact private delivery evidence,
 * or any free-text comment/note field. If a future category needs one of
 * these, that is a NEW, separately-justified design decision — not an
 * allowed addition to any interface below.
 */

import type {
  ReputationAttestationPayload,
  ReputationLocalSignedEnvelopeShape,
  TradeCompletionAttestationPayload,
} from "../reputation/attestation_types.js";
import {
  isWellFormedReputationAttestationPayload,
  isWellFormedTradeCompletionAttestationPayload,
} from "../reputation/attestation_types.js";
import {
  validateProductMediaDeclaration,
  validateProductMediaRetraction,
} from "../catalog/product_media_declaration_types.js";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Local mirror of `../catalog/types.ts`'s `ProductKind` — duplicated rather
 * than imported for the same reason `attestation_types.ts` mirrors Trust's
 * envelope shape instead of importing it: this file's validators must not
 * need to change whenever the catalog's own type gains a new value, and
 * `catalog/types.ts` is another agent's active territory this wave.
 */
export type CommerceNostrProductKindMirror =
  | "pdf"
  | "zip"
  | "template"
  | "software"
  | "link"
  | "other";

const PRODUCT_KIND_MIRROR_VALUES: readonly CommerceNostrProductKindMirror[] = [
  "pdf",
  "zip",
  "template",
  "software",
  "link",
  "other",
];

/**
 * Public listing status a product may be broadcast under. Deliberately
 * EXCLUDES `"draft"` (mirrors `../catalog/types.ts`'s `ProductStatus`,
 * narrowed) — a draft product's metadata is not yet the creator's public
 * word and must never be published, so `"draft"` is not a member of this
 * type and is rejected by every validator below that uses it.
 */
export type CommercePublicProductStatus = "active" | "archived";

const PUBLIC_PRODUCT_STATUSES: readonly CommercePublicProductStatus[] = ["active", "archived"];

export type CommerceOrderCommitmentStatus = "committed" | "fulfilled" | "cancelled";

const ORDER_COMMITMENT_STATUSES: readonly CommerceOrderCommitmentStatus[] = [
  "committed",
  "fulfilled",
  "cancelled",
];

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && HEX_64_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Category discriminant
// ---------------------------------------------------------------------------

export const COMMERCE_NOSTR_EVENT_CATEGORIES = [
  "product-publication",
  "product-update",
  "order-commitment",
  "trade-completion-attestation",
  "reputation-attestation",
  "media-manifest-reference",
  "product-media-declaration",
  "product-media-retraction",
] as const;

export type CommerceNostrEventCategory = (typeof COMMERCE_NOSTR_EVENT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// 1. product-publication
// ---------------------------------------------------------------------------

/**
 * A PUBLIC product listing announcement. PUBLIC-SAFE FIELDS ONLY — every
 * field here is already display metadata a public catalog entry carries
 * (mirrors `../catalog/types.ts`'s own "priceCents is display metadata
 * only — nothing here moves funds" discipline). Never carries
 * `linkedSpaceIds`/`linkedEventIds`/`assetIds`/`stock` — those are internal
 * routing/inventory details, not public listing content; asset references
 * belong in a separate `media-manifest-reference` event.
 */
export interface ProductPublicationEventDraft {
  readonly category: "product-publication";
  readonly formatVersion: 1;
  readonly productId: string;
  readonly productKind: CommerceNostrProductKindMirror;
  readonly title: string;
  readonly description?: string;
  /** The creator's own public Nostr pubkey — already public via the
   * creator's own account, not a new disclosure. */
  readonly creatorPubkey: string;
  /** Display price in minor units. Public marketplace listing data, NOT a
   * per-trade amount (see `order-commitment` below for why a per-trade
   * amount is forbidden instead). */
  readonly priceCents: number;
  readonly currency: string;
  /** Never `"draft"` — see this file's header. */
  readonly status: CommercePublicProductStatus;
  readonly publishedAt: number;
}

export const PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "productId",
  "productKind",
  "title",
  "description",
  "creatorPubkey",
  "priceCents",
  "currency",
  "status",
  "publishedAt",
]);

export function isWellFormedProductPublicationEventDraft(
  value: unknown,
): value is ProductPublicationEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "product-publication") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.productId)) return false;
  if (typeof c.productKind !== "string" || !PRODUCT_KIND_MIRROR_VALUES.includes(c.productKind as CommerceNostrProductKindMirror)) {
    return false;
  }
  if (!isNonEmptyString(c.title)) return false;
  if (c.description !== undefined && typeof c.description !== "string") return false;
  if (!isHex64(c.creatorPubkey)) return false;
  if (!isNonNegativeInteger(c.priceCents)) return false;
  if (!isNonEmptyString(c.currency)) return false;
  if (typeof c.status !== "string" || !PUBLIC_PRODUCT_STATUSES.includes(c.status as CommercePublicProductStatus)) {
    return false;
  }
  if (!isUnixSecondsInteger(c.publishedAt)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 2. product-update
// ---------------------------------------------------------------------------

/**
 * A PUBLIC amendment to a previously published product. Same public-safe
 * discipline as `ProductPublicationEventDraft` — every field is optional
 * except `productId`/`updatedAt`, but at least one of
 * `title`/`description`/`priceCents`/`currency`/`status` must be present
 * (an update with nothing changed is not a well-formed update).
 */
export interface ProductUpdateEventDraft {
  readonly category: "product-update";
  readonly formatVersion: 1;
  readonly productId: string;
  readonly title?: string;
  readonly description?: string;
  readonly priceCents?: number;
  readonly currency?: string;
  /** Never `"draft"` — see this file's header. */
  readonly status?: CommercePublicProductStatus;
  readonly updatedAt: number;
}

export const PRODUCT_UPDATE_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "productId",
  "title",
  "description",
  "priceCents",
  "currency",
  "status",
  "updatedAt",
]);

export function isWellFormedProductUpdateEventDraft(value: unknown): value is ProductUpdateEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRODUCT_UPDATE_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "product-update") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.productId)) return false;
  if (c.title !== undefined && typeof c.title !== "string") return false;
  if (c.description !== undefined && typeof c.description !== "string") return false;
  if (c.priceCents !== undefined && !isNonNegativeInteger(c.priceCents)) return false;
  if (c.currency !== undefined && typeof c.currency !== "string") return false;
  if (
    c.status !== undefined &&
    (typeof c.status !== "string" || !PUBLIC_PRODUCT_STATUSES.includes(c.status as CommercePublicProductStatus))
  ) {
    return false;
  }
  if (!isUnixSecondsInteger(c.updatedAt)) return false;
  if (
    c.title === undefined &&
    c.description === undefined &&
    c.priceCents === undefined &&
    c.currency === undefined &&
    c.status === undefined
  ) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 3. order-commitment (coarse — original brief §11, non-negotiable)
// ---------------------------------------------------------------------------

/**
 * Proves an order was created/committed between two PSEUDONYMOUS parties —
 * NEVER the order's price, currency, contents, payment rail, delivery
 * address, or the buyer's raw pubkey. `orderRefDigestHex` and
 * `buyerPartyDigestHex` MUST be one-way, SALTED digests computed locally by
 * Commerce before this draft is ever constructed — mirrors
 * `TradeCompletionAttestationPayload.tradeRefDigestHex`'s own documented
 * discipline in `../reputation/attestation_types.ts` (an unsalted digest of
 * a small id/pubkey space is brute-forceable back to the raw value). The
 * seller's pubkey is carried in the clear because it is already public via
 * that same seller's own `product-publication` events — this draft adds no
 * new disclosure on the seller side, only on the (deliberately withheld)
 * buyer side.
 *
 * THE FORBIDDEN LIST FOR THIS CATEGORY (enforced by the allowlist below,
 * never relaxed): `priceCents`/`amount`/`amountSats`, `currency`,
 * `buyerPubkey` (raw), `orderId` (raw), `paymentMethod`/`invoiceId`/
 * `transactionId`, `deliveryAddress`, `itemDescription`/`comment`/any
 * free-text field.
 */
export interface OrderCommitmentEventDraft {
  readonly category: "order-commitment";
  readonly formatVersion: 1;
  /** One-way, salted digest of the real order id. Never the raw id. */
  readonly orderRefDigestHex: string;
  /** One-way, salted digest of the buyer's identity/pubkey — a coarse,
   * unlinkable-by-a-third-party bucket, never the buyer's raw pubkey. */
  readonly buyerPartyDigestHex: string;
  /** The seller's real public Nostr pubkey — already public, see header. */
  readonly sellerPubkey: string;
  readonly status: CommerceOrderCommitmentStatus;
  readonly committedAt: number;
}

export const ORDER_COMMITMENT_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "orderRefDigestHex",
  "buyerPartyDigestHex",
  "sellerPubkey",
  "status",
  "committedAt",
]);

export function isWellFormedOrderCommitmentEventDraft(value: unknown): value is OrderCommitmentEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, ORDER_COMMITMENT_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "order-commitment") return false;
  if (c.formatVersion !== 1) return false;
  if (!isHex64(c.orderRefDigestHex)) return false;
  if (!isHex64(c.buyerPartyDigestHex)) return false;
  if (!isHex64(c.sellerPubkey)) return false;
  if (typeof c.status !== "string" || !ORDER_COMMITMENT_STATUSES.includes(c.status as CommerceOrderCommitmentStatus)) {
    return false;
  }
  if (!isUnixSecondsInteger(c.committedAt)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 4/5. trade-completion-attestation / reputation-attestation
// ---------------------------------------------------------------------------

/** Allowlisted keys of the local signed-envelope mirror this file wraps —
 * matches `ReputationLocalSignedEnvelopeShape`'s own field set exactly
 * (`../reputation/attestation_types.ts`). */
const ENVELOPE_SHAPE_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "version",
  "type",
  "issuer",
  "subject",
  "audience",
  "issuedAt",
  "expiresAt",
  "nonce",
  "payload",
  "signatureAlgorithm",
  "keyId",
  "signature",
]);

/**
 * Structural check for `ReputationLocalSignedEnvelopeShape<TPayload>`,
 * generic over the payload's own well-formedness check so this one
 * function serves both attestation categories without duplicating the
 * envelope-field logic. Fails closed; never throws.
 */
function isWellFormedEnvelopeShape<TPayload>(
  value: unknown,
  isWellFormedPayload: (payload: unknown) => payload is TPayload,
): value is ReputationLocalSignedEnvelopeShape<TPayload> {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, ENVELOPE_SHAPE_ALLOWED_KEYS)) return false;
  if (typeof c.version !== "number" || !Number.isInteger(c.version)) return false;
  if (!isNonEmptyString(c.type)) return false;
  if (!isNonEmptyString(c.issuer)) return false;
  if (c.subject !== undefined && typeof c.subject !== "string") return false;
  if (c.audience !== undefined && typeof c.audience !== "string") return false;
  if (!isUnixSecondsInteger(c.issuedAt)) return false;
  if (c.expiresAt !== undefined && !isUnixSecondsInteger(c.expiresAt)) return false;
  if (c.nonce !== undefined && typeof c.nonce !== "string") return false;
  if (!isWellFormedPayload(c.payload)) return false;
  if (!isNonEmptyString(c.signatureAlgorithm)) return false;
  if (!isNonEmptyString(c.keyId)) return false;
  if (!isNonEmptyString(c.signature)) return false;
  return true;
}

/**
 * Wraps an ALREADY-SIGNED `TradeCompletionAttestationPayload` envelope for
 * publication. This file does not redesign the payload — it re-validates it
 * with the SAME imported `isWellFormedTradeCompletionAttestationPayload`
 * (defense in depth; see this file's header).
 */
export interface TradeCompletionAttestationEventDraft {
  readonly category: "trade-completion-attestation";
  readonly formatVersion: 1;
  readonly envelope: ReputationLocalSignedEnvelopeShape<TradeCompletionAttestationPayload>;
}

export const TRADE_COMPLETION_ATTESTATION_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "envelope",
]);

export function isWellFormedTradeCompletionAttestationEventDraft(
  value: unknown,
): value is TradeCompletionAttestationEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, TRADE_COMPLETION_ATTESTATION_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "trade-completion-attestation") return false;
  if (c.formatVersion !== 1) return false;
  return isWellFormedEnvelopeShape(c.envelope, isWellFormedTradeCompletionAttestationPayload);
}

/**
 * Wraps an ALREADY-SIGNED `ReputationAttestationPayload` envelope for
 * publication. Same re-validation discipline as
 * `TradeCompletionAttestationEventDraft` above.
 */
export interface ReputationAttestationEventDraft {
  readonly category: "reputation-attestation";
  readonly formatVersion: 1;
  readonly envelope: ReputationLocalSignedEnvelopeShape<ReputationAttestationPayload>;
}

export const REPUTATION_ATTESTATION_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "envelope",
]);

export function isWellFormedReputationAttestationEventDraft(
  value: unknown,
): value is ReputationAttestationEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, REPUTATION_ATTESTATION_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "reputation-attestation") return false;
  if (c.formatVersion !== 1) return false;
  return isWellFormedEnvelopeShape(c.envelope, isWellFormedReputationAttestationPayload);
}

// ---------------------------------------------------------------------------
// 6. media-manifest-reference
// ---------------------------------------------------------------------------

/**
 * References a `MediaStorePort` object by CONTENT HASH ONLY — never the
 * bytes, never a raw storage pointer/URL/path (which could leak internal
 * backend layout). `contentHashHex` is a plain sha256 content hash (public
 * once the referenced product is public — a content hash of already-public
 * media is not itself a new secret), not a signed digest.
 */
export interface MediaManifestReferenceEventDraft {
  readonly category: "media-manifest-reference";
  readonly formatVersion: 1;
  readonly productId: string;
  readonly assetId: string;
  readonly mediaKind: CommerceNostrProductKindMirror;
  readonly contentHashHex: string;
  readonly sizeBytes?: number;
}

export const MEDIA_MANIFEST_REFERENCE_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "productId",
  "assetId",
  "mediaKind",
  "contentHashHex",
  "sizeBytes",
]);

export function isWellFormedMediaManifestReferenceEventDraft(
  value: unknown,
): value is MediaManifestReferenceEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, MEDIA_MANIFEST_REFERENCE_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "media-manifest-reference") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.productId)) return false;
  if (!isNonEmptyString(c.assetId)) return false;
  if (typeof c.mediaKind !== "string" || !PRODUCT_KIND_MIRROR_VALUES.includes(c.mediaKind as CommerceNostrProductKindMirror)) {
    return false;
  }
  if (!isHex64(c.contentHashHex)) return false;
  if (c.sizeBytes !== undefined && !isNonNegativeInteger(c.sizeBytes)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// 7/8. product-media-declaration / product-media-retraction
//
// ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
// Truthful Completion mega-arc, Wave A) — see
// `docs/commerce/PRODUCTMEDIA-SYNC-PROTOCOL-DESIGN.md` for the full design
// (why these two categories exist rather than reusing
// `media-manifest-reference` above — checked directly, does not fit: no
// `classification`, no `checksumSubject`, no ordering field, no
// seller-binding field), the complete field-by-field privacy
// classification, and the ordering/replay-rejection worked example.
//
// PUBLIC-SAFE FIELD ALLOWLIST, same discipline as every category above —
// every field is already as public as the `product-publication` event this
// media is attached to (see the design doc's privacy table for exactly
// why each field is safe). Deliberately EXCLUDES `storageRef` (an opaque,
// backend-specific pointer that could leak internal storage layout — same
// reasoning `media-manifest-reference` above already documents for never
// carrying a raw pointer/URL) and exact `sizeBytes` (a coarse `sizeClass`
// bucket is carried instead — design doc "resolved ambiguities" #2).
// Structural validation (including the "protected implies checksumSubject
// ciphertext" invariant) is delegated to the pure domain validators in
// `../catalog/product_media_declaration_types.ts` — this file does not
// duplicate that logic, only adds the category/formatVersion/allowlist
// checks every sibling draft already performs.
// ---------------------------------------------------------------------------

/** Local mirror of `ProductMediaRole` (`../catalog/product_media_types.ts`) — imported directly rather than re-declared, since (unlike `CommerceNostrProductKindMirror`'s own stated reason for mirroring `ProductKind`) `product_media_types.ts` is this SAME wave's own, already-stable territory, not another agent's active work. */
export type { ProductMediaRole, ProductMediaClassification, ProductMediaChecksumSubject } from "../catalog/product_media_types.js";
export type { ProductMediaSizeClass } from "../catalog/product_media_declaration_types.js";

import type {
  ProductMediaChecksumSubject as _PMChecksumSubject,
  ProductMediaClassification as _PMClassification,
  ProductMediaRole as _PMRole,
} from "../catalog/product_media_types.js";
import type { ProductMediaSizeClass as _PMSizeClass } from "../catalog/product_media_declaration_types.js";

export interface ProductMediaDeclarationEventDraft {
  readonly category: "product-media-declaration";
  readonly formatVersion: 1;
  readonly mediaId: string;
  readonly productId: string;
  /** The product's real, already-public creator pubkey — see design doc §5/§9. */
  readonly sellerPubkey: string;
  readonly role: _PMRole;
  readonly classification: _PMClassification;
  readonly contentType: string;
  readonly sizeClass: _PMSizeClass;
  readonly checksum: string;
  readonly checksumSubject: _PMChecksumSubject;
  readonly altText?: string;
  /** Monotonic per-mediaId ordering authority — never a timestamp. See design doc §6. */
  readonly version: number;
  readonly declaredAt: number;
}

export const PRODUCT_MEDIA_DECLARATION_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "mediaId",
  "productId",
  "sellerPubkey",
  "role",
  "classification",
  "contentType",
  "sizeClass",
  "checksum",
  "checksumSubject",
  "altText",
  "version",
  "declaredAt",
]);

export function isWellFormedProductMediaDeclarationEventDraft(
  value: unknown,
): value is ProductMediaDeclarationEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRODUCT_MEDIA_DECLARATION_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "product-media-declaration") return false;
  if (c.formatVersion !== 1) return false;
  return validateProductMediaDeclaration({
    mediaId: c.mediaId,
    productId: c.productId,
    sellerPubkey: c.sellerPubkey,
    role: c.role,
    classification: c.classification,
    contentType: c.contentType,
    sizeClass: c.sizeClass,
    checksum: c.checksum,
    checksumSubject: c.checksumSubject,
    altText: c.altText,
    version: c.version,
    declaredAt: c.declaredAt,
  }).valid;
}

/**
 * The unpublish/removal signal — a sibling category, not a status field on
 * the declaration itself (design doc §7: `ProductMedia` has no per-item
 * lifecycle field to mirror the way a whole `Product` does).
 */
export interface ProductMediaRetractionEventDraft {
  readonly category: "product-media-retraction";
  readonly formatVersion: 1;
  readonly mediaId: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  /** MUST exceed every previously-applied version for this mediaId — see design doc §7/§8 for why retraction also advances the ordering watermark. */
  readonly version: number;
  readonly retractedAt: number;
}

export const PRODUCT_MEDIA_RETRACTION_EVENT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "mediaId",
  "productId",
  "sellerPubkey",
  "version",
  "retractedAt",
]);

export function isWellFormedProductMediaRetractionEventDraft(
  value: unknown,
): value is ProductMediaRetractionEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRODUCT_MEDIA_RETRACTION_EVENT_ALLOWED_KEYS)) return false;
  if (c.category !== "product-media-retraction") return false;
  if (c.formatVersion !== 1) return false;
  return validateProductMediaRetraction({
    mediaId: c.mediaId,
    productId: c.productId,
    sellerPubkey: c.sellerPubkey,
    version: c.version,
    retractedAt: c.retractedAt,
  }).valid;
}

// ---------------------------------------------------------------------------
// Union + dispatcher
// ---------------------------------------------------------------------------

export type CommerceNostrEventDraft =
  | ProductPublicationEventDraft
  | ProductUpdateEventDraft
  | OrderCommitmentEventDraft
  | TradeCompletionAttestationEventDraft
  | ReputationAttestationEventDraft
  | MediaManifestReferenceEventDraft
  | ProductMediaDeclarationEventDraft
  | ProductMediaRetractionEventDraft;

/**
 * The single entry point every `CommerceNostrEventPort` implementation MUST
 * call before ever handing a draft to a transport. Fails closed to `false`
 * on any malformed input, any unrecognized `category`, or any of the
 * per-category structural/allowlist failures above; never throws.
 */
export function isWellFormedCommerceNostrEventDraft(value: unknown): value is CommerceNostrEventDraft {
  if (typeof value !== "object" || value === null) return false;
  const category = (value as Record<string, unknown>).category;
  switch (category) {
    case "product-publication":
      return isWellFormedProductPublicationEventDraft(value);
    case "product-update":
      return isWellFormedProductUpdateEventDraft(value);
    case "order-commitment":
      return isWellFormedOrderCommitmentEventDraft(value);
    case "trade-completion-attestation":
      return isWellFormedTradeCompletionAttestationEventDraft(value);
    case "reputation-attestation":
      return isWellFormedReputationAttestationEventDraft(value);
    case "media-manifest-reference":
      return isWellFormedMediaManifestReferenceEventDraft(value);
    case "product-media-declaration":
      return isWellFormedProductMediaDeclarationEventDraft(value);
    case "product-media-retraction":
      return isWellFormedProductMediaRetractionEventDraft(value);
    default:
      return false;
  }
}

/** Introspection map from category to its allowed-keys set — for tests and
 * for any future coordinator tooling that wants to enumerate the safety
 * contract without importing every individual constant by name. */
export const COMMERCE_NOSTR_EVENT_DRAFT_ALLOWED_KEYS: Readonly<
  Record<CommerceNostrEventCategory, ReadonlySet<string>>
> = {
  "product-publication": PRODUCT_PUBLICATION_EVENT_ALLOWED_KEYS,
  "product-update": PRODUCT_UPDATE_EVENT_ALLOWED_KEYS,
  "order-commitment": ORDER_COMMITMENT_EVENT_ALLOWED_KEYS,
  "trade-completion-attestation": TRADE_COMPLETION_ATTESTATION_EVENT_ALLOWED_KEYS,
  "reputation-attestation": REPUTATION_ATTESTATION_EVENT_ALLOWED_KEYS,
  "media-manifest-reference": MEDIA_MANIFEST_REFERENCE_EVENT_ALLOWED_KEYS,
  "product-media-declaration": PRODUCT_MEDIA_DECLARATION_EVENT_ALLOWED_KEYS,
  "product-media-retraction": PRODUCT_MEDIA_RETRACTION_EVENT_ALLOWED_KEYS,
};

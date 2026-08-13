/**
 * ProductMedia Sync Protocol (Agent M, Commerce Product-Media Sync +
 * Truthful Completion mega-arc, Wave A) — the PUBLIC, cross-process-safe
 * projection of a real `ProductMedia` record (`./product_media_types.ts`).
 *
 * See `docs/commerce/PRODUCTMEDIA-SYNC-PROTOCOL-DESIGN.md` for the full
 * design (privacy classification of every field, why this is a separate
 * type from `ProductMedia` rather than reusing it verbatim, why
 * `MediaManifestReferenceEventDraft` was not reused, ordering/replay
 * rules).
 *
 * PURE DOMAIN LAYER — no Nostr, no I/O, no network, no clock reads. This
 * file (plus `./product_media_sync_read_model.ts`) is the "domain first"
 * half of the mandate's own architecture requirement; the wire shape lives
 * in `../events/commerce_nostr_event_drafts.ts` and is a strictly separate
 * interface, never this one, even though every field is content-identical
 * (every field here is already PUBLIC — see the design doc's "domain type"
 * section for why there is no private domain-only superset to strip at the
 * wire boundary).
 *
 * WHY A SEPARATE TYPE FROM `ProductMedia` (NOT A SUBSET VIA `Pick<>`)
 * ----------------------------------------------------------------------
 * `ProductMedia` carries `storageRef` (an opaque, backend-specific pointer
 * — deliberately never made public, see the design doc §2) and
 * `nostrEventId` (this OWN event's own id would be circular to carry
 * inside its own content, and is meaningless before publication). Building
 * `ProductMediaDeclaration` as its own interface, with `deriveProductMedia
 * Declaration()` below as the ONE place a `ProductMedia` is ever narrowed
 * into it, makes "storageRef can never leak onto the wire" a structural
 * property of the type system, not a discipline a caller could forget.
 */

import {
  type ProductMedia,
  type ProductMediaChecksumSubject,
  type ProductMediaClassification,
  type ProductMediaRole,
} from "./product_media_types.js";

const HEX_64 = /^[0-9a-f]{64}$/;
const MAX_ID_CHARS = 200;
const MAX_CONTENT_TYPE_CHARS = 128;
const MAX_ALT_TEXT_CHARS = 500;

const VALID_ROLES: readonly ProductMediaRole[] = ["primary", "gallery", "thumbnail", "video", "video_preview", "sample"];
const VALID_CLASSIFICATIONS: readonly ProductMediaClassification[] = ["public", "protected"];
const VALID_CHECKSUM_SUBJECTS: readonly ProductMediaChecksumSubject[] = ["plaintext", "ciphertext"];

// ---------------------------------------------------------------------------
// Size bucketing — see design doc "resolved ambiguities" #2.
// ---------------------------------------------------------------------------

export type ProductMediaSizeClass = "tiny" | "small" | "medium" | "large" | "xlarge";

const SIZE_CLASS_VALUES: readonly ProductMediaSizeClass[] = ["tiny", "small", "medium", "large", "xlarge"];

/** Upper (exclusive) byte boundaries for each bucket below `xlarge`, which catches everything at or above the last one. Deliberately coarse — see design doc. */
const SIZE_CLASS_BOUNDARIES: ReadonlyArray<{ readonly under: number; readonly sizeClass: ProductMediaSizeClass }> = [
  { under: 10_000, sizeClass: "tiny" }, // < 10 KB
  { under: 100_000, sizeClass: "small" }, // < 100 KB
  { under: 1_000_000, sizeClass: "medium" }, // < 1 MB
  { under: 10_000_000, sizeClass: "large" }, // < 10 MB
];

/** Pure, deterministic bucketing of a real byte count into a coarse public size class. Never throws; a negative/non-finite input is treated as `"tiny"` (fails closed toward the LEAST informative bucket, never toward leaking more precision). */
export function productMediaSizeClassFor(sizeBytes: number): ProductMediaSizeClass {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return "tiny";
  for (const boundary of SIZE_CLASS_BOUNDARIES) {
    if (sizeBytes < boundary.under) return boundary.sizeClass;
  }
  return "xlarge";
}

// ---------------------------------------------------------------------------
// ProductMediaDeclaration — the public projection.
// ---------------------------------------------------------------------------

export interface ProductMediaDeclaration {
  readonly mediaId: string;
  readonly productId: string;
  /** The product's real, already-public creator pubkey — see design doc §5/§9 for the binding check this enables. */
  readonly sellerPubkey: string;
  readonly role: ProductMediaRole;
  readonly classification: ProductMediaClassification;
  readonly contentType: string;
  readonly sizeClass: ProductMediaSizeClass;
  readonly checksum: string;
  readonly checksumSubject: ProductMediaChecksumSubject;
  readonly altText?: string;
  /** Monotonic per-`mediaId` ordering authority — see design doc §6. Positive integer, never a timestamp. */
  readonly version: number;
  /** Informational only — unix seconds. NEVER used for ordering/replay decisions (see §6). */
  readonly declaredAt: number;
}

export interface ProductMediaDeclarationValidationDecision {
  readonly valid: boolean;
  readonly reason: string;
}

function isNonEmptyBoundedString(value: unknown, maxChars: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxChars;
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && HEX_64.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Pure structural + policy validation. Mirrors `validateProductMedia()`'s
 * own "protected implies checksumSubject: ciphertext" invariant exactly
 * (design doc, resolved ambiguity #4) — re-enforced here independently
 * rather than trusted from whatever produced the input, same
 * defense-in-depth discipline `commerce_nostr_event_drafts.ts` already
 * documents for the attestation categories.
 */
export function validateProductMediaDeclaration(value: unknown): ProductMediaDeclarationValidationDecision {
  if (typeof value !== "object" || value === null) return { valid: false, reason: "not an object" };
  const input = value as Record<string, unknown>;
  if (!isNonEmptyBoundedString(input.mediaId, MAX_ID_CHARS)) return { valid: false, reason: "mediaId must be a non-empty bounded string" };
  if (!isNonEmptyBoundedString(input.productId, MAX_ID_CHARS)) return { valid: false, reason: "productId must be a non-empty bounded string" };
  if (!isHex64(input.sellerPubkey)) return { valid: false, reason: "sellerPubkey must be a 64-char lowercase hex pubkey" };
  if (typeof input.role !== "string" || !VALID_ROLES.includes(input.role as ProductMediaRole)) {
    return { valid: false, reason: `unknown role "${String(input.role)}"` };
  }
  if (typeof input.classification !== "string" || !VALID_CLASSIFICATIONS.includes(input.classification as ProductMediaClassification)) {
    return { valid: false, reason: `unknown classification "${String(input.classification)}"` };
  }
  if (!isNonEmptyBoundedString(input.contentType, MAX_CONTENT_TYPE_CHARS)) return { valid: false, reason: "contentType must be a non-empty bounded string" };
  if (typeof input.sizeClass !== "string" || !SIZE_CLASS_VALUES.includes(input.sizeClass as ProductMediaSizeClass)) {
    return { valid: false, reason: `unknown sizeClass "${String(input.sizeClass)}"` };
  }
  if (!isHex64(input.checksum)) return { valid: false, reason: "checksum must be a 64-character lowercase SHA-256 hex digest" };
  if (typeof input.checksumSubject !== "string" || !VALID_CHECKSUM_SUBJECTS.includes(input.checksumSubject as ProductMediaChecksumSubject)) {
    return { valid: false, reason: `unknown checksumSubject "${String(input.checksumSubject)}"` };
  }
  if (input.altText !== undefined && !isNonEmptyBoundedString(input.altText, MAX_ALT_TEXT_CHARS)) {
    return { valid: false, reason: "altText, when present, must be a non-empty bounded string" };
  }
  if (!isPositiveInteger(input.version)) return { valid: false, reason: "version must be a positive integer" };
  if (!isUnixSecondsInteger(input.declaredAt)) return { valid: false, reason: "declaredAt must be a non-negative integer (unix seconds)" };
  // The core invariant, re-enforced independently — see this function's own header.
  if (input.classification === "protected" && input.checksumSubject !== "ciphertext") {
    return { valid: false, reason: "protected media must declare checksumSubject \"ciphertext\" — a plaintext hash is never exposed for protected media" };
  }
  return { valid: true, reason: "valid" };
}

/**
 * The ONE place a real `ProductMedia` record is ever narrowed into its
 * public wire-safe projection. Structurally cannot carry `storageRef`/
 * `nostrEventId` — see this file's own header.
 */
export function deriveProductMediaDeclaration(
  media: ProductMedia,
  sellerPubkey: string,
  version: number,
  declaredAt: number,
): ProductMediaDeclaration {
  const declaration: ProductMediaDeclaration = {
    mediaId: media.id,
    productId: media.productId,
    sellerPubkey,
    role: media.role,
    classification: media.classification,
    contentType: media.contentType,
    sizeClass: productMediaSizeClassFor(media.sizeBytes),
    checksum: media.checksum,
    checksumSubject: media.checksumSubject,
    version,
    declaredAt,
    ...(media.altText !== undefined ? { altText: media.altText } : {}),
  };
  return declaration;
}

// ---------------------------------------------------------------------------
// ProductMediaRetraction — unpublish/removal signal (design doc §7).
// ---------------------------------------------------------------------------

export interface ProductMediaRetraction {
  readonly mediaId: string;
  readonly productId: string;
  readonly sellerPubkey: string;
  readonly version: number;
  readonly retractedAt: number;
}

export function validateProductMediaRetraction(value: unknown): ProductMediaDeclarationValidationDecision {
  if (typeof value !== "object" || value === null) return { valid: false, reason: "not an object" };
  const input = value as Record<string, unknown>;
  if (!isNonEmptyBoundedString(input.mediaId, MAX_ID_CHARS)) return { valid: false, reason: "mediaId must be a non-empty bounded string" };
  if (!isNonEmptyBoundedString(input.productId, MAX_ID_CHARS)) return { valid: false, reason: "productId must be a non-empty bounded string" };
  if (!isHex64(input.sellerPubkey)) return { valid: false, reason: "sellerPubkey must be a 64-char lowercase hex pubkey" };
  if (!isPositiveInteger(input.version)) return { valid: false, reason: "version must be a positive integer" };
  if (!isUnixSecondsInteger(input.retractedAt)) return { valid: false, reason: "retractedAt must be a non-negative integer (unix seconds)" };
  return { valid: true, reason: "valid" };
}

export function buildProductMediaRetraction(
  productId: string,
  mediaId: string,
  sellerPubkey: string,
  version: number,
  retractedAt: number,
): ProductMediaRetraction {
  return { mediaId, productId, sellerPubkey, version, retractedAt };
}

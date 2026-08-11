/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (Gap #9).
 *
 * Formalizes `ProductMedia` using the shape recommended in
 * `docs/commerce/FEDOS-COMMERCE-END-TO-END.md` §10, reusing the SAME
 * primitives that doc names as the closest live analogs:
 *   - `checksum` — a SHA-256 hex digest, the exact technique
 *     `computeFedosConversationArchiveContentHash()`
 *     (`src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.ts`)
 *     already uses (`./product_media_content_address.ts`, this same pass).
 *   - `storageRef` — an opaque pointer into a `MediaStorePort`
 *     (`./media_store_port.ts`), mirroring `DigitalAsset.storageRef`'s own
 *     "opaque pointer, not resolved here" discipline (`./types.ts`).
 *
 * NET-NEW beyond the doc's own sketch (both required by this arc's own
 * §8/§29 acceptance criteria, not present in the original design note):
 *
 *   - `classification: "public" | "protected"` — EXPLICIT, never
 *     inferred from role/contentType/anything else. A caller (or a
 *     future adapter) must affirmatively say a piece of media is public
 *     before it is ever allowed to skip encryption.
 *   - `checksumSubject: "plaintext" | "ciphertext"` — EXPLICIT record of
 *     what `checksum` was actually computed over. `classification:
 *     "protected"` media MUST have `checksumSubject: "ciphertext"` —
 *     enforced by `validateProductMedia()` below, not left to caller
 *     discipline. This is the type-level half of "never expose a
 *     plaintext hash by default" (§8); see `./product_media_encryption.ts`
 *     for the runtime half (the encrypt-then-hash pipeline itself).
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/** Matches the doc's own recommended role set verbatim — no role added or removed. */
export type ProductMediaRole = "primary" | "gallery" | "thumbnail" | "video" | "video_preview" | "sample";

/**
 * - public:    may be stored/content-addressed over PLAINTEXT bytes (e.g. a
 *              storefront thumbnail nobody needs a grant to see).
 * - protected: MUST be encrypted before it is ever content-addressed or
 *              stored — see `./product_media_encryption.ts`. Never the
 *              default; a caller must say so explicitly.
 */
export type ProductMediaClassification = "public" | "protected";

/** What `checksum` was computed over. `protected` media must be `"ciphertext"` — see `validateProductMedia()`. */
export type ProductMediaChecksumSubject = "plaintext" | "ciphertext";

export interface ProductMedia {
  readonly id: string;
  readonly productId: string;
  readonly role: ProductMediaRole;
  readonly classification: ProductMediaClassification;
  /** MIME, as `AssetMetadata.contentType` (`./asset_cache_types.ts`). */
  readonly contentType: string;
  /** Size in bytes of the STORED bytes (i.e. ciphertext size when `classification: "protected"`). */
  readonly sizeBytes: number;
  /** SHA-256 hex digest of the STORED bytes — see `checksumSubject` for what that means. */
  readonly checksum: string;
  readonly checksumSubject: ProductMediaChecksumSubject;
  /** Net-new — wholly absent from the pre-existing `AssetMetadata` shape. */
  readonly altText?: string;
  /** Opaque `MediaStorePort` key — see `./media_store_port.ts`. Resolution deliberately deferred to that Port. */
  readonly storageRef: string;
  /** Plugs into `Product.linkedEventIds` / the existing Nostr classify.ts tag scheme, when present. */
  readonly nostrEventId?: string;
}

/** Result of a `validateProductMedia()` check: the answer plus a human-readable reason (mirrors `AccessDecision`). */
export interface ProductMediaValidationDecision {
  readonly valid: boolean;
  readonly reason: string;
}

const VALID_ROLES: readonly ProductMediaRole[] = ["primary", "gallery", "thumbnail", "video", "video_preview", "sample"];
const VALID_CLASSIFICATIONS: readonly ProductMediaClassification[] = ["public", "protected"];
const VALID_CHECKSUM_SUBJECTS: readonly ProductMediaChecksumSubject[] = ["plaintext", "ciphertext"];
/** Same SHA-256-hex shape every id/hash helper in this codebase already validates against (e.g. `isFedosDeletionRequestId`). */
const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Pure structural + policy validation for a `ProductMedia` record. This is
 * the ONE place the `classification: "protected" => checksumSubject:
 * "ciphertext"` invariant (§8's core rule) is enforced — every writer
 * (`LocalProductMediaRepository`, this same pass) MUST call this before
 * persisting a record, never trusting a caller-constructed object as-is.
 */
export function validateProductMedia(media: {
  readonly role: ProductMediaRole;
  readonly classification: ProductMediaClassification;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly checksumSubject: ProductMediaChecksumSubject;
  readonly storageRef: string;
}): ProductMediaValidationDecision {
  if (!VALID_ROLES.includes(media.role)) {
    return { valid: false, reason: `unknown role "${String(media.role)}"` };
  }
  if (!VALID_CLASSIFICATIONS.includes(media.classification)) {
    return { valid: false, reason: `unknown classification "${String(media.classification)}"` };
  }
  if (!VALID_CHECKSUM_SUBJECTS.includes(media.checksumSubject)) {
    return { valid: false, reason: `unknown checksumSubject "${String(media.checksumSubject)}"` };
  }
  if (media.contentType.trim().length === 0) {
    return { valid: false, reason: "contentType must not be blank" };
  }
  if (!Number.isInteger(media.sizeBytes) || media.sizeBytes < 0) {
    return { valid: false, reason: "sizeBytes must be a non-negative integer" };
  }
  if (!HEX_64.test(media.checksum)) {
    return { valid: false, reason: "checksum must be a 64-character lowercase SHA-256 hex digest" };
  }
  if (media.storageRef.trim().length === 0) {
    return { valid: false, reason: "storageRef must not be blank" };
  }
  // The core §8 rule: protected media must never carry a plaintext hash.
  if (media.classification === "protected" && media.checksumSubject !== "ciphertext") {
    return { valid: false, reason: "protected media must have checksumSubject \"ciphertext\" — a plaintext hash is never exposed for protected media" };
  }
  return { valid: true, reason: "valid" };
}

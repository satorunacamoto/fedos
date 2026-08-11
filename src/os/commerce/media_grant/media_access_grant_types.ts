/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent G) — `MediaAccessGrant`: the purchase-bound
 * entitlement artifact that closes P1: *"protected media not bound to
 * purchase grant / no revocation-expiry"*.
 *
 * THE GAP THIS CLOSES (see `../catalog/product_media_encryption.ts` for the
 * full account of the encryption primitive itself): protected Product
 * Media is encrypted with `FedosMasterSeedAuthority.resolveCommerceMediaKey()`
 * — a REAL, working AEAD key, but one derived per-PROFILE, not per-purchase.
 * Anyone who can reach that key (today: only the profile owner; in any
 * FUTURE design that lets a buyer's device obtain decryption capability at
 * all) could decrypt EVERY protected media item in the profile, not just
 * the ones they actually bought. `PurchaseGrant` (`../catalog/types.ts`)
 * already models "some buyer is entitled to a PRODUCT" but predates `Order`
 * (its own header says so) and carries no media binding, no Order
 * reference, and no signature — `MediaAccessGrant` below is the finer,
 * cryptographically-checkable sibling: it binds one buyer to one SPECIFIC
 * `ProductMedia` item, backed by one SPECIFIC qualifying `Order`
 * (`../order/order_types.ts`), for a bounded time window, revocably, and
 * SIGNED so a forged or tampered grant is detectable — never trusted as a
 * bare claim.
 *
 * WHAT THIS FILE DOES NOT DO: it does not carry, wrap, or derive any key
 * material. `MediaAccessGrantPayload` is pure authorization metadata — see
 * `./media_access_grant_key_release.ts` for the SEPARATE, honestly-scoped
 * mechanism that actually releases decryption capability once a grant here
 * evaluates ALLOW (`./media_access_grant_policy.ts`'s `evaluateMediaAccessGrant()`).
 *
 * ENVELOPE — REUSED, not reinvented: carried inside a
 * `ReputationLocalSignedEnvelopeShape<MediaAccessGrantPayload>`
 * (`../reputation/attestation_types.ts`) — the EXACT signed-envelope shape
 * and field set this codebase's Commerce domain already established and
 * tested for `TradeCompletionAttestationPayload`/`ReputationAttestationPayload`.
 * This file imports that generic type directly rather than declaring a
 * third near-identical mirror — both live under `src/os/commerce`, so this
 * is ordinary within-domain reuse, not the cross-domain
 * (messenger/trust/commerce) boundary `ReputationLocalSignedEnvelopeShape`'s
 * own header explains it was duplicated to avoid crossing.
 *
 * REVOCATION AND EXPIRY ARE DATA, NOT DRM: `revoked`/`validUntil` below
 * only ever gate whether a FUTURE call to `evaluateMediaAccessGrant()` (and
 * therefore a future key-release via `./media_access_grant_key_release.ts`)
 * returns ALLOW. Once a buyer has legitimately been granted access and has
 * copied the decrypted plaintext, revoking or expiring the grant CANNOT
 * make that already-obtained copy disappear — this module makes no such
 * claim anywhere, and neither should any caller-facing UI built on top of
 * it.
 *
 * REVOCATION AS A NEW VERSION (never a mutation): a `MediaAccessGrantPayload`
 * is signed and therefore immutable once issued — there is no way to flip
 * an existing envelope's `revoked` bit in place without invalidating its
 * own signature. A merchant revokes access by issuing a NEW signed
 * envelope for the SAME `(mediaId, buyerPubkey, orderId)` triple with a
 * HIGHER `grantVersion` and `revoked: true` — `evaluateMediaAccessGrant()`
 * always evaluates the latest version it is told about, and
 * `./media_access_grant_persistence.ts` durably keeps every version ever
 * issued (append-only, never rewritten), so "who revoked what, and when"
 * remains a real, replayable audit trail, not a destructive edit.
 */

import type { ReputationLocalSignedEnvelopeShape } from "../reputation/attestation_types.js";

/** Same 64-lowercase-hex-char shape every Nostr/secp256k1 pubkey in this codebase already uses (see `attestation_types.ts`'s own `HEX_64_PATTERN`, `fedos_conversation_counterparty_public_key_resolver.ts`'s own `NOSTR_PUBLIC_KEY_HEX_PATTERN`). */
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;
/** Mirrors `attestation_canonical_bytes.ts`'s own `MAX_FIELD_STRING_LENGTH` bound for every free-form-but-bounded id field below. */
const MAX_ID_STRING_LENGTH = 512;

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isBoundedNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_STRING_LENGTH;
}

/**
 * A single, signed, purchase-bound entitlement to decrypt/access ONE
 * protected `ProductMedia` item. Every field below exists to close ONE
 * specific failure mode this arc's own brief names — see each field's own
 * comment for which.
 */
export interface MediaAccessGrantPayload {
  /** This payload's own schema version — mirrors every other Commerce/Trust signed payload's `formatVersion` convention. */
  readonly formatVersion: 1;
  /** The SPECIFIC `ProductMedia.id` this grant authorizes — closes "wrong media" (a grant for media A must never authorize media B). */
  readonly mediaId: string;
  /** The `Product.id`/`ProductMedia.productId` the above media belongs to — a redundant-but-checked binding (defense in depth alongside `mediaId`) that closes "wrong Product". */
  readonly productId: string;
  /** Hex-encoded Nostr/secp256k1 pubkey of the ONE buyer this grant authorizes — closes "wrong buyer" (a grant issued to X must never authorize Y, even if Y somehow obtains a copy of the envelope). */
  readonly buyerPubkey: string;
  /** The SPECIFIC qualifying `Order.id` (`../order/order_types.ts`) this grant is backed by — closes "no Order at all" / "unpaid Order" once cross-checked by `evaluateMediaAccessGrant()` against a REAL, looked-up `Order` (never trusted as a bare string here). */
  readonly orderId: string;
  /** Hex-encoded pubkey of the issuing merchant authority — documentation-for-humans ONLY, mirroring `TradeCompletionAttestationPayload.attestorEpochKeyPublicHex`'s own established redundancy discipline (`../reputation/attestation_types.ts`): verification MUST treat the enclosing envelope's own `keyId` as authoritative, never this field. Closes nothing on its own — `evaluateMediaAccessGrant()` is what checks `keyId` really is the Order's own `sellerPubkey` ("wrong signer"). */
  readonly issuerPubkey: string;
  /** Monotonically increasing per `(mediaId, buyerPubkey, orderId)` — closes "replayed old/superseded grant version" (a verifier that has already seen a higher version for the same triple must reject a lower one, even if its own signature is perfectly valid) and is also HOW revocation is expressed (see this file's own header). Must be a positive integer; version `1` is the first grant ever issued for a triple. */
  readonly grantVersion: number;
  /** `true` iff THIS version revokes access — explicit DATA, never inferred, never a destructive delete of a prior version. See this file's own header on why revocation/expiry are prospective only, never retroactive DRM. */
  readonly revoked: boolean;
  /** Unix seconds — access is not yet valid before this instant. Lets a merchant pre-issue a grant that activates later (e.g. a scheduled release date) without a second signing round. */
  readonly validFrom: number;
  /** Unix seconds, or `null` for EXPLICIT no-expiry (never inferred from omission — an absent/undefined field is a schema-validation failure, not "forever"). Closes "expired grant". */
  readonly validUntil: number | null;
  /** Unix seconds this specific version was issued/signed. Audit/display metadata only — no access decision is ever derived from it directly (that is `validFrom`/`validUntil`'s job). */
  readonly issuedAt: number;
}

const MEDIA_ACCESS_GRANT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "formatVersion",
  "mediaId",
  "productId",
  "buyerPubkey",
  "orderId",
  "issuerPubkey",
  "grantVersion",
  "revoked",
  "validFrom",
  "validUntil",
  "issuedAt",
]);

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

/**
 * Structural well-formedness AND allowlisted-keys-only check, mirroring
 * `isWellFormedTradeCompletionAttestationPayload`'s exact discipline
 * (`../reputation/attestation_types.ts`): fails closed to `false` on any
 * malformed input, any missing field, or any UNEXPECTED extra field (an
 * accidentally-added field on an access-control record is exactly the kind
 * of thing that must be rejected outright, never silently tolerated). Never
 * throws.
 */
export function isWellFormedMediaAccessGrantPayload(value: unknown): value is MediaAccessGrantPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!hasOnlyAllowedKeys(candidate, MEDIA_ACCESS_GRANT_ALLOWED_KEYS)) return false;
  if (candidate.formatVersion !== 1) return false;
  if (!isBoundedNonEmptyString(candidate.mediaId)) return false;
  if (!isBoundedNonEmptyString(candidate.productId)) return false;
  if (typeof candidate.buyerPubkey !== "string" || !HEX_64_PATTERN.test(candidate.buyerPubkey)) return false;
  if (!isBoundedNonEmptyString(candidate.orderId)) return false;
  if (typeof candidate.issuerPubkey !== "string" || !HEX_64_PATTERN.test(candidate.issuerPubkey)) return false;
  if (typeof candidate.grantVersion !== "number" || !Number.isInteger(candidate.grantVersion) || candidate.grantVersion < 1) {
    return false;
  }
  if (typeof candidate.revoked !== "boolean") return false;
  if (!isUnixSecondsInteger(candidate.validFrom)) return false;
  if (candidate.validUntil !== null && !isUnixSecondsInteger(candidate.validUntil)) return false;
  if (!isUnixSecondsInteger(candidate.issuedAt)) return false;

  return true;
}

export type MediaAccessGrantEnvelope = ReputationLocalSignedEnvelopeShape<MediaAccessGrantPayload>;

/**
 * The identity key a grant's ISSUANCE HISTORY is tracked under —
 * `(mediaId, buyerPubkey, orderId)`. Every `grantVersion` for the same key
 * is one buyer's evolving entitlement to one media item under one Order;
 * two different keys are unrelated grants, even if they happen to share a
 * `mediaId` (different buyers) or a `buyerPubkey` (different media/orders).
 */
export function mediaAccessGrantKey(payload: Pick<MediaAccessGrantPayload, "mediaId" | "buyerPubkey" | "orderId">): string {
  return JSON.stringify([payload.mediaId, payload.buyerPubkey, payload.orderId]);
}

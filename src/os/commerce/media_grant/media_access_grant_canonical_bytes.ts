/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent G) — REAL canonical byte serialization for
 * `MediaAccessGrantPayload` (`./media_access_grant_types.ts`).
 *
 * Follows the exact same fixed-field-order, hand-written string builder
 * convention `../reputation/attestation_canonical_bytes.ts` already
 * established for this Commerce domain (never generic
 * `JSON.stringify(wholeObject)` — insertion order is not a cryptographic
 * guarantee). The envelope-level wrapping (`version`/`type`/`issuer`/...)
 * is NOT re-implemented here: `canonicalizeReputationEnvelope()`/
 * `canonicalBytesForReputationEnvelope()` (`../reputation/attestation_canonical_bytes.js`)
 * are already generic over the payload type and are imported and reused
 * directly by `./media_access_grant_sign_verify.ts` — this file owns only
 * the ONE thing that is genuinely specific to this payload shape: its own
 * field-by-field canonicalization, mirroring
 * `canonicalizeTradeCompletionAttestationPayload`'s own structure exactly.
 */

import type { MediaAccessGrantPayload } from "./media_access_grant_types.js";

/** Mirrors `attestation_canonical_bytes.ts`'s own `MAX_FIELD_STRING_LENGTH` bound. */
const MAX_FIELD_STRING_LENGTH = 512;

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`media access grant canonical bytes: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`media access grant canonical bytes: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function integerLiteral(fieldName: string, value: number): string {
  if (!Number.isInteger(value)) {
    throw new RangeError(`media access grant canonical bytes: "${fieldName}" must be an integer`);
  }
  return String(value);
}

function nullableIntegerLiteral(fieldName: string, value: number | null): string {
  if (value === null) return "null";
  return integerLiteral(fieldName, value);
}

function booleanLiteral(fieldName: string, value: boolean): string {
  if (typeof value !== "boolean") {
    throw new RangeError(`media access grant canonical bytes: "${fieldName}" must be a boolean`);
  }
  return value ? "true" : "false";
}

/** Canonicalizes a `MediaAccessGrantPayload` in fixed field order — the ONE payload-specific canonicalizer this file exists to provide. */
export function canonicalizeMediaAccessGrantPayload(payload: MediaAccessGrantPayload): string {
  const parts: readonly string[] = [
    `"formatVersion":${integerLiteral("formatVersion", payload.formatVersion)}`,
    `"mediaId":${requiredStringLiteral("mediaId", payload.mediaId)}`,
    `"productId":${requiredStringLiteral("productId", payload.productId)}`,
    `"buyerPubkey":${requiredStringLiteral("buyerPubkey", payload.buyerPubkey)}`,
    `"orderId":${requiredStringLiteral("orderId", payload.orderId)}`,
    `"issuerPubkey":${requiredStringLiteral("issuerPubkey", payload.issuerPubkey)}`,
    `"grantVersion":${integerLiteral("grantVersion", payload.grantVersion)}`,
    `"revoked":${booleanLiteral("revoked", payload.revoked)}`,
    `"validFrom":${integerLiteral("validFrom", payload.validFrom)}`,
    `"validUntil":${nullableIntegerLiteral("validUntil", payload.validUntil)}`,
    `"issuedAt":${integerLiteral("issuedAt", payload.issuedAt)}`,
  ];
  return `{${parts.join(",")}}`;
}

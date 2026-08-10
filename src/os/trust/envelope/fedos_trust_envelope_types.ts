/**
 * Trust — canonical SignedEnvelope type.
 *
 * FEDOS Trust / Offline Monetization + OSS Release Closure arc. See
 * `../README.md` for the full design rationale. This is the ONE signed
 * envelope shape every Trust proof type (subscription entitlement,
 * pseudonymous credential, proof-of-possession response, capability grant,
 * contract-artifact proof) is built from — a QR code is a transport
 * encoding OF this envelope, never a security primitive of its own (arc
 * brief §19–20).
 */

/** The only envelope format version this module understands today. Unknown
 * versions MUST fail closed at verification time (arc brief §10) — never
 * silently parsed as v1. Bump this constant (and add a new
 * `FEDOS_TRUST_ENVELOPE_VERSION_N`) if the metadata shape ever changes;
 * never redefine what `1` means. */
export const FEDOS_TRUST_ENVELOPE_VERSION_1 = 1 as const;

/**
 * Domain-separated envelope types (arc brief §9). Each is a distinct
 * signing domain: the canonicalizer includes `type` as a signed field, so a
 * signature produced for one type can never be replayed as another type
 * even if two payload shapes happen to serialize to overlapping bytes.
 * Adding a new domain is additive and safe; renaming or reusing an existing
 * literal for a different purpose is exactly the ambiguity this field
 * exists to prevent (arc brief §9) — never do that.
 */
export type FedosTrustEnvelopeType =
  | "fedos.subscription.v1"
  | "fedos.credential.v1"
  | "fedos.qr.v1"
  | "fedos.possession.v1"
  | "fedos.capability.v1"
  | "fedos.contract-artifact.v1"
  // Added by the FedosSubscriptionEntitlement + SubscriptionSigningRequest
  // workstream (`../entitlement/`): the subject's own self-signed
  // proof-of-possession request artifact — see
  // `../entitlement/fedos_trust_subscription_signing_request_types.ts`'s
  // header for why this is its own domain rather than reusing
  // `fedos.possession.v1`.
  | "fedos.subscription-request.v1"
  // Added by the same workstream: the OPTIONAL issuer-published revoked-serial
  // status list — see `../issuer/fedos_trust_issuer_status_list_types.ts`'s
  // header. Purely additive; does not change any existing literal's meaning.
  | "fedos.status-list.v1";

/** Signature algorithm identifier. Reuses this repository's own existing,
 * already-shipped production primitive (`@noble/curves` Schnorr/secp256k1 —
 * same library `src/os/messenger/adapters/nostr/protocol/noble_signature.ts`
 * and `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`
 * already use) rather than inventing a new signature scheme (arc brief §7).
 * A field, not a hardcoded assumption, so a future algorithm can be added
 * additively without breaking `v1` envelopes already issued. */
export const FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1 = "schnorr-secp256k1" as const;

export type FedosTrustSignatureAlgorithm = typeof FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1;

/**
 * A signed envelope, version 1. `TPayload` is intentionally generic — each
 * domain (`entitlement/`, `credentials/`, `possession/`, `capabilities/`,
 * `contracts/`) defines its own payload shape AND its own canonicalizer for
 * that shape (see `fedos_trust_canonical_bytes.ts`'s header for why payload
 * canonicalization is NOT generic).
 */
export interface FedosTrustSignedEnvelope<TPayload = unknown> {
  readonly version: typeof FEDOS_TRUST_ENVELOPE_VERSION_1;
  readonly type: FedosTrustEnvelopeType;
  /** Opaque issuer identifier (e.g. `"fedos-official"`, `"self"`, an
   * operator-chosen label). NOT a raw public key — see `keyId` and
   * `../policy/` for how a `(issuer, keyId)` pair resolves to an actual
   * public key under a verifier-chosen `FedosTrustPolicy`, which is what
   * makes issuer key rotation possible (arc brief §54) without embedding a
   * self-declared key an attacker could simply substitute. */
  readonly issuer: string;
  /** Opaque subject identifier — conventionally the subject's own public
   * key hex, but domain-defined. */
  readonly subject?: string;
  readonly audience?: string;
  /** Unix seconds. */
  readonly issuedAt: number;
  /** Unix seconds. Envelope-level expiry (distinct from any
   * domain-specific `validFrom`/`validUntil` payload fields an entitlement
   * carries — both are enforced, see `entitlement/`). */
  readonly expiresAt?: number;
  /** Required on any envelope used as a proof-of-possession response (replay
   * protection); optional elsewhere. */
  readonly nonce?: string;
  readonly payload: TPayload;
  readonly signatureAlgorithm: FedosTrustSignatureAlgorithm;
  /** Identifies which of `issuer`'s keys signed this envelope — the
   * rotation seam (arc brief §54). */
  readonly keyId: string;
  /** Hex-encoded Schnorr signature over the SHA-256 digest of this
   * envelope's canonical bytes (metadata + canonical payload), computed by
   * `../envelope/fedos_trust_canonical_bytes.ts`. */
  readonly signature: string;
}

/** The same envelope shape before signing (no `signature` field yet). */
export type FedosTrustUnsignedEnvelope<TPayload = unknown> = Omit<
  FedosTrustSignedEnvelope<TPayload>,
  "signature"
>;

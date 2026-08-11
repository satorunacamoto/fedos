/**
 * Trust — verify a signed envelope against a verifier-chosen TrustPolicy.
 *
 * Produces a closed, typed set of failure reasons (arc brief §14) rather
 * than throwing or returning a bare boolean — callers must be able to
 * distinguish EXPIRED from REVOKED_IF_STATUS_AVAILABLE from
 * SIGNATURE_INVALID (arc brief §34), and a bare boolean would collapse that.
 */

import { hexToBytes } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalizeFedosTrustEnvelopeV1 } from "./fedos_trust_canonical_bytes.js";
import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  type FedosTrustEnvelopeType,
  type FedosTrustSignedEnvelope,
} from "./fedos_trust_envelope_types.js";
import { defaultFedosTrustClock, type FedosTrustClock } from "./fedos_trust_clock.js";
import { isWellFormedFedosTrustPublicKeyHex, isWellFormedFedosTrustSignatureHex } from "./fedos_trust_signing_keypair.js";
import type { FedosTrustPolicy } from "../policy/fedos_trust_policy_types.js";
import { FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS } from "../fedos_trust_limits.js";
import { schnorr } from "@noble/curves/secp256k1.js";

export type FedosTrustVerifyFailureReason =
  | "malformed-envelope"
  | "unsupported-version"
  | "wrong-domain-type"
  | "unknown-issuer-key"
  | "signature-invalid"
  | "not-yet-valid"
  | "expired"
  | "payload-too-large";

export type FedosTrustVerifyResult =
  | { readonly ok: true; readonly resolvedPublicKeyHex: string }
  | { readonly ok: false; readonly reason: FedosTrustVerifyFailureReason; readonly detail?: string };

export interface FedosTrustVerifyOptions {
  /** If supplied, verification fails with `wrong-domain-type` unless
   * `envelope.type` matches exactly — the domain-separation check every
   * domain-specific verifier (entitlement, credential, possession,
   * capability, contract) should apply on top of this generic one. */
  readonly expectedType?: FedosTrustEnvelopeType;
  readonly clock?: FedosTrustClock;
}

/**
 * Verifies envelope-level structure, signature, issuer/key trust, and
 * envelope-level `issuedAt`/`expiresAt`. Domain-specific payload fields
 * (e.g. an entitlement's own `validFrom`/`validUntil`/`scopes`) are NOT
 * checked here — see each domain's own verify function, which calls this
 * first and then layers its own payload checks on top (arc brief §14).
 */
export function verifyFedosTrustEnvelopeV1(
  envelope: FedosTrustSignedEnvelope,
  canonicalPayload: string,
  trustPolicy: FedosTrustPolicy,
  options: FedosTrustVerifyOptions = {},
): FedosTrustVerifyResult {
  const clock = options.clock ?? defaultFedosTrustClock;

  if (envelope.version !== FEDOS_TRUST_ENVELOPE_VERSION_1) {
    return { ok: false, reason: "unsupported-version", detail: String(envelope.version) };
  }
  if (options.expectedType !== undefined && envelope.type !== options.expectedType) {
    return { ok: false, reason: "wrong-domain-type", detail: envelope.type };
  }
  if (!isWellFormedFedosTrustSignatureHex(envelope.signature)) {
    return { ok: false, reason: "malformed-envelope", detail: "signature" };
  }

  const now = clock();

  const resolvedPublicKeyHex = trustPolicy.resolveIssuerKey(envelope.issuer, envelope.keyId, now);
  if (resolvedPublicKeyHex === null || !isWellFormedFedosTrustPublicKeyHex(resolvedPublicKeyHex)) {
    return { ok: false, reason: "unknown-issuer-key", detail: `${envelope.issuer}/${envelope.keyId}` };
  }

  let canonical: string;
  try {
    const { signature: _signature, ...unsigned } = envelope;
    canonical = canonicalizeFedosTrustEnvelopeV1(unsigned, canonicalPayload);
  } catch (error) {
    const isTooLarge = error instanceof RangeError && /exceeds max length/.test(error.message);
    return { ok: false, reason: isTooLarge ? "payload-too-large" : "malformed-envelope", detail: String(error) };
  }

  const digest = sha256(new TextEncoder().encode(canonical));
  let signatureValid: boolean;
  try {
    signatureValid = schnorr.verify(hexToBytes(envelope.signature), digest, hexToBytes(resolvedPublicKeyHex));
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    return { ok: false, reason: "signature-invalid" };
  }

  if (envelope.issuedAt - now > FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS) {
    return { ok: false, reason: "not-yet-valid", detail: "issuedAt" };
  }
  if (envelope.expiresAt !== undefined && now - envelope.expiresAt > FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS) {
    return { ok: false, reason: "expired", detail: "expiresAt" };
  }

  return { ok: true, resolvedPublicKeyHex };
}

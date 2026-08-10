/**
 * Trust — issue a `fedos.subscription.v1` `FedosSubscriptionEntitlement`
 * envelope.
 *
 * RENEWAL IS A NEW ENTITLEMENT (§33) — this module has no "renew"/"extend"
 * function and never will. Renewing a subscription means calling
 * `issueFedosSubscriptionEntitlement` again with a fresh `validFrom`/
 * `validUntil` window; it always produces a brand-new `serial` (see
 * `generateFedosTrustSubscriptionEntitlementSerial` below) and a brand-new
 * signature. The PRIOR signed entitlement is never mutated, revoked, or
 * invalidated by this call — it remains independently verifiable at its own
 * original terms for as long as its own `validFrom`/`validUntil` window (and
 * the issuer key that signed it) says it should. If an issuer ever needs to
 * invalidate a prior entitlement early, that is what the OPTIONAL status
 * list (`../issuer/fedos_trust_issuer_status_list_types.ts`) is for — never
 * a mutation of the original signed bytes.
 */

import { bytesToHex } from "@noble/hashes/utils.js";
import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
  defaultFedosTrustClock,
  signFedosTrustEnvelopeV1,
  type FedosTrustClock,
  type FedosTrustSignedEnvelope,
  type FedosTrustSigningKeypair,
  type FedosTrustUnsignedEnvelope,
} from "../envelope/index.js";
import { FEDOS_TRUST_MAX_SCOPES } from "../fedos_trust_limits.js";
import { canonicalizeFedosSubscriptionEntitlementV1 } from "./fedos_trust_subscription_entitlement_canonical.js";
import {
  FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1,
  isValidFedosTrustSubscriptionScope,
  type FedosSubscriptionEntitlement,
} from "./fedos_trust_subscription_entitlement_types.js";
import type { SubscriptionSigningRequest } from "./fedos_trust_subscription_signing_request_types.js";

/** Fresh, random per-issuance serial — 16 bytes of CSPRNG output, hex
 * encoded. Every call to `issueFedosSubscriptionEntitlement` gets a new one,
 * which is what makes a renewal a distinguishable NEW entitlement rather
 * than a duplicate of the prior one (see this file's header). */
export function generateFedosTrustSubscriptionEntitlementSerial(): string {
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  return bytesToHex(randomBytes);
}

/**
 * Issues and signs a new `FedosSubscriptionEntitlement` envelope.
 *
 * `request` supplies `subjectPublicKeyHex` (the caller — typically the
 * offline issuer CLI, see `../issuer/fedos_trust_issuer_cli_core.ts` — is
 * responsible for having already verified `request`'s own self-signature,
 * i.e. proof of possession, via `verifyFedosTrustSubscriptionSigningRequest`,
 * BEFORE calling this function; this function does not re-verify it).
 *
 * The envelope's own `expiresAt` is DELIBERATELY left unset here (`undefined`)
 * rather than derived from `validUntil`: `verifyFedosTrustEnvelopeV1` checks
 * envelope-level `expiresAt` BEFORE any entitlement-specific check ever runs
 * and fails closed with its own lowercase `"expired"` reason the instant it
 * passes — aliasing it to `validUntil` would make that envelope-level check
 * fire first on every ordinary expiry and the entitlement layer's own
 * uppercase `"EXPIRED"`/`"NOT_YET_VALID"` outcomes
 * (`fedos_trust_subscription_entitlement_verify.ts`) effectively
 * unreachable, collapsing the two intentionally-separate windows this
 * file's header describes back into one. `validFrom`/`validUntil` alone
 * govern the actual subscription period; a caller who separately wants a
 * signed-artifact freshness window may still set one by constructing the
 * envelope directly instead of through this convenience function.
 */
export function issueFedosSubscriptionEntitlement(
  request: SubscriptionSigningRequest,
  plan: string,
  scopes: readonly string[],
  validFrom: number,
  validUntil: number,
  issuerKeypair: FedosTrustSigningKeypair,
  issuerId: string,
  keyId: string,
  clock: FedosTrustClock = defaultFedosTrustClock,
): FedosTrustSignedEnvelope<FedosSubscriptionEntitlement> {
  if (typeof plan !== "string" || plan.length === 0) {
    throw new RangeError("fedos subscription entitlement: plan must be a non-empty string");
  }
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new RangeError("fedos subscription entitlement: scopes must be a non-empty array");
  }
  if (scopes.length > FEDOS_TRUST_MAX_SCOPES) {
    throw new RangeError(`fedos subscription entitlement: scopes exceeds max count (${FEDOS_TRUST_MAX_SCOPES})`);
  }
  for (const scope of scopes) {
    if (!isValidFedosTrustSubscriptionScope(scope)) {
      throw new RangeError(`fedos subscription entitlement: "${String(scope)}" is not a recognized scope`);
    }
  }
  if (!Number.isInteger(validFrom) || !Number.isInteger(validUntil) || validUntil <= validFrom) {
    throw new RangeError("fedos subscription entitlement: validUntil must be an integer strictly after validFrom");
  }

  const payload: FedosSubscriptionEntitlement = {
    subjectPublicKeyHex: request.subjectPublicKeyHex,
    issuerKeyId: keyId,
    planId: plan,
    scopes,
    validFrom,
    validUntil,
    serial: generateFedosTrustSubscriptionEntitlementSerial(),
    formatVersion: FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1,
  };
  const canonicalPayload = canonicalizeFedosSubscriptionEntitlementV1(payload);

  const unsigned: FedosTrustUnsignedEnvelope<FedosSubscriptionEntitlement> = {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: "fedos.subscription.v1",
    issuer: issuerId,
    subject: request.subjectPublicKeyHex,
    issuedAt: clock(),
    payload,
    signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
    keyId,
  };
  return signFedosTrustEnvelopeV1(unsigned, canonicalPayload, issuerKeypair);
}

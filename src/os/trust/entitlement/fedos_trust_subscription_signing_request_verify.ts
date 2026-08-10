/**
 * Trust — verify a self-signed `SubscriptionSigningRequest` envelope.
 *
 * Deliberately does NOT take a `FedosTrustPolicy` — see
 * `fedos_trust_subscription_signing_request_types.ts`'s header: this is a
 * direct "does this signature validate against the exact public key the
 * request itself declares" check, not an issuer-trust decision. Reuses
 * `verifyFedosTrustSignatureOverDigest` from `../envelope/index.js` (the
 * same primitive `verifyFedosTrustEnvelopeV1` uses internally) rather than
 * duplicating signature-verification logic.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  canonicalizeFedosTrustEnvelopeV1,
  verifyFedosTrustSignatureOverDigest,
  type FedosTrustSignedEnvelope,
} from "../envelope/index.js";
import { canonicalizeFedosTrustSubscriptionSigningRequestV1 } from "./fedos_trust_subscription_signing_request_canonical.js";
import {
  isWellFormedSubscriptionSigningRequest,
  type SubscriptionSigningRequest,
} from "./fedos_trust_subscription_signing_request_types.js";

export type FedosTrustSubscriptionSigningRequestVerifyFailureReason =
  | "malformed-envelope"
  | "unsupported-version"
  | "wrong-domain-type"
  | "invalid-payload-shape"
  | "subject-mismatch"
  | "signature-invalid"
  | "payload-too-large";

export type FedosTrustSubscriptionSigningRequestVerifyResult =
  | { readonly ok: true; readonly payload: SubscriptionSigningRequest }
  | { readonly ok: false; readonly reason: FedosTrustSubscriptionSigningRequestVerifyFailureReason; readonly detail?: string };

/**
 * Verifies proof-of-possession of `envelope.payload.subjectPublicKeyHex`
 * (§31): that the request was self-signed by the exact key it declares.
 * Never throws.
 */
export function verifyFedosTrustSubscriptionSigningRequest(
  envelope: FedosTrustSignedEnvelope,
): FedosTrustSubscriptionSigningRequestVerifyResult {
  if (envelope.version !== FEDOS_TRUST_ENVELOPE_VERSION_1) {
    return { ok: false, reason: "unsupported-version", detail: String(envelope.version) };
  }
  if (envelope.type !== "fedos.subscription-request.v1") {
    return { ok: false, reason: "wrong-domain-type", detail: envelope.type };
  }
  if (!isWellFormedSubscriptionSigningRequest(envelope.payload)) {
    return { ok: false, reason: "invalid-payload-shape" };
  }
  const payload = envelope.payload;

  if (
    payload.subjectPublicKeyHex !== envelope.issuer ||
    payload.subjectPublicKeyHex !== envelope.subject ||
    payload.subjectPublicKeyHex !== envelope.keyId
  ) {
    return { ok: false, reason: "subject-mismatch" };
  }

  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalizeFedosTrustSubscriptionSigningRequestV1(payload);
  } catch (error) {
    return { ok: false, reason: "invalid-payload-shape", detail: String(error) };
  }

  let canonicalEnvelope: string;
  try {
    const { signature: _signature, ...unsigned } = envelope;
    canonicalEnvelope = canonicalizeFedosTrustEnvelopeV1(unsigned, canonicalPayload);
  } catch (error) {
    const isTooLarge = error instanceof RangeError && /exceeds max length/.test(error.message);
    return { ok: false, reason: isTooLarge ? "payload-too-large" : "malformed-envelope", detail: String(error) };
  }

  const digest = sha256(new TextEncoder().encode(canonicalEnvelope));
  const signatureValid = verifyFedosTrustSignatureOverDigest(payload.subjectPublicKeyHex, digest, envelope.signature);
  if (!signatureValid) {
    return { ok: false, reason: "signature-invalid" };
  }

  return { ok: true, payload };
}

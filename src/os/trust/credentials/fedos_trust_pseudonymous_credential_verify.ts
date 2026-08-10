/**
 * Trust — verify a `fedos.credential.v1` PseudonymousIdentityCredential
 * envelope.
 *
 * Layers payload-shape validation on top of the generic envelope verifier
 * (arc brief §14 pattern — see `../envelope/fedos_trust_envelope_verify.ts`'s
 * own header), and domain-separates via `expectedType`.
 */

import {
  isWellFormedFedosTrustPublicKeyHex,
  verifyFedosTrustEnvelopeV1,
  type FedosTrustClock,
  type FedosTrustSignedEnvelope,
  type FedosTrustVerifyFailureReason,
} from "../envelope/index.js";
import type { FedosTrustPolicy } from "../policy/index.js";
import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH } from "../fedos_trust_limits.js";
import { canonicalizeFedosTrustPseudonymousCredentialPayloadV1 } from "./fedos_trust_pseudonymous_credential_canonical.js";
import type { FedosTrustPseudonymousCredentialPayload } from "./fedos_trust_pseudonymous_credential_types.js";

export type FedosTrustPseudonymousCredentialVerifyFailureReason =
  | FedosTrustVerifyFailureReason
  | "invalid-payload-shape";

export type FedosTrustPseudonymousCredentialVerifyResult =
  | {
      readonly ok: true;
      readonly resolvedPublicKeyHex: string;
      readonly payload: FedosTrustPseudonymousCredentialPayload;
    }
  | {
      readonly ok: false;
      readonly reason: FedosTrustPseudonymousCredentialVerifyFailureReason;
      readonly detail?: string;
    };

/** Fails closed to `false`; never throws. Checked separately from
 * canonicalization because canonicalization only bounds string length — it
 * does not know `subjectPublicKeyHex` must be well-formed hex. */
function isWellFormedFedosTrustPseudonymousCredentialPayload(
  payload: unknown,
): payload is FedosTrustPseudonymousCredentialPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  if (!isWellFormedFedosTrustPublicKeyHex(candidate.subjectPublicKeyHex)) return false;
  if (typeof candidate.label !== "string" || candidate.label.length === 0) return false;
  if (candidate.label.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) return false;
  if (candidate.issuerStatement !== undefined) {
    if (typeof candidate.issuerStatement !== "string") return false;
    if (candidate.issuerStatement.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) return false;
  }
  return true;
}

export function verifyFedosTrustPseudonymousCredentialV1(
  envelope: FedosTrustSignedEnvelope<FedosTrustPseudonymousCredentialPayload>,
  trustPolicy: FedosTrustPolicy,
  options: { readonly clock?: FedosTrustClock } = {},
): FedosTrustPseudonymousCredentialVerifyResult {
  if (!isWellFormedFedosTrustPseudonymousCredentialPayload(envelope.payload)) {
    return { ok: false, reason: "invalid-payload-shape", detail: "payload" };
  }

  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalizeFedosTrustPseudonymousCredentialPayloadV1(envelope.payload);
  } catch (error) {
    return { ok: false, reason: "invalid-payload-shape", detail: String(error) };
  }

  const result = verifyFedosTrustEnvelopeV1(envelope, canonicalPayload, trustPolicy, {
    expectedType: "fedos.credential.v1",
    clock: options.clock,
  });
  if (!result.ok) return result;

  return { ok: true, resolvedPublicKeyHex: result.resolvedPublicKeyHex, payload: envelope.payload };
}

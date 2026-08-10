/**
 * Trust — verify a ContractArtifactProof.
 *
 * CRITICAL (arc brief §25, §28): a valid signature here means ONLY
 * "issuer/subject signed this specific artifact digest under this proof
 * type" — nothing about the artifact's audit status, security, legality,
 * safety, profitability, approval, or deployment. This file enforces that
 * boundary structurally: `artifactSignature` and `contentClaim` are always
 * separate fields on the result, never collapsed into one boolean.
 * `contentClaim` is ALWAYS the literal `"NOT_EVALUATED"` — this verifier
 * does not, and will never, evaluate content.
 */

import { verifyFedosTrustEnvelopeV1, type FedosTrustVerifyFailureReason, type FedosTrustVerifyOptions } from "../envelope/fedos_trust_envelope_verify.js";
import type { FedosTrustSignedEnvelope } from "../envelope/fedos_trust_envelope_types.js";
import type { FedosTrustPolicy } from "../policy/fedos_trust_policy_types.js";
import { canonicalizeFedosTrustContractArtifactProofPayloadV1 } from "./fedos_trust_contract_artifact_proof_canonical.js";
import { FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE, type FedosTrustContractArtifactProofPayload } from "./fedos_trust_contract_artifact_proof_types.js";

/**
 * Deliberately two separate fields, never one boolean (arc brief §25, §28).
 * `artifactSignature` mirrors `../envelope/`'s own closed failure-reason set
 * plus `"VALID"`, so callers get the same precise distinctions
 * (SIGNATURE_INVALID vs EXPIRED vs UNKNOWN_ISSUER_KEY, ...) this capability
 * already guarantees everywhere else.
 */
export interface FedosTrustContractArtifactProofVerifyResult {
  readonly artifactSignature: "VALID" | FedosTrustVerifyFailureReason;
  /** ALWAYS `"NOT_EVALUATED"` — see this file's header. Never becomes
   * `"SAFE"`, `"AUDITED"`, or any other value; the literal type intentionally
   * has exactly one member so no future edit can accidentally widen it
   * without a deliberate, reviewed type change. */
  readonly contentClaim: "NOT_EVALUATED";
  readonly resolvedPublicKeyHex?: string;
}

/**
 * Verifies envelope signature/issuer-trust/expiry AND that the envelope is
 * domain-typed `"fedos.contract-artifact.v1"`. Does not, and cannot,
 * evaluate whether the underlying artifact is safe, audited, or approved.
 */
export function verifyFedosTrustContractArtifactProof(
  envelope: FedosTrustSignedEnvelope<FedosTrustContractArtifactProofPayload>,
  trustPolicy: FedosTrustPolicy,
  options: FedosTrustVerifyOptions = {},
): FedosTrustContractArtifactProofVerifyResult {
  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalizeFedosTrustContractArtifactProofPayloadV1(envelope.payload);
  } catch {
    return { artifactSignature: "malformed-envelope", contentClaim: "NOT_EVALUATED" };
  }

  const result = verifyFedosTrustEnvelopeV1(envelope, canonicalPayload, trustPolicy, {
    ...options,
    expectedType: FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE,
  });

  if (!result.ok) {
    return { artifactSignature: result.reason, contentClaim: "NOT_EVALUATED" };
  }
  return { artifactSignature: "VALID", contentClaim: "NOT_EVALUATED", resolvedPublicKeyHex: result.resolvedPublicKeyHex };
}

/**
 * ARTIFACT SIGNATURE / SUBSCRIPTION ENTITLEMENT / CONTENT CLAIM three-way
 * split (arc brief §27–28). This helper composes a contract-artifact proof
 * with a SEPARATE subscription-entitlement envelope by checking BOTH
 * signatures independently and confirming the entitlement carries the
 * `"contract-proof"` scope — it never lets a valid entitlement paper over
 * an invalid artifact signature, or vice versa, and it still never touches
 * `contentClaim`.
 *
 * `entitlement/` (Agent E's directory, built in parallel) is NOT imported
 * here to avoid a race — the `"contract-proof"` scope literal is stable per
 * the arc brief, so it is redeclared locally as
 * `FedosTrustContractProofRequiredScope` and checked as a plain string
 * membership test against whatever `scopes` array the entitlement payload
 * happens to expose.
 */
export type FedosTrustContractProofRequiredScope = "contract-proof";

export const FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE: FedosTrustContractProofRequiredScope = "contract-proof";

export type FedosTrustSubscriptionEntitlementVerifyOutcome =
  | "VALID"
  | FedosTrustVerifyFailureReason
  | "missing-required-scope";

export interface FedosTrustDelegatedContractProofVerifyResult {
  readonly artifactSignature: "VALID" | FedosTrustVerifyFailureReason;
  readonly subscriptionEntitlement: FedosTrustSubscriptionEntitlementVerifyOutcome;
  /** ALWAYS `"NOT_EVALUATED"` — see this file's header; the same discipline
   * applies whether or not an entitlement is composed in. */
  readonly contentClaim: "NOT_EVALUATED";
}

/** Minimal local shape this helper needs from an entitlement payload — NOT
 * imported from `../entitlement/`, see this function's doc comment above. */
interface FedosTrustEntitlementLikePayload {
  readonly scopes?: readonly string[];
}

export interface FedosTrustDelegatedContractProofInput {
  readonly artifactEnvelope: FedosTrustSignedEnvelope<FedosTrustContractArtifactProofPayload>;
  readonly entitlementEnvelope: FedosTrustSignedEnvelope<FedosTrustEntitlementLikePayload>;
  /** The entitlement's own domain-specific canonical payload string,
   * produced by `../entitlement/`'s canonicalizer — this module does not,
   * and must not, own entitlement payload canonicalization. */
  readonly entitlementCanonicalPayload: string;
  readonly trustPolicy: FedosTrustPolicy;
  readonly options?: FedosTrustVerifyOptions;
}

export function verifyFedosTrustDelegatedContractProof(
  input: FedosTrustDelegatedContractProofInput,
): FedosTrustDelegatedContractProofVerifyResult {
  const artifactResult = verifyFedosTrustContractArtifactProof(input.artifactEnvelope, input.trustPolicy, input.options);

  const entitlementEnvelopeResult = verifyFedosTrustEnvelopeV1(
    input.entitlementEnvelope,
    input.entitlementCanonicalPayload,
    input.trustPolicy,
    input.options,
  );

  let subscriptionEntitlement: FedosTrustSubscriptionEntitlementVerifyOutcome;
  if (!entitlementEnvelopeResult.ok) {
    subscriptionEntitlement = entitlementEnvelopeResult.reason;
  } else {
    const scopes = input.entitlementEnvelope.payload.scopes;
    const hasRequiredScope = Array.isArray(scopes) && scopes.includes(FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE);
    subscriptionEntitlement = hasRequiredScope ? "VALID" : "missing-required-scope";
  }

  return {
    artifactSignature: artifactResult.artifactSignature,
    subscriptionEntitlement,
    contentClaim: "NOT_EVALUATED",
  };
}

/**
 * Trust — canonical byte serialization for `FedosTrustContractArtifactProofPayload`.
 *
 * Follows the same fixed-field-order, hand-written convention as
 * `../envelope/fedos_trust_canonical_bytes.ts` and this repo's established
 * per-record canonicalization precedent — this domain owns its own payload
 * shape and its own canonicalizer, per that file's header comment.
 */

import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH } from "../fedos_trust_limits.js";
import type {
  FedosTrustContractArtifactProofMetadata,
  FedosTrustContractArtifactProofMetadataValue,
  FedosTrustContractArtifactProofPayload,
} from "./fedos_trust_contract_artifact_proof_types.js";

const DIGEST_HEX_PATTERN = /^[0-9a-f]+$/;

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`fedos trust contract-artifact proof: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos trust contract-artifact proof: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function optionalStringLiteral(fieldName: string, value: string | undefined): string {
  if (value === undefined) return "null";
  return requiredStringLiteral(fieldName, value);
}

function canonicalMetadataValue(fieldName: string, value: FedosTrustContractArtifactProofMetadataValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return requiredStringLiteral(fieldName, value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`fedos trust contract-artifact proof: metadata field "${fieldName}" must be finite`);
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  throw new RangeError(`fedos trust contract-artifact proof: metadata field "${fieldName}" has an unsupported type`);
}

/** Deterministic sorted-key encoding of the (flat, primitive-valued)
 * `metadata` bag. `undefined` canonicalizes to `null` the same way every
 * other optional envelope/payload field does in this codebase. */
function canonicalMetadata(metadata: FedosTrustContractArtifactProofMetadata | undefined): string {
  if (metadata === undefined) return "null";
  const entries = Object.entries(metadata).sort(([leftKey], [rightKey]) => (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0));
  const parts = entries.map(
    ([key, value]) => `${requiredStringLiteral("metadata key", key)}:${canonicalMetadataValue(key, value)}`,
  );
  const json = `{${parts.join(",")}}`;
  if (json.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError("fedos trust contract-artifact proof: \"metadata\" exceeds max serialized length");
  }
  return json;
}

function digestHexLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length % 2 !== 0) {
    throw new RangeError(`fedos trust contract-artifact proof: "${fieldName}" must be a non-empty, even-length hex string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos trust contract-artifact proof: "${fieldName}" exceeds max length`);
  }
  if (!DIGEST_HEX_PATTERN.test(value)) {
    throw new RangeError(`fedos trust contract-artifact proof: "${fieldName}" must be lowercase hex`);
  }
  return JSON.stringify(value);
}

/**
 * Canonicalizes a `FedosTrustContractArtifactProofPayload` into one
 * fixed-order JSON-like string, suitable as the `canonicalPayload` argument
 * to `signFedosTrustEnvelopeV1` / `verifyFedosTrustEnvelopeV1`.
 */
export function canonicalizeFedosTrustContractArtifactProofPayloadV1(
  payload: FedosTrustContractArtifactProofPayload,
): string {
  const parts: readonly string[] = [
    `"artifactDigestHex":${digestHexLiteral("artifactDigestHex", payload.artifactDigestHex)}`,
    `"digestAlgorithm":${requiredStringLiteral("digestAlgorithm", payload.digestAlgorithm)}`,
    `"chainIdentifier":${optionalStringLiteral("chainIdentifier", payload.chainIdentifier)}`,
    `"metadata":${canonicalMetadata(payload.metadata)}`,
  ];
  return `{${parts.join(",")}}`;
}

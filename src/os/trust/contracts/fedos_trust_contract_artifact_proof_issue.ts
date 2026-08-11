/**
 * Trust — issue a ContractArtifactProof.
 *
 * No blockchain/network contact happens anywhere in this file (arc brief
 * §26 — hard boundary): the only inputs are locally-supplied bytes/hex and
 * a local signing keypair, matching every other proof type this capability
 * issues.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { signFedosTrustEnvelopeV1 } from "../envelope/fedos_trust_envelope_sign.js";
import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
  type FedosTrustSignedEnvelope,
  type FedosTrustUnsignedEnvelope,
} from "../envelope/fedos_trust_envelope_types.js";
import type { FedosTrustSigningKeypair } from "../envelope/fedos_trust_signing_keypair.js";
import { canonicalizeFedosTrustContractArtifactProofPayloadV1 } from "./fedos_trust_contract_artifact_proof_canonical.js";
import {
  FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE,
  FEDOS_TRUST_CONTRACT_DIGEST_ALGORITHM_SHA256,
  type FedosTrustContractArtifactProofMetadata,
  type FedosTrustContractArtifactProofPayload,
} from "./fedos_trust_contract_artifact_proof_types.js";

/** Computes the sha256 digest hex of arbitrary artifact bytes (source,
 * bytecode, manifest, ...) using this repo's existing hash primitive
 * (`@noble/hashes/sha2.js`) — no new hash library. Purely local; never
 * reads from or writes to a network or blockchain. */
export function computeFedosTrustArtifactDigestHexSha256(artifactBytes: Uint8Array): string {
  return bytesToHex(sha256(artifactBytes));
}

export interface FedosTrustContractArtifactProofPayloadInput {
  readonly artifactDigestHex: string;
  /** Defaults to `FEDOS_TRUST_CONTRACT_DIGEST_ALGORITHM_SHA256` — still an
   * explicit field on the resulting payload, never silently assumed by a
   * verifier. */
  readonly digestAlgorithm?: string;
  /** Included in the payload ONLY if supplied here — never inferred. */
  readonly chainIdentifier?: string;
  readonly metadata?: FedosTrustContractArtifactProofMetadata;
}

export interface FedosTrustContractArtifactProofEnvelopeInput {
  readonly issuer: string;
  readonly subject?: string;
  readonly audience?: string;
  readonly issuedAt: number;
  readonly expiresAt?: number;
  readonly nonce?: string;
  readonly keypair: FedosTrustSigningKeypair;
  /** Defaults to `keypair.publicKeyHex`. */
  readonly keyId?: string;
}

/**
 * Builds and signs a `fedos.contract-artifact.v1` envelope over
 * `artifactProof`. This function performs ONLY local canonicalization +
 * signing — see this file's header for the no-network/no-blockchain
 * boundary.
 */
export function issueFedosTrustContractArtifactProof(
  artifactProof: FedosTrustContractArtifactProofPayloadInput,
  envelopeInput: FedosTrustContractArtifactProofEnvelopeInput,
): FedosTrustSignedEnvelope<FedosTrustContractArtifactProofPayload> {
  const payload: FedosTrustContractArtifactProofPayload = {
    artifactDigestHex: artifactProof.artifactDigestHex,
    digestAlgorithm: artifactProof.digestAlgorithm ?? FEDOS_TRUST_CONTRACT_DIGEST_ALGORITHM_SHA256,
    ...(artifactProof.chainIdentifier !== undefined ? { chainIdentifier: artifactProof.chainIdentifier } : {}),
    ...(artifactProof.metadata !== undefined ? { metadata: artifactProof.metadata } : {}),
  };
  const canonicalPayload = canonicalizeFedosTrustContractArtifactProofPayloadV1(payload);

  const unsigned: FedosTrustUnsignedEnvelope<FedosTrustContractArtifactProofPayload> = {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE,
    issuer: envelopeInput.issuer,
    ...(envelopeInput.subject !== undefined ? { subject: envelopeInput.subject } : {}),
    ...(envelopeInput.audience !== undefined ? { audience: envelopeInput.audience } : {}),
    issuedAt: envelopeInput.issuedAt,
    ...(envelopeInput.expiresAt !== undefined ? { expiresAt: envelopeInput.expiresAt } : {}),
    ...(envelopeInput.nonce !== undefined ? { nonce: envelopeInput.nonce } : {}),
    payload,
    signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
    keyId: envelopeInput.keyId ?? envelopeInput.keypair.publicKeyHex,
  };

  return signFedosTrustEnvelopeV1(unsigned, canonicalPayload, envelopeInput.keypair);
}

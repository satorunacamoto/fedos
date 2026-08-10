/**
 * Trust — ContractArtifactProof payload types.
 *
 * Envelope `type: "fedos.contract-artifact.v1"`. This proof signs an
 * IMMUTABLE ARTIFACT DIGEST (e.g. sha256 of a piece of source, bytecode, or
 * a manifest) — never a live blockchain state, mainnet/testnet address, or
 * wallet balance (arc brief §26 — hard boundary: no blockchain/network
 * contact, no mainnet/testnet/wallet code lives anywhere in this
 * directory).
 *
 * CRITICAL SEMANTIC CONSTRAINT (arc brief §25, §28): the base semantics of
 * this proof are deliberately NARROW — "issuer/subject signed this specific
 * artifact digest under this proof type." That is ALL a valid signature on
 * this payload ever means. It MUST NOT be read, displayed, or composed as
 * implying the artifact is audited, secure, legal, safe, profitable,
 * approved, or deployed. See `fedos_trust_contract_artifact_proof_verify.ts`
 * for how the verify function's own return shape enforces this by never
 * collapsing "signature valid" and "content claim" into one boolean.
 */

/** The one envelope domain type this proof uses. */
export const FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE = "fedos.contract-artifact.v1" as const;

/** The digest algorithm this module's own `issue` helper computes with
 * (`@noble/hashes/sha2.js`'s `sha256` — this repo's existing hash
 * primitive, not a new dependency). `digestAlgorithm` on the payload itself
 * remains a plain `string` field (not narrowed to this literal) precisely
 * so a future algorithm can be recorded explicitly without ever silently
 * assuming one — see the payload interface below. */
export const FEDOS_TRUST_CONTRACT_DIGEST_ALGORITHM_SHA256 = "sha256" as const;

/** Metadata values are restricted to flat JSON primitives (never nested
 * objects/arrays) so the payload canonicalizer can serialize `metadata`
 * deterministically with a simple sorted-key encoding, and so its size is
 * trivially boundable — no risk of a deeply nested "canonicalization bomb"
 * (see `../fedos_trust_limits.ts`'s delegation-chain-depth rationale, same
 * defensive spirit applied here to an untrusted optional field). */
export type FedosTrustContractArtifactProofMetadataValue = string | number | boolean | null;

/** A small, bounded, optional bag of caller-supplied context (e.g.
 * `{ "repositoryUrl": "...", "buildId": "..." }`). Never interpreted by
 * this module beyond canonicalization — carries no semantic weight for
 * `contentClaim`, which is always `"NOT_EVALUATED"` regardless of what
 * `metadata` contains. */
export type FedosTrustContractArtifactProofMetadata = Readonly<
  Record<string, FedosTrustContractArtifactProofMetadataValue>
>;

/**
 * Payload minimum per arc brief §24. `chainIdentifier` is optional and is
 * NEVER inferred or defaulted by this module — it appears in the payload
 * if, and only if, a caller explicitly supplied it to `issueFedosTrust
 * ContractArtifactProof`. This is NOT a blockchain-interaction field: it is,
 * at most, an opaque caller-supplied label (e.g. which chain a related
 * on-chain artifact happens to reference) — this module never contacts any
 * chain, wallet, or network to read or validate it.
 */
export interface FedosTrustContractArtifactProofPayload {
  /** Lowercase hex digest of the artifact (source, bytecode, manifest, ...). */
  readonly artifactDigestHex: string;
  /** Explicit, versioned digest algorithm identifier (e.g. `"sha256"`) —
   * never assumed from `artifactDigestHex`'s length alone. */
  readonly digestAlgorithm: string;
  /** Only present if explicitly supplied by the caller at issue time —
   * never inferred/defaulted. */
  readonly chainIdentifier?: string;
  readonly metadata?: FedosTrustContractArtifactProofMetadata;
}

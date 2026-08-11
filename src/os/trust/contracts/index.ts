/**
 * Trust — `contracts/` barrel. Internal to `os/trust`; the capability's own
 * public surface is `src/os/trust/index.ts`, not this file.
 */

export {
  FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE,
  FEDOS_TRUST_CONTRACT_DIGEST_ALGORITHM_SHA256,
  type FedosTrustContractArtifactProofMetadata,
  type FedosTrustContractArtifactProofMetadataValue,
  type FedosTrustContractArtifactProofPayload,
} from "./fedos_trust_contract_artifact_proof_types.js";

export {
  canonicalizeFedosTrustContractArtifactProofPayloadV1,
} from "./fedos_trust_contract_artifact_proof_canonical.js";

export {
  computeFedosTrustArtifactDigestHexSha256,
  issueFedosTrustContractArtifactProof,
  type FedosTrustContractArtifactProofPayloadInput,
  type FedosTrustContractArtifactProofEnvelopeInput,
} from "./fedos_trust_contract_artifact_proof_issue.js";

export {
  verifyFedosTrustContractArtifactProof,
  verifyFedosTrustDelegatedContractProof,
  FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE,
  type FedosTrustContractArtifactProofVerifyResult,
  type FedosTrustDelegatedContractProofVerifyResult,
  type FedosTrustDelegatedContractProofInput,
  type FedosTrustContractProofRequiredScope,
  type FedosTrustSubscriptionEntitlementVerifyOutcome,
} from "./fedos_trust_contract_artifact_proof_verify.js";

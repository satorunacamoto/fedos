/**
 * Trust — `possession/` barrel. Internal to `os/trust`; the capability's own
 * public surface is `src/os/trust/index.ts`, not this file.
 */

export {
  FEDOS_TRUST_POSSESSION_CHALLENGE_TYPE_V1,
  createFedosTrustPossessionChallenge,
  type FedosTrustPossessionChallenge,
} from "./fedos_trust_possession_challenge.js";

export {
  createFedosTrustPossessionResponseV1,
  canonicalizeFedosTrustPossessionResponsePayloadV1,
  type CreateFedosTrustPossessionResponseV1Params,
  type FedosTrustPossessionResponsePayload,
} from "./fedos_trust_possession_response.js";

export {
  verifyFedosTrustPossessionResponseV1,
  createInMemoryFedosTrustUsedNonceTracker,
  type FedosTrustUsedNonceTracker,
  type FedosTrustPossessionVerifyFailureReason,
  type FedosTrustPossessionVerifyResult,
  type FedosTrustPossessionVerifyOptions,
} from "./fedos_trust_possession_verify.js";

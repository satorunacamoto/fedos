/**
 * Trust — `capabilities/` barrel. Internal to `os/trust`; the capability's
 * own public surface is `src/os/trust/index.ts`, not this file.
 */

export type {
  FedosTrustCapabilityDelegationPolicy,
  FedosTrustCapabilityGrantPayload,
} from "./fedos_trust_capability_grant_types.js";

export { canonicalizeFedosTrustCapabilityGrantPayloadV1 } from "./fedos_trust_capability_grant_canonical.js";

export {
  issueFedosTrustCapabilityGrantV1,
  type IssueFedosTrustCapabilityGrantV1Params,
} from "./fedos_trust_capability_grant_issue.js";

export {
  verifyFedosTrustCapabilityGrantV1,
  type FedosTrustCapabilityGrantVerifyFailureReason,
  type FedosTrustCapabilityGrantVerifyResult,
} from "./fedos_trust_capability_grant_verify.js";

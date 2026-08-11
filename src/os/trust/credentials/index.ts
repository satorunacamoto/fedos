/**
 * Trust — `credentials/` barrel. Internal to `os/trust`; the capability's
 * own public surface is `src/os/trust/index.ts`, not this file.
 */

export type { FedosTrustPseudonymousCredentialPayload } from "./fedos_trust_pseudonymous_credential_types.js";

export { canonicalizeFedosTrustPseudonymousCredentialPayloadV1 } from "./fedos_trust_pseudonymous_credential_canonical.js";

export {
  issueFedosTrustPseudonymousCredentialV1,
  type IssueFedosTrustPseudonymousCredentialV1Params,
} from "./fedos_trust_pseudonymous_credential_issue.js";

export {
  verifyFedosTrustPseudonymousCredentialV1,
  type FedosTrustPseudonymousCredentialVerifyFailureReason,
  type FedosTrustPseudonymousCredentialVerifyResult,
} from "./fedos_trust_pseudonymous_credential_verify.js";

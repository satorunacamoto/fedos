/**
 * Trust — `policy/` barrel. Internal to `os/trust`; the capability's own
 * public surface is `src/os/trust/index.ts`, not this file.
 */

export {
  createFedosTrustPolicy,
  createSingleIssuerFedosTrustPolicy,
  mergeFedosTrustPolicies,
  type FedosTrustPolicy,
  type FedosTrustedIssuer,
  type FedosTrustedIssuerKey,
} from "./fedos_trust_policy_types.js";

export {
  FEDOS_OFFICIAL_ISSUER_ID,
  FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT,
  createFedosOfficialTrustedIssuer,
} from "./fedos_trust_official_issuer_profile.js";

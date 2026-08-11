/**
 * Trust — `entitlement/` barrel. Internal to `os/trust`; the capability's
 * own public surface is `src/os/trust/index.ts`, not this file.
 */

export {
  FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1,
  FEDOS_TRUST_SUBSCRIPTION_SCOPES,
  isValidFedosTrustSubscriptionScope,
  isWellFormedFedosSubscriptionEntitlement,
  type FedosSubscriptionEntitlement,
  type FedosTrustSubscriptionScope,
} from "./fedos_trust_subscription_entitlement_types.js";

export { canonicalizeFedosSubscriptionEntitlementV1 } from "./fedos_trust_subscription_entitlement_canonical.js";

export {
  generateFedosTrustSubscriptionEntitlementSerial,
  issueFedosSubscriptionEntitlement,
} from "./fedos_trust_subscription_entitlement_issue.js";

export {
  verifyFedosSubscriptionEntitlement,
  type FedosTrustSubscriptionEntitlementVerifyOptions,
  type FedosTrustSubscriptionEntitlementVerifyResult,
  type FedosTrustSubscriptionEntitlementVerifyStatus,
} from "./fedos_trust_subscription_entitlement_verify.js";

export {
  FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1,
  isWellFormedSubscriptionSigningRequest,
  type SubscriptionSigningRequest,
} from "./fedos_trust_subscription_signing_request_types.js";

export { canonicalizeFedosTrustSubscriptionSigningRequestV1 } from "./fedos_trust_subscription_signing_request_canonical.js";

export { signFedosTrustSubscriptionSigningRequest } from "./fedos_trust_subscription_signing_request_sign.js";

export {
  verifyFedosTrustSubscriptionSigningRequest,
  type FedosTrustSubscriptionSigningRequestVerifyFailureReason,
  type FedosTrustSubscriptionSigningRequestVerifyResult,
} from "./fedos_trust_subscription_signing_request_verify.js";

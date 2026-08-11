/**
 * Trust — `issuer/` barrel. Internal to `os/trust`; the capability's own
 * public surface is `src/os/trust/index.ts`, not this file.
 */

export {
  generateFedosTrustIssuerKey,
  formatFedosTrustIssuerSecretForFileStorage,
  parseFedosTrustIssuerSecretFromFileStorage,
  loadFedosTrustIssuerKeypair,
  type FedosTrustIssuerGeneratedKey,
} from "./fedos_trust_issuer_keypair.js";

export {
  FedosTrustIssuerEnvFileSecretProvider,
  type FedosTrustIssuerSecretProvider,
} from "./fedos_trust_issuer_secret_provider.js";

export {
  FEDOS_TRUST_STATUS_LIST_FORMAT_VERSION_1,
  isSerialRevoked,
  type FedosTrustStatusList,
} from "./fedos_trust_issuer_status_list_types.js";

export {
  runFedosTrustIssuerGenerateKey,
  formatFedosTrustGenerateKeyStdout,
  computeFedosTrustIssuerIdentity,
  formatFedosTrustInspectKeyStdout,
  parseFedosTrustScopesCsv,
  runFedosTrustIssuerSignEntitlement,
  formatFedosTrustSignEntitlementStdout,
  parseFedosTrustPolicyFromParsedJson,
  runFedosTrustIssuerVerifyEntitlement,
  formatFedosTrustVerifyEntitlementStdout,
  type FedosTrustIssuerGenerateKeyResult,
  type FedosTrustIssuerIdentity,
  type FedosTrustIssuerSignEntitlementResult,
  type FedosTrustPolicyFileShape,
} from "./fedos_trust_issuer_cli_core.js";

/** FedOS Commerce FINAL P1 Closure (Agent K2) — durable sealed-at-rest custody for the demo Commerce Receipt-issuer keypair. A DIFFERENT, additive path from the offline-issuer file-secret provider above; see that file's own module header. */
export {
  COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE,
  COMMERCE_RECEIPT_ISSUER_KEY_ID,
  resolveReceiptIssuerSigningKeypair,
  type ResolveReceiptIssuerSigningKeypairOutcome,
  DurableSealedSigningKeyStore,
} from "./durable_receipt_issuer_signing_key_store.js";

/**
 * FedOS Trust / Offline Monetization + OSS Release Closure arc — public API
 * barrel for `os/trust`.
 *
 * `os/trust` is a peer capability of `os/core`/`os/messenger`/`os/commerce`
 * (see `docs/architecture/ADDING-A-CAPABILITY.md`, `CAPABILITY-MAP.md`).
 * It owns the serverless, offline-verifiable trust/monetization primitives:
 * a canonical SignedEnvelope format, subscription entitlements, an offline
 * issuer, pseudonymous credentials, proof of possession, capability grants,
 * signed QR (transport only), and contract-artifact proofs. See
 * `./README.md` for the full design rationale and
 * `docs/architecture/TRUST-MODEL.md` / `docs/architecture/OFFLINE-MONETIZATION-MODEL.md`
 * for the product-level narrative.
 *
 * Everything re-exported here is real, tested code — not scaffolding (see
 * `./README.md`'s own status section for exactly what is and isn't wired
 * into the packaged app).
 *
 * BOUNDARY (re-verified by `test/architecture_boundary_trust.test.ts`):
 * `os/trust` never imports `os/messenger`, `os/commerce`, `"electron"`, or
 * any Nostr SDK. It depends only on `@noble/curves`/`@noble/hashes`
 * (already this repo's own root crypto dependency) and, for `qr/` image
 * rendering only, the `qrcode` package added this same arc.
 *
 * NOTE ON DUPLICATE EXPORT: `qr/index.ts` re-exports `FedosTrustEnvelopeType`
 * for its own module's convenience (its decode function returns a value of
 * that type) — it is the SAME type as the one exported below from
 * `envelope/`, not a redefinition. Only exported once here to avoid a
 * duplicate-export error; import it from this barrel, not from `./qr/index.js`.
 */

// ---------------------------------------------------------------------------
// envelope/ — the one SignedEnvelope format every domain below builds on.
// ---------------------------------------------------------------------------
export {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
  type FedosTrustEnvelopeType,
  type FedosTrustSignatureAlgorithm,
  type FedosTrustSignedEnvelope,
  type FedosTrustUnsignedEnvelope,
  canonicalizeFedosTrustEnvelopeV1,
  canonicalBytesForFedosTrustEnvelopeV1,
  FedosTrustSigningKeypair,
  isWellFormedFedosTrustPublicKeyHex,
  isWellFormedFedosTrustSignatureHex,
  verifyFedosTrustSignatureOverDigest,
  verifyFedosTrustSignatureOverBytes,
  type FedosTrustClock,
  defaultFedosTrustClock,
  fixedFedosTrustClock,
  signFedosTrustEnvelopeV1,
  verifyFedosTrustEnvelopeV1,
  type FedosTrustVerifyFailureReason,
  type FedosTrustVerifyResult,
  type FedosTrustVerifyOptions,
} from "./envelope/index.js";

// ---------------------------------------------------------------------------
// policy/ — verifier-selected TrustPolicy; FedOS Official is one OPTIONAL
// issuer profile among any number a verifier may choose to trust.
// ---------------------------------------------------------------------------
export {
  createFedosTrustPolicy,
  createSingleIssuerFedosTrustPolicy,
  mergeFedosTrustPolicies,
  type FedosTrustPolicy,
  type FedosTrustedIssuer,
  type FedosTrustedIssuerKey,
  FEDOS_OFFICIAL_ISSUER_ID,
  FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT,
  createFedosOfficialTrustedIssuer,
} from "./policy/index.js";

// ---------------------------------------------------------------------------
// fedos_trust_limits.ts — shared bounds, re-exported for consumers/tests
// that want to validate against the same limits this capability enforces.
// ---------------------------------------------------------------------------
export {
  FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH,
  FEDOS_TRUST_MAX_FIELD_STRING_LENGTH,
  FEDOS_TRUST_MAX_SCOPES,
  FEDOS_TRUST_MAX_DELEGATION_CHAIN_DEPTH,
  FEDOS_TRUST_MAX_ISSUER_KEYS,
  FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS,
} from "./fedos_trust_limits.js";

// ---------------------------------------------------------------------------
// credentials/ — PseudonymousIdentityCredential.
// ---------------------------------------------------------------------------
export {
  type FedosTrustPseudonymousCredentialPayload,
  canonicalizeFedosTrustPseudonymousCredentialPayloadV1,
  issueFedosTrustPseudonymousCredentialV1,
  type IssueFedosTrustPseudonymousCredentialV1Params,
  verifyFedosTrustPseudonymousCredentialV1,
  type FedosTrustPseudonymousCredentialVerifyFailureReason,
  type FedosTrustPseudonymousCredentialVerifyResult,
} from "./credentials/index.js";

// ---------------------------------------------------------------------------
// possession/ — local challenge-response proof of possession.
// ---------------------------------------------------------------------------
export {
  FEDOS_TRUST_POSSESSION_CHALLENGE_TYPE_V1,
  createFedosTrustPossessionChallenge,
  type FedosTrustPossessionChallenge,
  createFedosTrustPossessionResponseV1,
  canonicalizeFedosTrustPossessionResponsePayloadV1,
  type CreateFedosTrustPossessionResponseV1Params,
  type FedosTrustPossessionResponsePayload,
  verifyFedosTrustPossessionResponseV1,
  createInMemoryFedosTrustUsedNonceTracker,
  type FedosTrustUsedNonceTracker,
  type FedosTrustPossessionVerifyFailureReason,
  type FedosTrustPossessionVerifyResult,
  type FedosTrustPossessionVerifyOptions,
} from "./possession/index.js";

// ---------------------------------------------------------------------------
// capabilities/ — minimal reusable CapabilityGrant primitive.
// ---------------------------------------------------------------------------
export {
  type FedosTrustCapabilityDelegationPolicy,
  type FedosTrustCapabilityGrantPayload,
  canonicalizeFedosTrustCapabilityGrantPayloadV1,
  issueFedosTrustCapabilityGrantV1,
  type IssueFedosTrustCapabilityGrantV1Params,
  verifyFedosTrustCapabilityGrantV1,
  type FedosTrustCapabilityGrantVerifyFailureReason,
  type FedosTrustCapabilityGrantVerifyResult,
} from "./capabilities/index.js";

// ---------------------------------------------------------------------------
// entitlement/ — FedosSubscriptionEntitlement + SubscriptionSigningRequest.
// The core monetization deliverable of this arc.
// ---------------------------------------------------------------------------
export {
  FEDOS_TRUST_SUBSCRIPTION_ENTITLEMENT_FORMAT_VERSION_1,
  FEDOS_TRUST_SUBSCRIPTION_SCOPES,
  isValidFedosTrustSubscriptionScope,
  isWellFormedFedosSubscriptionEntitlement,
  type FedosSubscriptionEntitlement,
  type FedosTrustSubscriptionScope,
  canonicalizeFedosSubscriptionEntitlementV1,
  generateFedosTrustSubscriptionEntitlementSerial,
  issueFedosSubscriptionEntitlement,
  verifyFedosSubscriptionEntitlement,
  type FedosTrustSubscriptionEntitlementVerifyOptions,
  type FedosTrustSubscriptionEntitlementVerifyResult,
  type FedosTrustSubscriptionEntitlementVerifyStatus,
  FEDOS_TRUST_SUBSCRIPTION_SIGNING_REQUEST_FORMAT_VERSION_1,
  isWellFormedSubscriptionSigningRequest,
  type SubscriptionSigningRequest,
  canonicalizeFedosTrustSubscriptionSigningRequestV1,
  signFedosTrustSubscriptionSigningRequest,
  verifyFedosTrustSubscriptionSigningRequest,
  type FedosTrustSubscriptionSigningRequestVerifyFailureReason,
  type FedosTrustSubscriptionSigningRequestVerifyResult,
} from "./entitlement/index.js";

// ---------------------------------------------------------------------------
// issuer/ — offline issuer key handling + CLI core logic. The actual
// executable entrypoint is `scripts/fedos_trust_issuer_cli.mjs`
// (`npm run trust:issuer -- <subcommand>`); this barrel exports the pure,
// testable logic behind it, in case a host application wants to build its
// own operator UI around the same functions instead of shelling out.
// ---------------------------------------------------------------------------
export {
  generateFedosTrustIssuerKey,
  formatFedosTrustIssuerSecretForFileStorage,
  parseFedosTrustIssuerSecretFromFileStorage,
  loadFedosTrustIssuerKeypair,
  type FedosTrustIssuerGeneratedKey,
  FedosTrustIssuerEnvFileSecretProvider,
  type FedosTrustIssuerSecretProvider,
  FEDOS_TRUST_STATUS_LIST_FORMAT_VERSION_1,
  isSerialRevoked,
  type FedosTrustStatusList,
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
  COMMERCE_RECEIPT_ISSUER_SIGNING_KEY_PURPOSE,
  COMMERCE_RECEIPT_ISSUER_KEY_ID,
  resolveReceiptIssuerSigningKeypair,
  type ResolveReceiptIssuerSigningKeypairOutcome,
  DurableSealedSigningKeyStore,
} from "./issuer/index.js";

// ---------------------------------------------------------------------------
// qr/ — Signed QR as TRANSPORT over an already-signed envelope, never a
// security primitive of its own. `FedosTrustEnvelopeType` is intentionally
// NOT re-exported again here — see this file's own header note.
// ---------------------------------------------------------------------------
export {
  FEDOS_TRUST_QR_TEXT_PREFIX,
  encodeFedosTrustEnvelopeToQrText,
  decodeFedosTrustEnvelopeFromQrText,
  type FedosTrustQrDecodeError,
  renderFedosTrustQrTextToPngDataUrl,
  renderFedosTrustQrTextToTerminalString,
  fedosTrustQrImageEncoder,
  type FedosTrustQrImageEncodeResult,
  type FedosTrustQrImageEncoderPort,
} from "./qr/index.js";

// ---------------------------------------------------------------------------
// contracts/ — ContractArtifactProof. Signs an immutable artifact digest
// only; never claims audited/secure/legal/safe/approved/deployed, and never
// collapses "signature valid" with "content is true" into one boolean.
// ---------------------------------------------------------------------------
export {
  FEDOS_TRUST_CONTRACT_ARTIFACT_ENVELOPE_TYPE,
  FEDOS_TRUST_CONTRACT_DIGEST_ALGORITHM_SHA256,
  type FedosTrustContractArtifactProofMetadata,
  type FedosTrustContractArtifactProofMetadataValue,
  type FedosTrustContractArtifactProofPayload,
  canonicalizeFedosTrustContractArtifactProofPayloadV1,
  computeFedosTrustArtifactDigestHexSha256,
  issueFedosTrustContractArtifactProof,
  type FedosTrustContractArtifactProofPayloadInput,
  type FedosTrustContractArtifactProofEnvelopeInput,
  verifyFedosTrustContractArtifactProof,
  verifyFedosTrustDelegatedContractProof,
  FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE,
  type FedosTrustContractArtifactProofVerifyResult,
  type FedosTrustDelegatedContractProofVerifyResult,
  type FedosTrustDelegatedContractProofInput,
  type FedosTrustContractProofRequiredScope,
  type FedosTrustSubscriptionEntitlementVerifyOutcome,
} from "./contracts/index.js";

// ---------------------------------------------------------------------------
// createTrust() — the capability factory (docs/architecture/ADDING-A-CAPABILITY.md
// convention). Trust has no messaging/storage Port dependency; its only
// genuinely swappable seams are the clock (for deterministic tests) and the
// QR image renderer (`FedosTrustQrImageEncoderPort`, in case a host wants to
// substitute a different QR library later). Calling `createTrust()` with no
// arguments is always safe: it does zero I/O, contacts zero external
// service, and never throws.
// ---------------------------------------------------------------------------
export { createTrust, type Trust, type TrustDependencies } from "./create_trust.js";

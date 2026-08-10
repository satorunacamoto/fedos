/**
 * Trust — `envelope/` barrel. Internal to `os/trust`; the capability's own
 * public surface is `src/os/trust/index.ts`, not this file.
 */

export {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
  type FedosTrustEnvelopeType,
  type FedosTrustSignatureAlgorithm,
  type FedosTrustSignedEnvelope,
  type FedosTrustUnsignedEnvelope,
} from "./fedos_trust_envelope_types.js";

export {
  canonicalizeFedosTrustEnvelopeV1,
  canonicalBytesForFedosTrustEnvelopeV1,
} from "./fedos_trust_canonical_bytes.js";

export {
  FedosTrustSigningKeypair,
  isWellFormedFedosTrustPublicKeyHex,
  isWellFormedFedosTrustSignatureHex,
  verifyFedosTrustSignatureOverDigest,
  verifyFedosTrustSignatureOverBytes,
} from "./fedos_trust_signing_keypair.js";

export {
  type FedosTrustClock,
  defaultFedosTrustClock,
  fixedFedosTrustClock,
} from "./fedos_trust_clock.js";

export { signFedosTrustEnvelopeV1 } from "./fedos_trust_envelope_sign.js";

export {
  verifyFedosTrustEnvelopeV1,
  type FedosTrustVerifyFailureReason,
  type FedosTrustVerifyResult,
  type FedosTrustVerifyOptions,
} from "./fedos_trust_envelope_verify.js";

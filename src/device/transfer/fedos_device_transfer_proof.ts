/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — Transfer Proof of Possession (initiator) and Transfer
 * Approval (responder).
 *
 * Both signatures reuse `FedosDeviceSigningKeypair.sign()`/
 * `verifyFedosDeviceSigningSignature()` verbatim (Alpha 3161–3240, real
 * BIP-340 Schnorr, zero new cryptographic primitive) over
 * `sha256(fixedPrefix + serializeFedosDeviceTransferChallengeV1(challenge))`
 * — the SAME "distinct fixed preimage prefix per signature role" technique
 * `fedos_device_binding_proof_of_possession.ts` already established, so the
 * two roles here (Proof vs. Approval) — and both of THOSE against any
 * Device Binding signature — can never be confused or substituted for one
 * another, even though every signature in this Arc's family is produced by
 * the SAME `FedosDeviceSigningKeypair` class.
 *
 * - **Transfer Proof of Possession**: the initiator device signs the
 *   Challenge the responder minted, proving it holds the private key named
 *   in the Invitation — mirrors the Device Binding Proof exactly.
 * - **Transfer Approval**: the RESPONDER signs a statement over the SAME
 *   Challenge under a DIFFERENT fixed prefix, proving IT is live and holds
 *   its own registered key too — the mutual-authentication half this Arc
 *   adds that Device Binding (a one-directional account→device proof) does
 *   not need.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  isWellFormedFedosDevicePublicKeyHex,
  isWellFormedFedosDeviceSchnorrSignatureHex,
  verifyFedosDeviceSigningSignature,
  type FedosDeviceSigningKeypair,
} from "../crypto/fedos_device_signing_keypair.js";
import {
  isFedosDeviceTransferChallengeExpired,
  isWellFormedFedosDeviceTransferChallengeV1,
  serializeFedosDeviceTransferChallengeV1,
  type FedosDeviceTransferChallengeV1,
} from "./fedos_device_transfer_challenge.js";

const PROOF_PREIMAGE_PREFIX = "fedos-device-transfer-proof-v1:";
const APPROVAL_PREIMAGE_PREFIX = "fedos-device-transfer-approval-v1:";

function digestFor(prefix: string, challenge: FedosDeviceTransferChallengeV1): Uint8Array {
  return sha256(new TextEncoder().encode(prefix + serializeFedosDeviceTransferChallengeV1(challenge)));
}

export interface FedosDeviceTransferProofV1 {
  readonly challenge: FedosDeviceTransferChallengeV1;
  readonly devicePublicKeyHex: string;
  readonly signatureHex: string;
}

/** Creates a Transfer Proof for `challenge`, signed by `keypair`. `null` if the challenge is malformed OR `keypair.publicKeyHex` does not match `challenge.initiatorDevicePublicKeyHex` — a Device can never prove possession of a key it does not hold. */
export function createFedosDeviceTransferProof(
  keypair: FedosDeviceSigningKeypair,
  challenge: FedosDeviceTransferChallengeV1,
): FedosDeviceTransferProofV1 | null {
  if (!isWellFormedFedosDeviceTransferChallengeV1(challenge)) return null;
  if (keypair.publicKeyHex !== challenge.initiatorDevicePublicKeyHex) return null;
  const signatureHex = bytesToHex(keypair.sign(digestFor(PROOF_PREIMAGE_PREFIX, challenge)));
  return Object.freeze({ challenge, devicePublicKeyHex: keypair.publicKeyHex, signatureHex });
}

export type FedosDeviceTransferProofOutcome = "valid" | "malformed-challenge" | "malformed-proof" | "key-mismatch" | "invalid-signature" | "expired";

/** Verifies a Transfer Proof against the SAME challenge object the caller independently holds. Fails closed; never throws. */
export function verifyFedosDeviceTransferProof(proof: FedosDeviceTransferProofV1, now: number): FedosDeviceTransferProofOutcome {
  const { challenge } = proof;
  if (!isWellFormedFedosDeviceTransferChallengeV1(challenge)) return "malformed-challenge";
  if (!isWellFormedFedosDevicePublicKeyHex(proof.devicePublicKeyHex) || !isWellFormedFedosDeviceSchnorrSignatureHex(proof.signatureHex)) {
    return "malformed-proof";
  }
  if (proof.devicePublicKeyHex !== challenge.initiatorDevicePublicKeyHex) return "key-mismatch";

  if (!verifyFedosDeviceSigningSignature(proof.devicePublicKeyHex, digestFor(PROOF_PREIMAGE_PREFIX, challenge), proof.signatureHex)) {
    return "invalid-signature";
  }
  if (isFedosDeviceTransferChallengeExpired(challenge, now)) return "expired";
  return "valid";
}

export interface FedosDeviceTransferApprovalV1 {
  readonly challenge: FedosDeviceTransferChallengeV1;
  readonly responderDeviceId: string;
  readonly responderDevicePublicKeyHex: string;
  readonly signatureHex: string;
  readonly approvedAt: number;
}

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Creates a Transfer Approval for `challenge`, signed by the RESPONDER's own `keypair`. `null` if the challenge is malformed or `responderDeviceId` is malformed. */
export function createFedosDeviceTransferApproval(
  keypair: FedosDeviceSigningKeypair,
  challenge: FedosDeviceTransferChallengeV1,
  responderDeviceId: string,
  approvedAt: number,
): FedosDeviceTransferApprovalV1 | null {
  if (!isWellFormedFedosDeviceTransferChallengeV1(challenge)) return null;
  if (!isNonEmptyString(responderDeviceId) || !DEVICE_ID_PATTERN.test(responderDeviceId)) return null;
  const signatureHex = bytesToHex(keypair.sign(digestFor(APPROVAL_PREIMAGE_PREFIX, challenge)));
  return Object.freeze({ challenge, responderDeviceId, responderDevicePublicKeyHex: keypair.publicKeyHex, signatureHex, approvedAt });
}

export type FedosDeviceTransferApprovalOutcome = "valid" | "malformed-challenge" | "malformed-approval" | "key-mismatch" | "invalid-signature" | "expired";

/** Verifies a Transfer Approval. `expectedResponderDevicePublicKeyHex` is the caller's OWN independently-resolved live Registry value for `approval.responderDeviceId` — never trusted from the approval object alone. */
export function verifyFedosDeviceTransferApproval(
  approval: FedosDeviceTransferApprovalV1,
  expectedResponderDevicePublicKeyHex: string,
  now: number,
): FedosDeviceTransferApprovalOutcome {
  const { challenge } = approval;
  if (!isWellFormedFedosDeviceTransferChallengeV1(challenge)) return "malformed-challenge";
  if (
    !isNonEmptyString(approval.responderDeviceId) ||
    !DEVICE_ID_PATTERN.test(approval.responderDeviceId) ||
    !isWellFormedFedosDevicePublicKeyHex(approval.responderDevicePublicKeyHex) ||
    !isWellFormedFedosDeviceSchnorrSignatureHex(approval.signatureHex)
  ) {
    return "malformed-approval";
  }
  if (approval.responderDevicePublicKeyHex !== expectedResponderDevicePublicKeyHex) return "key-mismatch";

  if (!verifyFedosDeviceSigningSignature(approval.responderDevicePublicKeyHex, digestFor(APPROVAL_PREIMAGE_PREFIX, challenge), approval.signatureHex)) {
    return "invalid-signature";
  }
  if (isFedosDeviceTransferChallengeExpired(challenge, now)) return "expired";
  return "valid";
}

/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase D: Device-level evidence over a suppression
 * fact.
 *
 * Mirrors `fedos_device_binding_proof_of_possession.ts`'s own exact
 * shape: a fixed, domain-separated preimage prefix (distinct from every
 * other Device-signature use in this codebase — Peer Capability, Ratchet
 * Session Reset, Identity Transition Device Corroboration, Device
 * Binding Proof of Possession all define their OWN prefix; this Arc adds
 * a new one, never reuses another domain's), `sha256` over the prefixed
 * canonical bytes, `FedosDeviceSigningKeypair.sign()`/
 * `verifyFedosDeviceSigningSignature()` — the SAME real, already-shipped
 * primitives, never a new signing algorithm.
 *
 * PRECISE EVIDENCE-LEVEL DISCIPLINE (Phase D's own explicit instruction:
 * "Account signature alone must not be described as proof of a
 * particular Device when Device evidence is absent"):
 *   - The PRIMARY authentication boundary for a suppression fact is the
 *     outer transport-level Nostr event signature (verified by the
 *     Device Sync transport layer, `fedos_archive_suppression_inbound_handler.ts`
 *     — real BIP-340 Schnorr verification over a real NIP-01 event,
 *     unmodified, reused) — this proves "an account-authorized device
 *     (one that holds this account's own activated signing capability)
 *     sent this," never "device X specifically sent this."
 *   - THIS file's own Device-level evidence is a SEPARATE, OPTIONAL,
 *     best-effort layer that narrows the claim to a SPECIFIC
 *     `sourceDeviceId`, mirroring Ratchet Peer Capability's own accepted
 *     evidence-level pattern EXACTLY (`fedos_ratchet_peer_capability_authentication.ts`)
 *     — never a hard requirement, since `devicePublicKeyRef` is `null`
 *     for the common case today (Phase A reconciliation report §9).
 *   - A caller MUST NOT present device-level evidence as proven when
 *     only the weaker, account-level claim holds — `FedosArchiveSuppressionFactEvidenceLevel`
 *     below exists specifically so callers cannot conflate the two.
 *
 * HARD GUARDRAILS:
 *   - No raw private key of any kind crosses this file.
 *   - `verifyFedosArchiveSuppressionFactDeviceEvidence` fails closed;
 *     never throws.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import {
  isWellFormedFedosDevicePublicKeyHex,
  isWellFormedFedosDeviceSchnorrSignatureHex,
  verifyFedosDeviceSigningSignature,
  type FedosDeviceSigningKeypair,
} from "../../device/crypto/fedos_device_signing_keypair.js";
import { fedosArchiveSuppressionFactCanonicalBytes, type FedosArchiveSuppressionFact } from "./fedos_archive_suppression_fact.js";

/** Fixed preimage prefix — distinct from every other Device-signature domain in this codebase (Proof of Possession, Peer Capability, Ratchet Session Reset, Identity Transition Device Corroboration each define their own; this Arc's is new and never reused elsewhere). */
const SUPPRESSION_FACT_DEVICE_EVIDENCE_PREIMAGE_PREFIX = "fedos-archive-suppression-fact-device-evidence-v1:";

function suppressionFactDeviceEvidenceDigest(fact: FedosArchiveSuppressionFact): Uint8Array {
  const preimage = new Uint8Array([
    ...new TextEncoder().encode(SUPPRESSION_FACT_DEVICE_EVIDENCE_PREIMAGE_PREFIX),
    ...fedosArchiveSuppressionFactCanonicalBytes(fact),
  ]);
  return sha256(preimage);
}

export interface FedosArchiveSuppressionFactDeviceEvidenceV1 {
  readonly devicePublicKeyHex: string;
  readonly signatureHex: string;
}

/** `null` if `keypair.publicKeyHex` does not match `fact.sourceDeviceId`'s own claimed key — a Device can only ever produce evidence for the fact IT authored, under the key it actually holds. Callers pass the RECEIVING/LOCAL device's registry-known `devicePublicKeyRef` for the source device as `expectedDevicePublicKeyHex`; `null` skips this cross-check for the SELF-authoring case (a device producing evidence for its own, just-created fact always trusts its own keypair). */
export function createFedosArchiveSuppressionFactDeviceEvidence(
  keypair: FedosDeviceSigningKeypair,
  fact: FedosArchiveSuppressionFact,
): FedosArchiveSuppressionFactDeviceEvidenceV1 {
  const digest = suppressionFactDeviceEvidenceDigest(fact);
  return Object.freeze({
    devicePublicKeyHex: keypair.publicKeyHex,
    signatureHex: bytesToHex(keypair.sign(digest)),
  });
}

export type FedosArchiveSuppressionFactEvidenceLevel =
  /** Only the transport-level (account) signature was verified -- device-specific attribution is NOT proven. Callers must never describe this as "device X sent this." */
  | "account-only"
  /** A well-formed, cryptographically valid Device signature over this exact fact was verified, AND it matches the Device Registry's own known `devicePublicKeyRef` for `sourceDeviceId`. */
  | "device-verified"
  /** Device evidence was PRESENT but did not verify (wrong key, bad signature, or registry mismatch) -- a stronger signal than "account-only" (something was tampered with or misattributed) but never treated as a successful device attribution. */
  | "device-evidence-invalid";

/**
 * Verifies OPTIONAL device-level evidence against the fact it accompanies
 * and the receiving Device's own locally-known `devicePublicKeyRef` for
 * `fact.sourceDeviceId` (`expectedDevicePublicKeyHex`, `null` if the
 * local Registry has no key on file for that device -- the common case
 * today, per Phase A's own finding). Never throws.
 */
export function verifyFedosArchiveSuppressionFactDeviceEvidence(
  fact: FedosArchiveSuppressionFact,
  evidence: FedosArchiveSuppressionFactDeviceEvidenceV1 | null,
  expectedDevicePublicKeyHex: string | null,
): FedosArchiveSuppressionFactEvidenceLevel {
  if (evidence === null) return "account-only";
  if (!isWellFormedFedosDevicePublicKeyHex(evidence.devicePublicKeyHex)) return "device-evidence-invalid";
  if (!isWellFormedFedosDeviceSchnorrSignatureHex(evidence.signatureHex)) return "device-evidence-invalid";
  if (expectedDevicePublicKeyHex !== null && evidence.devicePublicKeyHex !== expectedDevicePublicKeyHex) {
    return "device-evidence-invalid";
  }

  const digest = suppressionFactDeviceEvidenceDigest(fact);
  const valid = verifyFedosDeviceSigningSignature(evidence.devicePublicKeyHex, digest, evidence.signatureHex);
  return valid ? "device-verified" : "device-evidence-invalid";
}

/** Re-exported for callers that need to reconstruct/inspect the raw digest without importing `@noble/hashes` directly (e.g. tests). */
export function fedosArchiveSuppressionFactDeviceEvidenceDigestHex(fact: FedosArchiveSuppressionFact): string {
  return bytesToHex(suppressionFactDeviceEvidenceDigest(fact));
}

/** Re-exported for symmetry with other Device-evidence files in this codebase (unused internally, kept for callers that need raw hex<->bytes at the boundary). */
export { hexToBytes };

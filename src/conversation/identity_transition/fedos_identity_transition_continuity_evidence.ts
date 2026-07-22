/**
 * FedOS Identity Transition Foundation Arc — Phase G: old-identity
 * continuity evidence.
 *
 * Real BIP-340 Schnorr verification, same posture as
 * `fedos_identity_transition_new_key_proof.ts` (verifies only, never
 * signs, no new cryptographic primitive).
 *
 * Phase G's own stated limitation, preserved verbatim: a cryptographically
 * valid old-key signature is continuity evidence ONLY under an
 * uncompromised-old-key assumption — it is NOT sufficient proof when the
 * old key is suspected compromised. This file therefore never maps an
 * old-key signature directly to a `"trusted"`/`"accepted"` status; its own
 * verification function returns only `"cryptographically-valid"` or
 * `"rejected"`/`"unverifiable"` (an `FedosIdentityTransitionEvidenceStatus`
 * value), and it is the evidence evaluator (Phase I) — NOT this file —
 * that decides whether that status is enough, conditioned on the
 * transition's own `reasonCategory`.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionContinuityProofDigest } from "./fedos_identity_transition_canonical.js";
import type { FedosIdentityTransitionRecordV1 } from "./fedos_identity_transition_record.js";
import type { FedosIdentityTransitionEvidenceStatus } from "./fedos_identity_transition_vocabulary.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SCHNORR_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;

export interface FedosIdentityTransitionContinuityEvidenceV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly revision: number;
  readonly bodyHash: string;
  readonly oldNostrIdentity: string;
  readonly newNostrIdentity: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly signatureHex: string;
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isWellFormedFedosIdentityTransitionContinuityEvidenceV1(
  candidate: unknown,
): candidate is FedosIdentityTransitionContinuityEvidenceV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  const known = new Set([
    "schemaVersion",
    "transitionId",
    "revision",
    "bodyHash",
    "oldNostrIdentity",
    "newNostrIdentity",
    "issuedAt",
    "expiresAt",
    "signatureHex",
  ]);
  if (keys.length !== known.size || !keys.every((k) => known.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyBoundedString(r.transitionId, 256)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (!isNonEmptyBoundedString(r.bodyHash, 128)) return false;
  if (typeof r.oldNostrIdentity !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(r.oldNostrIdentity)) return false;
  if (typeof r.newNostrIdentity !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(r.newNostrIdentity)) return false;
  if (!Number.isInteger(r.issuedAt) || !Number.isInteger(r.expiresAt) || (r.expiresAt as number) <= (r.issuedAt as number)) return false;
  if (typeof r.signatureHex !== "string" || !SCHNORR_SIGNATURE_HEX_PATTERN.test(r.signatureHex)) return false;
  return true;
}

/**
 * Returns ONLY `"cryptographically-valid"`, `"rejected"`, or
 * `"unverifiable"` — deliberately never `"locally-accepted"` or any other
 * acceptance-flavored status (that decision belongs solely to the
 * evidence evaluator, Phase I, which also knows the transition's
 * `reasonCategory`).
 */
export function verifyFedosIdentityTransitionContinuityEvidence(
  record: FedosIdentityTransitionRecordV1,
  evidence: FedosIdentityTransitionContinuityEvidenceV1,
): FedosIdentityTransitionEvidenceStatus {
  if (!isWellFormedFedosIdentityTransitionContinuityEvidenceV1(evidence)) return "unverifiable";
  if (evidence.transitionId !== record.transitionId) return "unverifiable";
  if (evidence.revision !== record.revision) return "unverifiable";
  if (evidence.oldNostrIdentity !== record.oldNostrIdentity) return "unverifiable";
  if (evidence.newNostrIdentity !== record.newNostrIdentity) return "unverifiable";
  if (evidence.bodyHash !== fedosIdentityTransitionBodyHash(record)) return "unverifiable";
  try {
    const digest = fedosIdentityTransitionContinuityProofDigest({
      transitionId: evidence.transitionId,
      revision: evidence.revision,
      bodyHash: evidence.bodyHash,
      oldNostrIdentity: evidence.oldNostrIdentity,
      newNostrIdentity: evidence.newNostrIdentity,
      issuedAt: evidence.issuedAt,
      expiresAt: evidence.expiresAt,
    });
    const ok = schnorr.verify(hexToBytes(evidence.signatureHex), digest, hexToBytes(evidence.oldNostrIdentity));
    return ok ? "cryptographically-valid" : "rejected";
  } catch {
    return "unverifiable";
  }
}

/**
 * FedOS Identity Transition Foundation Arc — Phase F: new-key
 * proof-of-possession.
 *
 * Real BIP-340 Schnorr verification via `@noble/curves`, the SAME
 * dependency already used in production by
 * `../../nostr/noble_signature.ts` and
 * `../../device/crypto/fedos_device_signing_keypair.ts` — no new
 * cryptographic primitive (Absolute Prohibitions). This file verifies
 * only; it never signs (identical posture to `noble_signature.ts`'s own
 * header) — signing is the caller's own new-identity signing authority's
 * job (in production, `FedosNostrSigningAuthority`; in this Arc's real
 * vertical slice test, `RealFedosNostrSigningAuthority`'s underlying
 * key), and the raw private key never appears in this module.
 *
 * Phase F's own stated limitation, preserved verbatim in this file's
 * public API: "Proof of new-key possession alone does not prove
 * continuity" — `verifyFedosIdentityTransitionNewKeyProof()` returns only
 * a structural/cryptographic verdict about whether the NEW key signed
 * this specific transition; it says nothing about whether the OLD
 * identity's holder authorized the change. The evidence evaluator
 * (Phase I) is the only place these two facts are combined.
 */
import { schnorr } from "@noble/curves/secp256k1.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { fedosIdentityTransitionNewKeyProofDigest } from "../../../../conversation/identity_transition/fedos_identity_transition_canonical.js";
import type { FedosIdentityTransitionRecordV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_record.js";
import { fedosIdentityTransitionBodyHash } from "../../../../conversation/identity_transition/fedos_identity_transition_canonical.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SCHNORR_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;

export interface FedosIdentityTransitionNewKeyProofV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly revision: number;
  readonly bodyHash: string;
  readonly newNostrIdentity: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  /** 64-byte raw Schnorr signature, hex-encoded — a signature, never a private key. */
  readonly signatureHex: string;
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isWellFormedFedosIdentityTransitionNewKeyProofV1(candidate: unknown): candidate is FedosIdentityTransitionNewKeyProofV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  const known = new Set(["schemaVersion", "transitionId", "revision", "bodyHash", "newNostrIdentity", "issuedAt", "expiresAt", "signatureHex"]);
  if (keys.length !== known.size || !keys.every((k) => known.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyBoundedString(r.transitionId, 256)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0) return false;
  if (!isNonEmptyBoundedString(r.bodyHash, 128)) return false;
  if (typeof r.newNostrIdentity !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(r.newNostrIdentity)) return false;
  if (!Number.isInteger(r.issuedAt) || !Number.isInteger(r.expiresAt) || (r.expiresAt as number) <= (r.issuedAt as number)) return false;
  if (typeof r.signatureHex !== "string" || !SCHNORR_SIGNATURE_HEX_PATTERN.test(r.signatureHex)) return false;
  return true;
}

/**
 * Real cryptographic verification boundary. Never throws — a malformed
 * proof, a wrong transition/revision/body binding, or a signature that
 * fails to verify all resolve to `false` (fail closed). This is the ONLY
 * place a raw signature check happens for this evidence kind; every
 * caller must route through here rather than re-implementing schnorr
 * verification inline (Phase F: "no fake-production fallback").
 */
export function verifyFedosIdentityTransitionNewKeyProof(
  record: FedosIdentityTransitionRecordV1,
  proof: FedosIdentityTransitionNewKeyProofV1,
): boolean {
  if (!isWellFormedFedosIdentityTransitionNewKeyProofV1(proof)) return false;
  if (proof.transitionId !== record.transitionId) return false;
  if (proof.revision !== record.revision) return false;
  if (proof.newNostrIdentity !== record.newNostrIdentity) return false;
  if (proof.bodyHash !== fedosIdentityTransitionBodyHash(record)) return false;
  try {
    const digest = fedosIdentityTransitionNewKeyProofDigest({
      transitionId: proof.transitionId,
      revision: proof.revision,
      bodyHash: proof.bodyHash,
      oldNostrIdentity: record.oldNostrIdentity,
      newNostrIdentity: proof.newNostrIdentity,
      issuedAt: proof.issuedAt,
      expiresAt: proof.expiresAt,
    });
    return schnorr.verify(hexToBytes(proof.signatureHex), digest, hexToBytes(proof.newNostrIdentity));
  } catch {
    return false;
  }
}

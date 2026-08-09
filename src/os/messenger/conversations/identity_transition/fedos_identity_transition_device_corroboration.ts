/**
 * FedOS Identity Transition Foundation Arc — Phase H: optional Device
 * corroboration evidence.
 *
 * Uses the ACTUAL available Device-signature boundary
 * (`../../device/crypto/fedos_device_signing_keypair.ts`'s
 * `verifyFedosDeviceSigningSignature()`) — no new cryptographic
 * primitive, no invented durable Device private-key storage (Absolute
 * Prohibitions). A Device's own keypair remains process-memory-only,
 * exactly as `fedos_device_signing_keypair.ts` itself documents; this
 * file never persists or accepts raw Device secret material.
 *
 * Requirements enforced here (Phase H):
 *   - the corroborating Device must have a `"trusted"` `FedosDeviceBindingV1`
 *     bound to the transition's OLD account (an unknown/untrusted/revoked
 *     Device is never silently accepted)
 *   - the proof binds `transitionId` + `revision` + the new identity
 *   - `devicePublicKeyRef` on the binding must match the proof's own
 *     `devicePublicKeyHex` (a stale/wrong-key binding fails closed)
 *   - callers combine at most a bounded set of these per transition —
 *     ONE Device corroborating is never itself described as a quorum;
 *     that framing is enforced by the evidence evaluator (Phase I), not
 *     by strengthening this file's own per-proof verdict.
 */
import {
  isFedosDeviceBindingRevoked,
  isFedosDeviceBindingTrusted,
  type FedosDeviceBindingV1,
} from "../../../../device/fedos_device_binding.js";
import { verifyFedosDeviceSigningSignature } from "../../../../device/crypto/fedos_device_signing_keypair.js";
import { fedosIdentityTransitionBodyHash, fedosIdentityTransitionDeviceCorroborationDigest } from "../../../../conversation/identity_transition/fedos_identity_transition_canonical.js";
import { fedosIdentityTransitionAccountRefsEqual, type FedosIdentityTransitionRecordV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_record.js";
import type { FedosIdentityTransitionEvidenceStatus } from "../../../../conversation/identity_transition/fedos_identity_transition_vocabulary.js";

const SCHNORR_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;

export interface FedosIdentityTransitionDeviceCorroborationV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly revision: number;
  readonly bodyHash: string;
  readonly newNostrIdentity: string;
  readonly deviceId: string;
  /** Opaque Device public-key reference, matched against the Device Binding's own `devicePublicKeyRef` — never a private key. */
  readonly devicePublicKeyHex: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly signatureHex: string;
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isWellFormedFedosIdentityTransitionDeviceCorroborationV1(
  candidate: unknown,
): candidate is FedosIdentityTransitionDeviceCorroborationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  const known = new Set([
    "schemaVersion",
    "transitionId",
    "revision",
    "bodyHash",
    "newNostrIdentity",
    "deviceId",
    "devicePublicKeyHex",
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
  if (!isNonEmptyBoundedString(r.newNostrIdentity, 64)) return false;
  if (!isNonEmptyBoundedString(r.deviceId, 256)) return false;
  if (!isNonEmptyBoundedString(r.devicePublicKeyHex, 128)) return false;
  if (!Number.isInteger(r.issuedAt) || !Number.isInteger(r.expiresAt) || (r.expiresAt as number) <= (r.issuedAt as number)) return false;
  if (typeof r.signatureHex !== "string" || !SCHNORR_SIGNATURE_HEX_PATTERN.test(r.signatureHex)) return false;
  return true;
}

/**
 * Verifies one Device's corroboration against a specific, already-loaded
 * `FedosDeviceBindingV1`. Returns `"unverifiable"` for any structural
 * mismatch or an unauthorized/revoked/wrong-key Device (fail closed —
 * never silently accepted); `"rejected"` for a well-bound but
 * cryptographically invalid signature; `"cryptographically-valid"` only
 * when every binding check AND the signature both hold.
 */
export function verifyFedosIdentityTransitionDeviceCorroboration(
  record: FedosIdentityTransitionRecordV1,
  corroboration: FedosIdentityTransitionDeviceCorroborationV1,
  deviceBinding: FedosDeviceBindingV1,
): FedosIdentityTransitionEvidenceStatus {
  if (!isWellFormedFedosIdentityTransitionDeviceCorroborationV1(corroboration)) return "unverifiable";
  if (corroboration.transitionId !== record.transitionId) return "unverifiable";
  if (corroboration.revision !== record.revision) return "unverifiable";
  if (corroboration.newNostrIdentity !== record.newNostrIdentity) return "unverifiable";
  if (corroboration.bodyHash !== fedosIdentityTransitionBodyHash(record)) return "unverifiable";
  if (!fedosIdentityTransitionAccountRefsEqual(deviceBinding.accountRef, record.oldAccountIdentity)) return "unverifiable";
  if (deviceBinding.deviceId !== corroboration.deviceId) return "unverifiable";
  if (isFedosDeviceBindingRevoked(deviceBinding)) return "unverifiable";
  if (!isFedosDeviceBindingTrusted(deviceBinding)) return "unverifiable";
  if (deviceBinding.devicePublicKeyRef === null || deviceBinding.devicePublicKeyRef !== corroboration.devicePublicKeyHex) return "unverifiable";

  const digestBytes = fedosIdentityTransitionDeviceCorroborationDigest({
    transitionId: corroboration.transitionId,
    revision: corroboration.revision,
    bodyHash: corroboration.bodyHash,
    newNostrIdentity: corroboration.newNostrIdentity,
    deviceId: corroboration.deviceId,
    issuedAt: corroboration.issuedAt,
    expiresAt: corroboration.expiresAt,
  });
  const ok = verifyFedosDeviceSigningSignature(corroboration.devicePublicKeyHex, digestBytes, corroboration.signatureHex);
  return ok ? "cryptographically-valid" : "rejected";
}

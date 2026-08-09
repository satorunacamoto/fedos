/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — "existing per-Device signing keypair integration."
 *
 * Reuses the ALREADY-REAL `FedosDeviceSigningKeypair`
 * (`../../device/crypto/fedos_device_signing_keypair.ts`, Alpha
 * 3161–3240) exactly the way `fedos_device_binding_proof_of_possession.ts`
 * already does: a fixed, domain-separated preimage prefix (distinct from
 * every other preimage this codebase signs, so a reset signature can
 * never be replayed as, or confused with, a device-binding proof of
 * possession or an account authorization), hashed with `sha256`
 * (`@noble/hashes`, already a production dependency), signed with
 * `keypair.sign()`. No raw private key ever crosses this file — only the
 * resulting signature bytes are returned.
 *
 * REAL, DEMONSTRATED ARCHITECTURAL BOUNDARY this file works WITHIN,
 * not around: `FedosDeviceSigningKeypair` is process-memory-only
 * (`fedos_device_signing_keypair.ts`'s own header — "this Arc implements
 * no durable storage for a Device's own secret") and is never held by any
 * long-lived Runtime component anywhere in this codebase — every existing
 * caller (`FedosDevicePairingFacade.createPairingRequest()`/
 * `completePairing()`) receives it as a per-call PARAMETER, never stores
 * it. This file's own `createFedosDirectRatchetSessionResetDeviceSignature()`
 * follows the IDENTICAL pattern: the Runtime Reset Coordinator
 * (`./fedos_direct_ratchet_reset_coordinator.ts`) accepts an OPTIONAL
 * keypair per call, never holds one — this Arc does NOT invent new
 * durable secret storage for a Device signing key, which would be a
 * separate, much larger Secure Memory design decision outside this Arc's
 * own "narrow Runtime foundation" scope.
 *
 * Because of that same boundary, verification is BEST-EFFORT, never a
 * hard requirement: `FedosDeviceBindingV1.devicePublicKeyRef` is `null`
 * for the overwhelming majority of bindings in this codebase today
 * (every existing test seeds it `null`; a REMOTE peer's Device key has no
 * cross-account exchange mechanism yet) — a reset with no verifiable key
 * on file is still accepted on the strength of the existing, real NIP-17
 * envelope-level account authentication alone, exactly as
 * `docs/reviews/fedos_ratchet_multidevice_identity_rotation_v1/09_session_reset_and_reestablishment.md`
 * itself concluded no NEW authentication mechanism is REQUIRED.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  isWellFormedFedosDevicePublicKeyHex,
  verifyFedosDeviceSigningSignature,
  type FedosDeviceSigningKeypair,
} from "../../../../device/crypto/fedos_device_signing_keypair.js";
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import type { FedosDirectRatchetSuite } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_id.js";
import type { FedosDirectRatchetSessionResetReason } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_reset_reason.js";

/** Fixed, distinct from every other preimage prefix this codebase signs (device-binding proof of possession, account authorization) — a reset signature can never be replayed as either. */
const RESET_SIGNATURE_PREIMAGE_PREFIX = "fedos-direct-ratchet-session-reset-v1:";

export interface FedosDirectRatchetSessionResetSignableContent {
  readonly suite: FedosDirectRatchetSuite;
  readonly generation: number;
  readonly previousGeneration: number | null;
  readonly resetReason: FedosDirectRatchetSessionResetReason | null;
  readonly resetNonce: string;
  readonly senderAccountRef: FedosDeviceBindingAccountRef;
  readonly senderDeviceRef: string;
  readonly recipientAccountRef: FedosDeviceBindingAccountRef;
  readonly recipientDeviceRef: string;
  readonly conversationId: string;
  readonly ratchetPublicKeyHex: string;
}

/** Fixed-order array tuple — mirrors `serializeFedosDeviceBindingChallengeV1()`'s own canonical-serialization technique exactly, so there is no object-key-ordering ambiguity. */
function canonicalSerializeResetContent(content: FedosDirectRatchetSessionResetSignableContent): string {
  return JSON.stringify([
    content.suite,
    content.generation,
    content.previousGeneration,
    content.resetReason,
    content.resetNonce,
    content.senderAccountRef.authority,
    content.senderAccountRef.publicIdentifier,
    content.senderAccountRef.identityId,
    content.senderDeviceRef,
    content.recipientAccountRef.authority,
    content.recipientAccountRef.publicIdentifier,
    content.recipientAccountRef.identityId,
    content.recipientDeviceRef,
    content.conversationId,
    content.ratchetPublicKeyHex,
  ]);
}

function resetDigest(content: FedosDirectRatchetSessionResetSignableContent): Uint8Array {
  const preimage = RESET_SIGNATURE_PREIMAGE_PREFIX + canonicalSerializeResetContent(content);
  return sha256(new TextEncoder().encode(preimage));
}

/**
 * Signs `content` with `keypair` — the Runtime Reset Coordinator's own
 * caller supplies `keypair` per-call (see this file's own header); this
 * function itself never stores it. `null` only if `content` cannot be
 * serialized to a signable digest, which cannot happen for structurally
 * well-formed input (defensive, mirrors `createFedosDeviceBindingProofOfPossession()`'s
 * own never-throw discipline).
 */
export function createFedosDirectRatchetSessionResetDeviceSignature(
  keypair: FedosDeviceSigningKeypair,
  content: FedosDirectRatchetSessionResetSignableContent,
): string | null {
  if (!isWellFormedFedosDevicePublicKeyHex(keypair.publicKeyHex)) return null;
  const digest = resetDigest(content);
  return bytesToHex(keypair.sign(digest));
}

/**
 * Verifies a reset device signature against `devicePublicKeyHex` — the
 * caller (`FedosDirectRatchetSessionResetAuthority`) is the one place
 * that decides WHETHER a devicePublicKeyHex is even on file to check
 * against (best-effort, never a hard requirement — see this file's own
 * header). Fails closed to `false`; never throws.
 */
export function verifyFedosDirectRatchetSessionResetDeviceSignature(
  devicePublicKeyHex: string,
  content: FedosDirectRatchetSessionResetSignableContent,
  signatureHex: string,
): boolean {
  return verifyFedosDeviceSigningSignature(devicePublicKeyHex, resetDigest(content), signatureHex);
}

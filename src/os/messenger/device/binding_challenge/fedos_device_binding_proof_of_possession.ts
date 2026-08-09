/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase E: Device Proof of Possession.
 *
 * The Device proves it holds the private key matching
 * `challenge.devicePublicKeyHex` by signing a digest derived from the SAME
 * canonical challenge (`../fedos_device_binding_challenge.ts`) the account
 * itself authorized — but under a DIFFERENT, fixed preimage prefix than the
 * account's own Nostr-event signature
 * (`./fedos_device_binding_account_authorization.ts`) uses. This keeps the
 * two signatures non-interchangeable: a Device proof can never be mistaken
 * for (or replayed as) an account authorization, or vice versa, even though
 * both cover the same underlying challenge.
 *
 * `sha256` (already an existing dependency, `@noble/hashes`, already used by
 * `src/nostr/noble_signature.ts`) hashes the prefixed preimage to a 32-byte
 * digest; `FedosDeviceSigningKeypair.sign()`
 * (`../crypto/fedos_device_signing_keypair.ts`) signs that digest. No raw
 * private key ever crosses this function — only the resulting signature
 * bytes are returned.
 *
 * Requirements this file enforces directly:
 *   - a Device can only ever prove possession of the key IT holds — signing
 *     is keyed to `keypair`, and verification additionally checks
 *     `proof.devicePublicKeyHex === challenge.devicePublicKeyHex` before
 *     ever running a signature check, so a keypair mismatch fails closed
 *     without leaking timing/behavior differences from the crypto step.
 *   - Device proof ALONE never touches an account identity, the Device
 *     Registry, or any persistence — this file is pure, synchronous,
 *     side-effect-free, exactly like `../fedos_device_binding.ts`'s own
 *     transition functions.
 */

import {
  isWellFormedFedosDeviceSchnorrSignatureHex,
  isWellFormedFedosDevicePublicKeyHex,
  verifyFedosDeviceSigningSignature,
  type FedosDeviceSigningKeypair,
} from "../../../../device/crypto/fedos_device_signing_keypair.js";
import {
  isFedosDeviceBindingChallengeExpired,
  isWellFormedFedosDeviceBindingChallengeV1,
  serializeFedosDeviceBindingChallengeV1,
  type FedosDeviceBindingChallengeV1,
} from "../../../../device/binding_challenge/fedos_device_binding_challenge.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** Fixed preimage prefix — distinct from the account authorization's own Nostr-event preimage, so the two signature roles can never be confused. */
const PROOF_OF_POSSESSION_PREIMAGE_PREFIX = "fedos-device-binding-proof-of-possession-v1:";

function proofOfPossessionDigest(challenge: FedosDeviceBindingChallengeV1): Uint8Array {
  const preimage = PROOF_OF_POSSESSION_PREIMAGE_PREFIX + serializeFedosDeviceBindingChallengeV1(challenge);
  return sha256(new TextEncoder().encode(preimage));
}

export interface FedosDeviceBindingProofOfPossessionV1 {
  readonly challenge: FedosDeviceBindingChallengeV1;
  readonly devicePublicKeyHex: string;
  readonly signatureHex: string;
}

/**
 * Creates a proof of possession for `challenge`, signed by `keypair`. `null`
 * if the challenge is malformed OR `keypair.publicKeyHex` does not match
 * `challenge.devicePublicKeyHex` — a Device can never prove possession of a
 * key it does not hold, even one it merely claims to.
 */
export function createFedosDeviceBindingProofOfPossession(
  keypair: FedosDeviceSigningKeypair,
  challenge: FedosDeviceBindingChallengeV1,
): FedosDeviceBindingProofOfPossessionV1 | null {
  if (!isWellFormedFedosDeviceBindingChallengeV1(challenge)) return null;
  if (keypair.publicKeyHex !== challenge.devicePublicKeyHex) return null;

  const digest = proofOfPossessionDigest(challenge);
  const signatureHex = bytesToHex(keypair.sign(digest));

  return Object.freeze({ challenge, devicePublicKeyHex: keypair.publicKeyHex, signatureHex });
}

export type FedosDeviceBindingProofOfPossessionOutcome =
  | "valid"
  | "malformed-challenge"
  | "malformed-proof"
  | "key-mismatch"
  | "invalid-signature"
  | "expired";

/**
 * Verifies a Device's proof of possession against the SAME challenge object
 * the caller independently holds (never trusts a proof's own embedded
 * challenge blindly beyond structural well-formedness — callers in Phase G/H
 * additionally compare `proof.challenge` against the account-authorized
 * challenge by value). Fails closed; never throws.
 */
export function verifyFedosDeviceBindingProofOfPossession(
  proof: FedosDeviceBindingProofOfPossessionV1,
  now: number,
): FedosDeviceBindingProofOfPossessionOutcome {
  const { challenge } = proof;
  if (!isWellFormedFedosDeviceBindingChallengeV1(challenge)) return "malformed-challenge";
  if (
    !isWellFormedFedosDevicePublicKeyHex(proof.devicePublicKeyHex) ||
    !isWellFormedFedosDeviceSchnorrSignatureHex(proof.signatureHex)
  ) {
    return "malformed-proof";
  }
  if (proof.devicePublicKeyHex !== challenge.devicePublicKeyHex) return "key-mismatch";

  const digest = proofOfPossessionDigest(challenge);
  if (!verifyFedosDeviceSigningSignature(proof.devicePublicKeyHex, digest, proof.signatureHex)) {
    return "invalid-signature";
  }

  if (isFedosDeviceBindingChallengeExpired(challenge, now)) return "expired";

  return "valid";
}

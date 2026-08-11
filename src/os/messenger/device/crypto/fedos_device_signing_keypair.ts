/**
 * Secure Runtime Alpha 3161–3240 ("Account-to-Device Signature Verification
 * Boundary") — Phase B: independent Device signing key.
 *
 * Closes the exact blocker Alpha 2921–3000 Phase E named: `src/crypto/types.ts`
 * is (and remains, unmodified by this Arc) a pure placeholder with no key
 * generation of any kind. That seam is for a FUTURE Rust/WASM AEAD/KDF core —
 * a separate, unrelated concern from this file.
 *
 * This file instead reuses this repository's OWN existing, ALREADY-SHIPPED
 * production dependency and its OWN existing precedent:
 *   - `@noble/curves` is already a real dependency, already used in production
 *     for real Schnorr/secp256k1 verification (`src/nostr/noble_signature.ts`).
 *   - `@noble/hashes/utils.js`'s `randomBytes()` is already this codebase's own
 *     established, reviewed CSPRNG for real production id generation
 *     (`fedos_board_runtime_id_generator.ts`, `fedos_conversation_envelope_id.ts`,
 *     `fedos_conversation_payload_id.ts`).
 *
 * Option comparison (Phase B):
 *   A. Independent random Device key via reviewed CSPRNG — ADOPTED. No new
 *      dependency; reuses the exact library already trusted for verification.
 *   B. Deterministic Device key derived from the Master Seed — REJECTED. The
 *      Multi-Device review's own adopted recommendation is account identity +
 *      INDEPENDENT device keys; a Master-Seed-derived "device" key is not
 *      independent (compromise or export of one derives the other).
 *   C. Reuse the account signing key as the Device key — REJECTED explicitly
 *      by this Arc's own instructions and by the Multi-Device review.
 *   D. Caller-provided raw private key — REJECTED: this file never accepts
 *      external key bytes; the only producer of a keypair is
 *      `generateFedosDeviceSigningKeypair()`, and the secret never leaves it.
 *
 * `FedosDeviceSigningKeypair` is an OPAQUE HANDLE, mirroring this codebase's
 * `AeadKeyHandle`/`SecretHandle` discipline: the raw secret key lives in one
 * private field, is never returned by any method, and is used only inside
 * `sign()`. There is no raw private-key getter anywhere in this file. The key
 * is process-memory-only — this Arc implements no durable storage for a
 * Device's own secret (named explicitly as an unproven boundary in this Arc's
 * Security Statement).
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SCHNORR_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;

/**
 * An independent Device signing keypair. The ONLY way to obtain one is
 * `generateFedosDeviceSigningKeypair()` — there is no constructor that
 * accepts caller-supplied secret bytes.
 */
export class FedosDeviceSigningKeypair {
  readonly #secretKey: Uint8Array;
  readonly publicKeyHex: string;

  /** PRIVATE — use `generateFedosDeviceSigningKeypair()`. */
  private constructor(secretKey: Uint8Array) {
    this.#secretKey = secretKey;
    this.publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  }

  /**
   * Generates a fresh, independent Device signing keypair using
   * `@noble/curves`'s own reviewed key-generation path
   * (`schnorr.utils.randomSecretKey()`, itself backed by `@noble/hashes`'
   * CSPRNG). A real random secret every call — never derived from the Master
   * Seed, never caller-supplied, never reused.
   */
  static generate(): FedosDeviceSigningKeypair {
    return new FedosDeviceSigningKeypair(schnorr.utils.randomSecretKey());
  }

  /**
   * Signs an already-computed 32-byte message digest with this Device's own
   * secret key. Returns 64 raw signature bytes. Never exposes the secret key.
   */
  sign(messageDigest: Uint8Array): Uint8Array {
    return schnorr.sign(messageDigest, this.#secretKey);
  }
}

/** Free-function alias for `FedosDeviceSigningKeypair.generate()`, matching this Arc's own call-site style. */
export function generateFedosDeviceSigningKeypair(): FedosDeviceSigningKeypair {
  return FedosDeviceSigningKeypair.generate();
}

export function isWellFormedFedosDevicePublicKeyHex(value: unknown): value is string {
  return typeof value === "string" && NOSTR_PUBLIC_KEY_HEX_PATTERN.test(value);
}

export function isWellFormedFedosDeviceSchnorrSignatureHex(value: unknown): value is string {
  return typeof value === "string" && SCHNORR_SIGNATURE_HEX_PATTERN.test(value);
}

/**
 * Verifies a raw Device-key Schnorr signature over a 32-byte message digest.
 * Fails closed to `false` on any malformed input; never throws. This is a
 * NARROW, purpose-specific verifier over an already-computed digest — not a
 * generic `verify(anything)` authority: every production call site in this
 * Arc constructs `messageDigest` itself from one fixed, domain-bound preimage
 * scheme (`../binding_challenge/fedos_device_binding_proof_of_possession.ts`).
 */
export function verifyFedosDeviceSigningSignature(
  publicKeyHex: string,
  messageDigest: Uint8Array,
  signatureHex: string,
): boolean {
  if (!isWellFormedFedosDevicePublicKeyHex(publicKeyHex)) return false;
  if (!isWellFormedFedosDeviceSchnorrSignatureHex(signatureHex)) return false;
  try {
    return schnorr.verify(hexToBytes(signatureHex), messageDigest, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

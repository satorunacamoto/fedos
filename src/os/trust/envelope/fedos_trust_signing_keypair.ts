/**
 * Trust — local Schnorr/secp256k1 signing keypair.
 *
 * Reuses this repository's own existing, already-shipped production
 * dependency (`@noble/curves`) and its own existing precedent — same
 * library, same curve, same call shape as
 * `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts` and
 * `src/os/messenger/adapters/nostr/protocol/noble_signature.ts` — rather
 * than inventing a new signature algorithm, hash, or key format (arc brief
 * §7). This file is standalone (does not import the Messenger file above)
 * because `os/trust` must not depend on `os/messenger` (architecture
 * boundary — see `test/architecture_boundary_trust.test.ts`); duplicating
 * ~20 lines of `@noble/curves` call-shape is the correct trade, not a
 * boundary violation.
 *
 * `FedosTrustSigningKeypair` is an OPAQUE HANDLE: the raw secret key lives
 * in one private field, is never returned by any method, and is used only
 * inside `signDigest()`/`signBytes()`. There is no raw private-key getter
 * anywhere in this file.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SCHNORR_SIGNATURE_HEX_PATTERN = /^[0-9a-f]{128}$/;

export class FedosTrustSigningKeypair {
  readonly #secretKey: Uint8Array;
  readonly publicKeyHex: string;

  /** PRIVATE — use `FedosTrustSigningKeypair.generate()` or
   * `.fromSecretKeyBytes()`. */
  private constructor(secretKey: Uint8Array) {
    this.#secretKey = secretKey;
    this.publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  }

  /** Generates a fresh, independent keypair using `@noble/curves`'s own
   * reviewed key-generation path (`schnorr.utils.randomSecretKey()`). */
  static generate(): FedosTrustSigningKeypair {
    return new FedosTrustSigningKeypair(schnorr.utils.randomSecretKey());
  }

  /** Loads a keypair from raw 32-byte secret material — the seam an offline
   * issuer CLI uses to load an operator-supplied key. Callers are
   * responsible for how `secretKeyBytes` was obtained; this class never
   * reads a secret from an env var, CLI argument, file, or log itself (see
   * `../issuer/` for the safe secret-loading path and
   * `docs/operations/OFFLINE-ISSUER-RUNBOOK.md`). */
  static fromSecretKeyBytes(secretKeyBytes: Uint8Array): FedosTrustSigningKeypair {
    if (secretKeyBytes.length !== 32) {
      throw new RangeError("fedos trust signing keypair: secret key must be exactly 32 bytes");
    }
    return new FedosTrustSigningKeypair(secretKeyBytes);
  }

  /** Signs an already-computed 32-byte digest. Returns 64 raw signature
   * bytes. Never exposes the secret key. */
  signDigest(messageDigest32: Uint8Array): Uint8Array {
    return schnorr.sign(messageDigest32, this.#secretKey);
  }

  /** Convenience: `signDigest(sha256(bytes))`. This is the normal call path
   * — every Trust envelope is signed over `sha256(canonicalBytes)`, never
   * over raw canonical bytes directly, matching this repo's existing Nostr
   * event-id convention. */
  signBytes(bytes: Uint8Array): Uint8Array {
    return this.signDigest(sha256(bytes));
  }
}

export function isWellFormedFedosTrustPublicKeyHex(value: unknown): value is string {
  return typeof value === "string" && PUBLIC_KEY_HEX_PATTERN.test(value);
}

export function isWellFormedFedosTrustSignatureHex(value: unknown): value is string {
  return typeof value === "string" && SCHNORR_SIGNATURE_HEX_PATTERN.test(value);
}

/** Fails closed to `false` on any malformed input; never throws. */
export function verifyFedosTrustSignatureOverDigest(
  publicKeyHex: string,
  messageDigest32: Uint8Array,
  signatureHex: string,
): boolean {
  if (!isWellFormedFedosTrustPublicKeyHex(publicKeyHex)) return false;
  if (!isWellFormedFedosTrustSignatureHex(signatureHex)) return false;
  try {
    return schnorr.verify(hexToBytes(signatureHex), messageDigest32, hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

/** Convenience: `verifyFedosTrustSignatureOverDigest(pk, sha256(bytes), sig)`. */
export function verifyFedosTrustSignatureOverBytes(
  publicKeyHex: string,
  bytes: Uint8Array,
  signatureHex: string,
): boolean {
  if (!isWellFormedFedosTrustPublicKeyHex(publicKeyHex)) return false;
  if (!isWellFormedFedosTrustSignatureHex(signatureHex)) return false;
  try {
    return verifyFedosTrustSignatureOverDigest(publicKeyHex, sha256(bytes), signatureHex);
  } catch {
    return false;
  }
}

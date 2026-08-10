/**
 * Trust — offline issuer key generation.
 *
 * A thin wrapper around `@noble/curves`'s own key-generation primitive
 * (the SAME primitive `../envelope/fedos_trust_signing_keypair.ts` uses
 * internally for `FedosTrustSigningKeypair.generate()`) that ALSO exposes
 * the raw 32-byte secret at the moment of generation — something
 * `FedosTrustSigningKeypair` deliberately never does (it is an opaque
 * handle with no private-key getter, see that file's header).
 *
 * WHY THIS FILE IS THE ONE NARROW EXCEPTION: an offline issuer CLI's
 * `generate-key` subcommand has to write the secret to a file somewhere —
 * there is no way to persist a key for later reuse without, at some single
 * point, holding its raw bytes. This module is that single point. Nothing
 * outside it (the CLI script, `fedos_trust_issuer_cli_core.ts`) should ever
 * need to re-derive or otherwise obtain raw secret bytes except by reading
 * them back via a `FedosTrustIssuerSecretProvider`
 * (`fedos_trust_issuer_secret_provider.ts`) at the moment of use.
 *
 * HARD RULES:
 *   - No `console.log`/`JSON.stringify`/logging of `secretKeyBytes` or its
 *     hex form anywhere in this file.
 *   - This file performs NO file I/O and reads NO env var — it only
 *     generates/formats/loads already-in-memory key material. File I/O and
 *     env var reads belong to `fedos_trust_issuer_secret_provider.ts` and
 *     the CLI script (`scripts/fedos_trust_issuer_cli.mjs`) only.
 *   - Callers should overwrite (`.fill(0)`) any `secretKeyBytes` they
 *     receive from this module once they are done with it, where feasible
 *     (mirrors `src/os/core/vault/wasm/fedos_passphrase_provider.ts`'s own
 *     "clear temporary buffers where practical" discipline).
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { FedosTrustSigningKeypair } from "../envelope/fedos_trust_signing_keypair.js";

const SECRET_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosTrustIssuerGeneratedKey {
  /** RAW SECRET — 32 bytes. The caller (the CLI script only) is responsible
   * for writing this to an operator-controlled, out-of-repo file and then
   * discarding/zeroing this buffer. Never log, print, or otherwise persist
   * it anywhere else. */
  readonly secretKeyBytes: Uint8Array;
  /** An opaque signing handle over the same key — safe to hold and pass
   * around; never exposes `secretKeyBytes` itself. */
  readonly keypair: FedosTrustSigningKeypair;
  readonly publicKeyHex: string;
}

/** Generates a fresh, independent issuer keypair. */
export function generateFedosTrustIssuerKey(): FedosTrustIssuerGeneratedKey {
  const secretKeyBytes = schnorr.utils.randomSecretKey();
  const keypair = FedosTrustSigningKeypair.fromSecretKeyBytes(secretKeyBytes);
  return { secretKeyBytes, keypair, publicKeyHex: keypair.publicKeyHex };
}

/** Formats raw secret key bytes for file storage — lowercase hex, no
 * surrounding whitespace. The caller writes this string to a file at an
 * operator-chosen path (see `FedosTrustIssuerEnvFileSecretProvider`); this
 * function does no file I/O itself. */
export function formatFedosTrustIssuerSecretForFileStorage(secretKeyBytes: Uint8Array): string {
  if (secretKeyBytes.length !== 32) {
    throw new RangeError("fedos trust issuer keypair: secret key must be exactly 32 bytes");
  }
  return bytesToHex(secretKeyBytes);
}

/** Parses hex text (as read back from a key file) into raw secret key
 * bytes. Validates shape but never logs the input or output. */
export function parseFedosTrustIssuerSecretFromFileStorage(hexText: string): Uint8Array {
  const trimmed = hexText.trim();
  if (!SECRET_KEY_HEX_PATTERN.test(trimmed)) {
    throw new RangeError("fedos trust issuer keypair: key file does not contain exactly 64 lowercase hex characters");
  }
  return hexToBytes(trimmed);
}

/** Loads the opaque signing handle from raw secret bytes obtained via a
 * `FedosTrustIssuerSecretProvider`. */
export function loadFedosTrustIssuerKeypair(secretKeyBytes: Uint8Array): FedosTrustSigningKeypair {
  return FedosTrustSigningKeypair.fromSecretKeyBytes(secretKeyBytes);
}

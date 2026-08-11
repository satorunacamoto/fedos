/**
 * Commerce FINAL Closure arc (Agent M) — the decrypt-direction counterpart
 * to `./product_media_encryption.ts`'s `ProductMediaEncryptionPort`. That
 * file's own header explains why an ENCRYPT seam alone is not the whole
 * story: "how buyer authorization obtains/decrypts it" is one of this
 * arc's own required questions, and until now there was literally no
 * decrypt-direction Port anywhere in `os/commerce` — a caller could
 * `putProtected()` ciphertext into a `MediaStorePort` (`./ipfs_media_store.ts`)
 * but had no sanctioned way to ever get plaintext back out. This file
 * closes exactly that gap, mirroring `product_media_encryption.ts`'s own
 * shape and safety posture in every respect:
 *
 *   - `ProductMediaDecryptionPort` — shaped as the mirror image of
 *     `ProductMediaEncryptionPort`: `Uint8Array -> Promise<Uint8Array | null>`,
 *     never throws, `null` means "could not decrypt, do not proceed" —
 *     covers wrong key, wrong domain, tampered ciphertext, and
 *     crypto-unavailable uniformly (the real adapter,
 *     `./wasm_product_media_decryption.ts`, never distinguishes WHY a
 *     decrypt failed, mirroring `decrypt_aead()`'s own established
 *     "never distinguish AuthenticationFailed from any other failure"
 *     discipline — see `fedos_wasm_loader.ts`'s own doc comment for that
 *     rule at the Rust Boundary layer this ultimately rests on).
 *   - `UnavailableProductMediaDecryption` — the SAFE DEFAULT, exactly
 *     mirroring `UnavailableProductMediaEncryption`: always resolves
 *     `null`, never fabricates plaintext, never silently "succeeds" with
 *     the ciphertext bytes unchanged.
 *
 * This file does NOT implement any orchestration pipeline of its own (no
 * `decryptThenVerify...()` helper) — unlike the encrypt side, which needs
 * to compute a NEW content hash over the ciphertext it just produced
 * (`encryptThenContentAddressProtectedMedia()`), decrypt has nothing to
 * content-address: `./ipfs_media_store.ts`'s own `get()` ALREADY performs
 * the one piece of defensive verification that matters before ANY bytes
 * (ciphertext or plaintext) are handed back to a caller — re-hashing the
 * fetched bytes against the checksum recorded at `put()` time and failing
 * closed (`null`) on any mismatch. `getProtected()` (`./ipfs_media_store.ts`)
 * simply layers this Port's own `decrypt()` on top of that already-verified
 * ciphertext; no separate content-addressing step belongs in this file.
 */

/**
 * Injectable decryption seam for protected product media. `ciphertext` is
 * whatever opaque byte sequence `ProductMediaEncryptionPort.encrypt()`
 * (`./product_media_encryption.ts`) produced for the SAME classification
 * (today: the UTF-8 encoding of an `AeadCiphertextWire` envelope string —
 * see `./wasm_product_media_decryption.ts`'s own header for why this Port
 * does not need to know that shape itself, only accept opaque bytes and
 * return opaque bytes).
 */
export interface ProductMediaDecryptionPort {
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array | null>;
}

/**
 * The SAFE DEFAULT — mirrors `UnavailableProductMediaEncryption`
 * (`./product_media_encryption.ts`) exactly: always resolves `null`,
 * decryption is permanently unavailable until a real adapter is injected.
 * Never used to smuggle ciphertext through as if it were plaintext.
 */
export class UnavailableProductMediaDecryption implements ProductMediaDecryptionPort {
  async decrypt(_ciphertext: Uint8Array): Promise<Uint8Array | null> {
    return null;
  }
}

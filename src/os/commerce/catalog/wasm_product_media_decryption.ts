/**
 * Commerce FINAL Closure arc (Agent M) — the decrypt-direction
 * counterpart to `./wasm_product_media_encryption.ts`'s
 * `WasmProductMediaEncryption`. Reverses that file's own bridge exactly:
 *
 *   ciphertext bytes (UTF-8 of an `AeadCiphertextWire` envelope string)
 *     -> `TextDecoder().decode()`                              (reverse of `TextEncoder().encode()`)
 *     -> `importCiphertext()`                                  (`../../core/vault/wasm/fedos_runtime_import_ciphertext.ts`)
 *     -> opaque `AeadCiphertextHandle`
 *     -> `decrypt(key, algorithm, aadDomain, handle)`           (`../../core/vault/wasm/fedos_runtime_decrypt.ts`)
 *     -> plaintext `Uint8Array`, or `null` on ANY failure
 *
 * Both `importCiphertext()` and `decrypt()` are pre-existing, already
 * reviewed, unmodified Runtime Service exports (Stage 1010/1011) — this
 * file invents no cryptography, no new serialization, and no new Rust
 * Boundary reach; it is pure orchestration, exactly like
 * `WasmProductMediaEncryption` itself. Uses the SAME fixed
 * `ChaCha20Poly1305`/`"CommerceMedia"` pair that file uses — Product Media
 * has exactly one AEAD domain, never caller-configurable, same reasoning
 * as that file's own header.
 *
 * FAIL CLOSED, mirroring `WasmProductMediaEncryption`'s own "never
 * throws" discipline exactly: `decrypt()` below returns `null` (never
 * throws) on every one of:
 *   - `authority.resolveCommerceMediaKey` is not a function;
 *   - `resolveCommerceMediaKey()` resolves `null` (no Master Seed held);
 *   - `importCiphertext()` resolves `null` (malformed/tampered wire text —
 *     `deserialize_aead_ciphertext()`'s own wire-structure validation,
 *     Stage 186, unchanged);
 *   - `decrypt()` (the Runtime Service export) resolves `null` (wrong
 *     key, wrong AAD domain, tampered ciphertext bytes — Rust's own
 *     `decrypt_aead()` collapses ALL of these to one outcome, by design,
 *     never distinguishing which — see `fedos_wasm_loader.ts`'s own doc
 *     comment); or
 *   - any unexpected thrown error anywhere in the above, caught by this
 *     file's own outer `try`/`catch`.
 *
 * `authority` defaults exactly like `WasmProductMediaEncryption`'s own —
 * see that file's own header for the full account of why a zero-argument
 * default behaves safely (fails closed) until a real composition root
 * injects the app's actual, already-unlocked, SHARED
 * `FedosMasterSeedAuthority` instance.
 *
 * PRODUCTION BRIDGE FIRST (Buyer Discovery + Digital Content Delivery
 * mega-arc, Coordinator validation-gate fix) — this file mirrors, exactly,
 * the fix `./wasm_product_media_encryption.ts` carries for the same reason:
 * `runtimeImportCiphertext`/`runtimeDecrypt` drive the DEV-ONLY
 * `FedosWasmLoader` chain, which is unconditionally closed in a real
 * launch (`developmentAllowed: false`, reproduced live on the ENCRYPT side
 * of this same pair — see that file's own header for the captured gate
 * state). Left unfixed, this adapter would fail closed to `null` on every
 * real buyer redeem for exactly the same reason the seller-side attach
 * failed. When the injected authority itself structurally offers
 * `deserializeAeadCiphertext()`/`decryptAead()`, this adapter uses that
 * production bridge instead; otherwise it falls back to the dev-only
 * exports exactly as before. Structural check only — never an
 * `instanceof`/import of `src/os/messenger/**`.
 */

import type { FedosMasterSeedAuthority } from "../../core/vault/wasm/fedos_master_seed_authority.js";
import { FedosWasmMasterSeedAuthority } from "../../core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { decrypt as runtimeDecrypt } from "../../core/vault/wasm/fedos_runtime_decrypt.js";
import { importCiphertext as runtimeImportCiphertext } from "../../core/vault/wasm/fedos_runtime_import_ciphertext.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../core/vault/wasm/fedos_wasm_loader.js";
import type { ProductMediaDecryptionPort } from "./product_media_decryption.js";

/** MUST match `./wasm_product_media_encryption.ts`'s own fixed constants exactly — a decrypt under any other algorithm/domain pairing can never authenticate a `CommerceMedia` ciphertext (AAD mixing, `AeadAadDomain::CommerceMedia`). */
const COMMERCE_MEDIA_AAD_DOMAIN = "CommerceMedia" as const;
const COMMERCE_MEDIA_ALGORITHM = "ChaCha20Poly1305" as const;

/**
 * Injectable seam for the two Runtime Service calls this adapter makes.
 * Defaults to the real `importCiphertext()`/`decrypt()` exports — mirrors
 * `WasmProductMediaEncryptionDeps`'s own "TESTABILITY" reasoning exactly.
 */
export interface WasmProductMediaDecryptionDeps {
  readonly importCiphertext: (serialized: AeadCiphertextWire) => Promise<AeadCiphertextHandle | null>;
  readonly decrypt: (
    key: AeadKeyHandle,
    algorithm: typeof COMMERCE_MEDIA_ALGORITHM,
    aadDomain: typeof COMMERCE_MEDIA_AAD_DOMAIN,
    ciphertext: AeadCiphertextHandle,
  ) => Promise<Uint8Array | null>;
}

const DEFAULT_DEPS: WasmProductMediaDecryptionDeps = {
  importCiphertext: runtimeImportCiphertext,
  decrypt: runtimeDecrypt,
};

/**
 * The narrow, STRUCTURAL shape of a production Master Seed Authority's own
 * synchronous AEAD bridge, decrypt direction — the exact mirror of
 * `ProductionCommerceMediaEncryptSource`
 * (`./wasm_product_media_encryption.ts`). See this file's own header.
 */
interface ProductionCommerceMediaDecryptSource {
  deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null;
  decryptAead(
    key: AeadKeyHandle,
    algorithm: typeof COMMERCE_MEDIA_ALGORITHM,
    aadDomain: typeof COMMERCE_MEDIA_AAD_DOMAIN,
    ciphertext: AeadCiphertextHandle,
  ): Uint8Array | null;
}

/**
 * Returns a `WasmProductMediaDecryptionDeps` backed by `authority`'s own
 * production AEAD bridge if — and only if — it genuinely offers BOTH
 * halves as callable functions; `null` otherwise. Mirrors
 * `productionCommerceMediaEncryptionDepsFor()` exactly, including its
 * "never throws" wrapping.
 */
export function productionCommerceMediaDecryptionDepsFor(authority: unknown): WasmProductMediaDecryptionDeps | null {
  const candidate = authority as Partial<ProductionCommerceMediaDecryptSource> | null | undefined;
  if (candidate === null || candidate === undefined) return null;
  const { deserializeAeadCiphertext, decryptAead } = candidate;
  if (typeof deserializeAeadCiphertext !== "function" || typeof decryptAead !== "function") return null;
  return {
    importCiphertext: async (serialized) => {
      try {
        return deserializeAeadCiphertext.call(candidate, serialized);
      } catch {
        return null;
      }
    },
    decrypt: async (key, algorithm, aadDomain, ciphertext) => {
      try {
        return decryptAead.call(candidate, key, algorithm, aadDomain, ciphertext);
      } catch {
        return null;
      }
    },
  };
}

/**
 * The REAL `ProductMediaDecryptionPort` adapter — see this file's own
 * header for the full account. `./ipfs_media_store.ts`'s own DEFAULT
 * `ProductMediaDecryptionPort` as of this arc, exactly mirroring
 * `WasmProductMediaEncryption`'s own default-wiring story.
 */
export class WasmProductMediaDecryption implements ProductMediaDecryptionPort {
  readonly #authority: FedosMasterSeedAuthority;
  readonly #deps: WasmProductMediaDecryptionDeps;

  constructor(
    authority: FedosMasterSeedAuthority = new FedosWasmMasterSeedAuthority(),
    deps?: WasmProductMediaDecryptionDeps,
  ) {
    this.#authority = authority;
    // Explicit injection always wins (testability, unchanged); otherwise
    // prefer the injected authority's OWN production AEAD bridge. See this
    // file's own header, "PRODUCTION BRIDGE FIRST".
    this.#deps = deps ?? productionCommerceMediaDecryptionDepsFor(authority) ?? DEFAULT_DEPS;
  }

  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array | null> {
    try {
      if (typeof this.#authority.resolveCommerceMediaKey !== "function") return null;

      const key = await this.#authority.resolveCommerceMediaKey();
      if (key === null) return null;

      const wire = new TextDecoder().decode(ciphertext) as AeadCiphertextWire;
      const ciphertextHandle = await this.#deps.importCiphertext(wire);
      if (ciphertextHandle === null) return null;

      const plaintext = await this.#deps.decrypt(key, COMMERCE_MEDIA_ALGORITHM, COMMERCE_MEDIA_AAD_DOMAIN, ciphertextHandle);
      return plaintext;
    } catch {
      return null;
    }
  }
}

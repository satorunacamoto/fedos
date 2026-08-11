/**
 * Commerce E2E Completion arc (Wave B, Agent I) — the deferred
 * `ProductMediaEncryptionPort` adapter `product_media_encryption.ts`'s own
 * header names as "NOT YET DONE": `WasmProductMediaEncryption` wires the
 * now-real `AeadAadDomain::CommerceMedia` primitive
 * (`FedosMasterSeedAuthority.resolveCommerceMediaKey()` +
 * `encrypt()`/`exportCiphertext()`, `src/os/core/vault/wasm/`) into this
 * Port for the first time. See `./product_media_encryption.ts`'s own
 * "UPDATE (Commerce E2E Completion arc, coordinator)" section for the full
 * account of what was already real before this file, and
 * `docs/commerce/PROTECTED-MEDIA-CRYPTO-DECISION.md` for the crypto
 * spike's own analysis this file's wiring rests on.
 *
 * `os/commerce` importing `src/os/core/vault/**` is architecturally
 * ALLOWED — `test/architecture_boundary_commerce.test.ts`'s own
 * `FORBIDDEN_PREFIXES` list does not include `src/os/core/` (confirmed by
 * direct inspection before writing this file). This is the first file
 * under `src/os/commerce/catalog/` to actually exercise that allowance.
 *
 * THE BRIDGE (opaque handle -> `Uint8Array`), and why this exact choice:
 * `encrypt()` (`../../core/vault/wasm/fedos_runtime_encrypt.ts`) returns
 * an opaque `AeadCiphertextHandle` — never raw bytes, by the Runtime's own
 * "opaque handle in, opaque handle out" discipline (see that file's own
 * header). There is no handle-to-`Uint8Array` export anywhere in this
 * codebase — the ONLY sanctioned way to get anything concrete out of an
 * `AeadCiphertextHandle` is `exportCiphertext()`
 * (`../../core/vault/wasm/fedos_runtime_export_ciphertext.ts`), which
 * calls the Rust `serialize_aead_ciphertext()` boundary and returns an
 * `AeadCiphertextWire` — a branded `string` holding the canonical JSON +
 * base64url ciphertext-envelope text
 * (`docs/ciphertext_serialization_format_decision.md`). That is the ONLY
 * reusable bridge that exists; this file does not invent a new
 * serialization. `ProductMediaEncryptionPort.encrypt()`'s own contract
 * (`./product_media_encryption.ts`) is `Promise<Uint8Array | null>`, not
 * `Promise<string | null>`, so the last step of this file's own bridge is
 * a plain `TextEncoder().encode(wire)` — turning the wire STRING into its
 * UTF-8 byte representation. This is lossless and reversible
 * (`TextDecoder().decode(bytes)` recovers the exact same wire string a
 * future `WasmProductMediaDecryption`/`importCiphertext()` counterpart
 * would need), and it is the same "opaque string, opaque bytes" posture
 * `AeadCiphertextWire` already documents for itself (a plain transient
 * value, never parsed by any caller outside the Rust boundary). The bytes
 * this Port stores/content-addresses are therefore the UTF-8 encoding of
 * the real ciphertext envelope's wire text — not a raw AEAD ciphertext
 * byte string — which is fine: `MediaStorePort`/`product_media_encryption.ts`
 * only ever need SOME opaque, content-addressable, round-trippable byte
 * sequence for "the ciphertext," never a specific binary layout.
 *
 * FAIL CLOSED, mirroring `UnavailableProductMediaEncryption`'s own "never
 * throws" discipline exactly: `encrypt()` below returns `null` (never
 * throws) on every one of:
 *   - `authority.resolveCommerceMediaKey` is not a function (the
 *     interface's own OPTIONAL method is absent — see
 *     `fedos_master_seed_authority.ts`'s own doc comment for why it is
 *     optional);
 *   - `resolveCommerceMediaKey()` resolves `null` (no Master Seed held, or
 *     an internal derivation failure);
 *   - `encrypt()` (the Runtime Service export) resolves `null` (any Loader
 *     chain failure);
 *   - `exportCiphertext()` resolves `null` (any Loader chain failure); or
 *   - any unexpected thrown error anywhere in the above, caught by this
 *     file's own outer `try`/`catch`.
 *
 * TESTABILITY: constructor-accepts an optional `deps` object
 * (`{ encrypt, exportCiphertext }`), mirroring this codebase's own
 * established "accept an optional dependency purely for testability"
 * convention (e.g. `attemptDevOnlyRuntimeEncrypt()`'s own optional
 * `loader` parameter, `fedos_runtime_encrypt.ts`). Every REAL call site
 * omits it and gets the real `encrypt`/`exportCiphertext` Runtime Service
 * exports, which each construct their own fresh, real `FedosWasmLoader`
 * internally — this file never reaches around them. A test may inject
 * fakes for both to exercise this file's OWN wiring/fail-closed logic
 * without any real WASM artifact present (this worktree currently has no
 * built `packages/fedos-core-rust/pkg/` — see this arc's test file for
 * the exact check).
 */

import type { FedosMasterSeedAuthority } from "../../core/vault/wasm/fedos_master_seed_authority.js";
import { encrypt as runtimeEncrypt } from "../../core/vault/wasm/fedos_runtime_encrypt.js";
import { exportCiphertext as runtimeExportCiphertext } from "../../core/vault/wasm/fedos_runtime_export_ciphertext.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../core/vault/wasm/fedos_wasm_loader.js";
import type { ProductMediaEncryptionPort } from "./product_media_encryption.js";

/** The fixed algorithm/domain this adapter always uses — see this file's own header. Never caller-configurable: Product Media has exactly one AEAD domain (`"CommerceMedia"`), the same posture `FEDOS_CONVERSATION_ENVELOPE_AAD_DOMAIN` takes for `Conversation` (`fedos_wasm_conversation_encryption_authority.ts`). */
const COMMERCE_MEDIA_AAD_DOMAIN = "CommerceMedia" as const;
const COMMERCE_MEDIA_ALGORITHM = "ChaCha20Poly1305" as const;

/**
 * Injectable seam for the two Runtime Service calls this adapter makes.
 * Defaults to the real `encrypt()`/`exportCiphertext()` exports — see this
 * file's own header, "TESTABILITY".
 */
export interface WasmProductMediaEncryptionDeps {
  readonly encrypt: (
    key: AeadKeyHandle,
    algorithm: typeof COMMERCE_MEDIA_ALGORITHM,
    aadDomain: typeof COMMERCE_MEDIA_AAD_DOMAIN,
    plaintext: Uint8Array,
  ) => Promise<AeadCiphertextHandle | null>;
  readonly exportCiphertext: (ciphertext: AeadCiphertextHandle) => Promise<AeadCiphertextWire | null>;
}

const DEFAULT_DEPS: WasmProductMediaEncryptionDeps = {
  encrypt: runtimeEncrypt,
  exportCiphertext: runtimeExportCiphertext,
};

/**
 * The REAL `ProductMediaEncryptionPort` adapter — see this file's own
 * header for the full account (bridge choice, fail-closed cases,
 * testability). Never used as a default anywhere outside this arc's own
 * composition; `UnavailableProductMediaEncryption`
 * (`./product_media_encryption.ts`) remains the Port's own safe default
 * until a caller deliberately constructs and injects this class with a
 * real, unlocked `FedosMasterSeedAuthority`.
 */
export class WasmProductMediaEncryption implements ProductMediaEncryptionPort {
  readonly #authority: FedosMasterSeedAuthority;
  readonly #deps: WasmProductMediaEncryptionDeps;

  constructor(authority: FedosMasterSeedAuthority, deps: WasmProductMediaEncryptionDeps = DEFAULT_DEPS) {
    this.#authority = authority;
    this.#deps = deps;
  }

  async encrypt(plaintext: Uint8Array): Promise<Uint8Array | null> {
    try {
      if (typeof this.#authority.resolveCommerceMediaKey !== "function") return null;

      const key = await this.#authority.resolveCommerceMediaKey();
      if (key === null) return null;

      const ciphertextHandle = await this.#deps.encrypt(
        key,
        COMMERCE_MEDIA_ALGORITHM,
        COMMERCE_MEDIA_AAD_DOMAIN,
        plaintext,
      );
      if (ciphertextHandle === null) return null;

      const wire = await this.#deps.exportCiphertext(ciphertextHandle);
      if (wire === null) return null;

      return new TextEncoder().encode(wire);
    } catch {
      return null;
    }
  }
}

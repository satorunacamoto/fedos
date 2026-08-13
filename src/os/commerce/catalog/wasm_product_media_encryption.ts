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
 * `loader` parameter, `fedos_runtime_encrypt.ts`). An explicitly-injected
 * `deps` ALWAYS wins over every default below. A test may inject fakes
 * for both to exercise this file's OWN wiring/fail-closed logic without
 * any real WASM artifact present (see this arc's test file for the exact
 * check).
 *
 * ============================================================
 * PRODUCTION BRIDGE FIRST — THE DEV-ONLY RUNTIME SERVICE EXPORTS CANNOT
 * WORK IN A REAL LAUNCH (Buyer Discovery + Digital Content Delivery
 * mega-arc, Coordinator validation-gate fix).
 * ============================================================
 * REPRODUCED LIVE, not reasoned about: a real packaged/dev Electron
 * launch with a real, unlocked `FedosProductionMasterSeedAuthority`
 * reached this adapter, resolved a genuine `AeadKeyHandle` from
 * `resolveCommerceMediaKey()` — and then `encrypt()` below returned
 * `null` every single time, because `runtimeEncrypt`
 * (`../../core/vault/wasm/fedos_runtime_encrypt.ts`) drives the DEV-ONLY
 * `FedosWasmLoader` chain, whose own gate reported
 * `{ artifactsExist: false, developmentAllowed: false, reason:
 * "UnknownRuntime", ready: false, ... }` and therefore
 * `attemptDevOnlyEncryptCall() -> { attempted: false, succeeded: false,
 * reason: "NotInitialized" }`. `encrypt_aead()` was never called at all.
 * That gate is CORRECT and is not being weakened here: those Runtime
 * Service files are development-runtime scaffolding by construction (each
 * builds its OWN fresh WASM module instance per call, behind
 * `NODE_ENV=development`), so a production caller could never have
 * succeeded through them — and, even with the gate open, the
 * `AeadKeyHandle` resolved from the PRODUCTION authority's own module
 * instance would still fail on a cross-instantiation opaque-handle
 * mismatch.
 *
 * `fedos_production_conversation_encryption_runtime_boundary.ts`'s own
 * header already documented this exact trap and already solved it for
 * Conversations, by reaching `FedosProductionMasterSeedAuthority`'s own
 * `encryptAead()`/`serializeAeadCiphertext()` accessors — the SAME
 * already-real, already-tested `encrypt_aead`/`serialize_aead_ciphertext`
 * Rust exports, on the SAME module instance that minted the key handle.
 * Commerce media simply never got the same treatment, and until this arc
 * wired a real IPC caller nothing ever exercised it to find out.
 *
 * The fix, below: when the INJECTED authority itself structurally offers
 * that production AEAD bridge, this adapter uses it; otherwise it falls
 * back to the dev-only Runtime Service exports exactly as before (which
 * is what a development launch and every existing unit test rely on).
 * The check is STRUCTURAL (`typeof ... === "function"`), never an
 * `instanceof`/import of `src/os/messenger/**` — `src/os/commerce/` must
 * not depend on the Messenger desktop tree
 * (`test/architecture_boundary_commerce.test.ts`), and the same
 * shape-only coupling is exactly what
 * `FedosProductionConversationAeadHandleSource` already established. No
 * new cryptography, no new Rust export, no new serialization; and still
 * never a plaintext downgrade in any branch — every failure path returns
 * `null`.
 */

import type { FedosMasterSeedAuthority } from "../../core/vault/wasm/fedos_master_seed_authority.js";
import { FedosWasmMasterSeedAuthority } from "../../core/vault/wasm/fedos_wasm_master_seed_authority.js";
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
 * The narrow, STRUCTURAL shape of a production Master Seed Authority's own
 * synchronous AEAD bridge — satisfied by `FedosProductionMasterSeedAuthority`
 * (`src/os/messenger/desktop/production_activation/`) without this file
 * importing it, exactly as `FedosProductionConversationAeadHandleSource`
 * already does for Conversations. See this file's own header for why this
 * is the only bridge that can actually work in a real launch.
 */
interface ProductionCommerceMediaEncryptSource {
  encryptAead(
    key: AeadKeyHandle,
    algorithm: typeof COMMERCE_MEDIA_ALGORITHM,
    aadDomain: typeof COMMERCE_MEDIA_AAD_DOMAIN,
    plaintext: Uint8Array,
  ): AeadCiphertextHandle | null;
  serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null;
}

/**
 * Returns a `WasmProductMediaEncryptionDeps` backed by `authority`'s own
 * production AEAD bridge if — and only if — it genuinely offers BOTH
 * halves as callable functions; `null` otherwise (a dev/test authority,
 * or any object that only partially matches). Both wrappers convert a
 * thrown error to `null`, preserving this file's own "never throws"
 * contract, and neither ever returns anything but a real ciphertext
 * handle/wire or `null` — never plaintext.
 */
export function productionCommerceMediaEncryptionDepsFor(authority: unknown): WasmProductMediaEncryptionDeps | null {
  const candidate = authority as Partial<ProductionCommerceMediaEncryptSource> | null | undefined;
  if (candidate === null || candidate === undefined) return null;
  const { encryptAead, serializeAeadCiphertext } = candidate;
  if (typeof encryptAead !== "function" || typeof serializeAeadCiphertext !== "function") return null;
  return {
    encrypt: async (key, algorithm, aadDomain, plaintext) => {
      try {
        return encryptAead.call(candidate, key, algorithm, aadDomain, plaintext);
      } catch {
        return null;
      }
    },
    exportCiphertext: async (ciphertext) => {
      try {
        return serializeAeadCiphertext.call(candidate, ciphertext);
      } catch {
        return null;
      }
    },
  };
}

/**
 * The REAL `ProductMediaEncryptionPort` adapter — see this file's own
 * header for the full account (bridge choice, fail-closed cases,
 * testability).
 *
 * Commerce FINAL Closure arc (Agent M) — `authority` now defaults to a
 * FRESH `new FedosWasmMasterSeedAuthority()` when omitted, mirroring this
 * codebase's own established "accept an optional Authority; default to
 * constructing a real one" convention exactly
 * (`fedos_wasm_nostr_signing_authority.ts:112`'s
 * `masterSeedAuthority ?? new FedosWasmMasterSeedAuthority()`,
 * `fedos_nostr_nip17_v1_wire_adapter.ts:84`'s identical pattern). This is
 * `./ipfs_media_store.ts`'s own DEFAULT `ProductMediaEncryptionPort` as of
 * this arc (see that file's own header) — replacing
 * `UnavailableProductMediaEncryption` as the thing a caller gets when they
 * do not explicitly pass an `encryption` argument at all.
 *
 * IMPORTANT: a freshly-constructed, no-argument
 * `FedosWasmMasterSeedAuthority` holds NO Master Seed (nothing is ever
 * auto-generated or auto-restored on construction — see that class's own
 * header) and is a SEPARATE instance from whatever Master Seed Authority a
 * real running app may already have unlocked elsewhere. So this
 * zero-argument default, in practice, behaves EXACTLY like
 * `UnavailableProductMediaEncryption` (`resolveCommerceMediaKey()` fails
 * closed to `null` on an authority that was never constructed through the
 * real boot sequence / never had `generate()`/`restoreSealed()` called on
 * it) UNTIL a real composition root deliberately constructs
 * `new WasmProductMediaEncryption(theAppsSharedMasterSeedAuthority)` with
 * the SAME, already-unlocked `FedosMasterSeedAuthority` instance the rest
 * of the app uses (mirroring
 * `fedos_conversation_production_crypto_authority_factory.ts`'s own
 * "one Master Seed Authority instance, shared across every Authority that
 * needs it" pattern) — that explicit wiring is the coordinator's own
 * composition-root responsibility, not something this file can safely do
 * on its own (constructing/unlocking a SEPARATE Master Seed here would be
 * exactly the kind of "invent a parallel key" mistake this arc's own
 * brief warns against). Never a plaintext downgrade either way: whether
 * the authority in use is real-and-unlocked, real-and-empty, or the
 * zero-arg default, `encrypt()` below still only ever returns real
 * ciphertext or `null` — never plaintext.
 */
export class WasmProductMediaEncryption implements ProductMediaEncryptionPort {
  readonly #authority: FedosMasterSeedAuthority;
  readonly #deps: WasmProductMediaEncryptionDeps;

  constructor(
    authority: FedosMasterSeedAuthority = new FedosWasmMasterSeedAuthority(),
    deps?: WasmProductMediaEncryptionDeps,
  ) {
    this.#authority = authority;
    // Explicit injection always wins (testability, unchanged); otherwise
    // prefer the injected authority's OWN production AEAD bridge, and only
    // then fall back to the dev-only Runtime Service exports. See this
    // file's own header, "PRODUCTION BRIDGE FIRST".
    this.#deps = deps ?? productionCommerceMediaEncryptionDepsFor(authority) ?? DEFAULT_DEPS;
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

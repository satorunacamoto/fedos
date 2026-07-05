/**
 * Stage 249 — Runtime Crypto Provider boundary (definitions only).
 *
 * A MINIMAL, future-facing seam so `AppRuntime` (`src/runtime/types.ts`) could
 * eventually expose the FedOS/NIP-44 wire crypto pipeline
 * (`docs/public_nip44_wire_api.md`, Stage 241–248) to the rest of the app —
 * WITHOUT calling it yet. This file defines shapes ONLY: it implements no
 * cryptography, calls no `packages/fedos-core-rust` function (neither the Rust
 * crate nor its TypeScript package boundary, `src/crypto/fedos_core_adapter.ts`),
 * and is not wired into `AppRuntime`/`createRuntime`/the Worker.
 *
 * HARD GUARDRAILS:
 *   - `RuntimeCryptoProvider.encrypt()`/`decrypt()` NEVER run real cryptography —
 *     every implementation in this file resolves to `allowed: false` and one of
 *     the three fixed states below.
 *   - Requests carry OPAQUE, non-secret handles ONLY (`opaqueKeyRef`,
 *     `opaquePlaintextRef`/`opaqueCiphertextRef`) — never raw key/plaintext/
 *     ciphertext bytes, mirroring `src/crypto/types.ts`'s own `EncryptRequest`/
 *     `DecryptRequest` discipline.
 *   - Decisions carry NO output bytes.
 *   - This is a SEPARATE seam from `src/crypto/types.ts`'s `CryptoProvider` —
 *     never reused or merged with it (this crate's own "separate label per
 *     boundary" discipline, e.g. `crypto::ciphertext_envelope::AeadEnvelopeAlgorithm`
 *     staying separate from `crypto::aead_internal::AeadCipher` on the Rust
 *     side). `RuntimeCryptoProvider` is Runtime-facing specifically, and its
 *     method names (`encrypt`/`decrypt`/`capabilities`/`status`) are
 *     deliberately distinct from `CryptoProvider`'s
 *     (`encrypt`/`decrypt`/`getCapabilities`/`getStatus`) so the two are never
 *     confused at a glance.
 *   - This boundary makes NO connectivity or "safe storage" guarantee. Do not
 *     describe it as "connected", "live", or "complete".
 */

/**
 * Coarse observable state of a `RuntimeCryptoProvider`. Every implementation in
 * this file reports ONLY one of these three — never a fourth, and never
 * `"available"`/`"enabled"` (contrast `src/runtime/runtime_crypto_diagnostics.ts`,
 * Stage 251, whose OWN, separate display state does name an `"Enabled"` label
 * for a future connected state — that label is never produced by anything in
 * THIS file).
 */
export type RuntimeCryptoState =
  | "Placeholder" // a placeholder implementation is present; it performs no real cryptography
  | "NotConnected" // no FedOS crypto core is connected to Runtime
  | "Unsupported"; // the requested capability is not one this boundary names at all

/**
 * A non-sensitive snapshot of a `RuntimeCryptoProvider`. `reason` is
 * human-readable and MUST never contain secrets, keys, or plaintext/ciphertext.
 */
export interface RuntimeCryptoStatus {
  readonly state: RuntimeCryptoState;
  readonly reason: string;
}

/**
 * The result of a `RuntimeCryptoProvider.encrypt()`/`decrypt()` attempt. In this
 * stage every operation is denied. There is deliberately NO output/bytes field.
 */
export interface RuntimeCryptoDecision {
  readonly allowed: boolean;
  readonly state: RuntimeCryptoState;
  /** Non-sensitive explanation. Never echoes request handles or secret material. */
  readonly reason: string;
}

/**
 * FUTURE capabilities a Runtime-facing crypto boundary MIGHT expose — all
 * PLACEHOLDERS. Presence of a name is a label of intent only, never a working
 * or safe feature. See `src/runtime/runtime_crypto_capability.ts` (Stage 250)
 * for how each of these maps to an existing `src/crypto/types.ts` `CryptoCapability`.
 */
export type RuntimeCryptoCapability =
  | "runtime_encrypt_placeholder"
  | "runtime_decrypt_placeholder"
  | "runtime_nip44_wire_placeholder"
  | "runtime_rust_core_placeholder";

/** Every Runtime crypto capability label (for mapping/documentation helpers). */
export const RUNTIME_CRYPTO_CAPABILITIES: readonly RuntimeCryptoCapability[] = [
  "runtime_encrypt_placeholder",
  "runtime_decrypt_placeholder",
  "runtime_nip44_wire_placeholder",
  "runtime_rust_core_placeholder",
];

/**
 * Ask to encrypt. Carries only an OPAQUE handle pair and an optional capability
 * label — never a key or plaintext byte. This boundary encrypts nothing.
 */
export interface RuntimeEncryptRequest {
  /** OPAQUE key handle — NOT key bytes. */
  readonly opaqueKeyRef?: string;
  /** OPAQUE handle to plaintext held elsewhere — NOT plaintext bytes. */
  readonly opaquePlaintextRef?: string;
  /** Which capability this request nominally exercises (for `Unsupported` routing only). */
  readonly capability?: RuntimeCryptoCapability;
}

/**
 * Ask to decrypt. Carries only an OPAQUE handle pair and an optional capability
 * label — never a key or ciphertext byte. This boundary decrypts nothing.
 */
export interface RuntimeDecryptRequest {
  /** OPAQUE key handle — NOT key bytes. */
  readonly opaqueKeyRef?: string;
  /** OPAQUE handle to ciphertext held elsewhere — NOT ciphertext bytes. */
  readonly opaqueCiphertextRef?: string;
  /** Which capability this request nominally exercises (for `Unsupported` routing only). */
  readonly capability?: RuntimeCryptoCapability;
}

/**
 * The Runtime-facing crypto boundary. Implementations MUST NOT run real
 * cryptography, call `packages/fedos-core-rust` (Rust crate or TS package
 * boundary), or store secret bytes. Every operation resolves to a
 * `RuntimeCryptoDecision` (never throws) and, in this stage, is always denied.
 * Constructing an implementation does nothing.
 */
export interface RuntimeCryptoProvider {
  /** Current coarse status (pure read). */
  status(): RuntimeCryptoStatus;
  /** The PLACEHOLDER capabilities this boundary advertises (may be empty). */
  capabilities(): readonly RuntimeCryptoCapability[];
  /** Ask to encrypt. Encrypts NOTHING in this stage. */
  encrypt(request: RuntimeEncryptRequest): Promise<RuntimeCryptoDecision>;
  /** Ask to decrypt. Decrypts NOTHING in this stage. */
  decrypt(request: RuntimeDecryptRequest): Promise<RuntimeCryptoDecision>;
}

/**
 * The safe default `RuntimeCryptoProvider` — permanently a placeholder. It
 * advertises the fixed placeholder capability list, and denies every
 * encrypt/decrypt request: `"Unsupported"` when the request names a capability
 * outside `RUNTIME_CRYPTO_CAPABILITIES`, `"NotConnected"` otherwise (no FedOS
 * core is connected to Runtime in this stage — see `docs/runtime_crypto_bridge.md`,
 * `docs/runtime_worker_crypto_bridge.md`). NOT wired into `AppRuntime`/
 * `createRuntime`/the Worker.
 */
export class PlaceholderRuntimeCryptoProvider implements RuntimeCryptoProvider {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): RuntimeCryptoStatus {
    return {
      state: "Placeholder",
      reason: "Runtime crypto boundary is a placeholder; no FedOS core is connected",
    };
  }

  capabilities(): readonly RuntimeCryptoCapability[] {
    return RUNTIME_CRYPTO_CAPABILITIES;
  }

  async encrypt(request: RuntimeEncryptRequest): Promise<RuntimeCryptoDecision> {
    return this.#deny("encryption", request.capability);
  }

  async decrypt(request: RuntimeDecryptRequest): Promise<RuntimeCryptoDecision> {
    return this.#deny("decryption", request.capability);
  }

  /**
   * Build a denied decision. Reads only the (optional) capability label from
   * the request — never a key/plaintext/ciphertext handle — and derives
   * nothing from it beyond membership in the fixed capability list.
   */
  #deny(
    operation: string,
    capability: RuntimeCryptoCapability | undefined,
  ): RuntimeCryptoDecision {
    if (capability !== undefined && !RUNTIME_CRYPTO_CAPABILITIES.includes(capability)) {
      return {
        allowed: false,
        state: "Unsupported",
        reason: `Runtime crypto boundary does not name capability "${capability}" (${operation} not performed)`,
      };
    }
    return {
      allowed: false,
      state: "NotConnected",
      reason: `no FedOS core is connected to Runtime (${operation} not performed)`,
    };
  }
}

/**
 * Stage 34 — Crypto Core boundary (types only).
 *
 * A MINIMAL, future-facing seam for the FedOS crypto core sketched in
 * `docs/vault_crypto_identity.md`. This file defines shapes ONLY — it implements
 * no cryptography, generates no randomness, derives no key, and encrypts/decrypts
 * nothing. It exists so a real crypto core (the provisional
 * `packages/fedos-core-rust` / a RustCrypto-backed WASM/FFI module) can drop in
 * later behind the same interface without the current Nostr/Cloudflare core, the
 * Vault seam, or the asset layer depending on any concrete implementation.
 *
 * HARD GUARDRAILS (see the design notes):
 *   - NO real encryption, NO AEAD, NO KDF/HKDF/Argon2, NO random generation, NO
 *     BIP39/BIP32, NO NIP-44, NO zeroize, NO key generation/derivation here.
 *   - Requests carry OPAQUE, non-secret handles and labels ONLY — never raw key
 *     material, seeds, passphrases, or plaintext bytes. A future Rust core would
 *     hold the secret bytes internally and resolve handles on its own side; this
 *     TypeScript boundary neither transports nor stores secret material.
 *   - Decisions carry NO output bytes: nothing is produced because nothing runs.
 *   - This boundary makes NO security, confidentiality, or "safe storage"
 *     guarantee. Do not describe it as "safe", "complete", or "zero-trace".
 */

/** Coarse observable state of a crypto core. No secret is exposed at any state. */
export type CryptoState =
  | "available" // a real crypto core is present (NEVER in this stage)
  | "unavailable" // no crypto backend is present (the no-op default)
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * A non-sensitive snapshot of the crypto core. `reason` is human-readable and
 * MUST never contain secrets, keys, seeds, plaintext, or ciphertext.
 */
export interface CryptoStatus {
  readonly state: CryptoState;
  readonly reason: string;
}

/**
 * The result of a crypto operation attempt. In this stage every operation is
 * denied/unavailable. There is deliberately NO output/bytes field — nothing is
 * computed, so nothing is returned but a non-sensitive decision.
 */
export interface CryptoDecision {
  readonly allowed: boolean;
  /** The crypto-core state AFTER this decision. */
  readonly state: CryptoState;
  /** Non-sensitive explanation. Never echoes request handles or secret material. */
  readonly reason: string;
}

/**
 * FUTURE capabilities a crypto core MIGHT expose — all PLACEHOLDERS in this
 * stage. Presence of a name is a label of intent, NOT a working or safe feature.
 */
export type CryptoCapability =
  | "aead_placeholder" // future authenticated encryption (ChaCha20-Poly1305 / AES-GCM)
  | "kdf_placeholder" // future key derivation (HKDF / Argon2) — not run here
  | "random_placeholder" // future CSPRNG bytes — not generated here
  | "nip44_placeholder" // future NIP-44 payload encryption — not implemented here
  | "rust_core_placeholder"; // future Rust/WASM core swap point

/** Labels only — no algorithm is selected or executed in this stage. */
export type AeadAlgorithm =
  | "chacha20poly1305"
  | "xchacha20poly1305"
  | "aes_gcm"
  | "other";

/** Labels only — no KDF is run in this stage. */
export type KdfKind = "hkdf" | "argon2" | "other";

/**
 * Ask for CSPRNG bytes. Carries only the requested length — no secret. A real
 * core would return bytes; this boundary returns none.
 */
export interface RandomBytesRequest {
  /** How many bytes a real CSPRNG WOULD return. Not produced here. */
  readonly length: number;
}

/**
 * Ask to derive a key. Carries only OPAQUE handles and non-secret labels — never
 * a passphrase, seed, or raw input-key bytes. This boundary derives nothing.
 */
export interface DeriveKeyRequest {
  readonly kdf?: KdfKind;
  /** OPAQUE handle to input key material held elsewhere — NOT the bytes. */
  readonly keyRef?: string;
  /** Non-secret purpose/context label (e.g. an info string name). */
  readonly purpose?: string;
}

/**
 * Ask to encrypt. Carries only OPAQUE handles and non-secret labels — never the
 * key or plaintext bytes. A future Rust core resolves the handles internally.
 */
export interface EncryptRequest {
  readonly algorithm?: AeadAlgorithm;
  /** OPAQUE key handle — NOT key bytes. */
  readonly keyRef?: string;
  /** OPAQUE handle to plaintext held elsewhere — NOT plaintext bytes. */
  readonly plaintextRef?: string;
  /** Non-secret associated-data label (AAD), if any. */
  readonly aad?: string;
}

/**
 * Ask to decrypt. Carries only OPAQUE handles and non-secret labels — never the
 * key or ciphertext bytes. This boundary decrypts nothing.
 */
export interface DecryptRequest {
  readonly algorithm?: AeadAlgorithm;
  /** OPAQUE key handle — NOT key bytes. */
  readonly keyRef?: string;
  /** OPAQUE handle to ciphertext held elsewhere — NOT ciphertext bytes. */
  readonly ciphertextRef?: string;
  /** Non-secret associated-data label (AAD), if any. */
  readonly aad?: string;
}

/**
 * The crypto-core seam. Implementations MUST NOT run real cryptography, generate
 * randomness, or store secret bytes. Every operation resolves to a
 * `CryptoDecision` (never throws) and, in this stage, is denied/unavailable.
 * Constructing an implementation does nothing.
 */
export interface CryptoProvider {
  /** Current coarse status (pure read). */
  getStatus(): CryptoStatus;
  /** The PLACEHOLDER capabilities this core advertises (may be empty). */
  getCapabilities(): readonly CryptoCapability[];
  /** Ask for CSPRNG bytes. Generates NONE in this stage. */
  randomBytes(request: RandomBytesRequest): Promise<CryptoDecision>;
  /** Ask to derive a key. Derives NONE in this stage. */
  deriveKey(request: DeriveKeyRequest): Promise<CryptoDecision>;
  /** Ask to encrypt. Encrypts NOTHING in this stage. */
  encrypt(request: EncryptRequest): Promise<CryptoDecision>;
  /** Ask to decrypt. Decrypts NOTHING in this stage. */
  decrypt(request: DecryptRequest): Promise<CryptoDecision>;
}

/** Every placeholder capability name (for mapping/documentation helpers). */
export const CRYPTO_CAPABILITIES: readonly CryptoCapability[] = [
  "aead_placeholder",
  "kdf_placeholder",
  "random_placeholder",
  "nip44_placeholder",
  "rust_core_placeholder",
];

/**
 * Stage 59 — `@nostr-window/fedos-core-rust` boundary types.
 *
 * The public shapes of a FUTURE FedOS crypto core (sketched in
 * `docs/vault_crypto_identity.md`). This package is where a real, RustCrypto-
 * backed WASM/FFI core is INTENDED to live one day — but this stage ships the
 * package boundary ONLY. There is no Rust, no WASM, and no cryptography here.
 *
 * These types deliberately MIRROR the host's `src/crypto/types.ts` seam so the
 * host adapter (`src/crypto/fedos_core_adapter.ts`) can bridge the two without
 * either side importing the other's internals. This file is standalone: it
 * imports nothing (no host `src/`, no crypto library).
 *
 * HARD GUARDRAILS (identical to the host crypto seam):
 *   - NO real encryption, NO AEAD, NO KDF/HKDF/Argon2, NO CSPRNG/random
 *     generation, NO BIP39/BIP32, NO NIP-44, NO zeroize, NO WebAuthn, NO Secure
 *     Enclave, NO key generation/derivation.
 *   - Requests carry OPAQUE, non-secret handles and labels ONLY — never raw key
 *     material, seeds, passphrases, plaintext, or ciphertext bytes. A future
 *     Rust core would hold secret bytes internally on its own side.
 *   - Decisions carry NO output bytes: nothing is produced because nothing runs.
 *   - This boundary makes NO security, confidentiality, or "safe storage"
 *     guarantee. Do not describe it as "safe", "complete", or "zero-trace".
 */

/** Coarse observable state of the core. No secret is exposed at any state. */
export type FedosCoreState =
  | "available" // a real Rust/WASM core is present (NEVER in this stage)
  | "unavailable" // no core is present (the placeholder default)
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * A non-sensitive snapshot of the core. `reason` is human-readable and MUST
 * never contain secrets, keys, seeds, plaintext, or ciphertext.
 */
export interface FedosCoreStatus {
  readonly state: FedosCoreState;
  readonly reason: string;
}

/**
 * The result of a crypto operation attempt. In this stage every operation is
 * denied/unavailable. There is deliberately NO output/bytes field — nothing is
 * computed, so nothing is returned but a non-sensitive decision.
 */
export interface FedosCoreDecision {
  readonly allowed: boolean;
  /** The core state AFTER this decision. */
  readonly state: FedosCoreState;
  /** Non-sensitive explanation. Never echoes request handles or secret bytes. */
  readonly reason: string;
}

/**
 * FUTURE capabilities the core MIGHT expose — all PLACEHOLDERS in this stage.
 * Presence of a name is a label of intent, NOT a working or safe feature. The
 * string values match the host `CryptoCapability` union so the adapter can pass
 * them straight through.
 */
export type FedosCoreCapability =
  | "aead_placeholder" // future authenticated encryption (ChaCha20-Poly1305 / AES-GCM)
  | "kdf_placeholder" // future key derivation (HKDF / Argon2) — not run here
  | "random_placeholder" // future CSPRNG bytes — not generated here
  | "nip44_placeholder" // future NIP-44 payload encryption — not implemented here
  | "rust_core_placeholder"; // future Rust/WASM core swap point

/** Labels only — no algorithm is selected or executed in this stage. */
export type FedosCoreAeadAlgorithm =
  | "chacha20poly1305"
  | "xchacha20poly1305"
  | "aes_gcm"
  | "other";

/** Labels only — no KDF is run in this stage. */
export type FedosCoreKdfKind = "hkdf" | "argon2" | "other";

/**
 * Ask for CSPRNG bytes. Carries only the requested length — no secret. A real
 * core would return bytes; this boundary returns none.
 */
export interface FedosCoreRandomBytesRequest {
  /** How many bytes a real CSPRNG WOULD return. Not produced here. */
  readonly length: number;
}

/**
 * Ask to derive a key. Carries only OPAQUE handles and non-secret labels —
 * never a passphrase, seed, or raw input-key bytes. This boundary derives
 * nothing.
 */
export interface FedosCoreDeriveKeyRequest {
  readonly kdf?: FedosCoreKdfKind;
  /** OPAQUE handle to input key material held elsewhere — NOT the bytes. */
  readonly keyRef?: string;
  /** Non-secret purpose/context label (e.g. an info string name). */
  readonly purpose?: string;
}

/**
 * Ask to encrypt. Carries only OPAQUE handles and non-secret labels — never the
 * key or plaintext bytes. A future Rust core resolves the handles internally.
 */
export interface FedosCoreEncryptRequest {
  readonly algorithm?: FedosCoreAeadAlgorithm;
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
export interface FedosCoreDecryptRequest {
  readonly algorithm?: FedosCoreAeadAlgorithm;
  /** OPAQUE key handle — NOT key bytes. */
  readonly keyRef?: string;
  /** OPAQUE handle to ciphertext held elsewhere — NOT ciphertext bytes. */
  readonly ciphertextRef?: string;
  /** Non-secret associated-data label (AAD), if any. */
  readonly aad?: string;
}

/**
 * The FedOS crypto-core seam. A future Rust/WASM core implements this. Every
 * operation resolves to a `FedosCoreDecision` (never throws) and, in this stage,
 * is denied/unavailable. Implementations MUST NOT run real cryptography,
 * generate randomness, or store/transport secret bytes.
 */
export interface FedosCoreCrypto {
  /** Current coarse status (pure read). */
  getStatus(): FedosCoreStatus;
  /** The PLACEHOLDER capabilities this core advertises (may be empty). */
  getCapabilities(): readonly FedosCoreCapability[];
  /** Ask for CSPRNG bytes. Generates NONE in this stage. */
  randomBytes(request: FedosCoreRandomBytesRequest): Promise<FedosCoreDecision>;
  /** Ask to derive a key. Derives NONE in this stage. */
  deriveKey(request: FedosCoreDeriveKeyRequest): Promise<FedosCoreDecision>;
  /** Ask to encrypt. Encrypts NOTHING in this stage. */
  encrypt(request: FedosCoreEncryptRequest): Promise<FedosCoreDecision>;
  /** Ask to decrypt. Decrypts NOTHING in this stage. */
  decrypt(request: FedosCoreDecryptRequest): Promise<FedosCoreDecision>;
}

/**
 * Every placeholder capability name a future core MIGHT advertise. Labels of
 * intent only — none is implemented or safe in this stage.
 */
export const FEDOS_CORE_CAPABILITIES: readonly FedosCoreCapability[] = [
  "aead_placeholder",
  "kdf_placeholder",
  "random_placeholder",
  "nip44_placeholder",
  "rust_core_placeholder",
];

/**
 * Stage 34 — `NoopCryptoProvider`: a crypto core that does nothing.
 *
 * The safe default when no crypto core is present. It is permanently
 * `unavailable`: it advertises no capabilities and every operation resolves to a
 * denied/unavailable `CryptoDecision`. It generates no randomness, derives no
 * key, encrypts/decrypts nothing, and holds no key/seed/plaintext. Every method
 * is total and never throws.
 *
 * This exists so callers (the Vault seam, identity/asset layers, a future Rust
 * core) can depend on the `CryptoProvider` interface without a real backend,
 * exactly as the app depends on mock/no-op defaults elsewhere. It is NOT wired
 * into the runtime or Worker.
 */

import type {
  CryptoCapability,
  CryptoDecision,
  CryptoProvider,
  CryptoStatus,
  DecryptRequest,
  DeriveKeyRequest,
  EncryptRequest,
  RandomBytesRequest,
} from "./types.js";

export class NoopCryptoProvider implements CryptoProvider {
  constructor() {
    // Does nothing: no core loaded, no key/seed created, no RNG seeded.
  }

  getStatus(): CryptoStatus {
    return { state: "unavailable", reason: "no crypto core is configured" };
  }

  getCapabilities(): readonly CryptoCapability[] {
    // No core present -> advertises nothing.
    return [];
  }

  async randomBytes(_request: RandomBytesRequest): Promise<CryptoDecision> {
    return this.#deny("random-bytes generation");
  }

  async deriveKey(_request: DeriveKeyRequest): Promise<CryptoDecision> {
    return this.#deny("key derivation");
  }

  async encrypt(_request: EncryptRequest): Promise<CryptoDecision> {
    return this.#deny("encryption");
  }

  async decrypt(_request: DecryptRequest): Promise<CryptoDecision> {
    return this.#deny("decryption");
  }

  /**
   * Build a denied/unavailable decision. Reads nothing from the request, derives
   * nothing, and stores nothing. The `operation` label is a fixed, non-sensitive
   * string — never request handles or secret material.
   */
  #deny(operation: string): CryptoDecision {
    return {
      allowed: false,
      state: "unavailable",
      reason: `no crypto core is configured (${operation} not performed)`,
    };
  }
}

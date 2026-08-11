/**
 * Stage 34 — pure mapping from crypto-core capabilities to Vault capabilities.
 *
 * A future vault would advertise WHAT it can do partly based on what its crypto
 * core provides. This helper is the pure, side-effect-free glue between the two
 * PLACEHOLDER capability vocabularies — it derives nothing, runs no crypto, and
 * touches no runtime. It takes a type-only dependency on the Vault types; it does
 * NOT wire the crypto core into the vault, the runtime, or the Worker.
 *
 * The mapping is intentionally coarse (both sides are placeholders): a crypto
 * core that can do AEAD / NIP-44 / has a Rust core backs the vault's
 * `aead_crypto_placeholder`; a KDF backs `identity_unlock_placeholder` (unlock
 * flows derive from a passphrase in a future stage); `random_placeholder` has no
 * direct vault-facing capability and maps to nothing.
 */

import type { VaultCapability } from "../vault/types.js";
import type { CryptoCapability } from "./types.js";

/** Zero-or-one vault capability per crypto capability. Placeholders only. */
const CRYPTO_TO_VAULT: Partial<Record<CryptoCapability, VaultCapability>> = {
  aead_placeholder: "aead_crypto_placeholder",
  nip44_placeholder: "aead_crypto_placeholder",
  rust_core_placeholder: "aead_crypto_placeholder",
  kdf_placeholder: "identity_unlock_placeholder",
  // random_placeholder: no direct vault-facing capability.
};

/**
 * Map crypto-core capabilities to the vault capabilities they would back.
 * Pure and total: it does not mutate the input, dedupes while preserving first
 * appearance, and returns a new readonly array. Unknown/unmapped entries are
 * skipped.
 */
export function cryptoCapabilitiesToVaultCapabilities(
  capabilities: readonly CryptoCapability[],
): readonly VaultCapability[] {
  const out: VaultCapability[] = [];
  for (const capability of capabilities) {
    const mapped = CRYPTO_TO_VAULT[capability];
    if (mapped && !out.includes(mapped)) {
      out.push(mapped);
    }
  }
  return out;
}

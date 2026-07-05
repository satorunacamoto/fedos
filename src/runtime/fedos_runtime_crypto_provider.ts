/**
 * Stage 265 — FedOS Runtime Crypto Provider (encrypt/decrypt always Unsupported).
 *
 * A SECOND `RuntimeCryptoProvider` (`src/runtime/crypto_provider.ts`, Stage
 * 249) implementation, named after FedOS specifically — but still calling NO
 * `packages/fedos-core-rust` function (neither the Rust crate nor its
 * TypeScript package boundary, `src/crypto/fedos_core_adapter.ts`). This
 * exists so `src/runtime/runtime_crypto_registry.ts` (Stage 257/266) has a
 * second, distinctly-named entry to register — the actual bridge to a real
 * core is a future, separate, explicitly-reviewed stage.
 *
 * HARD GUARDRAILS:
 *   - `encrypt()`/`decrypt()` ALWAYS resolve to `state: "Unsupported"` —
 *     never `"Placeholder"`/`"NotConnected"`, and never real cryptography.
 *     This is intentionally a MORE restrictive answer than
 *     `PlaceholderRuntimeCryptoProvider`'s (which reports `"NotConnected"`
 *     for a well-formed capability): `"Unsupported"` here signals "this
 *     provider exists but performs no operation of any kind yet", not "a
 *     core could theoretically be connected".
 *   - NO import of `packages/fedos-core-rust` (Rust crate or TS package
 *     boundary), NO import of `src/crypto/fedos_core_adapter.ts`.
 *   - Never throws; never mutates its request argument.
 */

import type {
  RuntimeCryptoCapability,
  RuntimeCryptoDecision,
  RuntimeCryptoProvider,
  RuntimeCryptoStatus,
  RuntimeDecryptRequest,
  RuntimeEncryptRequest,
} from "./crypto_provider.js";
import { RUNTIME_CRYPTO_CAPABILITIES } from "./crypto_provider.js";

/**
 * The FedOS-named `RuntimeCryptoProvider`. Advertises the same fixed
 * placeholder capability labels as `PlaceholderRuntimeCryptoProvider`
 * (labels of intent only), but `encrypt()`/`decrypt()` ALWAYS deny with
 * `"Unsupported"` — no real core is connected, and this stage never
 * connects one.
 */
export class FedosRuntimeCryptoProvider implements RuntimeCryptoProvider {
  constructor() {
    // Does nothing: no core loaded, no handle resolved, no byte touched.
  }

  status(): RuntimeCryptoStatus {
    return {
      state: "NotConnected",
      reason: "FedOS runtime crypto provider is not connected to any real core",
    };
  }

  capabilities(): readonly RuntimeCryptoCapability[] {
    return RUNTIME_CRYPTO_CAPABILITIES;
  }

  async encrypt(_request: RuntimeEncryptRequest): Promise<RuntimeCryptoDecision> {
    return this.#unsupported("encryption");
  }

  async decrypt(_request: RuntimeDecryptRequest): Promise<RuntimeCryptoDecision> {
    return this.#unsupported("decryption");
  }

  #unsupported(operation: string): RuntimeCryptoDecision {
    return {
      allowed: false,
      state: "Unsupported",
      reason: `FedOS runtime crypto provider does not perform ${operation} in this stage`,
    };
  }
}

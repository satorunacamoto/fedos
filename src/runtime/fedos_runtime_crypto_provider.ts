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
 *
 * Stage 305 adds `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` — a fixed, PRIVATE
 * (well, exported for `runtime_crypto_activation_policy.ts`/
 * `worker_crypto_activation_policy.ts`, Stage 308, to reference as their
 * single source of truth) constant, permanently `false`, with NO env
 * path and NO parameter anywhere that could flip it. It answers ONE
 * question — "does a real encrypt/decrypt implementation exist inside
 * this class" — and is surfaced, read-only, on `status()`'s return value
 * as `implemented`. `encrypt()`/`decrypt()` still ALWAYS resolve
 * `"Unsupported"`, completely unchanged.
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
 * Fixed, permanently-`false` constant: whether `FedosRuntimeCryptoProvider`
 * has a real internal `encrypt`/`decrypt` implementation. Reads NO
 * `process.env`, accepts NO parameter or override anywhere in this
 * module or any importer — flipping it is a future, separate,
 * explicitly-reviewed stage's own decision, made only by editing this
 * literal.
 */
export const FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false;

/**
 * `FedosRuntimeCryptoProvider.status()`'s own return shape — a strict
 * superset of `RuntimeCryptoStatus` (assignable to it, so the class still
 * satisfies `RuntimeCryptoProvider.status(): RuntimeCryptoStatus`
 * exactly) that additionally surfaces `implemented`, mirroring
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` exactly. No secret, key, or
 * ciphertext material — a single boolean.
 */
export interface FedosRuntimeCryptoProviderStatus extends RuntimeCryptoStatus {
  readonly implemented: boolean;
}

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

  status(): FedosRuntimeCryptoProviderStatus {
    return {
      state: "NotConnected",
      reason: "FedOS runtime crypto provider is not connected to any real core",
      implemented: FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
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

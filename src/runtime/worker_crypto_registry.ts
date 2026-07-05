/**
 * Stage 274 — Worker Crypto Provider Registry.
 *
 * The Worker-side counterpart of `src/runtime/runtime_crypto_registry.ts`
 * (Stage 257/266) — a SEPARATE `RuntimeCryptoProviderRegistry` (Stage 257's
 * class, reused as-is; no new registry class is needed since the shape a
 * registry stores/resolves does not differ between "Runtime's own opt-in
 * surface" and "Worker's own opt-in surface") holding its OWN
 * `"placeholder"`/`"fedos"` registrations, independent of Runtime's
 * registry instance.
 *
 * `"fedos"` here CAN be constructed (`FedosRuntimeCryptoProvider`, Stage
 * 265) — this registry does not refuse to build it — but constructing it
 * performs NO real cryptography (its `encrypt`/`decrypt` always resolve to
 * `"Unsupported"`, unchanged from Stage 265) and nothing in this stage's
 * code ever calls `encrypt`/`decrypt` on anything this registry produces.
 * "FedOS生成可能" (constructible) is not "FedOS実行可能" (executable).
 *
 * HARD GUARDRAILS:
 *   - The default Worker registry (`createDefaultWorkerCryptoProviderRegistry`)
 *     registers ONLY `"placeholder"` → `PlaceholderRuntimeCryptoProvider` and
 *     `"fedos"` → `FedosRuntimeCryptoProvider` — no OTHER provider is ever
 *     registered, and neither factory calls `packages/fedos-core-rust`.
 *   - This registry is a SEPARATE INSTANCE from
 *     `createDefaultRuntimeCryptoProviderRegistry()`'s — Worker never reaches
 *     into Runtime's registry, and Runtime never reaches into this one.
 *   - Registering a factory does not run it, and nothing here ever calls
 *     `encrypt()`/`decrypt()` on a constructed provider.
 */

import type {
  RuntimeCryptoProviderFactory,
} from "./runtime_crypto_registry.js";
import { RuntimeCryptoProviderRegistry } from "./runtime_crypto_registry.js";
import { PlaceholderRuntimeCryptoProvider } from "./crypto_provider.js";
import { FedosRuntimeCryptoProvider } from "./fedos_runtime_crypto_provider.js";

/** The fixed name the safe default provider registers under (Worker side). */
export const WORKER_PLACEHOLDER_PROVIDER_NAME = "placeholder";

/** The fixed name the FedOS-named (still non-operational) provider registers under (Worker side). */
export const WORKER_FEDOS_PROVIDER_NAME = "fedos";

/**
 * Build a Worker-side registry with `"placeholder"` and `"fedos"`
 * registered — a completely separate instance from
 * `createDefaultRuntimeCryptoProviderRegistry()`'s. Neither factory here
 * calls `packages/fedos-core-rust`, and nothing here invokes
 * `encrypt()`/`decrypt()` on the result.
 */
export function createDefaultWorkerCryptoProviderRegistry(): RuntimeCryptoProviderRegistry {
  const registry = new RuntimeCryptoProviderRegistry();
  const placeholderFactory: RuntimeCryptoProviderFactory = () =>
    new PlaceholderRuntimeCryptoProvider();
  const fedosFactory: RuntimeCryptoProviderFactory = () => new FedosRuntimeCryptoProvider();
  registry.register(WORKER_PLACEHOLDER_PROVIDER_NAME, placeholderFactory);
  registry.register(WORKER_FEDOS_PROVIDER_NAME, fedosFactory);
  return registry;
}

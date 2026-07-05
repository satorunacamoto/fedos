/**
 * Stage 257 — Runtime Crypto Provider Registry.
 *
 * A MINIMAL registry that `RuntimeCryptoProvider` (`src/runtime/crypto_provider.ts`,
 * Stage 249) implementations can be registered under a name and resolved by
 * name from. This exists so a future, separate, explicitly-reviewed stage can
 * register a REAL provider without changing `src/runtime/runtime_crypto_bridge.js`'s
 * (Stage 259) own resolution logic — the bridge only ever asks the registry
 * for `"placeholder"`.
 *
 * HARD GUARDRAILS:
 *   - The default registry (`createDefaultRuntimeCryptoProviderRegistry`)
 *     registers ONLY `"placeholder"` → `PlaceholderRuntimeCryptoProvider`. NO
 *     FedOS/Rust/WASM provider is registered anywhere in this file, and
 *     nothing in this stage's code ever calls `register()` with anything
 *     else.
 *   - `register`/`create` never construct or call `packages/fedos-core-rust`
 *     (Rust crate or TS package boundary) — they only store/invoke
 *     zero-argument factory functions the caller supplies.
 *   - Registering a factory does not run it — `create()` is the only thing
 *     that invokes a factory, and invoking a factory only ever constructs a
 *     `RuntimeCryptoProvider` object (never real cryptography, per
 *     `crypto_provider.ts`'s own contract).
 */

import type { RuntimeCryptoProvider } from "./crypto_provider.js";
import { PlaceholderRuntimeCryptoProvider } from "./crypto_provider.js";

/** A zero-argument constructor for a `RuntimeCryptoProvider`. */
export type RuntimeCryptoProviderFactory = () => RuntimeCryptoProvider;

/** The fixed name the default (and, in this stage, ONLY) provider registers under. */
export const PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME = "placeholder";

/**
 * A name → factory registry for `RuntimeCryptoProvider` implementations.
 * Registering a factory does nothing beyond storing it; `create()` invokes
 * it fresh on every call (no caching, no shared instance).
 */
export class RuntimeCryptoProviderRegistry {
  readonly #factories = new Map<string, RuntimeCryptoProviderFactory>();

  /** Register `factory` under `name`, replacing any prior registration for it. */
  register(name: string, factory: RuntimeCryptoProviderFactory): void {
    this.#factories.set(name, factory);
  }

  /** Construct a fresh provider for `name`, or `undefined` if none is registered. */
  create(name: string): RuntimeCryptoProvider | undefined {
    const factory = this.#factories.get(name);
    return factory ? factory() : undefined;
  }

  /** Which names are currently registered, in registration order. */
  names(): readonly string[] {
    return [...this.#factories.keys()];
  }
}

/**
 * Build a registry with ONLY `"placeholder"` registered — the safe default.
 * No FedOS/Rust/WASM provider is ever registered by this function.
 */
export function createDefaultRuntimeCryptoProviderRegistry(): RuntimeCryptoProviderRegistry {
  const registry = new RuntimeCryptoProviderRegistry();
  registry.register(
    PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
    () => new PlaceholderRuntimeCryptoProvider(),
  );
  return registry;
}

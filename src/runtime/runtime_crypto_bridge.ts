/**
 * Stage 259 — Runtime Crypto Bridge (non-operational).
 *
 * The ONE function that resolves a `RuntimeCryptoProvider` for `AppRuntime`
 * (`src/runtime/create_runtime.ts`, Stage 260) to use. Reads
 * `src/runtime/runtime_crypto_config.ts`'s (Stage 258) fixed,
 * `runtimeCryptoEnabled: false` config and, per that flag, resolves ONLY the
 * registry's `"placeholder"` entry (`src/runtime/runtime_crypto_registry.ts`,
 * Stage 257) — never a real FedOS core, in either branch below.
 *
 * HARD GUARDRAILS:
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary) anywhere in this file.
 *   - Both branches of `if (!runtimeCryptoEnabled)` resolve to the SAME safe
 *     placeholder — there is no code path in this stage that could ever
 *     construct or call a non-placeholder provider, even if
 *     `runtimeCryptoEnabled` were (hypothetically, and never in this stage)
 *     `true`.
 *   - A `RuntimeCryptoProvider` is NEVER constructed with `new` in this
 *     file — every provider comes from `RuntimeCryptoProviderRegistry.create()`
 *     (Stage 257), so a future stage that registers a real provider changes
 *     NOTHING here beyond which name is asked for.
 *   - Never throws; never mutates its `registry` argument.
 */

import type { RuntimeCryptoProvider } from "./crypto_provider.js";
import { getRuntimeCryptoConfig } from "./runtime_crypto_config.js";
import {
  createDefaultRuntimeCryptoProviderRegistry,
  PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  RuntimeCryptoProviderRegistry,
} from "./runtime_crypto_registry.js";

/**
 * Resolve the `"placeholder"` entry from `registry`, falling back to a
 * fresh default registry's own entry if `registry` somehow lacks one (e.g. a
 * caller supplied a bespoke registry without registering it) — still
 * resolved via a `RuntimeCryptoProviderRegistry`, never `new`'d directly.
 */
function resolvePlaceholderProvider(
  registry: RuntimeCryptoProviderRegistry,
): RuntimeCryptoProvider {
  const fromRegistry = registry.create(PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME);
  if (fromRegistry) return fromRegistry;
  // `registry` lacked a "placeholder" entry (e.g. a caller supplied a
  // bespoke, not-yet-populated registry) — resolve from a fresh default
  // registry instead. `createDefaultRuntimeCryptoProviderRegistry()` always
  // registers this name (see runtime_crypto_registry.ts), so this second
  // lookup is guaranteed to succeed.
  return createDefaultRuntimeCryptoProviderRegistry().create(
    PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  ) as RuntimeCryptoProvider;
}

/**
 * Resolve the `RuntimeCryptoProvider` Runtime should use. Always resolves
 * (from `registry`, or a fresh default registry) the `"placeholder"` entry —
 * `runtimeCryptoEnabled` being permanently `false` (Stage 258) means the
 * `if` branch below is the only one ever taken, and even the (currently
 * unreachable) `else` branch resolves nothing but the same placeholder name.
 * No FedOS Core call exists in this function.
 */
export function buildRuntimeCryptoProvider(
  registry: RuntimeCryptoProviderRegistry = createDefaultRuntimeCryptoProviderRegistry(),
): RuntimeCryptoProvider {
  const { runtimeCryptoEnabled } = getRuntimeCryptoConfig();
  if (!runtimeCryptoEnabled) {
    return resolvePlaceholderProvider(registry);
  }
  // Unreachable in this stage: `runtimeCryptoEnabled` is permanently `false`
  // (Stage 258). Even here, only the registry's own "placeholder" entry is
  // ever resolved — never a FedOS core.
  return resolvePlaceholderProvider(registry);
}

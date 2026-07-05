/**
 * Stage 259 — Runtime Crypto Bridge (non-operational).
 *
 * The ONE function that resolves a `RuntimeCryptoProvider` for `AppRuntime`
 * (`src/runtime/create_runtime.ts`, Stage 260) to use. Reads
 * `src/runtime/runtime_crypto_config.ts`'s (Stage 258/267) fixed config and
 * resolves a name via the Registry (`src/runtime/runtime_crypto_registry.ts`,
 * Stage 257/266) — never a real FedOS core call, in any branch below.
 *
 * Stage 268 makes the selection a TWO-FLAG gate:
 * `runtimeCryptoEnabled && runtimeCryptoProvider === "fedos"`. BOTH must be
 * true before `"fedos"` is even asked for — either flag alone still
 * resolves `"placeholder"`. Since `runtimeCryptoEnabled` is permanently
 * `false` (Stage 258), this gate can never actually pass in this stage,
 * regardless of `runtimeCryptoProvider`'s value (itself fixed
 * `"placeholder"`, Stage 267).
 *
 * HARD GUARDRAILS:
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary) anywhere in this file.
 *   - The two-flag gate is evaluated with `&&`, never `||` — a single
 *     truthy flag is never enough.
 *   - A `RuntimeCryptoProvider` is NEVER constructed with `new` in this
 *     file — every provider comes from `RuntimeCryptoProviderRegistry.create()`
 *     (Stage 257/266), so a future stage that registers another real
 *     provider changes NOTHING here beyond which name is asked for.
 *   - Never throws; never mutates its `registry` argument.
 */

import type { RuntimeCryptoProvider } from "./crypto_provider.js";
import { getRuntimeCryptoConfig } from "./runtime_crypto_config.js";
import {
  createDefaultRuntimeCryptoProviderRegistry,
  FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME,
  PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  RuntimeCryptoProviderRegistry,
} from "./runtime_crypto_registry.js";

/**
 * Resolve `name` from `registry`, falling back to a fresh default
 * registry's own entry if `registry` somehow lacks one (e.g. a caller
 * supplied a bespoke registry without registering it) — still resolved via
 * a `RuntimeCryptoProviderRegistry`, never `new`'d directly.
 */
function resolveFromRegistry(
  registry: RuntimeCryptoProviderRegistry,
  name: string,
): RuntimeCryptoProvider {
  const fromRegistry = registry.create(name);
  if (fromRegistry) return fromRegistry;
  // `registry` lacked this name (e.g. a caller supplied a bespoke,
  // not-yet-populated registry) — resolve from a fresh default registry
  // instead. `createDefaultRuntimeCryptoProviderRegistry()` always
  // registers both known names (see runtime_crypto_registry.ts), so this
  // second lookup for the SAFE placeholder name is guaranteed to succeed.
  return createDefaultRuntimeCryptoProviderRegistry().create(
    PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  ) as RuntimeCryptoProvider;
}

/**
 * Resolve the `RuntimeCryptoProvider` Runtime should use. Only resolves
 * `"fedos"` when BOTH `runtimeCryptoEnabled` is `true` AND
 * `runtimeCryptoProvider === "fedos"` — otherwise (always, in this stage)
 * resolves `"placeholder"`. No FedOS Core call exists in this function
 * regardless of which name is resolved — `FedosRuntimeCryptoProvider`
 * itself performs no real cryptography either (Stage 265).
 */
export function buildRuntimeCryptoProvider(
  registry: RuntimeCryptoProviderRegistry = createDefaultRuntimeCryptoProviderRegistry(),
): RuntimeCryptoProvider {
  const { runtimeCryptoEnabled, runtimeCryptoProvider } = getRuntimeCryptoConfig();
  if (runtimeCryptoEnabled && runtimeCryptoProvider === FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME) {
    // Unreachable in this stage: runtimeCryptoEnabled is permanently false
    // (Stage 258), so this branch never actually runs. Even here, only the
    // registry's own "fedos" entry (FedosRuntimeCryptoProvider, itself
    // encrypt/decrypt-Unsupported) is ever resolved — never a real core.
    return resolveFromRegistry(registry, FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME);
  }
  return resolveFromRegistry(registry, PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME);
}

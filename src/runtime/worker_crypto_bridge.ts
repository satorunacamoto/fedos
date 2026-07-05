/**
 * Stage 275 — Worker Crypto Bridge (non-operational).
 *
 * The Worker-side counterpart of `src/runtime/runtime_crypto_bridge.ts`
 * (Stage 259/268). Reads `src/runtime/worker_crypto_config.ts`'s (Stage
 * 273) fixed config and resolves a name via the Worker Registry
 * (`src/runtime/worker_crypto_registry.ts`, Stage 274) — never a real
 * FedOS core call, in any branch below.
 *
 * The selection is a TWO-FLAG gate: `workerCryptoEnabled && workerCryptoProvider
 * === "fedos"`. BOTH must be true before `"fedos"` is even asked for —
 * either flag alone still resolves `"placeholder"`. Since
 * `workerCryptoEnabled` is permanently `false` (Stage 273), this gate can
 * never actually pass in this stage, regardless of `workerCryptoProvider`'s
 * value (itself fixed `"placeholder"`).
 *
 * **Nothing calls this function yet.** `src/worker.ts` does not import
 * this module — see `docs/runtime_worker_activation_boundary.md` (Stage
 * 276) for the ordering this bridge sits inside, still unconnected.
 *
 * Stage 284 confirms this gate still holds exactly as before now that
 * `workerCryptoProvider` can be `"fedos"` via the `FEDOS_CRYPTO_PROVIDER`
 * env var (Stage 283): setting it alone records
 * `workerCryptoProvider: "fedos"` in the config, but `workerCryptoEnabled`
 * being permanently `false` means `buildWorkerCryptoProvider` STILL always
 * resolves `"placeholder"`. `buildWorkerCryptoProvider` now accepts an
 * OPTIONAL `env` parameter (added AFTER `registry` for backward
 * compatibility), passed straight through to `getWorkerCryptoConfig`.
 *
 * HARD GUARDRAILS:
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary) anywhere in this file.
 *   - NO `process.env` reference — `env`, if supplied, is used only to read
 *     `FEDOS_CRYPTO_PROVIDER` via `getWorkerCryptoConfig`.
 *   - The two-flag gate is evaluated with `&&`, never `||`.
 *   - A `RuntimeCryptoProvider` is NEVER constructed with `new` in this
 *     file — every provider comes from the Worker Registry's own `create()`.
 *   - This file never imports `src/runtime/runtime_crypto_registry.ts`'s
 *     `createDefaultRuntimeCryptoProviderRegistry` or
 *     `src/runtime/runtime_crypto_bridge.ts`'s `buildRuntimeCryptoProvider`
 *     — Worker resolves its own provider through its OWN registry, never
 *     Runtime's.
 *   - Never throws; never mutates its `registry`/`env` argument.
 */

import type { RuntimeCryptoProvider } from "./crypto_provider.js";
import type { FedosCryptoProviderEnvLike } from "./crypto_provider_env.js";
import { getWorkerCryptoConfig } from "./worker_crypto_config.js";
import {
  createDefaultWorkerCryptoProviderRegistry,
  WORKER_FEDOS_PROVIDER_NAME,
  WORKER_PLACEHOLDER_PROVIDER_NAME,
} from "./worker_crypto_registry.js";
import type { RuntimeCryptoProviderRegistry } from "./runtime_crypto_registry.js";

/**
 * Resolve `name` from `registry`, falling back to a fresh default Worker
 * registry's own entry if `registry` somehow lacks one — still resolved
 * via a `RuntimeCryptoProviderRegistry`, never `new`'d directly.
 */
function resolveFromWorkerRegistry(
  registry: RuntimeCryptoProviderRegistry,
  name: string,
): RuntimeCryptoProvider {
  const fromRegistry = registry.create(name);
  if (fromRegistry) return fromRegistry;
  // `registry` lacked this name (e.g. a caller supplied a bespoke,
  // not-yet-populated registry) — resolve from a fresh default Worker
  // registry instead. `createDefaultWorkerCryptoProviderRegistry()` always
  // registers both known names, so this second lookup for the SAFE
  // placeholder name is guaranteed to succeed.
  return createDefaultWorkerCryptoProviderRegistry().create(
    WORKER_PLACEHOLDER_PROVIDER_NAME,
  ) as RuntimeCryptoProvider;
}

/**
 * Resolve the `RuntimeCryptoProvider` Worker would use, if anything ever
 * called this function (nothing does, in this stage). Only resolves
 * `"fedos"` when BOTH `workerCryptoEnabled` is `true` AND
 * `workerCryptoProvider === "fedos"` — otherwise (always, in this stage)
 * resolves `"placeholder"`. No FedOS Core call exists in this function
 * regardless of which name is resolved.
 */
export function buildWorkerCryptoProvider(
  registry: RuntimeCryptoProviderRegistry = createDefaultWorkerCryptoProviderRegistry(),
  env?: FedosCryptoProviderEnvLike,
): RuntimeCryptoProvider {
  const { workerCryptoEnabled, workerCryptoProvider } = getWorkerCryptoConfig(env);
  if (workerCryptoEnabled && workerCryptoProvider === WORKER_FEDOS_PROVIDER_NAME) {
    // Unreachable in this stage: workerCryptoEnabled is permanently false
    // (Stage 273), so this branch never actually runs. Even here, only the
    // registry's own "fedos" entry (FedosRuntimeCryptoProvider, itself
    // encrypt/decrypt-Unsupported) is ever resolved — never a real core.
    return resolveFromWorkerRegistry(registry, WORKER_FEDOS_PROVIDER_NAME);
  }
  return resolveFromWorkerRegistry(registry, WORKER_PLACEHOLDER_PROVIDER_NAME);
}

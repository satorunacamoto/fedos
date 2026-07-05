/**
 * Stage 277 — Worker Crypto Activation Diagnostics (display only).
 *
 * The Worker-side counterpart of
 * `src/runtime/runtime_crypto_diagnostics.ts`'s (Stage 261/269/285)
 * `runtimeCryptoActivationStatus`. Reports a fixed, non-sensitive
 * `{ enabled, configuredProvider, effectiveProvider, reachable }` summary
 * read directly from `src/runtime/worker_crypto_config.ts`'s (Stage
 * 273/283) own config, mirroring `src/runtime/worker_crypto_bridge.ts`'s
 * (Stage 275/284) own two-flag gate for `effectiveProvider` — plus a
 * FOURTH field, `reachable`, naming whether `src/worker.ts` can actually
 * reach this boundary at all.
 *
 * Stage 285 splits the field that used to be a single `provider` into
 * `configuredProvider` (the raw PARSED config value — reflects
 * `FEDOS_CRYPTO_PROVIDER` even though `enabled` stays `false`; NEVER the
 * raw env string) and `effectiveProvider` (the same two-flag-gated
 * computation as before).
 *
 * `reachable` is fixed `false` in this stage: `src/worker.ts` does not
 * import `worker_crypto_bridge.ts`/`worker_crypto_config.ts`/
 * `worker_crypto_registry.ts` at all (see
 * `docs/runtime_worker_activation_boundary.md`), so even if
 * `workerCryptoEnabled` were hypothetically flipped, nothing in the Worker
 * would ever call this boundary. This function does not import or inspect
 * `src/worker.ts` to compute `reachable` — it is a documented, hand-fixed
 * constant, exactly as fixed as `workerCryptoEnabled` itself.
 *
 * HARD GUARDRAILS:
 *   - NO secret, key, plaintext, or ciphertext byte is ever read or displayed.
 *   - NO `encrypt()`/`decrypt()` call of any kind.
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary).
 *   - NO `process.env` reference — the OPTIONAL `env` parameter is passed
 *     straight through to `getWorkerCryptoConfig`, never read from
 *     `process.env`.
 *   - Never echoes `env`'s raw string value anywhere in its return value —
 *     only the parsed `"placeholder"`/`"fedos"` enum values ever appear.
 */

import type { FedosCryptoProviderEnvLike } from "./crypto_provider_env.js";
import type { WorkerCryptoProviderName } from "./worker_crypto_config.js";
import { getWorkerCryptoConfig } from "./worker_crypto_config.js";
import { WORKER_FEDOS_PROVIDER_NAME } from "./worker_crypto_registry.js";

/** A minimal, non-sensitive Worker activation summary. */
export interface WorkerCryptoActivationStatus {
  readonly enabled: boolean;
  /**
   * The PARSED, configured provider name (`getWorkerCryptoConfig`'s own
   * `workerCryptoProvider`) — reflects `FEDOS_CRYPTO_PROVIDER` even though
   * `enabled` stays `false`. NEVER the raw env string.
   */
  readonly configuredProvider: WorkerCryptoProviderName;
  /**
   * The EFFECTIVE provider name — mirrors
   * `src/runtime/worker_crypto_bridge.ts`'s own two-flag gate exactly.
   * Permanently `"placeholder"` in this stage, since `enabled` is
   * permanently `false`.
   */
  readonly effectiveProvider: WorkerCryptoProviderName;
  /**
   * Whether `src/worker.ts` can actually reach this boundary at all. Fixed
   * `false` in this stage — see this module's own doc comment above.
   */
  readonly reachable: boolean;
}

/**
 * Read-only Worker activation summary: `enabled` mirrors
 * `workerCryptoEnabled` (`src/runtime/worker_crypto_config.ts`) exactly —
 * permanently `false` — `configuredProvider` reports the raw PARSED
 * config value (reflecting `FEDOS_CRYPTO_PROVIDER` via `env`),
 * `effectiveProvider` reports the two-flag-gated result, and `reachable`
 * is fixed `false` (this stage's Worker never imports the Worker crypto
 * boundary at all). Accepts an OPTIONAL `env`, passed straight through to
 * `getWorkerCryptoConfig` — reads no `process.env` directly, and never
 * calls a `RuntimeCryptoProvider` method.
 */
export function workerCryptoActivationStatus(
  env?: FedosCryptoProviderEnvLike,
): WorkerCryptoActivationStatus {
  const { workerCryptoEnabled, workerCryptoProvider } = getWorkerCryptoConfig(env);
  const effectiveProvider: WorkerCryptoProviderName =
    workerCryptoEnabled && workerCryptoProvider === WORKER_FEDOS_PROVIDER_NAME
      ? WORKER_FEDOS_PROVIDER_NAME
      : "placeholder";
  return {
    enabled: workerCryptoEnabled,
    configuredProvider: workerCryptoProvider,
    effectiveProvider,
    reachable: false,
  };
}

/**
 * Stage 277 — Worker Crypto Activation Diagnostics (display only).
 *
 * The Worker-side counterpart of
 * `src/runtime/runtime_crypto_diagnostics.ts`'s (Stage 261/269)
 * `runtimeCryptoActivationStatus`. Reports a fixed, non-sensitive
 * `{ enabled, provider, reachable }` summary read directly from
 * `src/runtime/worker_crypto_config.ts`'s (Stage 273) own config, mirroring
 * `src/runtime/worker_crypto_bridge.ts`'s (Stage 275) own two-flag gate for
 * `provider` — plus a THIRD field, `reachable`, naming whether `src/worker.ts`
 * can actually reach this boundary at all.
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
 *   - Takes no parameter, reads no environment variable.
 */

import type { WorkerCryptoProviderName } from "./worker_crypto_config.js";
import { getWorkerCryptoConfig } from "./worker_crypto_config.js";
import { WORKER_FEDOS_PROVIDER_NAME } from "./worker_crypto_registry.js";

/** A minimal, non-sensitive Worker activation summary. */
export interface WorkerCryptoActivationStatus {
  readonly enabled: boolean;
  readonly provider: WorkerCryptoProviderName;
  /**
   * Whether `src/worker.ts` can actually reach this boundary at all. Fixed
   * `false` in this stage — see this module's own doc comment above.
   */
  readonly reachable: boolean;
}

/**
 * Read-only Worker activation summary: `enabled` mirrors
 * `workerCryptoEnabled` (`src/runtime/worker_crypto_config.ts`) exactly —
 * permanently `false` — `provider` reports the EFFECTIVE provider name,
 * mirroring `src/runtime/worker_crypto_bridge.ts`'s own two-flag gate, and
 * `reachable` is fixed `false` (this stage's Worker never imports the
 * Worker crypto boundary at all). Takes no parameter, reads no environment
 * variable, and never calls a `RuntimeCryptoProvider` method.
 */
export function workerCryptoActivationStatus(): WorkerCryptoActivationStatus {
  const { workerCryptoEnabled, workerCryptoProvider } = getWorkerCryptoConfig();
  const effectiveProvider: WorkerCryptoProviderName =
    workerCryptoEnabled && workerCryptoProvider === WORKER_FEDOS_PROVIDER_NAME
      ? WORKER_FEDOS_PROVIDER_NAME
      : "placeholder";
  return {
    enabled: workerCryptoEnabled,
    provider: effectiveProvider,
    reachable: false,
  };
}

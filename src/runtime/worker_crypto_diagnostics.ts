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
 *
 * Stage 291 adds `activationReason`
 * (`src/runtime/worker_crypto_activation_policy.ts`'s
 * `evaluateWorkerCryptoActivation`, Stage 290 — an INDEPENDENT
 * implementation, not shared with the Runtime policy) — WHY activation is
 * not (yet) allowed. `"Allowed"` is never displayed here.
 *
 * Stage 297 adds `configuredEnabled` — the PARSED `FEDOS_CRYPTO_ENABLED`
 * label — and passes `env` through to `evaluateWorkerCryptoActivation`
 * too, so `activationReason` now reflects the Stage 297 dual-lock
 * combination. `effectiveProvider` is DELIBERATELY UNCHANGED — still
 * mirrors ONLY `worker_crypto_bridge.ts`'s own two-flag gate, which was
 * NOT touched this stage.
 *
 * Stage 309 adds `providerImplemented` — a direct read of
 * `fedos_runtime_crypto_provider.ts`'s (Stage 305)
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`, the SAME constant
 * `evaluateWorkerCryptoActivation` itself now consults (Stage 308).
 * Fixed `false`.
 *
 * Stage 317 adds `providerImplementationState`/`providerExecutionState`/
 * `providerOperationState`, reading `fedos_runtime_crypto_provider.ts`'s
 * three standalone, pure "state" functions — no instance construction,
 * no request or secret material exposed. All three stay fixed in this
 * stage.
 *
 * Stage 325 adds `providerImplementationStage`/`opaqueApiState`/
 * `runtimeExecutionState` — see `runtime_crypto_diagnostics.ts`'s own
 * Stage 325 doc comment for the exact meaning of each.
 */

import type { FedosCryptoEnabledLabel, FedosCryptoProviderEnvLike } from "./crypto_provider_env.js";
import { parseFedosCryptoEnabledEnv } from "./crypto_provider_env.js";
import type { FedosOpaqueApiState } from "./fedos_opaque_api.js";
import { fedosOpaqueApiState } from "./fedos_opaque_api.js";
import type {
  FedosProviderDecisionReason,
  FedosProviderImplementationStage,
  FedosRuntimeExecutionState,
} from "./fedos_runtime_crypto_provider.js";
import {
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  fedosProviderExecutionState,
  fedosProviderImplementationStage,
  fedosProviderImplementationState,
  fedosProviderOperationState,
} from "./fedos_runtime_crypto_provider.js";
import type { FedosRuntimeOperationStatus } from "./fedos_runtime_operation.js";
import type { ActivationReason } from "./worker_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "./worker_crypto_activation_policy.js";
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
   * The PARSED `FEDOS_CRYPTO_ENABLED` label ("Lock #2", Stage 297) —
   * `"explicit-dev-only"` only for that exact (trimmed) env string;
   * `"disabled"` for everything else. NEVER the raw env string.
   */
  readonly configuredEnabled: FedosCryptoEnabledLabel;
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
  /**
   * WHY activation is not (yet) allowed —
   * `evaluateWorkerCryptoActivation`'s own reason
   * (`src/runtime/worker_crypto_activation_policy.ts`, Stage 290). Never
   * `"Allowed"` in this stage.
   */
  readonly activationReason: ActivationReason;
  /**
   * Whether `FedosRuntimeCryptoProvider` has a real internal
   * `encrypt`/`decrypt` implementation — a direct read of
   * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`. Fixed `false` in this stage.
   */
  readonly providerImplemented: boolean;
  /**
   * WHY `FedosRuntimeCryptoProvider.encrypt()`/`decrypt()` currently deny
   * every request — `fedosProviderImplementationState()`'s own answer.
   * Fixed `"NotImplemented"` in this stage.
   */
  readonly providerImplementationState: FedosProviderDecisionReason;
  /**
   * What `FedosRuntimeCryptoProvider.planExecution()` would resolve to
   * — `fedosProviderExecutionState()`'s own answer. Fixed
   * `"BlockedByImplementation"` in this stage.
   */
  readonly providerExecutionState: FedosRuntimeExecutionState;
  /**
   * The `FedosRuntimeOperationStatus` a planned operation would resolve
   * to — `fedosProviderOperationState()`'s own answer. Fixed `"Blocked"`
   * in this stage.
   */
  readonly providerOperationState: FedosRuntimeOperationStatus;
  /**
   * The internal architecture's own coarse milestone —
   * `fedosProviderImplementationStage()`'s own answer. Fixed
   * `"OpaqueApiReady"` in this stage.
   */
  readonly providerImplementationStage: FedosProviderImplementationStage;
  /**
   * The Opaque API's own status — `fedosOpaqueApiState()`'s own answer.
   * Fixed `"NotConnected"` in this stage.
   */
  readonly opaqueApiState: FedosOpaqueApiState;
  /**
   * Whether Worker's own execution attempt would succeed right now —
   * the SAME computation as `providerExecutionState`, exposed under a
   * second name. Fixed `"BlockedByImplementation"` in this stage.
   */
  readonly runtimeExecutionState: FedosRuntimeExecutionState;
}

/**
 * Read-only Worker activation summary: `enabled` mirrors
 * `workerCryptoEnabled` (`src/runtime/worker_crypto_config.ts`) exactly —
 * permanently `false` — `configuredProvider` reports the raw PARSED
 * config value (reflecting `FEDOS_CRYPTO_PROVIDER` via `env`),
 * `effectiveProvider` reports the two-flag-gated result, `reachable` is
 * fixed `false` (this stage's Worker never imports the Worker crypto
 * boundary at all), and `activationReason` reports WHY activation is not
 * (yet) allowed (`evaluateWorkerCryptoActivation`, Stage 290). Accepts an
 * OPTIONAL `env`, passed straight through to `getWorkerCryptoConfig` —
 * reads no `process.env` directly, and never calls a
 * `RuntimeCryptoProvider` method.
 */
export function workerCryptoActivationStatus(
  env?: FedosCryptoProviderEnvLike,
): WorkerCryptoActivationStatus {
  const config = getWorkerCryptoConfig(env);
  const { workerCryptoEnabled, workerCryptoProvider } = config;
  const effectiveProvider: WorkerCryptoProviderName =
    workerCryptoEnabled && workerCryptoProvider === WORKER_FEDOS_PROVIDER_NAME
      ? WORKER_FEDOS_PROVIDER_NAME
      : "placeholder";
  return {
    enabled: workerCryptoEnabled,
    configuredProvider: workerCryptoProvider,
    configuredEnabled: parseFedosCryptoEnabledEnv(env?.FEDOS_CRYPTO_ENABLED),
    effectiveProvider,
    reachable: false,
    activationReason: evaluateWorkerCryptoActivation(config, env).reason,
    providerImplemented: FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
    providerImplementationState: fedosProviderImplementationState(),
    providerExecutionState: fedosProviderExecutionState(),
    providerOperationState: fedosProviderOperationState(),
    providerImplementationStage: fedosProviderImplementationStage(),
    opaqueApiState: fedosOpaqueApiState(),
    runtimeExecutionState: fedosProviderExecutionState(),
  };
}

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
 *
 * Stage 333 adds `rustBoundaryState`/`rustBoundaryReachable` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 333 doc comment.
 *
 * Stage 341 adds `rustApiState`/`rustApiReachable` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 341 doc comment.
 * `providerImplementationStage` now reflects the extended six-step
 * milestone, fixed at `"RustApiReady"`.
 *
 * Stage 349 adds `rustExecutionReviewState`/`rustExecutionReviewReason`/
 * `rustExecutionApproved` — see `runtime_crypto_diagnostics.ts`'s own
 * Stage 349 doc comment. `providerImplementationStage` is unaffected —
 * the Execution Review is a permission layer, not an architecture
 * milestone.
 *
 * Stage 357 adds `internalRustCallState`/`internalRustCallReachable` —
 * see `runtime_crypto_diagnostics.ts`'s own Stage 357 doc comment.
 *
 * Stage 365 adds `rustInvocationAdapterState`/`rustInvocationAdapterReachable`/
 * `rustInvocationAdapterExecuted` — see `runtime_crypto_diagnostics.ts`'s
 * own Stage 365 doc comment. `providerImplementationStage` now reflects
 * the extended seven-step milestone, fixed at
 * `"RustInvocationAdapterReady"`.
 *
 * Stage 372 adds `rustPingReachable`/`rustPingExecuted` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 372 doc comment.
 *
 * Stage 377/379 flips `rustPingExecuted` to fixed `true` and adds
 * `rustPingSucceeded` — see `runtime_crypto_diagnostics.ts`'s own
 * Stage 377/379 doc comment.
 *
 * Stage 388 adds `wasmBoundaryState`/`wasmBoundaryReachable`/
 * `wasmLoaded` — see `runtime_crypto_diagnostics.ts`'s own Stage 388
 * doc comment.
 *
 * Stage 396 adds `wasmArtifactState`/`wasmArtifactReachable`/
 * `wasmArtifactBuilt` — see `runtime_crypto_diagnostics.ts`'s own
 * Stage 396 doc comment.
 *
 * Stage 404 adds `executionBackend`/`executionBackendState`/
 * `executionBackendReachable`/`backendImplemented` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 404 doc comment. Fixed
 * `"Wasm"`/`"Planning"`/`true`/`false` respectively.
 *
 * Stage 420 adds `wasmToolchainInstalled`/`wasmToolchainVerified`/
 * `wasmBuildReady` — see `runtime_crypto_diagnostics.ts`'s own Stage
 * 420 doc comment. All three fixed `false`; unlike every other field
 * here, `fedos_wasm_toolchain.ts` is NOT structurally wired into the
 * Runtime -> Rust chain (no `reachable` field is added for it).
 *
 * Stage 453 adds `wasmArtifactGenerated`/`generatedArtifactPath` —
 * see `runtime_crypto_diagnostics.ts`'s own Stage 453 doc comment.
 * Fixed `false`/`null` respectively.
 */

import type { FedosCryptoEnabledLabel, FedosCryptoProviderEnvLike } from "./crypto_provider_env.js";
import { parseFedosCryptoEnabledEnv } from "./crypto_provider_env.js";
import type { FedosInternalRustCallStatus } from "./fedos_internal_rust_call.js";
import { fedosInternalRustCallReachable, fedosInternalRustCallState } from "./fedos_internal_rust_call.js";
import type { FedosOpaqueApiState } from "./fedos_opaque_api.js";
import { fedosOpaqueApiState } from "./fedos_opaque_api.js";
import type {
  FedosProviderDecisionReason,
  FedosProviderImplementationStage,
  FedosRuntimeExecutionState,
} from "./fedos_runtime_crypto_provider.js";
import type { FedosRustApiState } from "./fedos_rust_api.js";
import { fedosRustApiReachable, fedosRustApiState } from "./fedos_rust_api.js";
import type { FedosRustBoundaryState } from "./fedos_rust_boundary.js";
import { fedosRustBoundaryReachable, fedosRustBoundaryState } from "./fedos_rust_boundary.js";
import type { FedosRustExecutionReviewReason, FedosRustExecutionReviewState } from "./fedos_rust_execution_review.js";
import {
  fedosRustExecutionApproved,
  fedosRustExecutionReviewReason,
  fedosRustExecutionReviewState,
} from "./fedos_rust_execution_review.js";
import type { FedosRustInvocationAdapterState } from "./fedos_rust_invocation_adapter.js";
import {
  fedosRustInvocationAdapterExecuted,
  fedosRustInvocationAdapterReachable,
  fedosRustInvocationAdapterState,
  fedosRustPingExecuted,
  fedosRustPingReachable,
  fedosRustPingSucceeded,
} from "./fedos_rust_invocation_adapter.js";
import type { FedosExecutionBackendKind, FedosExecutionBackendState } from "./fedos_execution_backend.js";
import {
  fedosExecutionBackendImplemented,
  fedosExecutionBackendKind,
  fedosExecutionBackendReachable,
  fedosExecutionBackendState,
} from "./fedos_execution_backend.js";
import type { FedosWasmArtifactState } from "./fedos_wasm_artifact.js";
import {
  fedosGeneratedArtifactPath,
  fedosWasmArtifactBuilt,
  fedosWasmArtifactGenerated,
  fedosWasmArtifactReachable,
  fedosWasmArtifactState,
} from "./fedos_wasm_artifact.js";
import type { FedosWasmBoundaryState } from "./fedos_wasm_boundary.js";
import { fedosWasmBoundaryReachable, fedosWasmBoundaryState, fedosWasmLoaded } from "./fedos_wasm_boundary.js";
import {
  fedosWasmBuildReady,
  fedosWasmToolchainInstalled,
  fedosWasmToolchainVerified,
} from "./fedos_wasm_toolchain.js";
import type { FedosLoaderImportMode, FedosWasmLoaderState } from "./fedos_wasm_loader_contract.js";
import {
  loaderImportMode as fedosLoaderImportMode,
  loaderInitialized as fedosLoaderInitialized,
  wasmLoaderState as fedosWasmLoaderState,
} from "./fedos_wasm_loader_contract.js";
import type {
  FedosWasmLoaderMode,
  FedosWasmLoaderPolicy,
  FedosWasmLoaderState as FedosWasmLoaderSkeletonState,
} from "./fedos_wasm_loader.js";
import {
  loaderMode as fedosLoaderSkeletonMode,
  loaderPolicy as fedosLoaderSkeletonPolicy,
  loaderState as fedosLoaderSkeletonState,
} from "./fedos_wasm_loader.js";
import type { FedosWasmLoaderPlanState } from "./fedos_wasm_loader_plan.js";
import {
  loaderImportAllowed as fedosLoaderImportAllowed,
  loaderInitializationAllowed as fedosLoaderInitializationAllowed,
  loaderPlanState as fedosLoaderPlanState,
} from "./fedos_wasm_loader_plan.js";
import type {
  FedosWasmLoaderImportReason,
  FedosWasmLoaderImportPolicyState,
} from "./fedos_wasm_loader_import_policy.js";
import {
  evaluateWasmLoaderImportPolicy,
  wasmLoaderImportPolicyState as fedosWasmLoaderImportPolicyState,
} from "./fedos_wasm_loader_import_policy.js";
import type { FedosWasmStaticImportState } from "./fedos_wasm_static_import_plan.js";
import {
  staticImportAllowed as fedosStaticImportAllowed,
  staticImportPlanState as fedosStaticImportPlanState,
  staticImportTarget as fedosStaticImportTarget,
} from "./fedos_wasm_static_import_plan.js";
import type {
  FedosWasmStaticImportReviewReason,
  FedosWasmStaticImportReviewState,
} from "./fedos_wasm_static_import_review.js";
import {
  staticImportReviewApproved as fedosStaticImportReviewApproved,
  staticImportReviewReason as fedosStaticImportReviewReason,
  staticImportReviewState as fedosStaticImportReviewState,
} from "./fedos_wasm_static_import_review.js";
import type {
  FedosWasmStaticImportReadinessReason,
  FedosWasmStaticImportReadinessState,
} from "./fedos_wasm_static_import_readiness.js";
import {
  staticImportReadinessReason as fedosStaticImportReadinessReason,
  staticImportReadinessState as fedosStaticImportReadinessState,
  staticImportReady as fedosStaticImportReady,
} from "./fedos_wasm_static_import_readiness.js";
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
   * `"RustInvocationAdapterReady"` in this stage.
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
  /**
   * The Rust Boundary's own status — `fedosRustBoundaryState()`'s own
   * answer. Fixed `"NotConnected"` in this stage.
   */
  readonly rustBoundaryState: FedosRustBoundaryState;
  /**
   * Whether the Rust Boundary is structurally reachable from the
   * Opaque API's own internal chain — `fedosRustBoundaryReachable()`'s
   * own answer. Fixed `true` in this stage, NOT a claim that real Rust
   * crypto executes.
   */
  readonly rustBoundaryReachable: boolean;
  /**
   * The Rust API's own status — `fedosRustApiState()`'s own answer.
   * Fixed `"NotConnected"` in this stage.
   */
  readonly rustApiState: FedosRustApiState;
  /**
   * Whether the Rust API is structurally reachable from the Rust
   * Boundary's own internal chain — `fedosRustApiReachable()`'s own
   * answer. Fixed `true` in this stage, NOT a claim that real Rust
   * crypto executes.
   */
  readonly rustApiReachable: boolean;
  /**
   * The Execution Review's own status — `fedosRustExecutionReviewState()`'s
   * own answer. Fixed `"Blocked"` in this stage.
   */
  readonly rustExecutionReviewState: FedosRustExecutionReviewState;
  /**
   * WHY execution has not (yet) been approved —
   * `fedosRustExecutionReviewReason()`'s own answer. Fixed
   * `"BlockedBeforeCrypto"` in this stage.
   */
  readonly rustExecutionReviewReason: FedosRustExecutionReviewReason;
  /**
   * Whether real Rust execution has been approved —
   * `fedosRustExecutionApproved()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly rustExecutionApproved: boolean;
  /**
   * The Internal Rust Call plan's own status —
   * `fedosInternalRustCallState()`'s own answer. Fixed `"Planned"` in
   * this stage.
   */
  readonly internalRustCallState: FedosInternalRustCallStatus;
  /**
   * Whether the Internal Rust Call plan is structurally reachable from
   * the Execution Review's own internal chain —
   * `fedosInternalRustCallReachable()`'s own answer. Fixed `true` in
   * this stage, NOT a claim that any call has ever executed.
   */
  readonly internalRustCallReachable: boolean;
  /**
   * The Rust Invocation Adapter's own status —
   * `fedosRustInvocationAdapterState()`'s own answer. Fixed
   * `"NotConnected"` in this stage.
   */
  readonly rustInvocationAdapterState: FedosRustInvocationAdapterState;
  /**
   * Whether the Rust Invocation Adapter is structurally reachable from
   * the Internal Rust Call's own internal chain —
   * `fedosRustInvocationAdapterReachable()`'s own answer. Fixed `true`
   * in this stage.
   */
  readonly rustInvocationAdapterReachable: boolean;
  /**
   * Whether the Rust Invocation Adapter has ever actually executed
   * real Rust crypto — `fedosRustInvocationAdapterExecuted()`'s own
   * answer. Fixed `false` in this stage.
   */
  readonly rustInvocationAdapterExecuted: boolean;
  /**
   * Whether `FedosRustInvocationAdapter.planPing()` is structurally
   * reachable — `fedosRustPingReachable()`'s own answer. Fixed `true`
   * in this stage.
   */
  readonly rustPingReachable: boolean;
  /**
   * Whether `planPing()` has reached `fedos_runtime_ping_internal()`'s
   * own contract via its TypeScript-side mirror —
   * `fedosRustPingExecuted()`'s own answer. Fixed `true` in this
   * stage. This does NOT claim a literal WASM/FFI/native-addon call
   * occurred — see `docs/runtime_first_rust_ping_execution.md`.
   */
  readonly rustPingExecuted: boolean;
  /**
   * Whether the ping, once executed, reported success —
   * `fedosRustPingSucceeded()`'s own answer. Fixed `true` in this
   * stage.
   */
  readonly rustPingSucceeded: boolean;
  /**
   * The WASM Boundary's own status — `fedosWasmBoundaryState()`'s own
   * answer. Fixed `"NotLoaded"` in this stage.
   */
  readonly wasmBoundaryState: FedosWasmBoundaryState;
  /**
   * Whether the WASM Boundary is structurally reachable from the Rust
   * Invocation Adapter's own internal chain —
   * `fedosWasmBoundaryReachable()`'s own answer. Fixed `true` in this
   * stage.
   */
  readonly wasmBoundaryReachable: boolean;
  /**
   * Whether a real WASM module has ever actually been loaded —
   * `fedosWasmLoaded()`'s own answer. Fixed `false` in this stage.
   */
  readonly wasmLoaded: boolean;
  /**
   * The WASM Artifact's own status — `fedosWasmArtifactState()`'s own
   * answer. Fixed `"NotBuilt"` in this stage.
   */
  readonly wasmArtifactState: FedosWasmArtifactState;
  /**
   * Whether the WASM Artifact is structurally reachable from the WASM
   * Boundary's own internal chain — `fedosWasmArtifactReachable()`'s
   * own answer. Fixed `true` in this stage.
   */
  readonly wasmArtifactReachable: boolean;
  /**
   * Whether a real WASM artifact has ever actually been built —
   * `fedosWasmArtifactBuilt()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly wasmArtifactBuilt: boolean;
  /**
   * The Execution Backend's own candidate kind —
   * `fedosExecutionBackendKind()`'s own answer. Fixed `"Wasm"` in this
   * stage.
   */
  readonly executionBackend: FedosExecutionBackendKind;
  /**
   * The Execution Backend's own decision state —
   * `fedosExecutionBackendState()`'s own answer. Fixed `"Planning"` in
   * this stage.
   */
  readonly executionBackendState: FedosExecutionBackendState;
  /**
   * Whether the Execution Backend is structurally reachable from the
   * Rust Invocation Adapter's own internal chain —
   * `fedosExecutionBackendReachable()`'s own answer. Fixed `true` in
   * this stage.
   */
  readonly executionBackendReachable: boolean;
  /**
   * Whether ANY Execution Backend candidate has ever actually been
   * implemented and connected — `fedosExecutionBackendImplemented()`'s
   * own answer. Fixed `false` in this stage.
   */
  readonly backendImplemented: boolean;
  /**
   * Whether the WASM toolchain has ever actually been installed —
   * `fedosWasmToolchainInstalled()`'s own answer
   * (`src/runtime/fedos_wasm_toolchain.ts`, Stage 419/420). Fixed
   * `false` in this stage.
   */
  readonly wasmToolchainInstalled: boolean;
  /**
   * Whether the WASM toolchain has ever actually been verified —
   * `fedosWasmToolchainVerified()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly wasmToolchainVerified: boolean;
  /**
   * Whether a real WASM build is ready to be attempted —
   * `fedosWasmBuildReady()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly wasmBuildReady: boolean;
  /**
   * Whether a real `.wasm` + JS glue pair has ever actually been
   * generated on disk — `fedosWasmArtifactGenerated()`'s own answer
   * (Stage 452/453). Fixed `false` in this stage.
   */
  readonly wasmArtifactGenerated: boolean;
  /**
   * The filesystem path a generated artifact would live at, IF one
   * had ever been generated — `fedosGeneratedArtifactPath()`'s own
   * answer. Fixed `null` in this stage.
   */
  readonly generatedArtifactPath: string | null;
  /**
   * The generated JS glue loader's own fixed state —
   * `wasmLoaderState()`'s own answer (`fedos_wasm_loader_contract.ts`,
   * Stage 482/483). Fixed `"NotLoaded"` in this stage — no loader has
   * ever run.
   */
  readonly loaderContractState: FedosWasmLoaderState;
  /**
   * The generated JS glue loader's planned import mode —
   * `loaderImportMode()`'s own answer. Fixed `"StaticPlanning"` — no
   * real import-mode decision has been made.
   */
  readonly loaderImportMode: FedosLoaderImportMode;
  /**
   * Whether the generated JS glue has ever actually been initialized
   * — `loaderInitialized()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly loaderInitialized: boolean;
  /**
   * The Loader Skeleton's own fixed state —
   * `loaderState()`'s own answer (`src/runtime/fedos_wasm_loader.ts`,
   * Stage 489/495) — DISTINCT from `loaderContractState` above (a
   * separate, deliberately unwired file). Fixed `"NotLoaded"` in this
   * stage — no loader has ever run.
   */
  readonly loaderSkeletonState: FedosWasmLoaderSkeletonState;
  /**
   * The Loader Skeleton's own fixed operating mode —
   * `loaderMode()`'s own answer. Fixed `"PlanningOnly"` — this stage
   * only ever plans an operation, never performs one.
   */
  readonly loaderSkeletonMode: FedosWasmLoaderMode;
  /**
   * The Loader Skeleton's own fixed fail-safety policy —
   * `loaderPolicy()`'s own answer. Fixed `"FailClosed"` — every
   * planned operation (`planLoad`/`planInitialize`/`planUnload`) is
   * denied by policy.
   */
  readonly loaderSkeletonPolicy: FedosWasmLoaderPolicy;
  /**
   * The Loader Plan's own fixed coarse mode —
   * `loaderPlanState()`'s own answer (`src/runtime/fedos_wasm_loader_plan.ts`,
   * Stage 502/504). Fixed `"PlanningOnly"` in this stage — this file
   * only ever plans an operation, never performs one.
   */
  readonly loaderPlanState: FedosWasmLoaderPlanState;
  /**
   * Whether phase #2 (Import Permission,
   * `docs/runtime_wasm_loader_planning.md`) is currently granted —
   * `loaderImportAllowed()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly loaderImportAllowed: boolean;
  /**
   * Whether phase #3 (Initialization Permission) is currently
   * granted — `loaderInitializationAllowed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly loaderInitializationAllowed: boolean;
  /**
   * The Import Policy's own fixed coarse state —
   * `wasmLoaderImportPolicyState()`'s own answer
   * (`src/runtime/fedos_wasm_loader_import_policy.ts`, Stage
   * 510/512). Fixed `"Blocked"` in this stage.
   */
  readonly loaderImportPolicyState: FedosWasmLoaderImportPolicyState;
  /**
   * Whether the generated JS glue may be `import`ed right now —
   * `evaluateWasmLoaderImportPolicy()`'s own `allowed` answer. Fixed
   * `false` in this stage.
   */
  readonly loaderImportPolicyAllowed: boolean;
  /**
   * WHY the generated JS glue may not be `import`ed right now —
   * `evaluateWasmLoaderImportPolicy()`'s own `reason` answer. Fixed
   * `"BlockedByPolicy"` in this stage.
   */
  readonly loaderImportPolicyReason: FedosWasmLoaderImportReason;
  /**
   * The Static Import Plan's own fixed coarse mode —
   * `staticImportPlanState()`'s own answer
   * (`src/runtime/fedos_wasm_static_import_plan.ts`, Stage 518/520).
   * Fixed `"PlanningOnly"` in this stage — this file only ever plans
   * an import, never performs one.
   */
  readonly staticImportPlanState: FedosWasmStaticImportState;
  /**
   * The exact path a future static import would target —
   * `staticImportTarget()`'s own answer. Fixed
   * `"packages/fedos-core-rust/pkg/fedos_core_rust.js"` in this
   * stage; a plain string label, never resolved against a real path.
   */
  readonly staticImportTarget: string;
  /**
   * Whether the static import is currently allowed —
   * `staticImportAllowed()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly staticImportAllowed: boolean;
  /**
   * The Static Import Safety Review's own fixed coarse state —
   * `staticImportReviewState()`'s own answer
   * (`src/runtime/fedos_wasm_static_import_review.ts`, Stage 526/528).
   * Fixed `"ReviewedAndBlocked"` in this stage.
   */
  readonly staticImportReviewState: FedosWasmStaticImportReviewState;
  /**
   * Whether the static import is currently approved by the Safety
   * Review — `staticImportReviewApproved()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly staticImportReviewApproved: boolean;
  /**
   * WHY the static import is not currently approved —
   * `staticImportReviewReason()`'s own answer. Fixed
   * `"GeneratedArtifactNotCommitted"` in this stage.
   */
  readonly staticImportReviewReason: FedosWasmStaticImportReviewReason;
  /**
   * The Static Import Readiness record's own fixed coarse state —
   * `staticImportReadinessState()`'s own answer
   * (`src/runtime/fedos_wasm_static_import_readiness.ts`, Stage
   * 534/536). Fixed `"PlanningOnly"` in this stage.
   */
  readonly readinessState: FedosWasmStaticImportReadinessState;
  /**
   * Whether the static import is currently ready to run —
   * `staticImportReady()`'s own answer. Fixed `false` in this stage.
   */
  readonly staticImportReady: boolean;
  /**
   * WHY the static import is not currently ready —
   * `staticImportReadinessReason()`'s own answer. Fixed
   * `"RuntimeNotReady"` in this stage.
   */
  readonly staticImportReadinessReason: FedosWasmStaticImportReadinessReason;
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
    rustBoundaryState: fedosRustBoundaryState(),
    rustBoundaryReachable: fedosRustBoundaryReachable(),
    rustApiState: fedosRustApiState(),
    rustApiReachable: fedosRustApiReachable(),
    rustExecutionReviewState: fedosRustExecutionReviewState(),
    rustExecutionReviewReason: fedosRustExecutionReviewReason(),
    rustExecutionApproved: fedosRustExecutionApproved(),
    internalRustCallState: fedosInternalRustCallState(),
    internalRustCallReachable: fedosInternalRustCallReachable(),
    rustInvocationAdapterState: fedosRustInvocationAdapterState(),
    rustInvocationAdapterReachable: fedosRustInvocationAdapterReachable(),
    rustInvocationAdapterExecuted: fedosRustInvocationAdapterExecuted(),
    rustPingReachable: fedosRustPingReachable(),
    rustPingExecuted: fedosRustPingExecuted(),
    rustPingSucceeded: fedosRustPingSucceeded(),
    wasmBoundaryState: fedosWasmBoundaryState(),
    wasmBoundaryReachable: fedosWasmBoundaryReachable(),
    wasmLoaded: fedosWasmLoaded(),
    wasmArtifactState: fedosWasmArtifactState(),
    wasmArtifactReachable: fedosWasmArtifactReachable(),
    wasmArtifactBuilt: fedosWasmArtifactBuilt(),
    executionBackend: fedosExecutionBackendKind(),
    executionBackendState: fedosExecutionBackendState(),
    executionBackendReachable: fedosExecutionBackendReachable(),
    backendImplemented: fedosExecutionBackendImplemented(),
    wasmToolchainInstalled: fedosWasmToolchainInstalled(),
    wasmToolchainVerified: fedosWasmToolchainVerified(),
    wasmBuildReady: fedosWasmBuildReady(),
    wasmArtifactGenerated: fedosWasmArtifactGenerated(),
    generatedArtifactPath: fedosGeneratedArtifactPath(),
    loaderContractState: fedosWasmLoaderState(),
    loaderImportMode: fedosLoaderImportMode(),
    loaderInitialized: fedosLoaderInitialized(),
    loaderSkeletonState: fedosLoaderSkeletonState(),
    loaderSkeletonMode: fedosLoaderSkeletonMode(),
    loaderSkeletonPolicy: fedosLoaderSkeletonPolicy(),
    loaderPlanState: fedosLoaderPlanState(),
    loaderImportAllowed: fedosLoaderImportAllowed(),
    loaderInitializationAllowed: fedosLoaderInitializationAllowed(),
    loaderImportPolicyState: fedosWasmLoaderImportPolicyState(),
    loaderImportPolicyAllowed: evaluateWasmLoaderImportPolicy().allowed,
    loaderImportPolicyReason: evaluateWasmLoaderImportPolicy().reason,
    staticImportPlanState: fedosStaticImportPlanState(),
    staticImportTarget: fedosStaticImportTarget(),
    staticImportAllowed: fedosStaticImportAllowed(),
    staticImportReviewState: fedosStaticImportReviewState(),
    staticImportReviewApproved: fedosStaticImportReviewApproved(),
    staticImportReviewReason: fedosStaticImportReviewReason(),
    readinessState: fedosStaticImportReadinessState(),
    staticImportReady: fedosStaticImportReady(),
    staticImportReadinessReason: fedosStaticImportReadinessReason(),
  };
}

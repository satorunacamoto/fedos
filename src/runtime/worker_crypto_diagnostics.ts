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
 *
 * Stage 588 adds `cryptoInitializationMode`/`cryptoInitializationAllowed`/
 * `cryptoInitialized`/`cryptoInitializationReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 588 doc comment. Fixed
 * `"ExplicitInitialization"`/`false`/`false`/
 * `"InitializationApprovalPending"` respectively.
 *
 * Stage 596 adds `cryptoLoaderFacadeState`/`cryptoLoaderFacadeBackend`/
 * `cryptoLoaderFacadeInitialized`/`cryptoLoaderFacadeReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 596 doc comment. Fixed
 * `"PlanningOnly"`/`"WasmPlanned"`/`false`/
 * `"FacadeInitializationPending"` respectively.
 *
 * Stage 604 adds `providerFacadeBoundaryState`/`providerFacadeConnected`/
 * `providerFacadeReason` — see `runtime_crypto_diagnostics.ts`'s own
 * Stage 604 doc comment. Fixed `"PlanningOnly"`/`false`/
 * `"ProviderFacadeConnectionPending"` respectively.
 *
 * Stage 612 adds `providerInitializationRequestState`/
 * `providerInitializationRequested`/`providerInitializationAllowed`/
 * `providerInitializationReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 612 doc comment. Fixed
 * `"PlanningOnly"`/`false`/`false`/
 * `"ProviderInitializationRequestPending"` respectively.
 *
 * Stage 620 adds `providerInitializationApprovalState`/
 * `providerInitializationApproved`/
 * `providerInitializationApprovalReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 620 doc comment. Fixed
 * `"PlanningOnly"`/`false`/`"ProviderInitializationApprovalPending"`
 * respectively.
 *
 * Stage 628 adds `providerInitFacadeContractState`/
 * `providerInitFacadeContractReady`/`providerInitFacadeContractReason`
 * — see `runtime_crypto_diagnostics.ts`'s own Stage 628 doc comment.
 * Fixed `"PlanningOnly"`/`false`/`"ProviderInitFacadeContractPending"`
 * respectively.
 *
 * Stage 636 adds `initializeCryptoApiState`/`initializeCryptoCallable`/
 * `initializeCryptoInitialized`/`initializeCryptoReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 636 doc comment. Fixed
 * `"PlanningOnly"`/`false`/`false`/`"InitializeCryptoApiPending"`
 * respectively.
 *
 * Stage 644 adds `cryptoInitializationResultState`/
 * `cryptoInitializationSuccess`/`cryptoInitializationBackend`/
 * `cryptoInitializationResultReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 644 doc comment. Fixed
 * `"PlanningOnly"`/`false`/`"None"`/`"InitializationResultPending"`
 * respectively.
 *
 * Stage 652 adds `initializeCryptoExposureState`/
 * `initializeCryptoExposed`/`initializeCryptoExposureApproved`/
 * `initializeCryptoExposureReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 652 doc comment. Fixed
 * `"PlanningOnly"`/`false`/`false`/`"RuntimeExposureReviewPending"`
 * respectively.
 *
 * Stage 660 adds `initializeCryptoWiringPlanState`/
 * `initializeCryptoRuntimeWiringAllowed`/
 * `initializeCryptoWorkerWiringAllowed`/
 * `initializeCryptoWiringPlanReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 660 doc comment. Fixed
 * `"PlanningOnly"`/`false`/`false`/`"RuntimeWiringPlanPending"`
 * respectively.
 *
 * Stage 668 adds `initializeCryptoPublicApiState`/
 * `initializeCryptoApiVisible`/`initializeCryptoPublicApiCallable`/
 * `initializeCryptoPublicApiReason` — see
 * `runtime_crypto_diagnostics.ts`'s own Stage 668 doc comment
 * (including the deliberate naming distinction from
 * `initializeCryptoCallable`). Fixed `"PlanningOnly"`/`false`/
 * `false`/`"PublicApiPending"` respectively.
 *
 * Stage 676 adds `initializeCryptoInvocationState`/
 * `initializeCryptoInvocationAllowed`/
 * `initializeCryptoInvocationCompleted`/`initializeCryptoInvocationReason`
 * — see `runtime_crypto_diagnostics.ts`'s own Stage 676 doc comment.
 * Fixed `"PlanningOnly"`/`false`/`false`/`"InvocationContractPending"`
 * respectively.
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
import type {
  FedosGeneratedArtifactPresenceReason,
  FedosGeneratedArtifactPresenceState,
} from "./fedos_generated_artifact_presence.js";
import {
  artifactPresenceReason as fedosArtifactPresenceReason,
  artifactPresenceState as fedosArtifactPresenceState,
  artifactPresent as fedosArtifactPresent,
} from "./fedos_generated_artifact_presence.js";
import type {
  FedosStaticImportActivationReason,
  FedosStaticImportActivationState,
} from "./fedos_static_import_activation_review.js";
import {
  staticImportActivationApproved as fedosStaticImportActivationApproved,
  staticImportActivationReason as fedosStaticImportActivationReason,
  staticImportActivationState as fedosStaticImportActivationState,
} from "./fedos_static_import_activation_review.js";
import type { FedosGeneratedArtifactDistributionMode } from "./fedos_generated_artifact_distribution.js";
import {
  generatedArtifactCommitted as fedosGeneratedArtifactCommitted,
  generatedArtifactDistributionMode as fedosGeneratedArtifactDistributionMode,
  staticImportSafe as fedosStaticImportSafe,
} from "./fedos_generated_artifact_distribution.js";
import type { FedosBuildTimeLoaderStrategyKind } from "./fedos_build_time_loader_strategy.js";
import {
  buildTimeLoaderRequiresPrebuild as fedosBuildTimeLoaderRequiresPrebuild,
  buildTimeLoaderRuntimeAttachAllowed as fedosBuildTimeLoaderRuntimeAttachAllowed,
  buildTimeLoaderStrategy as fedosBuildTimeLoaderStrategy,
} from "./fedos_build_time_loader_strategy.js";
import type {
  FedosDynamicLoaderGateReason,
  FedosDynamicLoaderGateState,
} from "./fedos_dynamic_loader_gate.js";
import {
  dynamicLoaderAllowed as fedosDynamicLoaderAllowed,
  dynamicLoaderGateReason as fedosDynamicLoaderGateReason,
  dynamicLoaderGateState as fedosDynamicLoaderGateState,
} from "./fedos_dynamic_loader_gate.js";
import type {
  FedosDynamicLoaderDevApprovalReason,
  FedosDynamicLoaderDevApprovalState,
} from "./fedos_dynamic_loader_dev_approval.js";
import {
  dynamicLoaderDevApprovalState as fedosDynamicLoaderDevApprovalState,
  dynamicLoaderDevApproved as fedosDynamicLoaderDevApproved,
  dynamicLoaderDevReason as fedosDynamicLoaderDevReason,
} from "./fedos_dynamic_loader_dev_approval.js";
import type {
  FedosCryptoInitializationMode,
  FedosCryptoInitializationReason,
} from "./fedos_explicit_crypto_initialization.js";
import {
  cryptoInitializationAllowed as fedosCryptoInitializationAllowed,
  cryptoInitializationMode as fedosCryptoInitializationMode,
  cryptoInitializationReason as fedosCryptoInitializationReason,
  cryptoInitialized as fedosCryptoInitialized,
} from "./fedos_explicit_crypto_initialization.js";
import type {
  FedosCryptoLoaderFacadeBackend,
  FedosCryptoLoaderFacadeReason,
  FedosCryptoLoaderFacadeState,
} from "./fedos_crypto_loader_facade.js";
import {
  cryptoLoaderFacadeBackend as fedosCryptoLoaderFacadeBackend,
  cryptoLoaderFacadeInitialized as fedosCryptoLoaderFacadeInitialized,
  cryptoLoaderFacadeReason as fedosCryptoLoaderFacadeReason,
  cryptoLoaderFacadeState as fedosCryptoLoaderFacadeState,
} from "./fedos_crypto_loader_facade.js";
import type {
  FedosCryptoProviderFacadeBoundaryReason,
  FedosCryptoProviderFacadeBoundaryState,
} from "./fedos_crypto_provider_facade_boundary.js";
import {
  providerFacadeBoundaryState as fedosProviderFacadeBoundaryState,
  providerFacadeConnected as fedosProviderFacadeConnected,
  providerFacadeReason as fedosProviderFacadeReason,
} from "./fedos_crypto_provider_facade_boundary.js";
import type {
  FedosCryptoProviderInitializationRequestReason,
  FedosCryptoProviderInitializationRequestState,
} from "./fedos_crypto_provider_initialization_request.js";
import {
  providerInitializationAllowed as fedosProviderInitializationAllowed,
  providerInitializationReason as fedosProviderInitializationReason,
  providerInitializationRequested as fedosProviderInitializationRequested,
  providerInitializationRequestState as fedosProviderInitializationRequestState,
} from "./fedos_crypto_provider_initialization_request.js";
import type {
  FedosProviderInitializationApprovalReason,
  FedosProviderInitializationApprovalState,
} from "./fedos_provider_initialization_approval.js";
import {
  providerInitializationApproved as fedosProviderInitializationApproved,
  providerInitializationApprovalReason as fedosProviderInitializationApprovalReason,
  providerInitializationApprovalState as fedosProviderInitializationApprovalState,
} from "./fedos_provider_initialization_approval.js";
import type {
  FedosProviderInitFacadeContractReason,
  FedosProviderInitFacadeContractState,
} from "./fedos_provider_init_facade_contract.js";
import {
  providerInitFacadeContractReady as fedosProviderInitFacadeContractReady,
  providerInitFacadeContractReason as fedosProviderInitFacadeContractReason,
  providerInitFacadeContractState as fedosProviderInitFacadeContractState,
} from "./fedos_provider_init_facade_contract.js";
import type {
  FedosInitializeCryptoApiContractReason,
  FedosInitializeCryptoApiContractState,
} from "./fedos_initialize_crypto_api_contract.js";
import {
  initializeCryptoApiState as fedosInitializeCryptoApiState,
  initializeCryptoCallable as fedosInitializeCryptoCallable,
  initializeCryptoInitialized as fedosInitializeCryptoInitialized,
  initializeCryptoReason as fedosInitializeCryptoReason,
} from "./fedos_initialize_crypto_api_contract.js";
import type {
  FedosCryptoInitializationResultBackend,
  FedosCryptoInitializationResultReason,
  FedosCryptoInitializationResultState,
} from "./fedos_crypto_initialization_result.js";
import {
  cryptoInitializationBackend as fedosCryptoInitializationBackend,
  cryptoInitializationResultReason as fedosCryptoInitializationResultReason,
  cryptoInitializationResultState as fedosCryptoInitializationResultState,
  cryptoInitializationSuccess as fedosCryptoInitializationSuccess,
} from "./fedos_crypto_initialization_result.js";
import type {
  FedosInitializeCryptoExposureReviewReason,
  FedosInitializeCryptoExposureReviewState,
} from "./fedos_initialize_crypto_exposure_review.js";
import {
  initializeCryptoExposed as fedosInitializeCryptoExposed,
  initializeCryptoExposureApproved as fedosInitializeCryptoExposureApproved,
  initializeCryptoExposureReason as fedosInitializeCryptoExposureReason,
  initializeCryptoExposureState as fedosInitializeCryptoExposureState,
} from "./fedos_initialize_crypto_exposure_review.js";
import type {
  FedosInitializeCryptoWiringPlanReason,
  FedosInitializeCryptoWiringPlanState,
} from "./fedos_initialize_crypto_wiring_plan.js";
import {
  initializeCryptoRuntimeWiringAllowed as fedosInitializeCryptoRuntimeWiringAllowed,
  initializeCryptoWiringPlanReason as fedosInitializeCryptoWiringPlanReason,
  initializeCryptoWiringPlanState as fedosInitializeCryptoWiringPlanState,
  initializeCryptoWorkerWiringAllowed as fedosInitializeCryptoWorkerWiringAllowed,
} from "./fedos_initialize_crypto_wiring_plan.js";
import type {
  FedosInitializeCryptoPublicApiReason,
  FedosInitializeCryptoPublicApiState,
} from "./fedos_initialize_crypto_public_api.js";
import {
  initializeCryptoApiVisible as fedosInitializeCryptoApiVisible,
  initializeCryptoPublicApiCallable as fedosInitializeCryptoPublicApiCallable,
  initializeCryptoPublicApiReason as fedosInitializeCryptoPublicApiReason,
  initializeCryptoPublicApiState as fedosInitializeCryptoPublicApiState,
} from "./fedos_initialize_crypto_public_api.js";
import type {
  FedosInitializeCryptoInvocationContractReason,
  FedosInitializeCryptoInvocationContractState,
} from "./fedos_initialize_crypto_invocation_contract.js";
import {
  initializeCryptoInvocationAllowed as fedosInitializeCryptoInvocationAllowed,
  initializeCryptoInvocationCompleted as fedosInitializeCryptoInvocationCompleted,
  initializeCryptoInvocationReason as fedosInitializeCryptoInvocationReason,
  initializeCryptoInvocationState as fedosInitializeCryptoInvocationState,
} from "./fedos_initialize_crypto_invocation_contract.js";
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
  /**
   * The Generated Artifact Presence Policy's own fixed coarse state —
   * `artifactPresenceState()`'s own answer
   * (`src/runtime/fedos_generated_artifact_presence.ts`, Stage
   * 538/540). Fixed `"PlanningOnly"` in this stage.
   */
  readonly artifactPresenceState: FedosGeneratedArtifactPresenceState;
  /**
   * Whether the generated artifact is currently present-and-usable
   * for Runtime — `artifactPresent()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly artifactPresent: boolean;
  /**
   * WHY the generated artifact is not currently present-and-usable —
   * `artifactPresenceReason()`'s own answer. Fixed
   * `"ArtifactNotGeneratedForRuntime"` in this stage.
   */
  readonly artifactPresenceReason: FedosGeneratedArtifactPresenceReason;
  /**
   * The Static Import Activation Review's own fixed coarse state —
   * `staticImportActivationState()`'s own answer
   * (`src/runtime/fedos_static_import_activation_review.ts`, Stage
   * 546/548). Fixed `"PlanningOnly"` in this stage.
   */
  readonly staticImportActivationState: FedosStaticImportActivationState;
  /**
   * Whether static import activation is currently approved —
   * `staticImportActivationApproved()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly staticImportActivationApproved: boolean;
  /**
   * WHY static import activation is not currently approved —
   * `staticImportActivationReason()`'s own answer. Fixed
   * `"RuntimeActivationReviewPending"` in this stage.
   */
  readonly staticImportActivationReason: FedosStaticImportActivationReason;
  /**
   * This repository's standing Generated Artifact Distribution
   * Policy mode — `generatedArtifactDistributionMode()`'s own answer
   * (`src/runtime/fedos_generated_artifact_distribution.ts`, Stage
   * 554/556). Fixed `"BuildTimeGenerated"` (Option B) in this stage.
   */
  readonly generatedArtifactDistributionMode: FedosGeneratedArtifactDistributionMode;
  /**
   * Whether the generated artifact is committed to version control —
   * `generatedArtifactCommitted()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly generatedArtifactCommitted: boolean;
  /**
   * Whether a static import is currently safe given this
   * distribution policy — `staticImportSafe()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly staticImportSafe: boolean;
  /**
   * This repository's standing Build-Time Loader Strategy decision —
   * `buildTimeLoaderStrategy()`'s own answer
   * (`src/runtime/fedos_build_time_loader_strategy.ts`, Stage
   * 562/564). Fixed `"DynamicLoaderPlanned"` (Option C, designated
   * but not implemented) in this stage.
   */
  readonly buildTimeLoaderStrategy: FedosBuildTimeLoaderStrategyKind;
  /**
   * Whether a prebuild step (`npm run build:wasm`) is required before
   * the generated artifact could ever be loaded —
   * `buildTimeLoaderRequiresPrebuild()`'s own answer. Fixed `true` in
   * this stage.
   */
  readonly buildTimeLoaderRequiresPrebuild: boolean;
  /**
   * Whether Runtime may currently attach to this loader strategy —
   * `buildTimeLoaderRuntimeAttachAllowed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly buildTimeLoaderRuntimeAttachAllowed: boolean;
  /**
   * The Dynamic Loader Gate's own fixed coarse state —
   * `dynamicLoaderGateState()`'s own answer
   * (`src/runtime/fedos_dynamic_loader_gate.ts`, Stage 570/572). Fixed
   * `"PlanningOnly"` in this stage.
   */
  readonly dynamicLoaderGateState: FedosDynamicLoaderGateState;
  /**
   * Whether a dynamic loader is currently allowed —
   * `dynamicLoaderAllowed()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly dynamicLoaderAllowed: boolean;
  /**
   * WHY a dynamic loader is not currently allowed —
   * `dynamicLoaderGateReason()`'s own answer. Fixed
   * `"DynamicLoaderGatePending"` in this stage.
   */
  readonly dynamicLoaderGateReason: FedosDynamicLoaderGateReason;
  /**
   * The Dynamic Loader Dev Approval's own fixed coarse state —
   * `dynamicLoaderDevApprovalState()`'s own answer
   * (`src/runtime/fedos_dynamic_loader_dev_approval.ts`, Stage
   * 578/580). Fixed `"PlanningOnly"` in this stage.
   */
  readonly dynamicLoaderDevApprovalState: FedosDynamicLoaderDevApprovalState;
  /**
   * Whether the dev-only dynamic loader is currently approved —
   * `dynamicLoaderDevApproved()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly dynamicLoaderDevApproved: boolean;
  /**
   * WHY the dev-only dynamic loader is not currently approved —
   * `dynamicLoaderDevReason()`'s own answer. Fixed
   * `"DevApprovalPending"` in this stage.
   */
  readonly dynamicLoaderDevReason: FedosDynamicLoaderDevApprovalReason;
  /**
   * The Explicit Crypto Initialization design's own fixed operating
   * mode — `cryptoInitializationMode()`'s own answer
   * (`src/runtime/fedos_explicit_crypto_initialization.ts`, Stage
   * 586/588). Fixed `"ExplicitInitialization"` in this stage.
   */
  readonly cryptoInitializationMode: FedosCryptoInitializationMode;
  /**
   * Whether a (future) explicit initialization call is currently
   * allowed — `cryptoInitializationAllowed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly cryptoInitializationAllowed: boolean;
  /**
   * Whether an explicit initialization call has ever actually run —
   * `cryptoInitialized()`'s own answer. Fixed `false` in this stage.
   */
  readonly cryptoInitialized: boolean;
  /**
   * WHY a (future) explicit initialization call is not currently
   * allowed — `cryptoInitializationReason()`'s own answer. Fixed
   * `"InitializationApprovalPending"` in this stage.
   */
  readonly cryptoInitializationReason: FedosCryptoInitializationReason;
  /**
   * The Crypto Loader Facade's own fixed coarse state —
   * `cryptoLoaderFacadeState()`'s own answer
   * (`src/runtime/fedos_crypto_loader_facade.ts`, Stage 594/596).
   * Fixed `"PlanningOnly"` in this stage.
   */
  readonly cryptoLoaderFacadeState: FedosCryptoLoaderFacadeState;
  /**
   * The Facade's currently designated backend candidate —
   * `cryptoLoaderFacadeBackend()`'s own answer. Fixed `"WasmPlanned"`
   * in this stage.
   */
  readonly cryptoLoaderFacadeBackend: FedosCryptoLoaderFacadeBackend;
  /**
   * Whether the Facade has ever actually been initialized —
   * `cryptoLoaderFacadeInitialized()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly cryptoLoaderFacadeInitialized: boolean;
  /**
   * WHY the Facade has not yet been initialized —
   * `cryptoLoaderFacadeReason()`'s own answer. Fixed
   * `"FacadeInitializationPending"` in this stage.
   */
  readonly cryptoLoaderFacadeReason: FedosCryptoLoaderFacadeReason;
  /**
   * The Provider/Facade Boundary's own fixed coarse state —
   * `providerFacadeBoundaryState()`'s own answer
   * (`src/runtime/fedos_crypto_provider_facade_boundary.ts`, Stage
   * 602/604). Fixed `"PlanningOnly"` in this stage.
   */
  readonly providerFacadeBoundaryState: FedosCryptoProviderFacadeBoundaryState;
  /**
   * Whether the Provider side AND the Facade side are both currently
   * connected — `providerFacadeConnected()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly providerFacadeConnected: boolean;
  /**
   * WHY the Boundary is not yet fully connected —
   * `providerFacadeReason()`'s own answer. Fixed
   * `"ProviderFacadeConnectionPending"` in this stage.
   */
  readonly providerFacadeReason: FedosCryptoProviderFacadeBoundaryReason;
  /**
   * The Provider Initialization Request planning design's own fixed
   * coarse state — `providerInitializationRequestState()`'s own
   * answer (`src/runtime/fedos_crypto_provider_initialization_request.ts`,
   * Stage 610/612). Fixed `"PlanningOnly"` in this stage.
   */
  readonly providerInitializationRequestState: FedosCryptoProviderInitializationRequestState;
  /**
   * Whether a Provider has ever actually issued such a request —
   * `providerInitializationRequested()`'s own answer. Fixed `false`
   * in this stage.
   */
  readonly providerInitializationRequested: boolean;
  /**
   * Whether the Boundary would currently accept such a request if one
   * were issued — `providerInitializationAllowed()`'s own answer.
   * Fixed `false` in this stage.
   */
  readonly providerInitializationAllowed: boolean;
  /**
   * WHY a request is not currently allowed —
   * `providerInitializationReason()`'s own answer. Fixed
   * `"ProviderInitializationRequestPending"` in this stage.
   */
  readonly providerInitializationReason: FedosCryptoProviderInitializationRequestReason;
  /**
   * The Provider Initialization Approval's own fixed coarse review
   * state — `providerInitializationApprovalState()`'s own answer
   * (`src/runtime/fedos_provider_initialization_approval.ts`, Stage
   * 618/620). Fixed `"PlanningOnly"` in this stage.
   */
  readonly providerInitializationApprovalState: FedosProviderInitializationApprovalState;
  /**
   * Whether a specific request has ever actually been approved —
   * `providerInitializationApproved()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly providerInitializationApproved: boolean;
  /**
   * WHY the request is not currently approved —
   * `providerInitializationApprovalReason()`'s own answer. Fixed
   * `"ProviderInitializationApprovalPending"` in this stage.
   */
  readonly providerInitializationApprovalReason: FedosProviderInitializationApprovalReason;
  /**
   * The Provider Init Facade Contract's own fixed coarse readiness
   * state — `providerInitFacadeContractState()`'s own answer
   * (`src/runtime/fedos_provider_init_facade_contract.ts`, Stage
   * 626/628). Fixed `"PlanningOnly"` in this stage.
   */
  readonly providerInitFacadeContractState: FedosProviderInitFacadeContractState;
  /**
   * Whether the Provider side and the Facade side currently agree on
   * a shared call/return shape — `providerInitFacadeContractReady()`'s
   * own answer. Fixed `false` in this stage.
   */
  readonly providerInitFacadeContractReady: boolean;
  /**
   * WHY the contract is not currently ready —
   * `providerInitFacadeContractReason()`'s own answer. Fixed
   * `"ProviderInitFacadeContractPending"` in this stage.
   */
  readonly providerInitFacadeContractReason: FedosProviderInitFacadeContractReason;
  /**
   * The initializeCrypto API Contract's own fixed coarse readiness
   * state — `initializeCryptoApiState()`'s own answer
   * (`src/runtime/fedos_initialize_crypto_api_contract.ts`, Stage
   * 634/636). Fixed `"PlanningOnly"` in this stage.
   */
  readonly initializeCryptoApiState: FedosInitializeCryptoApiContractState;
  /**
   * Whether `initializeCrypto()` is currently callable at all —
   * `initializeCryptoCallable()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly initializeCryptoCallable: boolean;
  /**
   * Whether `initializeCrypto()` has ever actually been called and
   * completed — `initializeCryptoInitialized()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly initializeCryptoInitialized: boolean;
  /**
   * WHY `initializeCrypto()` is not currently callable —
   * `initializeCryptoReason()`'s own answer. Fixed
   * `"InitializeCryptoApiPending"` in this stage.
   */
  readonly initializeCryptoReason: FedosInitializeCryptoApiContractReason;
  /**
   * The Crypto Initialization Result Contract's own fixed coarse
   * completion state — `cryptoInitializationResultState()`'s own
   * answer (`src/runtime/fedos_crypto_initialization_result.ts`,
   * Stage 642/644). Fixed `"PlanningOnly"` in this stage.
   */
  readonly cryptoInitializationResultState: FedosCryptoInitializationResultState;
  /**
   * Whether initialization has ever actually succeeded —
   * `cryptoInitializationSuccess()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly cryptoInitializationSuccess: boolean;
  /**
   * Which backend (if any) ultimately served a completed request —
   * `cryptoInitializationBackend()`'s own answer. Fixed `"None"` in
   * this stage.
   */
  readonly cryptoInitializationBackend: FedosCryptoInitializationResultBackend;
  /**
   * WHY no result is currently available —
   * `cryptoInitializationResultReason()`'s own answer. Fixed
   * `"InitializationResultPending"` in this stage.
   */
  readonly cryptoInitializationResultReason: FedosCryptoInitializationResultReason;
  /**
   * The Runtime initializeCrypto Exposure Review's own fixed coarse
   * state — `initializeCryptoExposureState()`'s own answer
   * (`src/runtime/fedos_initialize_crypto_exposure_review.ts`, Stage
   * 650/652). Fixed `"PlanningOnly"` in this stage.
   */
  readonly initializeCryptoExposureState: FedosInitializeCryptoExposureReviewState;
  /**
   * Whether `initializeCrypto()` is currently exposed on `AppRuntime`
   * in any way — `initializeCryptoExposed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly initializeCryptoExposed: boolean;
  /**
   * Whether exposing `initializeCrypto()` has ever been reviewed and
   * approved — `initializeCryptoExposureApproved()`'s own answer.
   * Fixed `false` in this stage.
   */
  readonly initializeCryptoExposureApproved: boolean;
  /**
   * WHY `initializeCrypto()` is not currently exposed —
   * `initializeCryptoExposureReason()`'s own answer. Fixed
   * `"RuntimeExposureReviewPending"` in this stage.
   */
  readonly initializeCryptoExposureReason: FedosInitializeCryptoExposureReviewReason;
  /**
   * The Runtime initializeCrypto Wiring Plan's own fixed coarse
   * state — `initializeCryptoWiringPlanState()`'s own answer
   * (`src/runtime/fedos_initialize_crypto_wiring_plan.ts`, Stage
   * 658/660). Fixed `"PlanningOnly"` in this stage.
   */
  readonly initializeCryptoWiringPlanState: FedosInitializeCryptoWiringPlanState;
  /**
   * Whether a Runtime connection is currently permitted —
   * `initializeCryptoRuntimeWiringAllowed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly initializeCryptoRuntimeWiringAllowed: boolean;
  /**
   * Whether a Worker connection is currently permitted —
   * `initializeCryptoWorkerWiringAllowed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly initializeCryptoWorkerWiringAllowed: boolean;
  /**
   * WHY neither wiring is currently permitted —
   * `initializeCryptoWiringPlanReason()`'s own answer. Fixed
   * `"RuntimeWiringPlanPending"` in this stage.
   */
  readonly initializeCryptoWiringPlanReason: FedosInitializeCryptoWiringPlanReason;
  /**
   * The Runtime initializeCrypto Public API's own fixed coarse
   * state — `initializeCryptoPublicApiState()`'s own answer
   * (`src/runtime/fedos_initialize_crypto_public_api.ts`, Stage
   * 666/668). Fixed `"PlanningOnly"` in this stage.
   */
  readonly initializeCryptoPublicApiState: FedosInitializeCryptoPublicApiState;
  /**
   * Whether `initializeCrypto()` is currently visible as a public
   * member on `AppRuntime` — `initializeCryptoApiVisible()`'s own
   * answer. Fixed `false` in this stage.
   */
  readonly initializeCryptoApiVisible: boolean;
  /**
   * Whether the public-facing member is currently callable —
   * `initializeCryptoPublicApiCallable()`'s own answer. Fixed
   * `false` in this stage. DISTINCT from `initializeCryptoCallable`
   * above (Stage 636, the internal Facade-level answer) — see
   * `docs/runtime_initialize_crypto_public_api.md` §1.
   */
  readonly initializeCryptoPublicApiCallable: boolean;
  /**
   * WHY `initializeCrypto()` is not currently visible —
   * `initializeCryptoPublicApiReason()`'s own answer. Fixed
   * `"PublicApiPending"` in this stage.
   */
  readonly initializeCryptoPublicApiReason: FedosInitializeCryptoPublicApiReason;
  /**
   * The Runtime initializeCrypto Invocation Contract's own fixed
   * coarse state — `initializeCryptoInvocationState()`'s own answer
   * (`src/runtime/fedos_initialize_crypto_invocation_contract.ts`,
   * Stage 674/676). Fixed `"PlanningOnly"` in this stage.
   */
  readonly initializeCryptoInvocationState: FedosInitializeCryptoInvocationContractState;
  /**
   * Whether an actual invocation is currently permitted —
   * `initializeCryptoInvocationAllowed()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly initializeCryptoInvocationAllowed: boolean;
  /**
   * Whether an invocation has ever actually completed —
   * `initializeCryptoInvocationCompleted()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly initializeCryptoInvocationCompleted: boolean;
  /**
   * WHY an invocation is not currently allowed —
   * `initializeCryptoInvocationReason()`'s own answer. Fixed
   * `"InvocationContractPending"` in this stage.
   */
  readonly initializeCryptoInvocationReason: FedosInitializeCryptoInvocationContractReason;
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
    artifactPresenceState: fedosArtifactPresenceState(),
    artifactPresent: fedosArtifactPresent(),
    artifactPresenceReason: fedosArtifactPresenceReason(),
    staticImportActivationState: fedosStaticImportActivationState(),
    staticImportActivationApproved: fedosStaticImportActivationApproved(),
    staticImportActivationReason: fedosStaticImportActivationReason(),
    generatedArtifactDistributionMode: fedosGeneratedArtifactDistributionMode(),
    generatedArtifactCommitted: fedosGeneratedArtifactCommitted(),
    staticImportSafe: fedosStaticImportSafe(),
    buildTimeLoaderStrategy: fedosBuildTimeLoaderStrategy(),
    buildTimeLoaderRequiresPrebuild: fedosBuildTimeLoaderRequiresPrebuild(),
    buildTimeLoaderRuntimeAttachAllowed: fedosBuildTimeLoaderRuntimeAttachAllowed(),
    dynamicLoaderGateState: fedosDynamicLoaderGateState(),
    dynamicLoaderAllowed: fedosDynamicLoaderAllowed(),
    dynamicLoaderGateReason: fedosDynamicLoaderGateReason(),
    dynamicLoaderDevApprovalState: fedosDynamicLoaderDevApprovalState(),
    dynamicLoaderDevApproved: fedosDynamicLoaderDevApproved(),
    dynamicLoaderDevReason: fedosDynamicLoaderDevReason(),
    cryptoInitializationMode: fedosCryptoInitializationMode(),
    cryptoInitializationAllowed: fedosCryptoInitializationAllowed(),
    cryptoInitialized: fedosCryptoInitialized(),
    cryptoInitializationReason: fedosCryptoInitializationReason(),
    cryptoLoaderFacadeState: fedosCryptoLoaderFacadeState(),
    cryptoLoaderFacadeBackend: fedosCryptoLoaderFacadeBackend(),
    cryptoLoaderFacadeInitialized: fedosCryptoLoaderFacadeInitialized(),
    cryptoLoaderFacadeReason: fedosCryptoLoaderFacadeReason(),
    providerFacadeBoundaryState: fedosProviderFacadeBoundaryState(),
    providerFacadeConnected: fedosProviderFacadeConnected(),
    providerFacadeReason: fedosProviderFacadeReason(),
    providerInitializationRequestState: fedosProviderInitializationRequestState(),
    providerInitializationRequested: fedosProviderInitializationRequested(),
    providerInitializationAllowed: fedosProviderInitializationAllowed(),
    providerInitializationReason: fedosProviderInitializationReason(),
    providerInitializationApprovalState: fedosProviderInitializationApprovalState(),
    providerInitializationApproved: fedosProviderInitializationApproved(),
    providerInitializationApprovalReason: fedosProviderInitializationApprovalReason(),
    providerInitFacadeContractState: fedosProviderInitFacadeContractState(),
    providerInitFacadeContractReady: fedosProviderInitFacadeContractReady(),
    providerInitFacadeContractReason: fedosProviderInitFacadeContractReason(),
    initializeCryptoApiState: fedosInitializeCryptoApiState(),
    initializeCryptoCallable: fedosInitializeCryptoCallable(),
    initializeCryptoInitialized: fedosInitializeCryptoInitialized(),
    initializeCryptoReason: fedosInitializeCryptoReason(),
    cryptoInitializationResultState: fedosCryptoInitializationResultState(),
    cryptoInitializationSuccess: fedosCryptoInitializationSuccess(),
    cryptoInitializationBackend: fedosCryptoInitializationBackend(),
    cryptoInitializationResultReason: fedosCryptoInitializationResultReason(),
    initializeCryptoExposureState: fedosInitializeCryptoExposureState(),
    initializeCryptoExposed: fedosInitializeCryptoExposed(),
    initializeCryptoExposureApproved: fedosInitializeCryptoExposureApproved(),
    initializeCryptoExposureReason: fedosInitializeCryptoExposureReason(),
    initializeCryptoWiringPlanState: fedosInitializeCryptoWiringPlanState(),
    initializeCryptoRuntimeWiringAllowed: fedosInitializeCryptoRuntimeWiringAllowed(),
    initializeCryptoWorkerWiringAllowed: fedosInitializeCryptoWorkerWiringAllowed(),
    initializeCryptoWiringPlanReason: fedosInitializeCryptoWiringPlanReason(),
    initializeCryptoPublicApiState: fedosInitializeCryptoPublicApiState(),
    initializeCryptoApiVisible: fedosInitializeCryptoApiVisible(),
    initializeCryptoPublicApiCallable: fedosInitializeCryptoPublicApiCallable(),
    initializeCryptoPublicApiReason: fedosInitializeCryptoPublicApiReason(),
    initializeCryptoInvocationState: fedosInitializeCryptoInvocationState(),
    initializeCryptoInvocationAllowed: fedosInitializeCryptoInvocationAllowed(),
    initializeCryptoInvocationCompleted: fedosInitializeCryptoInvocationCompleted(),
    initializeCryptoInvocationReason: fedosInitializeCryptoInvocationReason(),
  };
}

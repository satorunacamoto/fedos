/**
 * Stage 251 — Runtime Crypto Diagnostics (display only).
 *
 * A READ-ONLY inspection of a `RuntimeCryptoProvider`'s
 * (`src/runtime/crypto_provider.ts`, Stage 249) current status and advertised
 * capabilities — mirroring `docs/runtime_diagnostics.md`'s existing "read-only
 * inspection of already-constructed objects" discipline (§1). This file calls
 * ONLY `provider.status()`/`provider.capabilities()` (both pure reads per
 * `RuntimeCryptoProvider`'s own contract) — never `encrypt()`/`decrypt()`.
 *
 * HARD GUARDRAILS:
 *   - NO secret, key, plaintext, or ciphertext byte is ever read or displayed.
 *   - NO `encrypt()`/`decrypt()` call — this file never asks a provider to
 *     perform an operation, only to report its own state.
 *   - NO `packages/fedos-core-rust` reference (Rust crate or TS package
 *     boundary).
 *
 * Stage 261 adds [`runtimeCryptoActivationStatus`] — a fixed,
 * `{ enabled: false, provider: "placeholder" }` summary read directly from
 * `src/runtime/runtime_crypto_config.ts`'s (Stage 258) own config, for a
 * simple activation-status display distinct from the fuller
 * `RuntimeCryptoDiagnosticsReport` above. `enabled` is `false` because
 * `runtimeCryptoEnabled` is permanently `false` — not because this function
 * re-derives it independently.
 *
 * Stage 269 extends `runtimeCryptoActivationStatus`'s `provider` field to
 * report the EFFECTIVE provider name — mirroring
 * `src/runtime/runtime_crypto_bridge.ts`'s (Stage 268) own two-flag gate
 * (`runtimeCryptoEnabled && runtimeCryptoProvider === "fedos"`) — rather
 * than blindly echoing the config's `runtimeCryptoProvider` field.
 *
 * Stage 285 SPLITS that single field into TWO, now that
 * `runtimeCryptoProvider` can be `"fedos"` via the `FEDOS_CRYPTO_PROVIDER`
 * env var (Stage 282): `configuredProvider` (the raw, PARSED — never the
 * raw env string — config value) and `effectiveProvider` (the same
 * two-flag-gated computation Stage 269 already did, unrenamed). Setting
 * `FEDOS_CRYPTO_PROVIDER=fedos` now makes `configuredProvider` report
 * `"fedos"`, but `effectiveProvider` stays `"placeholder"` regardless,
 * because `runtimeCryptoEnabled` is permanently `false`. Accepts an
 * OPTIONAL `env` parameter, passed straight through to
 * `getRuntimeCryptoConfig` — never reads `process.env` directly, and never
 * echoes `env`'s raw string value anywhere in its return value (only the
 * parsed `"placeholder"`/`"fedos"` enum values ever appear).
 *
 * Stage 291 adds `activationReason`
 * (`src/runtime/runtime_crypto_activation_policy.ts`'s
 * `evaluateRuntimeCryptoActivation`, Stage 289) to the activation summary
 * — WHY activation is not (yet) allowed, one of `"DisabledByConfig"`/
 * `"ProviderNotSelected"`/`"ProviderUnavailable"`/`"FutureFeature"`.
 * `"Allowed"` is never displayed here — the policy function itself never
 * produces it in this stage.
 *
 * Stage 297 adds `configuredEnabled` — the PARSED `FEDOS_CRYPTO_ENABLED`
 * label (`src/runtime/crypto_provider_env.ts`'s `parseFedosCryptoEnabledEnv`)
 * — and passes `env` through to `evaluateRuntimeCryptoActivation` too, so
 * `activationReason` now reflects the Stage 297 dual-lock combination.
 * `effectiveProvider` is DELIBERATELY UNCHANGED — it still mirrors ONLY
 * `runtime_crypto_bridge.ts`'s own two-flag gate (which was NOT touched
 * this stage and still never reads `FEDOS_CRYPTO_ENABLED`), so it can
 * legitimately diverge from `activationReason` once Lock #2 is set (e.g.
 * `activationReason: "ProviderUnavailable"` while `effectiveProvider`
 * still reports `"placeholder"`) — see
 * `docs/runtime_crypto_activation_policy.md` §2.
 *
 * Stage 309 adds `providerImplemented` — a direct read of
 * `fedos_runtime_crypto_provider.ts`'s (Stage 305)
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`, the SAME constant
 * `evaluateRuntimeCryptoActivation` itself now consults (Stage 308).
 * Fixed `false`; setting BOTH `FEDOS_CRYPTO_PROVIDER=fedos` AND
 * `FEDOS_CRYPTO_ENABLED=explicit-dev-only` still leaves
 * `activationReason: "ProviderUnavailable"` (unchanged from Stage 297).
 *
 * Stage 317 adds `providerImplementationState`/`providerExecutionState`/
 * `providerOperationState`, reading `fedos_runtime_crypto_provider.ts`'s
 * (Stage 317) three standalone, pure "state" functions —
 * `fedosProviderImplementationState()`/`fedosProviderExecutionState()`/
 * `fedosProviderOperationState()` — which need no
 * `FedosRuntimeCryptoProvider` instance and expose no request or secret
 * material. All three are fully determined by
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` alone, so all three stay fixed in
 * this stage.
 *
 * Stage 325 adds `providerImplementationStage` (`fedos_runtime_crypto_provider.ts`'s
 * `fedosProviderImplementationStage()`, Stage 324 — the internal
 * architecture's own coarse milestone), `opaqueApiState`
 * (`fedos_opaque_api.ts`'s `fedosOpaqueApiState()`, fixed
 * `"NotConnected"`), and `runtimeExecutionState` (the SAME computation
 * as `providerExecutionState`, exposed under a second name for a
 * "would Runtime's own execution attempt succeed right now" framing).
 * None of these construct/expose a request or secret material.
 *
 * Stage 333 adds `rustBoundaryState` (`fedos_rust_boundary.ts`'s
 * `fedosRustBoundaryState()`, Stage 329 — fixed `"NotConnected"`) and
 * `rustBoundaryReachable` (`fedosRustBoundaryReachable()`, fixed `true`
 * — the Rust Boundary IS structurally wired into the Opaque API's own
 * chain as of Stage 330, even though every call still resolves
 * `"BlockedByImplementation"`).
 *
 * Stage 341 adds `rustApiState` (`fedos_rust_api.ts`'s
 * `fedosRustApiState()`, Stage 337 — fixed `"NotConnected"`) and
 * `rustApiReachable` (`fedosRustApiReachable()`, fixed `true` — the
 * Rust API IS structurally wired into the Rust Boundary's own chain as
 * of Stage 338). `providerImplementationStage` now reflects the
 * extended six-step milestone, fixed at `"RustApiReady"`.
 *
 * Stage 349 adds `rustExecutionReviewState` (`fedos_rust_execution_review.ts`'s
 * `fedosRustExecutionReviewState()`, Stage 345 — fixed `"Blocked"`),
 * `rustExecutionReviewReason` (`fedosRustExecutionReviewReason()`, fixed
 * `"BlockedBeforeCrypto"`), and `rustExecutionApproved`
 * (`fedosRustExecutionApproved()`, fixed `false`). `providerImplementationStage`
 * is DELIBERATELY UNCHANGED by this stage — the Execution Review is a
 * permission/approval layer, not an architecture milestone (see
 * `docs/runtime_fedos_execution_approval_checklist.md`).
 *
 * Stage 357 adds `internalRustCallState` (`fedos_internal_rust_call.ts`'s
 * `fedosInternalRustCallState()`, Stage 353 — fixed `"Planned"`) and
 * `internalRustCallReachable` (`fedosInternalRustCallReachable()`,
 * fixed `true` — the Internal Rust Call plan IS structurally wired
 * into the Execution Review's own chain as of Stage 354, even though
 * it is only ever planned, never executed). No payload, plaintext,
 * ciphertext, or key material is exposed by either field.
 *
 * Stage 365 adds `rustInvocationAdapterState` (`fedos_rust_invocation_adapter.ts`'s
 * `fedosRustInvocationAdapterState()`, Stage 361 — fixed `"NotConnected"`),
 * `rustInvocationAdapterReachable` (`fedosRustInvocationAdapterReachable()`,
 * fixed `true` — the Rust Invocation Adapter IS structurally wired
 * into the Internal Rust Call's own chain as of Stage 362), and
 * `rustInvocationAdapterExecuted` (`fedosRustInvocationAdapterExecuted()`,
 * fixed `false`). `providerImplementationStage` now reflects the
 * extended seven-step milestone, fixed at `"RustInvocationAdapterReady"`.
 *
 * Stage 372 adds `rustPingReachable` (`fedos_rust_invocation_adapter.ts`'s
 * `fedosRustPingReachable()`, Stage 370 — fixed `true`, since
 * `planPing()` exists and can be called) and `rustPingExecuted`
 * (`fedosRustPingExecuted()`, fixed `false` at the time — `planPing()`
 * never called Rust's `fedos_runtime_ping_internal()` yet in that
 * stage). Neither field exposes any implementation detail beyond these
 * two booleans.
 *
 * Stage 377 flips `rustPingExecuted` to fixed `true` — `planPing()`
 * (`fedos_rust_invocation_adapter.ts`, Stage 377) now reaches
 * `fedos_runtime_ping_internal()`'s own contract via a verified,
 * pure TypeScript mirror (NOT a literal WASM/FFI/native-addon call;
 * see `docs/runtime_first_rust_ping_execution.md`). Stage 379 adds
 * `rustPingSucceeded` (`fedosRustPingSucceeded()`, fixed `true`) —
 * whether that ping, once executed, reported success. Neither field
 * exposes any implementation detail beyond these booleans; no
 * payload, plaintext, ciphertext, or key material is ever involved.
 *
 * Stage 388 adds `wasmBoundaryState` (`fedos_wasm_boundary.ts`'s
 * `fedosWasmBoundaryState()`, Stage 386 — fixed `"NotLoaded"`),
 * `wasmBoundaryReachable` (`fedosWasmBoundaryReachable()`, fixed
 * `true` — the WASM Boundary IS structurally wired into the Rust
 * Invocation Adapter's own chain as of Stage 387), and `wasmLoaded`
 * (`fedosWasmLoaded()`, fixed `false` — no real WASM module is ever
 * loaded). None of these expose any implementation detail beyond
 * these values; no payload, plaintext, ciphertext, or key material is
 * ever involved.
 *
 * Stage 396 adds `wasmArtifactState` (`fedos_wasm_artifact.ts`'s
 * `fedosWasmArtifactState()`, Stage 394 — fixed `"NotBuilt"`),
 * `wasmArtifactReachable` (`fedosWasmArtifactReachable()`, fixed
 * `true` — the WASM Artifact IS structurally wired into the WASM
 * Boundary's own chain as of Stage 395), and `wasmArtifactBuilt`
 * (`fedosWasmArtifactBuilt()`, fixed `false` — no real artifact is
 * ever built). None of these expose any implementation detail beyond
 * these values.
 *
 * Stage 404 adds `executionBackend` (`fedos_execution_backend.ts`'s
 * `fedosExecutionBackendKind()`, Stage 402 — fixed `"Wasm"`, the first
 * implementation candidate), `executionBackendState`
 * (`fedosExecutionBackendState()`, fixed `"Planning"`),
 * `executionBackendReachable` (`fedosExecutionBackendReachable()`,
 * fixed `true` — the Execution Backend IS structurally wired into the
 * Rust Invocation Adapter's own chain as of Stage 403, REPLACING its
 * previous direct wiring to the WASM Boundary), and
 * `backendImplemented` (`fedosExecutionBackendImplemented()`, fixed
 * `false` — no WASM/Native/Mobile/other backend candidate has ever
 * actually been selected, connected, or executed). None of these
 * expose any implementation detail beyond these values; no payload,
 * plaintext, ciphertext, or key material is ever involved.
 *
 * Stage 420 adds `wasmToolchainInstalled` (`fedos_wasm_toolchain.ts`'s
 * `fedosWasmToolchainInstalled()`, Stage 419 — fixed `false`),
 * `wasmToolchainVerified` (`fedosWasmToolchainVerified()`, fixed
 * `false`), and `wasmBuildReady` (`fedosWasmBuildReady()`, fixed
 * `false`). Unlike every other field in this summary,
 * `fedos_wasm_toolchain.ts` is NOT structurally wired into the
 * Runtime -> Rust chain (no `reachable` field is added for it) — it is
 * a standalone toolchain-readiness model read here for display only.
 *
 * Stage 453 adds `wasmArtifactGenerated` (`fedos_wasm_artifact.ts`'s
 * `fedosWasmArtifactGenerated()`, Stage 452 — fixed `false`) and
 * `generatedArtifactPath` (`fedosGeneratedArtifactPath()`, fixed
 * `null`) — see `docs/runtime_wasm_generation.md` §2. These answer
 * "does a real `.wasm` + JS glue pair exist on disk", DISTINCT from
 * the existing `wasmArtifactState`/`wasmArtifactBuilt` fields (Stage
 * 396), which answer "has this Provider-internal abstraction's own
 * build step ever executed". Neither new field performs a filesystem
 * check — both are hand-fixed constants.
 *
 * Stage 588 adds `cryptoInitializationMode`/`cryptoInitializationAllowed`/
 * `cryptoInitialized`/`cryptoInitializationReason`
 * (`fedos_explicit_crypto_initialization.ts`'s
 * `cryptoInitializationMode()`/`cryptoInitializationAllowed()`/
 * `cryptoInitialized()`/`cryptoInitializationReason()`, Stage 586/587)
 * — the standing "explicit initialization only" design's own fixed
 * answers: `"ExplicitInitialization"`/`false`/`false`/
 * `"InitializationApprovalPending"`. None of these expose any
 * implementation detail beyond these values; no payload, plaintext,
 * ciphertext, or key material is ever involved.
 *
 * Stage 596 adds `cryptoLoaderFacadeState`/`cryptoLoaderFacadeBackend`/
 * `cryptoLoaderFacadeInitialized`/`cryptoLoaderFacadeReason`
 * (`fedos_crypto_loader_facade.ts`'s `cryptoLoaderFacadeState()`/
 * `cryptoLoaderFacadeBackend()`/`cryptoLoaderFacadeInitialized()`/
 * `cryptoLoaderFacadeReason()`, Stage 594/595) — the Crypto Loader
 * Facade's own fixed answers: `"PlanningOnly"`/`"WasmPlanned"`/
 * `false`/`"FacadeInitializationPending"`. None of these expose any
 * implementation detail beyond these values; no payload, plaintext,
 * ciphertext, or key material is ever involved.
 *
 * Stage 604 adds `providerFacadeBoundaryState`/`providerFacadeConnected`/
 * `providerFacadeReason` (`fedos_crypto_provider_facade_boundary.ts`'s
 * `providerFacadeBoundaryState()`/`providerFacadeConnected()`/
 * `providerFacadeReason()`, Stage 602/603) — the Provider/Facade
 * Boundary's own fixed answers: `"PlanningOnly"`/`false`/
 * `"ProviderFacadeConnectionPending"`. `providerFacadeConnected`
 * mirrors the logical AND of the Boundary's own `providerConnected`/
 * `facadeConnected` flags, both permanently `false` in this stage.
 *
 * Stage 612 adds `providerInitializationRequestState`/
 * `providerInitializationRequested`/`providerInitializationAllowed`/
 * `providerInitializationReason`
 * (`fedos_crypto_provider_initialization_request.ts`'s
 * `providerInitializationRequestState()`/`providerInitializationRequested()`/
 * `providerInitializationAllowed()`/`providerInitializationReason()`,
 * Stage 610/611) — the Provider Initialization Request planning
 * design's own fixed answers: `"PlanningOnly"`/`false`/`false`/
 * `"ProviderInitializationRequestPending"`. None of these expose any
 * implementation detail beyond these values; no payload, plaintext,
 * ciphertext, or key material is ever involved.
 */

import type {
  RuntimeCryptoCapability,
  RuntimeCryptoProvider,
  RuntimeCryptoState,
} from "./crypto_provider.js";
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
import {
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  fedosProviderExecutionState,
  fedosProviderImplementationStage,
  fedosProviderImplementationState,
  fedosProviderOperationState,
} from "./fedos_runtime_crypto_provider.js";
import type { FedosRuntimeOperationStatus } from "./fedos_runtime_operation.js";
import type { ActivationReason } from "./runtime_crypto_activation_policy.js";
import { evaluateRuntimeCryptoActivation } from "./runtime_crypto_activation_policy.js";
import type { RuntimeCryptoProviderName } from "./runtime_crypto_config.js";
import { getRuntimeCryptoConfig } from "./runtime_crypto_config.js";
import { FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME } from "./runtime_crypto_registry.js";

/**
 * A non-sensitive, display-only readiness label for a `RuntimeCryptoProvider`
 * — DELIBERATELY SEPARATE from `RuntimeCryptoState` (see
 * `crypto_provider.ts`'s own doc comment for why). `"Enabled"` names a future
 * state where a real FedOS core is actually connected — NOTHING in this file,
 * or anywhere in this stage's code, ever produces it; it exists purely so a
 * later, separate, explicitly-reviewed stage can report it without a new enum
 * variant needing review at that point.
 */
export type RuntimeCryptoDiagnosticsState =
  | "Enabled" // a real, connected FedOS core — NEVER produced in this stage
  | "Disabled" // the boundary explicitly denies the requested capability
  | "Placeholder" // a placeholder implementation is present
  | "NotConnected"; // no FedOS core is connected

/**
 * A non-sensitive snapshot of a `RuntimeCryptoProvider`, for display purposes
 * only. `capabilities` echoes the provider's own fixed label list; `reason` is
 * the provider's own non-sensitive explanation, unmodified.
 */
export interface RuntimeCryptoDiagnosticsReport {
  readonly state: RuntimeCryptoDiagnosticsState;
  readonly capabilities: readonly RuntimeCryptoCapability[];
  readonly reason: string;
}

/**
 * Map a `RuntimeCryptoProvider`'s own `RuntimeCryptoState` to this module's
 * display-only `RuntimeCryptoDiagnosticsState`. Fixed, hand-maintained —
 * `"Unsupported"` (the provider-facing label) displays as `"Disabled"` (the
 * diagnostics-facing label); `"Placeholder"`/`"NotConnected"` pass through
 * unchanged. `"Enabled"` is never reachable from this function.
 */
function mapProviderStateToDiagnosticsState(
  state: RuntimeCryptoState,
): RuntimeCryptoDiagnosticsState {
  switch (state) {
    case "Placeholder":
      return "Placeholder";
    case "NotConnected":
      return "NotConnected";
    case "Unsupported":
      return "Disabled";
  }
}

/**
 * Read-only snapshot of `provider`'s current status and capabilities. Calls
 * ONLY `provider.status()`/`provider.capabilities()` — never `encrypt()`/
 * `decrypt()`, and never mutates `provider` or any argument.
 */
export function runtimeCryptoDiagnosticsPreview(
  provider: RuntimeCryptoProvider,
): RuntimeCryptoDiagnosticsReport {
  const status = provider.status();
  return {
    state: mapProviderStateToDiagnosticsState(status.state),
    capabilities: provider.capabilities(),
    reason: status.reason,
  };
}

/** A minimal, non-sensitive activation summary — see this module's Stage 261/269/285 doc comment above. */
export interface RuntimeCryptoActivationStatus {
  readonly enabled: boolean;
  /**
   * The PARSED, configured provider name (`getRuntimeCryptoConfig`'s own
   * `runtimeCryptoProvider`) — reflects `FEDOS_CRYPTO_PROVIDER` even though
   * `enabled` stays `false`. NEVER the raw env string — only the parsed
   * `"placeholder"`/`"fedos"` enum value.
   */
  readonly configuredProvider: RuntimeCryptoProviderName;
  /**
   * The PARSED `FEDOS_CRYPTO_ENABLED` label ("Lock #2",
   * `src/runtime/crypto_provider_env.ts`'s `parseFedosCryptoEnabledEnv`,
   * Stage 297) — `"explicit-dev-only"` only for that exact (trimmed) env
   * string; `"disabled"` for everything else, including every common
   * truthy spelling. NEVER the raw env string.
   */
  readonly configuredEnabled: FedosCryptoEnabledLabel;
  /**
   * The EFFECTIVE provider name — mirrors
   * `src/runtime/runtime_crypto_bridge.ts`'s own two-flag gate exactly.
   * `"fedos"` only when BOTH `enabled` is `true` AND `configuredProvider
   * === "fedos"`; `"placeholder"` otherwise. Since `enabled` is
   * permanently `false` in this stage, `effectiveProvider` is permanently
   * `"placeholder"` regardless of `configuredProvider`.
   */
  readonly effectiveProvider: RuntimeCryptoProviderName;
  /**
   * WHY activation is not (yet) allowed —
   * `evaluateRuntimeCryptoActivation`'s own reason
   * (`src/runtime/runtime_crypto_activation_policy.ts`, Stage 289). Never
   * `"Allowed"` in this stage.
   */
  readonly activationReason: ActivationReason;
  /**
   * Whether `FedosRuntimeCryptoProvider` has a real internal
   * `encrypt`/`decrypt` implementation — a direct read of
   * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` (`src/runtime/fedos_runtime_crypto_provider.ts`,
   * Stage 305). Fixed `false` in this stage.
   */
  readonly providerImplemented: boolean;
  /**
   * WHY `FedosRuntimeCryptoProvider.encrypt()`/`decrypt()` currently deny
   * every request — `fedosProviderImplementationState()`'s own answer
   * (`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 307/317).
   * Fixed `"NotImplemented"` in this stage.
   */
  readonly providerImplementationState: FedosProviderDecisionReason;
  /**
   * What `FedosRuntimeCryptoProvider.planExecution()` would resolve to
   * — `fedosProviderExecutionState()`'s own answer (Stage 316/317).
   * Fixed `"BlockedByImplementation"` in this stage.
   */
  readonly providerExecutionState: FedosRuntimeExecutionState;
  /**
   * The `FedosRuntimeOperationStatus` a planned operation would resolve
   * to — `fedosProviderOperationState()`'s own answer
   * (`src/runtime/fedos_runtime_operation.ts`, Stage 313/317). Fixed
   * `"Blocked"` in this stage.
   */
  readonly providerOperationState: FedosRuntimeOperationStatus;
  /**
   * The internal architecture's own coarse milestone —
   * `fedosProviderImplementationStage()`'s own answer
   * (`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 324/332/340/364).
   * Fixed `"RustInvocationAdapterReady"` in this stage.
   */
  readonly providerImplementationStage: FedosProviderImplementationStage;
  /**
   * The Opaque API's own status — `fedosOpaqueApiState()`'s own answer
   * (`src/runtime/fedos_opaque_api.ts`, Stage 321/325). Fixed
   * `"NotConnected"` in this stage.
   */
  readonly opaqueApiState: FedosOpaqueApiState;
  /**
   * Whether Runtime's own execution attempt would succeed right now —
   * the SAME computation as `providerExecutionState`, exposed under a
   * second name for diagnostics display. Fixed
   * `"BlockedByImplementation"` in this stage.
   */
  readonly runtimeExecutionState: FedosRuntimeExecutionState;
  /**
   * The Rust Boundary's own status — `fedosRustBoundaryState()`'s own
   * answer (`src/runtime/fedos_rust_boundary.ts`, Stage 329/333). Fixed
   * `"NotConnected"` in this stage.
   */
  readonly rustBoundaryState: FedosRustBoundaryState;
  /**
   * Whether the Rust Boundary is structurally reachable from the
   * Opaque API's own internal chain — `fedosRustBoundaryReachable()`'s
   * own answer. Fixed `true` in this stage (the code path exists and
   * is called), NOT a claim that real Rust crypto executes.
   */
  readonly rustBoundaryReachable: boolean;
  /**
   * The Rust API's own status — `fedosRustApiState()`'s own answer
   * (`src/runtime/fedos_rust_api.ts`, Stage 337/341). Fixed
   * `"NotConnected"` in this stage.
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
   * own answer (`src/runtime/fedos_rust_execution_review.ts`, Stage
   * 345/349). Fixed `"Blocked"` in this stage.
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
   * stage, with no env path, parameter, or override anywhere.
   */
  readonly rustExecutionApproved: boolean;
  /**
   * The Internal Rust Call plan's own status —
   * `fedosInternalRustCallState()`'s own answer
   * (`src/runtime/fedos_internal_rust_call.ts`, Stage 353/357). Fixed
   * `"Planned"` in this stage.
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
   * `fedosRustInvocationAdapterState()`'s own answer
   * (`src/runtime/fedos_rust_invocation_adapter.ts`, Stage 361/365).
   * Fixed `"NotConnected"` in this stage.
   */
  readonly rustInvocationAdapterState: FedosRustInvocationAdapterState;
  /**
   * Whether the Rust Invocation Adapter is structurally reachable from
   * the Internal Rust Call's own internal chain —
   * `fedosRustInvocationAdapterReachable()`'s own answer. Fixed `true`
   * in this stage, NOT a claim that real Rust crypto executes.
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
   * reachable — `fedosRustPingReachable()`'s own answer
   * (`src/runtime/fedos_rust_invocation_adapter.ts`, Stage 370/372).
   * Fixed `true` in this stage.
   */
  readonly rustPingReachable: boolean;
  /**
   * Whether `planPing()` has reached `fedos_runtime_ping_internal()`'s
   * own contract via this file's TypeScript-side mirror —
   * `fedosRustPingExecuted()`'s own answer
   * (`src/runtime/fedos_rust_invocation_adapter.ts`, Stage 377). Fixed
   * `true` in this stage. This does NOT claim a literal WASM/FFI/
   * native-addon call occurred — see
   * `docs/runtime_first_rust_ping_execution.md`.
   */
  readonly rustPingExecuted: boolean;
  /**
   * Whether the ping, once executed, reported success —
   * `fedosRustPingSucceeded()`'s own answer (Stage 379). Fixed `true`
   * in this stage. No implementation detail beyond this boolean.
   */
  readonly rustPingSucceeded: boolean;
  /**
   * The WASM Boundary's own status — `fedosWasmBoundaryState()`'s own
   * answer (`src/runtime/fedos_wasm_boundary.ts`, Stage 386/388).
   * Fixed `"NotLoaded"` in this stage.
   */
  readonly wasmBoundaryState: FedosWasmBoundaryState;
  /**
   * Whether the WASM Boundary is structurally reachable from the Rust
   * Invocation Adapter's own internal chain —
   * `fedosWasmBoundaryReachable()`'s own answer. Fixed `true` in this
   * stage, NOT a claim that any WASM module is ever loaded.
   */
  readonly wasmBoundaryReachable: boolean;
  /**
   * Whether a real WASM module has ever actually been loaded —
   * `fedosWasmLoaded()`'s own answer. Fixed `false` in this stage.
   */
  readonly wasmLoaded: boolean;
  /**
   * The WASM Artifact's own status — `fedosWasmArtifactState()`'s own
   * answer (`src/runtime/fedos_wasm_artifact.ts`, Stage 394/396).
   * Fixed `"NotBuilt"` in this stage.
   */
  readonly wasmArtifactState: FedosWasmArtifactState;
  /**
   * Whether the WASM Artifact is structurally reachable from the
   * WASM Boundary's own internal chain — `fedosWasmArtifactReachable()`'s
   * own answer. Fixed `true` in this stage, NOT a claim that any
   * artifact is ever built.
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
   * `fedosExecutionBackendKind()`'s own answer
   * (`src/runtime/fedos_execution_backend.ts`, Stage 402/404). Fixed
   * `"Wasm"` in this stage — the first implementation candidate, not a
   * claim that it is selected or connected.
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
   * this stage, NOT a claim that any backend is ever selected,
   * connected, or executed. As of Stage 403, this REPLACES the Rust
   * Invocation Adapter's previous direct wiring to the WASM Boundary.
   */
  readonly executionBackendReachable: boolean;
  /**
   * Whether ANY Execution Backend candidate (WASM, Native, Mobile, or
   * otherwise) has ever actually been implemented and connected —
   * `fedosExecutionBackendImplemented()`'s own answer. Fixed `false`
   * in this stage.
   */
  readonly backendImplemented: boolean;
  /**
   * Whether the WASM toolchain (`wasm32` target / `wasm-bindgen-cli` /
   * `wasm-pack`) has ever actually been installed —
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
   * (`src/runtime/fedos_wasm_artifact.ts`, Stage 452/453). Fixed
   * `false` in this stage; distinct from `wasmArtifactBuilt` (Stage
   * 396) — see `docs/runtime_wasm_generation.md` §2.
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
   * 586/588). Fixed `"ExplicitInitialization"` in this stage — there
   * is no reachable auto/implicit-load alternative anywhere in this
   * arc.
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
}

/**
 * Read-only activation summary: `enabled` mirrors `runtimeCryptoEnabled`
 * (`src/runtime/runtime_crypto_config.ts`) exactly — permanently `false` in
 * this stage — `configuredProvider` reports the raw PARSED config value
 * (reflecting `FEDOS_CRYPTO_PROVIDER` via `env`), `configuredEnabled`
 * reports the PARSED `FEDOS_CRYPTO_ENABLED` label, `effectiveProvider`
 * reports the two-flag-gated result (UNCHANGED by `FEDOS_CRYPTO_ENABLED`
 * — see this module's Stage 297 doc comment above), and `activationReason`
 * reports WHY activation is not (yet) allowed
 * (`evaluateRuntimeCryptoActivation`, Stage 289/297's dual-lock
 * combination). Accepts an OPTIONAL `env`, passed straight through to
 * `getRuntimeCryptoConfig`/`evaluateRuntimeCryptoActivation` — reads no
 * `process.env` directly, and never calls a `RuntimeCryptoProvider`
 * method.
 */
export function runtimeCryptoActivationStatus(
  env?: FedosCryptoProviderEnvLike,
): RuntimeCryptoActivationStatus {
  const config = getRuntimeCryptoConfig(env);
  const { runtimeCryptoEnabled, runtimeCryptoProvider } = config;
  const effectiveProvider: RuntimeCryptoProviderName =
    runtimeCryptoEnabled && runtimeCryptoProvider === FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME
      ? FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME
      : "placeholder";
  return {
    enabled: runtimeCryptoEnabled,
    configuredProvider: runtimeCryptoProvider,
    configuredEnabled: parseFedosCryptoEnabledEnv(env?.FEDOS_CRYPTO_ENABLED),
    effectiveProvider,
    activationReason: evaluateRuntimeCryptoActivation(config, env).reason,
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
  };
}

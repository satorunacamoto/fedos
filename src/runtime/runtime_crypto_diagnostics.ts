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
 *
 * Stage 620 adds `providerInitializationApprovalState`/
 * `providerInitializationApproved`/`providerInitializationApprovalReason`
 * (`fedos_provider_initialization_approval.ts`'s
 * `providerInitializationApprovalState()`/`providerInitializationApproved()`/
 * `providerInitializationApprovalReason()`, Stage 618/619) — the
 * Provider Initialization Approval's own fixed answers:
 * `"PlanningOnly"`/`false`/
 * `"ProviderInitializationApprovalPending"`.
 *
 * Stage 628 adds `providerInitFacadeContractState`/
 * `providerInitFacadeContractReady`/`providerInitFacadeContractReason`
 * (`fedos_provider_init_facade_contract.ts`'s
 * `providerInitFacadeContractState()`/`providerInitFacadeContractReady()`/
 * `providerInitFacadeContractReason()`, Stage 626/627) — the Provider
 * Init Facade Contract's own fixed answers: `"PlanningOnly"`/`false`/
 * `"ProviderInitFacadeContractPending"`. None of these expose any
 * implementation detail beyond these values; no payload, plaintext,
 * ciphertext, or key material is ever involved.
 *
 * Stage 636 adds `initializeCryptoApiState`/`initializeCryptoCallable`/
 * `initializeCryptoInitialized`/`initializeCryptoReason`
 * (`fedos_initialize_crypto_api_contract.ts`'s
 * `initializeCryptoApiState()`/`initializeCryptoCallable()`/
 * `initializeCryptoInitialized()`/`initializeCryptoReason()`, Stage
 * 634/635) — the initializeCrypto API Contract's own fixed answers:
 * `"PlanningOnly"`/`false`/`false`/`"InitializeCryptoApiPending"`.
 *
 * Stage 644 adds `cryptoInitializationResultState`/
 * `cryptoInitializationSuccess`/`cryptoInitializationBackend`/
 * `cryptoInitializationResultReason`
 * (`fedos_crypto_initialization_result.ts`'s
 * `cryptoInitializationResultState()`/`cryptoInitializationSuccess()`/
 * `cryptoInitializationBackend()`/`cryptoInitializationResultReason()`,
 * Stage 642/643) — the Crypto Initialization Result Contract's own
 * fixed answers: `"PlanningOnly"`/`false`/`"None"`/
 * `"InitializationResultPending"`. None of these expose any
 * implementation detail beyond these values; no payload, plaintext,
 * ciphertext, or key material is ever involved.
 *
 * Stage 652 adds `initializeCryptoExposureState`/
 * `initializeCryptoExposed`/`initializeCryptoExposureApproved`/
 * `initializeCryptoExposureReason`
 * (`fedos_initialize_crypto_exposure_review.ts`'s
 * `initializeCryptoExposureState()`/`initializeCryptoExposed()`/
 * `initializeCryptoExposureApproved()`/`initializeCryptoExposureReason()`,
 * Stage 650/651) — the Runtime initializeCrypto Exposure Review's own
 * fixed answers: `"PlanningOnly"`/`false`/`false`/
 * `"RuntimeExposureReviewPending"`.
 *
 * Stage 660 adds `initializeCryptoWiringPlanState`/
 * `initializeCryptoRuntimeWiringAllowed`/
 * `initializeCryptoWorkerWiringAllowed`/
 * `initializeCryptoWiringPlanReason`
 * (`fedos_initialize_crypto_wiring_plan.ts`'s
 * `initializeCryptoWiringPlanState()`/
 * `initializeCryptoRuntimeWiringAllowed()`/
 * `initializeCryptoWorkerWiringAllowed()`/
 * `initializeCryptoWiringPlanReason()`, Stage 658/659) — the Runtime
 * initializeCrypto Wiring Plan's own fixed answers: `"PlanningOnly"`/
 * `false`/`false`/`"RuntimeWiringPlanPending"`. None of these expose
 * any implementation detail beyond these values; no payload,
 * plaintext, ciphertext, or key material is ever involved.
 *
 * Stage 668 adds `initializeCryptoPublicApiState`/
 * `initializeCryptoApiVisible`/`initializeCryptoPublicApiCallable`/
 * `initializeCryptoPublicApiReason`
 * (`fedos_initialize_crypto_public_api.ts`'s
 * `initializeCryptoPublicApiState()`/`initializeCryptoApiVisible()`/
 * `initializeCryptoPublicApiCallable()`/`initializeCryptoPublicApiReason()`,
 * Stage 666/667) — the Runtime initializeCrypto Public API's own
 * fixed answers: `"PlanningOnly"`/`false`/`false`/
 * `"PublicApiPending"`. `initializeCryptoPublicApiCallable` is
 * DELIBERATELY named differently from the pre-existing
 * `initializeCryptoCallable` (Stage 636, which reads
 * `fedos_initialize_crypto_api_contract.ts`'s INTERNAL Facade-level
 * callability) to avoid colliding with it — see
 * `docs/runtime_initialize_crypto_public_api.md` §1.
 *
 * Stage 676 adds `initializeCryptoInvocationState`/
 * `initializeCryptoInvocationAllowed`/
 * `initializeCryptoInvocationCompleted`/`initializeCryptoInvocationReason`
 * (`fedos_initialize_crypto_invocation_contract.ts`'s
 * `initializeCryptoInvocationState()`/`initializeCryptoInvocationAllowed()`/
 * `initializeCryptoInvocationCompleted()`/`initializeCryptoInvocationReason()`,
 * Stage 674/675) — the Runtime initializeCrypto Invocation Contract's
 * own fixed answers: `"PlanningOnly"`/`false`/`false`/
 * `"InvocationContractPending"`. None of these expose any
 * implementation detail beyond these values; no payload, plaintext,
 * ciphertext, or key material is ever involved.
 *
 * Stage 692 (Prototype Phase 001) adds
 * `runtimeInitializeCryptoPrototypeExposed`/
 * `runtimeInitializeCryptoPrototypeAllowed`/
 * `runtimeInitializeCryptoPrototypeReason`, reading
 * `src/runtime/create_runtime.ts`'s (Stage 691)
 * `createRuntimeInitializeCryptoResult()` — the real, now-wired
 * `AppRuntime.initializeCrypto()` prototype, DELIBERATELY SEPARATE
 * from the twelve `fedos_*.ts` `PlanningOnly` layers above.
 * `runtimeInitializeCryptoPrototypeExposed` is fixed `true` (the
 * member IS really wired into `AppRuntime` now); `...Allowed` is
 * fixed `false` and `...Reason` is fixed `"PrototypeDisabled"` — the
 * door exists, but calling it still does no real work.
 *
 * Stage 698 (Prototype Phase 002) adds `runtimePrototypeFacadeReached`/
 * `runtimePrototypeFacadeConnected`/`runtimePrototypeFacadeReason`,
 * reflecting `create_runtime.ts`'s (Stage 697) extension of
 * `createRuntimeInitializeCryptoResult()` one link deeper into the
 * Crypto Loader Facade. `runtimePrototypeFacadeReached` is fixed
 * `true` (the Facade IS actually called now, its result discarded);
 * `runtimePrototypeFacadeConnected` reads
 * `fedos_crypto_loader_facade.ts`'s own `cryptoLoaderFacadeInitialized()`
 * (fixed `false`, that file UNMODIFIED by this stage); `...Reason`
 * mirrors the Runtime-level `"PrototypeDisabled"` reason, unchanged.
 * `worker_crypto_diagnostics.ts` is intentionally NOT touched.
 *
 * Stage 725 (Prototype Phase 003) adds `cryptoLoaderBackendState`/
 * `cryptoLoaderBackendKind`/`cryptoLoaderBackendReady`/
 * `cryptoLoaderBackendReason`, reading
 * `fedos_crypto_loader_backend.ts`'s (Stage 713/714)
 * `cryptoLoaderBackendState()`/`cryptoLoaderBackendKind()`/
 * `cryptoLoaderBackendReady()`/`cryptoLoaderBackendReason()` — the
 * Backend Abstraction the Facade now reaches (Stage 721), one link
 * below the Facade's own pre-existing `cryptoLoaderFacadeBackend`
 * field. Fixed `"PlanningOnly"`/`"WasmPlanned"`/`false`/
 * `"BackendAbstractionPending"`. `worker_crypto_diagnostics.ts` is
 * intentionally NOT touched.
 *
 * Stage 741 (Prototype Phase 004) adds `wasmBackendState`/
 * `wasmBackendReady`/`wasmBackendLoaderAttached`/
 * `wasmBackendLoaderKind`/`wasmBackendReason`, reading
 * `fedos_wasm_backend.ts`'s (Stage 729/730)
 * `wasmBackendState()`/`wasmBackendReady()`/`wasmBackendLoaderAttached()`/
 * `wasmBackendLoaderKind()`/`wasmBackendReason()` — the WASM Backend
 * Planning layer the Backend Abstraction now reaches (Stage 737), one
 * link below the Backend Abstraction's own pre-existing
 * `cryptoLoaderBackendReady` field. Fixed `"PlanningOnly"`/`false`/
 * `false`/`"WasmLoaderPlanned"`/`"WasmBackendPlanningPending"`.
 * `worker_crypto_diagnostics.ts` is intentionally NOT touched.
 *
 * Stage 757 (Prototype Phase 005) adds `cryptoBackendInterfaceState`/
 * `cryptoBackendInterfaceReady`/`cryptoBackendSelected`/
 * `cryptoBackendActivated`/`cryptoBackendInterfaceReason`, reading
 * `fedos_crypto_backend_interface.ts`'s (Stage 745/746)
 * `cryptoBackendInterfaceState()`/`cryptoBackendInterfaceReady()`/
 * `cryptoBackendSelected()`/`cryptoBackendActivated()`/
 * `cryptoBackendInterfaceReason()` — the Backend Interface the
 * Backend Abstraction now reaches (Stage 753), inserted between the
 * Abstraction's own pre-existing `cryptoLoaderBackendReady` field and
 * the WASM Backend Planning layer's own fields above. Fixed
 * `"PlanningOnly"`/`false`/`"WasmPlanned"`/`false`/
 * `"BackendInterfacePending"`. `worker_crypto_diagnostics.ts` is
 * intentionally NOT touched.
 *
 * Stage 774 (Prototype Phase 006) adds `cryptoBackendResolverState`/
 * `cryptoBackendResolverSelected`/`cryptoBackendResolved`/
 * `cryptoBackendAvailable`/`cryptoBackendResolverReason`, reading
 * `fedos_crypto_backend_resolver.ts`'s (Stage 762/763)
 * `cryptoBackendResolverState()`/`cryptoBackendResolverSelected()`/
 * `cryptoBackendResolved()`/`cryptoBackendAvailable()`/
 * `cryptoBackendResolverReason()` — the Backend Resolver the Backend
 * Interface now ALSO reaches as a second, separate leaf (Stage 764),
 * alongside its pre-existing reach into WASM Backend Planning. Fixed
 * `"PlanningOnly"`/`"WasmPlanned"`/`false`/`false`/
 * `"BackendResolutionPending"`. `worker_crypto_diagnostics.ts` is
 * intentionally NOT touched.
 *
 * Stage 793 (Prototype Phase 008) adds `wasmBackendLoaderReached`/
 * `wasmBackendLoaderLoaded`/`wasmBackendLoaderDecision`, reading
 * `fedos_wasm_backend.ts`'s (Stage 793) `wasmBackendLoaderReached()`/
 * `wasmBackendLoaderLoaded()`/`wasmBackendLoaderDecision()` — the
 * FIRST real connection from WASM Backend Planning to the previously
 * "unwired" `FedosWasmLoader` Skeleton (`fedos_wasm_loader.ts`,
 * Stage 489–492). Fixed `true`/`false`/`"BlockedByPolicy"`.
 * `wasmBackendState`/`wasmBackendReady`/`wasmBackendLoaderAttached`/
 * `wasmBackendLoaderKind`/`wasmBackendReason` above are UNCHANGED by
 * this stage. `worker_crypto_diagnostics.ts` is intentionally NOT
 * touched.
 *
 * Stage 809 (Prototype Phase 009) adds `loaderPlanningState`/
 * `loaderPlanningDecision`/`loaderLoaded`, reading
 * `fedos_wasm_loader.ts`'s (Stage 809) `loaderPlanningState()`/
 * `loaderPlanningDecision()`/`loaderLoaded()` — a NEW, separately-named
 * Loader State reader added alongside the pre-existing `status()`-based
 * `loaderSkeletonState`/`loaderSkeletonMode`/`loaderSkeletonPolicy`
 * fields above (Stage 495, UNCHANGED). Fixed
 * `"Planning"`/`"BlockedByPolicy"`/`false`. `worker_crypto_diagnostics.ts`
 * is intentionally NOT touched.
 *
 * Stage 817 (Prototype Phase 010) adds `loaderPolicyAllowed`/
 * `loaderPolicyDecision`/`loaderPolicyReason`, reading
 * `fedos_wasm_loader.ts`'s (Stage 817) `loaderPolicyAllowed()`/
 * `loaderPolicyDecision()`/`loaderPolicyReason()` — a NEW, separately-named
 * Loader Policy reader, independent of the pre-existing
 * `loaderPlanningState`/`loaderPlanningDecision`/`loaderLoaded` fields
 * above (Stage 809, UNCHANGED) and of `loaderSkeletonPolicy` (Stage 495,
 * UNCHANGED — a different, pre-existing `loaderPolicy()` label read).
 * Fixed `false`/`"BlockedByPolicy"`/`"PrototypePolicy"`.
 * `worker_crypto_diagnostics.ts` is intentionally NOT touched.
 *
 * Stage 825 (Prototype Phase 011) adds `loaderPlanReachedPolicy`,
 * reading `fedos_wasm_loader.ts`'s (Stage 825) `loaderPlanReachedPolicy()`
 * — whether `planLoad()` structurally reaches `policy()` now (it does,
 * discarding the result). The pre-existing `loaderPolicyAllowed`/
 * `loaderPolicyDecision`/`loaderPolicyReason` fields above (Stage 817)
 * are UNCHANGED by this stage. Fixed `true`.
 * `worker_crypto_diagnostics.ts` is intentionally NOT touched.
 *
 * Stage 833 (Prototype Phase 012) adds `loaderPolicyEvaluated`, reading
 * `fedos_wasm_loader.ts`'s (Stage 833) `loaderPolicyEvaluated()` —
 * whether `planLoad()` actually branches on `policy().allowed` now
 * (it does, always taking the `BlockedByPolicy` path since `allowed`
 * is permanently `false`). Every pre-existing field above, including
 * `loaderPlanReachedPolicy` (Stage 825), is UNCHANGED by this stage.
 * Fixed `true`. `worker_crypto_diagnostics.ts` is intentionally NOT
 * touched.
 *
 * Stage 841 (Prototype Phase 013) adds `loaderLoadPlanCreated`/
 * `loaderLoadPlanAllowed`/`loaderLoadPlanShouldLoad`/
 * `loaderLoadPlanBackend`, reading `fedos_wasm_loader.ts`'s (Stage 841)
 * `loaderLoadPlanCreated()`/`loaderLoadPlanAllowed()`/
 * `loaderLoadPlanShouldLoad()`/`loaderLoadPlanBackend()` — the internal
 * Load Plan object `planLoad()` now builds and confirms before
 * returning its own, unrelated `BlockedByPolicy` answer. Every
 * pre-existing field above is UNCHANGED by this stage. Fixed
 * `true`/`false`/`false`/`"Wasm"`. `worker_crypto_diagnostics.ts` is
 * intentionally NOT touched.
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
  FedosWasmLoaderDecisionState,
  FedosWasmLoaderMode,
  FedosWasmLoaderPlanningState,
  FedosWasmLoaderPolicy,
  FedosWasmLoaderState as FedosWasmLoaderSkeletonState,
} from "./fedos_wasm_loader.js";
import {
  loaderLoaded as fedosLoaderLoaded,
  loaderLoadPlanAllowed as fedosLoaderLoadPlanAllowed,
  loaderLoadPlanBackend as fedosLoaderLoadPlanBackend,
  loaderLoadPlanCreated as fedosLoaderLoadPlanCreated,
  loaderLoadPlanShouldLoad as fedosLoaderLoadPlanShouldLoad,
  loaderMode as fedosLoaderSkeletonMode,
  loaderPlanningDecision as fedosLoaderPlanningDecision,
  loaderPlanningState as fedosLoaderPlanningState,
  loaderPlanReachedPolicy as fedosLoaderPlanReachedPolicy,
  loaderPolicy as fedosLoaderSkeletonPolicy,
  loaderPolicyAllowed as fedosLoaderPolicyAllowed,
  loaderPolicyDecision as fedosLoaderPolicyDecision,
  loaderPolicyEvaluated as fedosLoaderPolicyEvaluated,
  loaderPolicyReason as fedosLoaderPolicyReason,
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
  FedosCryptoLoaderBackendKind,
  FedosCryptoLoaderBackendReason,
  FedosCryptoLoaderBackendState,
} from "./fedos_crypto_loader_backend.js";
import {
  cryptoLoaderBackendKind as fedosCryptoLoaderBackendKind,
  cryptoLoaderBackendReady as fedosCryptoLoaderBackendReady,
  cryptoLoaderBackendReason as fedosCryptoLoaderBackendReason,
  cryptoLoaderBackendState as fedosCryptoLoaderBackendState,
} from "./fedos_crypto_loader_backend.js";
import type {
  FedosWasmBackendLoaderKind,
  FedosWasmBackendReason,
  FedosWasmBackendState,
} from "./fedos_wasm_backend.js";
import {
  wasmBackendLoaderAttached as fedosWasmBackendLoaderAttached,
  wasmBackendLoaderDecision as fedosWasmBackendLoaderDecision,
  wasmBackendLoaderKind as fedosWasmBackendLoaderKind,
  wasmBackendLoaderLoaded as fedosWasmBackendLoaderLoaded,
  wasmBackendLoaderReached as fedosWasmBackendLoaderReached,
  wasmBackendReady as fedosWasmBackendReady,
  wasmBackendReason as fedosWasmBackendReason,
  wasmBackendState as fedosWasmBackendState,
} from "./fedos_wasm_backend.js";
import type {
  FedosCryptoBackendInterfaceReason,
  FedosCryptoBackendInterfaceState,
} from "./fedos_crypto_backend_interface.js";
import {
  cryptoBackendActivated as fedosCryptoBackendActivated,
  cryptoBackendInterfaceReady as fedosCryptoBackendInterfaceReady,
  cryptoBackendInterfaceReason as fedosCryptoBackendInterfaceReason,
  cryptoBackendInterfaceState as fedosCryptoBackendInterfaceState,
  cryptoBackendSelected as fedosCryptoBackendSelected,
} from "./fedos_crypto_backend_interface.js";
import type {
  FedosCryptoBackendResolverReason,
  FedosCryptoBackendResolverState,
} from "./fedos_crypto_backend_resolver.js";
import {
  cryptoBackendAvailable as fedosCryptoBackendAvailable,
  cryptoBackendResolved as fedosCryptoBackendResolved,
  cryptoBackendResolverReason as fedosCryptoBackendResolverReason,
  cryptoBackendResolverSelected as fedosCryptoBackendResolverSelected,
  cryptoBackendResolverState as fedosCryptoBackendResolverState,
} from "./fedos_crypto_backend_resolver.js";
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
import type { ActivationReason } from "./runtime_crypto_activation_policy.js";
import { evaluateRuntimeCryptoActivation } from "./runtime_crypto_activation_policy.js";
import type { RuntimeCryptoProviderName } from "./runtime_crypto_config.js";
import { getRuntimeCryptoConfig } from "./runtime_crypto_config.js";
import { FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME } from "./runtime_crypto_registry.js";
import type { RuntimeInitializeCryptoReason } from "./types.js";
import { createRuntimeInitializeCryptoResult } from "./create_runtime.js";

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
  /**
   * Stage 692 (Prototype Phase 001) — whether `AppRuntime.initializeCrypto`
   * is currently exposed as a real, callable member on `AppRuntime` —
   * `createRuntime()` (Stage 691) always wires it in, so this is fixed
   * `true`. DELIBERATELY DISTINCT from every `PlanningOnly` layer's own
   * `exposed`/`visible`-style field above, all of which stay `false`
   * because none of them is ever wired into `AppRuntime`.
   */
  readonly runtimeInitializeCryptoPrototypeExposed: boolean;
  /**
   * Whether calling `AppRuntime.initializeCrypto()` actually performs
   * any real work — the same answer as
   * `createRuntimeInitializeCryptoResult().allowed`
   * (`src/runtime/create_runtime.ts`, Stage 691). Fixed `false` in this
   * stage: the prototype is exposed, but not yet allowed to do
   * anything.
   */
  readonly runtimeInitializeCryptoPrototypeAllowed: boolean;
  /**
   * WHY `AppRuntime.initializeCrypto()` is not currently allowed to do
   * anything — the same answer as
   * `createRuntimeInitializeCryptoResult().reason`. Fixed
   * `"PrototypeDisabled"` in this stage.
   */
  readonly runtimeInitializeCryptoPrototypeReason: RuntimeInitializeCryptoReason;
  /**
   * Stage 698 (Prototype Phase 002) — whether the Runtime prototype's
   * implementation actually reaches the Crypto Loader Facade —
   * `create_runtime.ts`'s own `createRuntimeInitializeCryptoResult()`
   * (Stage 697) now calls `createCryptoLoaderFacade()`, so this is
   * fixed `true`. Reaching the Facade is a STRUCTURAL fact, distinct
   * from whether the Facade itself is connected/initialized (see
   * `runtimePrototypeFacadeConnected` below).
   */
  readonly runtimePrototypeFacadeReached: boolean;
  /**
   * Whether the Crypto Loader Facade itself is initialized — the SAME
   * answer as `cryptoLoaderFacadeInitialized()`
   * (`fedos_crypto_loader_facade.ts`, unmodified by this stage). Fixed
   * `false`: Runtime reaching the Facade does not connect or initialize
   * it.
   */
  readonly runtimePrototypeFacadeConnected: boolean;
  /**
   * WHY the Runtime prototype does not go beyond reaching the Facade —
   * the same answer as `createRuntimeInitializeCryptoResult().reason`.
   * Fixed `"PrototypeDisabled"` in this stage.
   */
  readonly runtimePrototypeFacadeReason: RuntimeInitializeCryptoReason;
  /**
   * Stage 725 (Prototype Phase 003) — the Crypto Loader Backend
   * Abstraction's own fixed coarse state —
   * `cryptoLoaderBackendState()`'s own answer
   * (`src/runtime/fedos_crypto_loader_backend.ts`, Stage 713/714).
   * Fixed `"PlanningOnly"` in this stage.
   */
  readonly cryptoLoaderBackendState: FedosCryptoLoaderBackendState;
  /**
   * The currently designated backend candidate —
   * `cryptoLoaderBackendKind()`'s own answer. Fixed `"WasmPlanned"`
   * in this stage; `"NativePlanned"`/`"PythonPlanned"` are named but
   * never produced.
   */
  readonly cryptoLoaderBackendKind: FedosCryptoLoaderBackendKind;
  /**
   * Whether the designated backend is ready to serve a request —
   * `cryptoLoaderBackendReady()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly cryptoLoaderBackendReady: boolean;
  /**
   * WHY the designated backend is not ready — `cryptoLoaderBackendReason()`'s
   * own answer. Fixed `"BackendAbstractionPending"` in this stage.
   */
  readonly cryptoLoaderBackendReason: FedosCryptoLoaderBackendReason;
  /**
   * Stage 741 (Prototype Phase 004) — the WASM Backend Planning
   * layer's own fixed coarse state — `wasmBackendState()`'s own
   * answer (`src/runtime/fedos_wasm_backend.ts`, Stage 729/730).
   * Fixed `"PlanningOnly"` in this stage.
   */
  readonly wasmBackendState: FedosWasmBackendState;
  /**
   * Whether a real WASM backend is ready to serve a request —
   * `wasmBackendReady()`'s own answer. Fixed `false` in this stage.
   */
  readonly wasmBackendReady: boolean;
  /**
   * Whether a real WASM Loader has ever actually been attached —
   * `wasmBackendLoaderAttached()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly wasmBackendLoaderAttached: boolean;
  /**
   * The loader kind this backend currently plans to attach —
   * `wasmBackendLoaderKind()`'s own answer. Fixed
   * `"WasmLoaderPlanned"` in this stage.
   */
  readonly wasmBackendLoaderKind: FedosWasmBackendLoaderKind;
  /**
   * WHY the WASM backend is not ready — `wasmBackendReason()`'s own
   * answer. Fixed `"WasmBackendPlanningPending"` in this stage.
   */
  readonly wasmBackendReason: FedosWasmBackendReason;
  /**
   * Stage 793 (Prototype Phase 008) — whether `createWasmBackend()`
   * has actually reached the real `FedosWasmLoader` —
   * `wasmBackendLoaderReached()`'s own answer. Fixed `true` in this
   * stage: the code path exists and runs, NOT a claim that any module
   * is loaded.
   */
  readonly wasmBackendLoaderReached: boolean;
  /**
   * Whether the real WASM Loader has ever actually loaded anything —
   * `wasmBackendLoaderLoaded()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly wasmBackendLoaderLoaded: boolean;
  /**
   * The real `FedosWasmLoader.planLoad()`'s own decision state —
   * `wasmBackendLoaderDecision()`'s own answer. Fixed
   * `"BlockedByPolicy"` in this stage.
   */
  readonly wasmBackendLoaderDecision: FedosWasmLoaderDecisionState;
  /**
   * Stage 809 (Prototype Phase 009) — the real `FedosWasmLoader`'s own
   * coarse planning state — `loaderPlanningState()`'s own answer
   * (`src/runtime/fedos_wasm_loader.ts`, Stage 809). Fixed `"Planning"`
   * in this stage. DELIBERATELY separate from `loaderSkeletonState`
   * below (Stage 495, `status()`'s own field, UNCHANGED).
   */
  readonly loaderPlanningState: FedosWasmLoaderPlanningState;
  /**
   * The decision `FedosWasmLoader.planLoad()` would resolve to,
   * without calling it — `loaderPlanningDecision()`'s own answer.
   * Fixed `"BlockedByPolicy"` in this stage.
   */
  readonly loaderPlanningDecision: FedosWasmLoaderDecisionState;
  /**
   * Whether the real WASM Loader has ever actually loaded anything —
   * `loaderLoaded()`'s own answer. Fixed `false` in this stage.
   */
  readonly loaderLoaded: boolean;
  /**
   * Stage 817 (Prototype Phase 010) — the real `FedosWasmLoader`'s own
   * fixed POLICY allowance — `loaderPolicyAllowed()`'s own answer
   * (`src/runtime/fedos_wasm_loader.ts`, Stage 817). Fixed `false` in
   * this stage.
   */
  readonly loaderPolicyAllowed: boolean;
  /**
   * The POLICY decision `FedosWasmLoader.policy()` resolves to —
   * `loaderPolicyDecision()`'s own answer. Fixed `"BlockedByPolicy"`
   * in this stage.
   */
  readonly loaderPolicyDecision: FedosWasmLoaderDecisionState;
  /**
   * WHY the POLICY denies every operation — `loaderPolicyReason()`'s
   * own answer. Fixed `"PrototypePolicy"` in this stage.
   */
  readonly loaderPolicyReason: string;
  /**
   * Stage 825 (Prototype Phase 011) — whether `FedosWasmLoader.planLoad()`
   * structurally reaches `policy()` — `loaderPlanReachedPolicy()`'s
   * own answer (`src/runtime/fedos_wasm_loader.ts`, Stage 825). Fixed
   * `true` in this stage: the call happens every time, but its result
   * is always discarded and `planLoad()`'s own return value never
   * changes.
   */
  readonly loaderPlanReachedPolicy: boolean;
  /**
   * Stage 833 (Prototype Phase 012) — whether `FedosWasmLoader.planLoad()`
   * actually EVALUATES the `policy()` answer (branches on `.allowed`)
   * rather than merely reaching and discarding it —
   * `loaderPolicyEvaluated()`'s own answer
   * (`src/runtime/fedos_wasm_loader.ts`, Stage 833). Fixed `true` in
   * this stage: the branch runs every time, but it always takes the
   * `BlockedByPolicy` path, so `planLoad()`'s own return value never
   * changes.
   */
  readonly loaderPolicyEvaluated: boolean;
  /**
   * Stage 841 (Prototype Phase 013) — whether `FedosWasmLoader.planLoad()`
   * structurally creates an internal Load Plan object —
   * `loaderLoadPlanCreated()`'s own answer
   * (`src/runtime/fedos_wasm_loader.ts`, Stage 841). Fixed `true` in
   * this stage: the Load Plan is built every time `policy.allowed`
   * evaluates `false` (always, today), but its own fields are never
   * merged into `planLoad()`'s return value.
   */
  readonly loaderLoadPlanCreated: boolean;
  /**
   * The Load Plan's own fixed `allowed` field —
   * `loaderLoadPlanAllowed()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly loaderLoadPlanAllowed: boolean;
  /**
   * The Load Plan's own fixed `shouldLoad` field —
   * `loaderLoadPlanShouldLoad()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly loaderLoadPlanShouldLoad: boolean;
  /**
   * The Load Plan's own fixed `backend` field —
   * `loaderLoadPlanBackend()`'s own answer. Fixed `"Wasm"` in this
   * stage.
   */
  readonly loaderLoadPlanBackend: "Wasm";
  /**
   * Stage 757 (Prototype Phase 005) — the Backend Interface's own
   * fixed coarse state — `cryptoBackendInterfaceState()`'s own answer
   * (`src/runtime/fedos_crypto_backend_interface.ts`, Stage 745/746).
   * Fixed `"PlanningOnly"` in this stage.
   */
  readonly cryptoBackendInterfaceState: FedosCryptoBackendInterfaceState;
  /**
   * Whether the Backend Interface itself is ready to route a real
   * call — `cryptoBackendInterfaceReady()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly cryptoBackendInterfaceReady: boolean;
  /**
   * Which backend candidate the Interface currently talks to —
   * `cryptoBackendSelected()`'s own answer. Fixed `"WasmPlanned"` in
   * this stage.
   */
  readonly cryptoBackendSelected: FedosCryptoLoaderBackendKind;
  /**
   * Whether any backend has ever actually been activated through the
   * Interface — `cryptoBackendActivated()`'s own answer. Fixed
   * `false` in this stage.
   */
  readonly cryptoBackendActivated: boolean;
  /**
   * WHY the Interface is not ready — `cryptoBackendInterfaceReason()`'s
   * own answer. Fixed `"BackendInterfacePending"` in this stage.
   */
  readonly cryptoBackendInterfaceReason: FedosCryptoBackendInterfaceReason;
  /**
   * Stage 774 (Prototype Phase 006) — the Backend Resolver's own
   * fixed coarse state — `cryptoBackendResolverState()`'s own answer
   * (`src/runtime/fedos_crypto_backend_resolver.ts`, Stage 762/763).
   * Fixed `"PlanningOnly"` in this stage.
   */
  readonly cryptoBackendResolverState: FedosCryptoBackendResolverState;
  /**
   * Which backend this repository currently plans to use —
   * `cryptoBackendResolverSelected()`'s own answer. Fixed
   * `"WasmPlanned"` in this stage.
   */
  readonly cryptoBackendResolverSelected: FedosCryptoLoaderBackendKind;
  /**
   * Whether resolution has ever actually completed —
   * `cryptoBackendResolved()`'s own answer. Fixed `false` in this
   * stage.
   */
  readonly cryptoBackendResolved: boolean;
  /**
   * Whether the resolved backend is actually available to load right
   * now — `cryptoBackendAvailable()`'s own answer. Fixed `false` in
   * this stage.
   */
  readonly cryptoBackendAvailable: boolean;
  /**
   * WHY resolution/availability is not settled —
   * `cryptoBackendResolverReason()`'s own answer. Fixed
   * `"BackendResolutionPending"` in this stage.
   */
  readonly cryptoBackendResolverReason: FedosCryptoBackendResolverReason;
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
  const prototypeResult = createRuntimeInitializeCryptoResult();
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
    runtimeInitializeCryptoPrototypeExposed: true,
    runtimeInitializeCryptoPrototypeAllowed: prototypeResult.allowed,
    runtimeInitializeCryptoPrototypeReason: prototypeResult.reason,
    runtimePrototypeFacadeReached: true,
    runtimePrototypeFacadeConnected: fedosCryptoLoaderFacadeInitialized(),
    runtimePrototypeFacadeReason: prototypeResult.reason,
    cryptoLoaderBackendState: fedosCryptoLoaderBackendState(),
    cryptoLoaderBackendKind: fedosCryptoLoaderBackendKind(),
    cryptoLoaderBackendReady: fedosCryptoLoaderBackendReady(),
    cryptoLoaderBackendReason: fedosCryptoLoaderBackendReason(),
    wasmBackendState: fedosWasmBackendState(),
    wasmBackendReady: fedosWasmBackendReady(),
    wasmBackendLoaderAttached: fedosWasmBackendLoaderAttached(),
    wasmBackendLoaderKind: fedosWasmBackendLoaderKind(),
    wasmBackendReason: fedosWasmBackendReason(),
    wasmBackendLoaderReached: fedosWasmBackendLoaderReached(),
    wasmBackendLoaderLoaded: fedosWasmBackendLoaderLoaded(),
    wasmBackendLoaderDecision: fedosWasmBackendLoaderDecision(),
    loaderPlanningState: fedosLoaderPlanningState(),
    loaderPlanningDecision: fedosLoaderPlanningDecision(),
    loaderLoaded: fedosLoaderLoaded(),
    loaderPolicyAllowed: fedosLoaderPolicyAllowed(),
    loaderPolicyDecision: fedosLoaderPolicyDecision(),
    loaderPolicyReason: fedosLoaderPolicyReason(),
    loaderPlanReachedPolicy: fedosLoaderPlanReachedPolicy(),
    loaderPolicyEvaluated: fedosLoaderPolicyEvaluated(),
    loaderLoadPlanCreated: fedosLoaderLoadPlanCreated(),
    loaderLoadPlanAllowed: fedosLoaderLoadPlanAllowed(),
    loaderLoadPlanShouldLoad: fedosLoaderLoadPlanShouldLoad(),
    loaderLoadPlanBackend: fedosLoaderLoadPlanBackend(),
    cryptoBackendInterfaceState: fedosCryptoBackendInterfaceState(),
    cryptoBackendInterfaceReady: fedosCryptoBackendInterfaceReady(),
    cryptoBackendSelected: fedosCryptoBackendSelected(),
    cryptoBackendActivated: fedosCryptoBackendActivated(),
    cryptoBackendInterfaceReason: fedosCryptoBackendInterfaceReason(),
    cryptoBackendResolverState: fedosCryptoBackendResolverState(),
    cryptoBackendResolverSelected: fedosCryptoBackendResolverSelected(),
    cryptoBackendResolved: fedosCryptoBackendResolved(),
    cryptoBackendAvailable: fedosCryptoBackendAvailable(),
    cryptoBackendResolverReason: fedosCryptoBackendResolverReason(),
  };
}

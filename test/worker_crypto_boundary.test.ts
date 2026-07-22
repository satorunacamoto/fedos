import { describe, it, expect } from "vitest";
import { PlaceholderRuntimeCryptoProvider } from "../src/runtime/crypto_provider.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  WORKER_CRYPTO_CONFIG,
  WORKER_CRYPTO_PROVIDER_NAMES,
  getWorkerCryptoConfig,
} from "../src/runtime/worker_crypto_config.js";
import {
  WORKER_FEDOS_PROVIDER_NAME,
  WORKER_PLACEHOLDER_PROVIDER_NAME,
  createDefaultWorkerCryptoProviderRegistry,
} from "../src/runtime/worker_crypto_registry.js";
import { buildWorkerCryptoProvider } from "../src/runtime/worker_crypto_bridge.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
import { RuntimeCryptoProviderRegistry } from "../src/runtime/runtime_crypto_registry.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import configSource from "../src/runtime/worker_crypto_config.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/runtime/worker_crypto_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bridgeSource from "../src/runtime/worker_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeConfigSource from "../src/runtime/runtime_crypto_config.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeBridgeSource from "../src/runtime/runtime_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeRegistrySource from "../src/runtime/runtime_crypto_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationBoundaryDocSource from "../docs/runtime_worker_activation_boundary.md?raw";

/**
 * Stage 273–280 — "Worker Opt-in Gate Foundation":
 * src/runtime/worker_crypto_config.ts (Stage 273),
 * src/runtime/worker_crypto_registry.ts (Stage 274),
 * src/runtime/worker_crypto_bridge.ts (Stage 275),
 * docs/runtime_worker_activation_boundary.md (Stage 276),
 * src/runtime/worker_crypto_diagnostics.ts (Stage 277). Default OFF,
 * Worker never calls FedOS, Runtime never executes crypto, no Relay
 * connection, and the Worker/Runtime crypto stacks never reach into each
 * other's registry/bridge/config.
 */
describe("Worker crypto opt-in gate, foundation only (Stage 273-280)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  const WORKER_PRODUCTION_FILES: [string, string][] = [
    ["worker_crypto_config.ts", configSource],
    ["worker_crypto_registry.ts", registrySource],
    ["worker_crypto_bridge.ts", bridgeSource],
    ["worker_crypto_diagnostics.ts", diagnosticsSource],
  ];

  it("1. WORKER_CRYPTO_CONFIG/getWorkerCryptoConfig fix workerCryptoEnabled: false and workerCryptoProvider: 'placeholder'", () => {
    expect(WORKER_CRYPTO_CONFIG).toEqual({
      workerCryptoEnabled: false,
      workerCryptoProvider: "placeholder",
    });
    expect(getWorkerCryptoConfig()).toEqual(WORKER_CRYPTO_CONFIG);
    expect(Object.isFrozen(WORKER_CRYPTO_CONFIG)).toBe(true);
    expect(WORKER_CRYPTO_PROVIDER_NAMES).toEqual(["placeholder", "fedos"]);
  });

  it("2. worker_crypto_config.ts reads no RuntimeEnv/process.env field", () => {
    const codeOnly = codeOnlyOf(configSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/RuntimeEnv/);
  });

  it("3. the default Worker registry registers placeholder and fedos, and fedos is constructible but never executed", async () => {
    const registry = createDefaultWorkerCryptoProviderRegistry();
    expect(registry.names()).toEqual([
      WORKER_PLACEHOLDER_PROVIDER_NAME,
      WORKER_FEDOS_PROVIDER_NAME,
    ]);
    const provider = registry.create(WORKER_FEDOS_PROVIDER_NAME);
    expect(provider).toBeInstanceOf(FedosRuntimeCryptoProvider);
    const decision = await provider!.encrypt({});
    expect(decision.state).toBe("Unsupported");
  });

  it("4. the Worker registry is a separate instance from the Runtime registry", () => {
    const workerRegistry = createDefaultWorkerCryptoProviderRegistry();
    expect(workerRegistry).toBeInstanceOf(RuntimeCryptoProviderRegistry);
    // Registering in one does not appear in the other.
    workerRegistry.register("custom-worker-only", () => new PlaceholderRuntimeCryptoProvider());
    expect(workerRegistry.names()).toContain("custom-worker-only");
  });

  it("5. buildWorkerCryptoProvider always resolves placeholder (the two-flag gate never passes), only via the Worker Registry", () => {
    const provider = buildWorkerCryptoProvider();
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(provider).not.toBeInstanceOf(FedosRuntimeCryptoProvider);
  });

  it("6. the bridge's two-flag gate is evaluated with && (never ||) in source", () => {
    expect(bridgeSource).toMatch(
      /workerCryptoEnabled\s*&&\s*workerCryptoProvider\s*===\s*WORKER_FEDOS_PROVIDER_NAME/,
    );
    expect(codeOnlyOf(bridgeSource)).not.toMatch(
      /workerCryptoEnabled\s*\|\|\s*workerCryptoProvider/,
    );
  });

  it("7. no RuntimeCryptoProvider is constructed with `new` outside worker_crypto_registry.ts among the Worker production files", () => {
    for (const [name, src] of WORKER_PRODUCTION_FILES) {
      if (name === "worker_crypto_registry.ts") continue;
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, `${name} must not construct a provider with new`).not.toMatch(
        /new\s+(PlaceholderRuntimeCryptoProvider|FedosRuntimeCryptoProvider)/,
      );
    }
  });

  it("8. Worker crypto files never call encrypt/decrypt themselves", () => {
    for (const [name, src] of WORKER_PRODUCTION_FILES) {
      expect(codeOnlyOf(src), name).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
    }
  });

  it("9. Worker crypto files never import the Runtime's own registry/bridge/config (each boundary stays independent)", () => {
    expect(codeOnlyOf(bridgeSource)).not.toMatch(
      /createDefaultRuntimeCryptoProviderRegistry|buildRuntimeCryptoProvider|getRuntimeCryptoConfig/,
    );
    expect(codeOnlyOf(registrySource)).not.toMatch(/createDefaultRuntimeCryptoProviderRegistry/);
    expect(codeOnlyOf(diagnosticsSource)).not.toMatch(/getRuntimeCryptoConfig|runtimeCryptoActivationStatus/);
  });

  it("10. the Runtime's own registry/bridge/config never import any Worker crypto file (independent both ways)", () => {
    for (const src of [runtimeConfigSource, runtimeBridgeSource, runtimeRegistrySource, createRuntimeSource, runtimeTypesSource]) {
      // Match actual imports/identifiers, not the pre-existing (Stage 252)
      // docs/runtime_worker_crypto_bridge.md filename reference, which
      // legitimately contains the substring "worker_crypto_bridge".
      expect(src).not.toMatch(/from\s+["'][^"']*worker_crypto_(config|registry|bridge|diagnostics)\.js["']/);
      expect(src).not.toMatch(/\bWorkerCryptoConfig\b|\bbuildWorkerCryptoProvider\b/);
    }
  });

  it("11. no direct Rust/Relay/Storage reference in the four Worker production files; no real WASM execution primitive either (Stage 388 legitimately references the WASM Boundary abstraction by name in worker_crypto_diagnostics.ts)", () => {
    for (const [name, src] of WORKER_PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, name).not.toMatch(/fedos-core-rust|Relay|Storage|nip.?17|nip-17/i);
      if (name !== "worker_crypto_diagnostics.ts") {
        expect(codeOnly, name).not.toMatch(/wasm/i);
      } else {
        expect(codeOnly, name).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)/);
        expect(codeOnly, name).not.toMatch(/wasm-bindgen/i);
        expect(codeOnly, name).not.toMatch(/\.wasm['"`]/);
      }
    }
  });

  it("12. src/worker.ts does not reference any Worker crypto file", () => {
    expect(workerSource).not.toMatch(
      /worker_crypto_config|worker_crypto_registry|worker_crypto_bridge|worker_crypto_diagnostics|buildWorkerCryptoProvider|WorkerCryptoConfig/,
    );
  });

  it("13. workerCryptoActivationStatus reports { enabled: false, configuredProvider: 'placeholder', effectiveProvider: 'placeholder', reachable: false }", () => {
    expect(workerCryptoActivationStatus()).toEqual({
      enabled: false,
      configuredProvider: "placeholder",
      configuredEnabled: "disabled",
      effectiveProvider: "placeholder",
      reachable: false,
      activationReason: "DisabledByConfig",
      providerImplemented: false,
      providerImplementationState: "NotImplemented",
      providerExecutionState: "BlockedByImplementation",
      providerOperationState: "Blocked",
      providerImplementationStage: "RustInvocationAdapterReady",
      opaqueApiState: "NotConnected",
      runtimeExecutionState: "BlockedByImplementation",
      rustBoundaryState: "NotConnected",
      rustBoundaryReachable: true,
      rustApiState: "NotConnected",
      rustApiReachable: true,
      rustExecutionReviewState: "Blocked",
      rustExecutionReviewReason: "BlockedBeforeCrypto",
      rustExecutionApproved: false,
      internalRustCallState: "Planned",
      internalRustCallReachable: true,
      rustInvocationAdapterState: "NotConnected",
      rustInvocationAdapterReachable: true,
      rustInvocationAdapterExecuted: false,
      rustPingReachable: true,
      rustPingExecuted: true,
      rustPingSucceeded: true,
      wasmBoundaryState: "NotLoaded",
      wasmBoundaryReachable: true,
      wasmLoaded: false,
      wasmArtifactState: "NotBuilt",
      wasmArtifactReachable: true,
      wasmArtifactBuilt: false,
      executionBackend: "Wasm",
      executionBackendState: "Planning",
      executionBackendReachable: true,
      backendImplemented: false,
      wasmToolchainInstalled: false,
      wasmToolchainVerified: false,
      wasmBuildReady: false,
      wasmArtifactGenerated: false,
      generatedArtifactPath: null,
      loaderContractState: "NotLoaded",
      loaderImportMode: "StaticPlanning",
      loaderInitialized: false,
      loaderSkeletonState: "NotLoaded",
      loaderSkeletonMode: "PlanningOnly",
      loaderSkeletonPolicy: "FailClosed",
      loaderPlanState: "PlanningOnly",
      loaderImportAllowed: false,
      loaderInitializationAllowed: false,
      loaderImportPolicyState: "Blocked",
      loaderImportPolicyAllowed: false,
      loaderImportPolicyReason: "BlockedByPolicy",
      staticImportPlanState: "PlanningOnly",
      staticImportTarget: "packages/fedos-core-rust/pkg/fedos_core_rust.js",
      staticImportAllowed: false,
      staticImportReviewState: "ReviewedAndBlocked",
      staticImportReviewApproved: false,
      staticImportReviewReason: "GeneratedArtifactNotCommitted",
      readinessState: "PlanningOnly",
      staticImportReady: false,
      staticImportReadinessReason: "RuntimeNotReady",
      artifactPresenceState: "PlanningOnly",
      artifactPresent: false,
      artifactPresenceReason: "ArtifactNotGeneratedForRuntime",
      staticImportActivationState: "PlanningOnly",
      staticImportActivationApproved: false,
      staticImportActivationReason: "RuntimeActivationReviewPending",
      generatedArtifactDistributionMode: "BuildTimeGenerated",
      generatedArtifactCommitted: false,
      staticImportSafe: false,
      buildTimeLoaderStrategy: "DynamicLoaderPlanned",
      buildTimeLoaderRequiresPrebuild: true,
      buildTimeLoaderRuntimeAttachAllowed: false,
      dynamicLoaderGateState: "PlanningOnly",
      dynamicLoaderAllowed: false,
      dynamicLoaderGateReason: "DynamicLoaderGatePending",
      dynamicLoaderDevApprovalState: "PlanningOnly",
      dynamicLoaderDevApproved: false,
      dynamicLoaderDevReason: "DevApprovalPending",
      cryptoInitializationMode: "ExplicitInitialization",
      cryptoInitializationAllowed: false,
      cryptoInitialized: false,
      cryptoInitializationReason: "InitializationApprovalPending",
      cryptoLoaderFacadeState: "PlanningOnly",
      cryptoLoaderFacadeBackend: "WasmPlanned",
      cryptoLoaderFacadeInitialized: false,
      cryptoLoaderFacadeReason: "FacadeInitializationPending",
      providerFacadeBoundaryState: "PlanningOnly",
      providerFacadeConnected: false,
      providerFacadeReason: "ProviderFacadeConnectionPending",
      providerInitializationRequestState: "PlanningOnly",
      providerInitializationRequested: false,
      providerInitializationAllowed: false,
      providerInitializationReason: "ProviderInitializationRequestPending",
      providerInitializationApprovalState: "PlanningOnly",
      providerInitializationApproved: false,
      providerInitializationApprovalReason: "ProviderInitializationApprovalPending",
      providerInitFacadeContractState: "PlanningOnly",
      providerInitFacadeContractReady: false,
      providerInitFacadeContractReason: "ProviderInitFacadeContractPending",
      initializeCryptoApiState: "PlanningOnly",
      initializeCryptoCallable: false,
      initializeCryptoInitialized: false,
      initializeCryptoReason: "InitializeCryptoApiPending",
      cryptoInitializationResultState: "PlanningOnly",
      cryptoInitializationSuccess: false,
      cryptoInitializationBackend: "None",
      cryptoInitializationResultReason: "InitializationResultPending",
      initializeCryptoExposureState: "PlanningOnly",
      initializeCryptoExposed: false,
      initializeCryptoExposureApproved: false,
      initializeCryptoExposureReason: "RuntimeExposureReviewPending",
      initializeCryptoWiringPlanState: "PlanningOnly",
      initializeCryptoRuntimeWiringAllowed: false,
      initializeCryptoWorkerWiringAllowed: false,
      initializeCryptoWiringPlanReason: "RuntimeWiringPlanPending",
      initializeCryptoPublicApiState: "PlanningOnly",
      initializeCryptoApiVisible: false,
      initializeCryptoPublicApiCallable: false,
      initializeCryptoPublicApiReason: "PublicApiPending",
      initializeCryptoInvocationState: "PlanningOnly",
      initializeCryptoInvocationAllowed: false,
      initializeCryptoInvocationCompleted: false,
      initializeCryptoInvocationReason: "InvocationContractPending",
    });
  });

  it("14. docs/runtime_worker_activation_boundary.md exists, names the five-layer order, and adds no code", () => {
    expect(activationBoundaryDocSource).toMatch(/this document adds no code/i);
    expect(activationBoundaryDocSource).toMatch(/Runtime/);
    expect(activationBoundaryDocSource).toMatch(/Worker Bridge/);
    expect(activationBoundaryDocSource).toMatch(/FedOS Provider/);
    expect(activationBoundaryDocSource).toMatch(/FedOS Core/);
    expect(activationBoundaryDocSource).toMatch(/Crypto/);
  });

  it("15. public pub fn surface is unchanged at twenty-seven", () => {
    // Secure Runtime Alpha 684/685 (Alpha 681-720 Arc) added exactly one
    // new, reviewed pub fn -- `FedosMasterSeedAuthority::public_key_hex_for_account`
    // -- reusing the existing derivation chain, no signing, no secret
    // exposure. 44 -> 45.
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(68);  });

  it("16. Cargo.toml and package.json dependency counts are unchanged", () => {
    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("17. Stage 281-284: FEDOS_CRYPTO_PROVIDER=fedos is recorded as configuredProvider but effectiveProvider/buildWorkerCryptoProvider stay placeholder", () => {
    const config = getWorkerCryptoConfig({ FEDOS_CRYPTO_PROVIDER: "fedos" });
    expect(config.workerCryptoEnabled).toBe(false);
    expect(config.workerCryptoProvider).toBe("fedos");

    const status = workerCryptoActivationStatus({ FEDOS_CRYPTO_PROVIDER: "fedos" });
    expect(status.enabled).toBe(false);
    expect(status.configuredProvider).toBe("fedos");
    expect(status.effectiveProvider).toBe("placeholder");
    expect(status.reachable).toBe(false);

    const provider = buildWorkerCryptoProvider(undefined, { FEDOS_CRYPTO_PROVIDER: "fedos" });
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(provider).not.toBeInstanceOf(FedosRuntimeCryptoProvider);
  });

  it("18. unset/unknown/truthy-flag-spelled env values all resolve to placeholder on the Worker side too", () => {
    for (const raw of [undefined, "", "unknown", "true", "1", "on", "enabled", "fedos-dev-only"]) {
      const env = raw === undefined ? undefined : { FEDOS_CRYPTO_PROVIDER: raw };
      expect(getWorkerCryptoConfig(env).workerCryptoProvider).toBe("placeholder");
      expect(workerCryptoActivationStatus(env).effectiveProvider).toBe("placeholder");
    }
  });

  it("19. no raw env string value ever leaks into the Worker diagnostics report", () => {
    const marker = "totally-unrecognized-worker-marker";
    const status = workerCryptoActivationStatus({ FEDOS_CRYPTO_PROVIDER: marker });
    expect(JSON.stringify(status)).not.toContain(marker);
  });

  it("20. worker_crypto_config.ts / worker_crypto_bridge.ts / worker_crypto_diagnostics.ts read no process.env", () => {
    for (const [name, src] of WORKER_PRODUCTION_FILES) {
      expect(codeOnlyOf(src), name).not.toMatch(/process\.env/);
    }
  });
});

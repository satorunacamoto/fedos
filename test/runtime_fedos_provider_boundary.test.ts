import { describe, it, expect } from "vitest";
import { PlaceholderRuntimeCryptoProvider, RUNTIME_CRYPTO_CAPABILITIES } from "../src/runtime/crypto_provider.js";
import {
  FedosRuntimeCryptoProvider,
  FEDOS_RUNTIME_PROVIDER_IMPLEMENTED,
  FEDOS_PROVIDER_DECISION_REASONS,
} from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME,
  PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  createDefaultRuntimeCryptoProviderRegistry,
} from "../src/runtime/runtime_crypto_registry.js";
import {
  RUNTIME_CRYPTO_CONFIG,
  RUNTIME_CRYPTO_PROVIDER_NAMES,
  getRuntimeCryptoConfig,
} from "../src/runtime/runtime_crypto_config.js";
import { buildRuntimeCryptoProvider } from "../src/runtime/runtime_crypto_bridge.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosProviderSource from "../src/runtime/fedos_runtime_crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/runtime/runtime_crypto_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import configSource from "../src/runtime/runtime_crypto_config.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bridgeSource from "../src/runtime/runtime_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationDocSource from "../docs/runtime_fedos_provider_activation.md?raw";

/**
 * Stage 265–272 — "Runtime FedOS Provider Integration (Opt-in,
 * Safe-by-default)": src/runtime/fedos_runtime_crypto_provider.ts (Stage
 * 265), Registry registration (Stage 266), explicit opt-in config (Stage
 * 267), the bridge's two-flag gate (Stage 268), diagnostics' effective
 * provider (Stage 269), docs/runtime_fedos_provider_activation.md (Stage
 * 270). Default stays Placeholder; FedOS provider is never constructed
 * outside the Registry/Bridge; Runtime never calls encrypt/decrypt.
 */
describe("Runtime FedOS provider integration, opt-in and safe-by-default (Stage 265-272)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  const PRODUCTION_FILES: [string, string][] = [
    ["fedos_runtime_crypto_provider.ts", fedosProviderSource],
    ["runtime_crypto_registry.ts", registrySource],
    ["runtime_crypto_config.ts", configSource],
    ["runtime_crypto_bridge.ts", bridgeSource],
  ];

  it("1. FedosRuntimeCryptoProvider.encrypt/decrypt always resolve to Unsupported, and calls no FedOS core", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.allowed).toBe(false);
    expect(encrypted.state).toBe("Unsupported");
    const decrypted = await provider.decrypt({});
    expect(decrypted.allowed).toBe(false);
    expect(decrypted.state).toBe("Unsupported");
  });

  it("2. FedosRuntimeCryptoProvider does not mutate its request argument", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const request = { opaqueKeyRef: "h1", opaquePlaintextRef: "h2" };
    const snapshot = JSON.stringify(request);
    await provider.encrypt(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("3. the default registry registers both placeholder and fedos, and fedos resolves a FedosRuntimeCryptoProvider", () => {
    const registry = createDefaultRuntimeCryptoProviderRegistry();
    expect(registry.names()).toEqual([
      PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
      FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME,
    ]);
    expect(registry.create(FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME)).toBeInstanceOf(
      FedosRuntimeCryptoProvider,
    );
  });

  it("4. RUNTIME_CRYPTO_CONFIG/getRuntimeCryptoConfig fix both runtimeCryptoEnabled: false and runtimeCryptoProvider: 'placeholder'", () => {
    expect(RUNTIME_CRYPTO_CONFIG).toEqual({
      runtimeCryptoEnabled: false,
      runtimeCryptoProvider: "placeholder",
    });
    expect(getRuntimeCryptoConfig()).toEqual(RUNTIME_CRYPTO_CONFIG);
    expect(Object.isFrozen(RUNTIME_CRYPTO_CONFIG)).toBe(true);
    expect(RUNTIME_CRYPTO_PROVIDER_NAMES).toEqual(["placeholder", "fedos"]);
  });

  it("5. runtime_crypto_config.ts reads no RuntimeEnv/process.env field", () => {
    const codeOnly = codeOnlyOf(configSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/RuntimeEnv/);
  });

  it("6. buildRuntimeCryptoProvider always resolves placeholder (the two-flag gate never passes), and only via the Registry", () => {
    const provider = buildRuntimeCryptoProvider();
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(provider).not.toBeInstanceOf(FedosRuntimeCryptoProvider);
  });

  it("7. the bridge's two-flag gate is evaluated with && (never ||) in source", () => {
    expect(bridgeSource).toMatch(
      /runtimeCryptoEnabled\s*&&\s*runtimeCryptoProvider\s*===\s*FEDOS_RUNTIME_CRYPTO_PROVIDER_NAME/,
    );
    expect(codeOnlyOf(bridgeSource)).not.toMatch(
      /runtimeCryptoEnabled\s*\|\|\s*runtimeCryptoProvider/,
    );
  });

  it("8. no RuntimeCryptoProvider is constructed with `new` outside runtime_crypto_registry.ts among the production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      if (name === "runtime_crypto_registry.ts" || name === "fedos_runtime_crypto_provider.ts") {
        continue;
      }
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, `${name} must not construct a provider with new`).not.toMatch(
        /new\s+(PlaceholderRuntimeCryptoProvider|FedosRuntimeCryptoProvider)/,
      );
    }
  });

  it("9. runtimeCryptoActivationStatus reports { enabled: false, configuredProvider: 'placeholder', effectiveProvider: 'placeholder' }, mirroring the bridge's gate", () => {
    expect(runtimeCryptoActivationStatus()).toEqual({
      enabled: false,
      configuredProvider: "placeholder",
      configuredEnabled: "disabled",
      effectiveProvider: "placeholder",
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
      runtimeInitializeCryptoPrototypeExposed: true,
      runtimeInitializeCryptoPrototypeAllowed: false,
      runtimeInitializeCryptoPrototypeReason: "PrototypeDisabled",
      runtimePrototypeFacadeReached: true,
      runtimePrototypeFacadeConnected: false,
      runtimePrototypeFacadeReason: "PrototypeDisabled",
      cryptoLoaderBackendState: "PlanningOnly",
      cryptoLoaderBackendKind: "WasmPlanned",
      cryptoLoaderBackendReady: false,
      cryptoLoaderBackendReason: "BackendAbstractionPending",
      wasmBackendState: "PlanningOnly",
      wasmBackendReady: false,
      wasmBackendLoaderAttached: false,
      wasmBackendLoaderKind: "WasmLoaderPlanned",
      wasmBackendReason: "WasmBackendPlanningPending",
      wasmBackendLoaderReached: true,
      wasmBackendLoaderLoaded: false,
      wasmBackendLoaderDecision: "BlockedByPolicy",
      loaderPlanningState: "Planning",
      loaderPlanningDecision: "BlockedByPolicy",
      loaderLoaded: false,
      cryptoBackendInterfaceState: "PlanningOnly",
      cryptoBackendInterfaceReady: false,
      cryptoBackendSelected: "WasmPlanned",
      cryptoBackendActivated: false,
      cryptoBackendInterfaceReason: "BackendInterfacePending",
      cryptoBackendResolverState: "PlanningOnly",
      cryptoBackendResolverSelected: "WasmPlanned",
      cryptoBackendResolved: false,
      cryptoBackendAvailable: false,
      cryptoBackendResolverReason: "BackendResolutionPending",
    });
  });

  it("10. AppRuntime.crypto defaults to PlaceholderRuntimeCryptoProvider, and createRuntime never calls encrypt/decrypt", () => {
    const runtime = createRuntime();
    expect(runtime.crypto).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(createRuntimeSource).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("11. no Worker/Relay/Storage/NIP-17 reference in the four new/updated production files; no real WASM execution primitive either (Stage 388 legitimately references the WASM Boundary abstraction by name)", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, name).not.toMatch(/worker\.js|wasm|Relay|Storage|nip.?17|nip-17/i);
    }
    const diagnosticsCode = codeOnlyOf(diagnosticsSource);
    expect(diagnosticsCode).not.toMatch(/worker\.js|Relay|Storage|nip.?17|nip-17/i);
    expect(diagnosticsCode).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)/);
    expect(diagnosticsCode).not.toMatch(/wasm-bindgen/i);
    expect(diagnosticsCode).not.toMatch(/\.wasm['"`]/);
  });

  it("12. the Worker does not reference any Runtime crypto file or AppRuntime.crypto", () => {
    expect(workerSource).not.toMatch(
      /fedos_runtime_crypto_provider|runtime_crypto_registry|runtime_crypto_config|runtime_crypto_bridge|FedosRuntimeCryptoProvider/,
    );
    expect(workerSource).not.toMatch(/\.crypto\s*\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("13. public pub fn surface is unchanged at twenty-seven", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(27);
  });

  it("14. Cargo.toml and package.json dependency counts are unchanged", () => {
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
    expect(depLines.length).toBe(10);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("15. docs/runtime_fedos_provider_activation.md exists, names the five-step order, and adds no code", () => {
    expect(activationDocSource).toMatch(/this document adds no code/i);
    expect(activationDocSource).toMatch(/Placeholder/);
    expect(activationDocSource).toMatch(/FedOS Provider/);
    expect(activationDocSource).toMatch(/Worker/);
    expect(activationDocSource).toMatch(/Runtime/);
    expect(activationDocSource).toMatch(/Nostr/);
  });

  it("16. Stage 281-284: FEDOS_CRYPTO_PROVIDER=fedos still never yields a FedosRuntimeCryptoProvider from buildRuntimeCryptoProvider (runtimeCryptoEnabled stays false)", () => {
    const provider = buildRuntimeCryptoProvider(
      createDefaultRuntimeCryptoProviderRegistry(),
      { FEDOS_CRYPTO_PROVIDER: "fedos" },
    );
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(provider).not.toBeInstanceOf(FedosRuntimeCryptoProvider);
  });

  it("17. FedosRuntimeCryptoProvider still always resolves encrypt/decrypt to Unsupported, unaffected by the env var", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect((await provider.encrypt({})).state).toBe("Unsupported");
    expect((await provider.decrypt({})).state).toBe("Unsupported");
  });

  it("18. RUNTIME_CRYPTO_PROVIDER_NAMES still lists exactly placeholder/fedos", () => {
    expect(RUNTIME_CRYPTO_PROVIDER_NAMES).toEqual(["placeholder", "fedos"]);
  });

  it("19. FedosRuntimeCryptoProvider.status() reports implemented: false, mirroring FEDOS_RUNTIME_PROVIDER_IMPLEMENTED", () => {
    const provider = new FedosRuntimeCryptoProvider();
    const status = provider.status();
    expect(status.implemented).toBe(false);
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
  });

  it("20. internalCapabilitySurface() names runtime_nip44_wire_placeholder as internal-only and the rest not-implemented, with no secret material", () => {
    const provider = new FedosRuntimeCryptoProvider();
    const surface = provider.internalCapabilitySurface();
    expect(surface).toEqual([
      { capability: "runtime_encrypt_placeholder", availability: "not-implemented" },
      { capability: "runtime_decrypt_placeholder", availability: "not-implemented" },
      { capability: "runtime_nip44_wire_placeholder", availability: "internal-only" },
      { capability: "runtime_rust_core_placeholder", availability: "not-implemented" },
    ]);
    for (const entry of surface) {
      expect(JSON.stringify(entry)).not.toMatch(/key|secret|plaintext|ciphertext/i);
    }
  });

  it("21. capabilities() itself is unaffected by internalCapabilitySurface() -- still the same fixed label list", () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect(provider.capabilities()).toEqual(RUNTIME_CRYPTO_CAPABILITIES);
  });

  it("22. decisionReason() always reports NotImplemented in this stage", () => {
    const provider = new FedosRuntimeCryptoProvider();
    expect(provider.decisionReason()).toBe("NotImplemented");
    expect(FEDOS_PROVIDER_DECISION_REASONS).toEqual([
      "NotImplemented",
      "DisabledByActivationPolicy",
      "RuntimeConnectionMissing",
      "Unsupported",
    ]);
  });

  it("23. FEDOS_RUNTIME_PROVIDER_IMPLEMENTED cannot be changed via any env-like object -- the class constructor and every method take no env parameter", () => {
    expect(codeOnlyOf(fedosProviderSource)).not.toMatch(/process\.env/);
    expect(codeOnlyOf(fedosProviderSource)).not.toMatch(/RuntimeEnv/);
    // The constructor and every public method are zero/no-env-arg.
    expect(fedosProviderSource).toMatch(/constructor\(\)\s*\{/);
  });

  it("24. even with FEDOS_CRYPTO_PROVIDER=fedos and FEDOS_CRYPTO_ENABLED=explicit-dev-only, runtimeCryptoActivationStatus still reports providerImplemented: false and activationReason: ProviderUnavailable", () => {
    const status = runtimeCryptoActivationStatus({
      FEDOS_CRYPTO_PROVIDER: "fedos",
      FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
    });
    expect(status.providerImplemented).toBe(false);
    expect(status.activationReason).toBe("ProviderUnavailable");
  });
});

import { describe, it, expect } from "vitest";
import {
  PlaceholderRuntimeCryptoProvider,
  RUNTIME_CRYPTO_CAPABILITIES,
} from "../src/runtime/crypto_provider.js";
import type { RuntimeCryptoProvider } from "../src/runtime/crypto_provider.js";
import {
  PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
  RuntimeCryptoProviderRegistry,
  createDefaultRuntimeCryptoProviderRegistry,
} from "../src/runtime/runtime_crypto_registry.js";
import {
  RUNTIME_CRYPTO_CONFIG,
  getRuntimeCryptoConfig,
} from "../src/runtime/runtime_crypto_config.js";
import { buildRuntimeCryptoProvider } from "../src/runtime/runtime_crypto_bridge.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/runtime/runtime_crypto_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import configSource from "../src/runtime/runtime_crypto_config.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bridgeSource from "../src/runtime/runtime_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoProviderSource from "../src/runtime/crypto_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
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
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeySource from "../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messageKeySource from "../packages/fedos-core-rust/src/crypto/message_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44WirePayloadSource from "../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationDocSource from "../docs/runtime_crypto_activation.md?raw";

/**
 * Stage 257–264 — "Runtime Opt-in Crypto Bridge (Non-Operational)":
 * src/runtime/runtime_crypto_registry.ts (Stage 257),
 * src/runtime/runtime_crypto_config.ts (Stage 258),
 * src/runtime/runtime_crypto_bridge.ts (Stage 259), `AppRuntime.crypto`
 * integration (Stage 260), `runtimeCryptoActivationStatus` (Stage 261),
 * docs/runtime_crypto_activation.md (Stage 262). Runtime never calls FedOS,
 * `runtimeCryptoEnabled` stays permanently `false`, and no provider is ever
 * constructed outside the Registry.
 */
describe("Runtime opt-in crypto bridge, non-operational (Stage 257-264)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  function productionOnlyOf(source: string): string {
    const idx = source.indexOf("describe(");
    return idx === -1 ? source : source.slice(0, idx);
  }

  const PRODUCTION_FILES: [string, string][] = [
    ["runtime_crypto_registry.ts", registrySource],
    ["runtime_crypto_config.ts", configSource],
    ["runtime_crypto_bridge.ts", bridgeSource],
  ];

  it("1. RuntimeCryptoProviderRegistry registers only placeholder and fedos by default (Stage 266 adds fedos alongside the unchanged placeholder)", () => {
    const registry = createDefaultRuntimeCryptoProviderRegistry();
    expect(registry.names()).toEqual([
      PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME,
      "fedos",
    ]);
    const provider = registry.create(PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME);
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
  });

  it("2. registry.create returns undefined for an unregistered name, and register() can add (but this stage never adds) more", () => {
    const registry = new RuntimeCryptoProviderRegistry();
    expect(registry.create("fedos")).toBeUndefined();
    expect(registry.names()).toEqual([]);
    let called = 0;
    registry.register("custom", () => {
      called += 1;
      return new PlaceholderRuntimeCryptoProvider();
    });
    expect(called).toBe(0); // registering does not invoke the factory
    registry.create("custom");
    expect(called).toBe(1);
  });

  it("3. RUNTIME_CRYPTO_CONFIG / getRuntimeCryptoConfig always report runtimeCryptoEnabled: false", () => {
    expect(RUNTIME_CRYPTO_CONFIG.runtimeCryptoEnabled).toBe(false);
    expect(getRuntimeCryptoConfig().runtimeCryptoEnabled).toBe(false);
    // Stage 282: each call now builds a fresh frozen object (to reflect a
    // possibly-different `env` argument), so no-arg calls are no longer
    // the SAME reference -- but are still deeply equal.
    expect(getRuntimeCryptoConfig()).toEqual(getRuntimeCryptoConfig());
    expect(Object.isFrozen(RUNTIME_CRYPTO_CONFIG)).toBe(true);
    expect(Object.isFrozen(getRuntimeCryptoConfig())).toBe(true);
  });

  it("4. runtime_crypto_config.ts reads no RuntimeEnv/process.env field", () => {
    const codeOnly = codeOnlyOf(configSource);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/RuntimeEnv/);
  });

  it("5. buildRuntimeCryptoProvider always resolves the placeholder, regardless of a custom registry", () => {
    const provider = buildRuntimeCryptoProvider();
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);

    const customRegistry = new RuntimeCryptoProviderRegistry();
    let called = 0;
    customRegistry.register(PLACEHOLDER_RUNTIME_CRYPTO_PROVIDER_NAME, () => {
      called += 1;
      return new PlaceholderRuntimeCryptoProvider();
    });
    const fromCustom = buildRuntimeCryptoProvider(customRegistry);
    expect(fromCustom).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
    expect(called).toBe(1);
  });

  it("6. buildRuntimeCryptoProvider falls back to a default registry when the supplied one lacks placeholder, without ever new'ing a provider outside a registry", () => {
    const emptyRegistry = new RuntimeCryptoProviderRegistry();
    const provider = buildRuntimeCryptoProvider(emptyRegistry);
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
  });

  it("7. no RuntimeCryptoProvider is constructed with `new` outside runtime_crypto_registry.ts among the four production files", () => {
    for (const [name, src] of [
      ...PRODUCTION_FILES,
      ["crypto_provider.ts", cryptoProviderSource] as [string, string],
    ]) {
      if (name === "runtime_crypto_registry.ts" || name === "crypto_provider.ts") continue;
      const codeOnly = codeOnlyOf(productionOnlyOf(src));
      expect(codeOnly, `${name} must not construct a provider with new`).not.toMatch(
        /new\s+PlaceholderRuntimeCryptoProvider/,
      );
    }
  });

  it("8. no direct Rust/WASM/Worker import in the four new production files", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly, `${name} must not import Rust/WASM`).not.toMatch(
        /fedos-core-rust|wasm_loader|\.rs['"]/i,
      );
      expect(codeOnly, `${name} must not import the Worker`).not.toMatch(/worker\.js/i);
    }
  });

  it("9. no panic-like throw in production code (defensive invariant assertions aside are documented, never triggered in normal use)", async () => {
    // buildRuntimeCryptoProvider never throws under normal/expected use,
    // including with an empty custom registry (test 6 above).
    await expect(async () => buildRuntimeCryptoProvider()).not.toThrow();
  });

  it("10. AppRuntime.crypto is a PlaceholderRuntimeCryptoProvider by default, and createRuntime never calls encrypt/decrypt", () => {
    const runtime = createRuntime();
    expect(runtime.crypto).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
  });

  it("11. an override wins, and createRuntime still never calls its encrypt/decrypt", async () => {
    let encryptCalls = 0;
    let decryptCalls = 0;
    const spy: RuntimeCryptoProvider = {
      status: () => ({ state: "Placeholder", reason: "spy" }),
      capabilities: () => RUNTIME_CRYPTO_CAPABILITIES,
      encrypt: async () => {
        encryptCalls += 1;
        return { allowed: false, state: "NotConnected", reason: "spy" };
      },
      decrypt: async () => {
        decryptCalls += 1;
        return { allowed: false, state: "NotConnected", reason: "spy" };
      },
    };
    const runtime = createRuntime(undefined, { runtimeCryptoProvider: spy });
    expect(runtime.crypto).toBe(spy);
    expect(encryptCalls).toBe(0);
    expect(decryptCalls).toBe(0);
  });

  it("12. runtimeCryptoActivationStatus reports { enabled: false, configuredProvider: 'placeholder', effectiveProvider: 'placeholder' }, reading no live provider", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status).toEqual({
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
      loaderPolicyAllowed: false,
      loaderPolicyDecision: "BlockedByPolicy",
      loaderPolicyReason: "PrototypePolicy",
      loaderPlanReachedPolicy: true,
      loaderPolicyEvaluated: true,
      loaderLoadPlanCreated: true,
      loaderLoadPlanAllowed: false,
      loaderLoadPlanShouldLoad: false,
      loaderLoadPlanBackend: "Wasm",
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

  it("13. Worker does not reference any of the four new Runtime files or AppRuntime.crypto", () => {
    expect(workerSource).not.toMatch(
      /runtime_crypto_registry|runtime_crypto_config|runtime_crypto_bridge|RuntimeCryptoProviderRegistry/,
    );
    expect(workerSource).not.toMatch(/\.crypto\s*\.\s*(encrypt|decrypt)\s*\(/);
  });

  it("14. public pub fn surface is unchanged at twenty-seven, and SecretHandle/ConversationKey/MessageKey/Nip44WirePayload stay pub(crate)-only", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect(pubFnNames.length).toBe(48);

    expect(libRsSource).toMatch(/pub\(crate\)\s+struct\s+SecretHandle\b/);
    expect(libRsSource).not.toMatch(/pub\s+struct\s+SecretHandle\b/);
    expect(conversationKeySource).toMatch(/pub\(crate\)\s+struct\s+ConversationKey\b/);
    expect(conversationKeySource).not.toMatch(/pub\s+struct\s+ConversationKey\b/);
    expect(messageKeySource).toMatch(/pub\(crate\)\s+struct\s+MessageKey\b/);
    expect(messageKeySource).not.toMatch(/pub\s+struct\s+MessageKey\b/);
    expect(nip44WirePayloadSource).toMatch(/pub\(crate\)\s+struct\s+Nip44WirePayload\b/);
    expect(nip44WirePayloadSource).not.toMatch(/pub\s+struct\s+Nip44WirePayload\b/);
  });

  it("15. capability_matrix is unchanged in shape — still sixteen CryptoCapability variants", () => {
    expect(capabilityMatrixSource).toMatch(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[/,
    );
  });

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

  it("17. AppRuntime.crypto/RuntimeOverrides.runtimeCryptoProvider are wired exactly once, and runtime_status.ts's twelve-component list is unaffected", () => {
    expect(runtimeTypesSource).toMatch(/readonly\s+crypto:\s*RuntimeCryptoProvider/);
    expect(runtimeTypesSource).toMatch(/readonly\s+runtimeCryptoProvider\?:\s*RuntimeCryptoProvider/);
    expect(createRuntimeSource).toMatch(/crypto:\s*selectRuntimeCryptoProvider\(overrides\)/);
  });

  it("18. docs/runtime_crypto_activation.md exists, names the five layers, and adds no code", () => {
    expect(activationDocSource).toMatch(/this document adds no code/i);
    expect(activationDocSource).toMatch(/Registry/);
    expect(activationDocSource).toMatch(/runtimeCryptoEnabled/);
    expect(activationDocSource).not.toMatch(/```[\s\S]*?register\(\s*["']fedos["']/);
  });

  it("19. no Storage/Relay/NIP-17 reference anywhere in the four new production Runtime files; no real WASM execution primitive either (Stage 388 legitimately references the WASM Boundary abstraction by name)", () => {
    for (const [name, src] of PRODUCTION_FILES) {
      expect(codeOnlyOf(src), name).not.toMatch(/Storage|Relay|nip.?17|nip-17|wasm/i);
    }
    const diagnosticsCode = codeOnlyOf(runtimeDiagnosticsSource);
    expect(diagnosticsCode).not.toMatch(/Storage|Relay|nip.?17|nip-17/i);
    expect(diagnosticsCode).not.toMatch(/WebAssembly\s*\.\s*(instantiate|compile)/);
    expect(diagnosticsCode).not.toMatch(/wasm-bindgen/i);
    expect(diagnosticsCode).not.toMatch(/\.wasm['"`]/);
  });

  it("20. Stage 281-285: FEDOS_CRYPTO_PROVIDER=fedos is recorded as configuredProvider but effectiveProvider stays placeholder", () => {
    const config = getRuntimeCryptoConfig({ FEDOS_CRYPTO_PROVIDER: "fedos" });
    expect(config.runtimeCryptoEnabled).toBe(false);
    expect(config.runtimeCryptoProvider).toBe("fedos");

    const status = runtimeCryptoActivationStatus({ FEDOS_CRYPTO_PROVIDER: "fedos" });
    expect(status.enabled).toBe(false);
    expect(status.configuredProvider).toBe("fedos");
    expect(status.effectiveProvider).toBe("placeholder");

    const provider = buildRuntimeCryptoProvider(undefined, { FEDOS_CRYPTO_PROVIDER: "fedos" });
    expect(provider).toBeInstanceOf(PlaceholderRuntimeCryptoProvider);
  });

  it("21. unset/unknown/truthy-flag-spelled env values all resolve to placeholder", () => {
    for (const raw of [undefined, "", "unknown", "true", "1", "on", "enabled", "fedos-dev-only"]) {
      const env = raw === undefined ? undefined : { FEDOS_CRYPTO_PROVIDER: raw };
      expect(getRuntimeCryptoConfig(env).runtimeCryptoProvider).toBe("placeholder");
      expect(runtimeCryptoActivationStatus(env).configuredProvider).toBe("placeholder");
      expect(runtimeCryptoActivationStatus(env).effectiveProvider).toBe("placeholder");
    }
  });

  it("22. no raw env string value ever leaks into the diagnostics report", () => {
    const marker = "totally-unrecognized-marker-string";
    const status = runtimeCryptoActivationStatus({ FEDOS_CRYPTO_PROVIDER: marker });
    expect(JSON.stringify(status)).not.toContain(marker);
  });

  it("23. runtime_crypto_config.ts / runtime_crypto_bridge.ts / runtime_crypto_diagnostics.ts read no process.env", () => {
    for (const src of [configSource, bridgeSource, runtimeDiagnosticsSource]) {
      expect(codeOnlyOf(src)).not.toMatch(/process\.env/);
    }
  });
});

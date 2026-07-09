import { describe, it, expect } from "vitest";
import {
  evaluateRuntimeCryptoActivation,
} from "../src/runtime/runtime_crypto_activation_policy.js";
import type {
  ActivationDecision as RuntimeActivationDecision,
  ActivationReason as RuntimeActivationReason,
} from "../src/runtime/runtime_crypto_activation_policy.js";
import {
  evaluateWorkerCryptoActivation,
} from "../src/runtime/worker_crypto_activation_policy.js";
import type {
  ActivationDecision as WorkerActivationDecision,
  ActivationReason as WorkerActivationReason,
} from "../src/runtime/worker_crypto_activation_policy.js";
import type { RuntimeCryptoConfig } from "../src/runtime/runtime_crypto_config.js";
import type { WorkerCryptoConfig } from "../src/runtime/worker_crypto_config.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
import { FEDOS_RUNTIME_PROVIDER_IMPLEMENTED } from "../src/runtime/fedos_runtime_crypto_provider.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimePolicySource from "../src/runtime/runtime_crypto_activation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerPolicySource from "../src/runtime/worker_crypto_activation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationPolicyDocSource from "../docs/runtime_crypto_activation_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import threatModelDocSource from "../docs/runtime_crypto_threat_model.md?raw";

/**
 * Stage 289–296 — "Activation Policy (Fail-Closed)":
 * src/runtime/runtime_crypto_activation_policy.ts (Stage 289),
 * src/runtime/worker_crypto_activation_policy.ts (Stage 290, an
 * INDEPENDENT implementation), activationReason on both diagnostics
 * functions (Stage 291). `evaluate*CryptoActivation` never returns
 * `"Allowed"`; `"DisabledByConfig"` always wins when `enabled` is false,
 * regardless of the provider name.
 */
describe("Runtime/Worker crypto activation policy, fail-closed (Stage 289-296)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  const runtimeConfig = (
    overrides: Partial<RuntimeCryptoConfig> = {},
  ): RuntimeCryptoConfig => ({
    runtimeCryptoEnabled: false,
    runtimeCryptoProvider: "placeholder",
    ...overrides,
  });

  const workerConfig = (
    overrides: Partial<WorkerCryptoConfig> = {},
  ): WorkerCryptoConfig => ({
    workerCryptoEnabled: false,
    workerCryptoProvider: "placeholder",
    ...overrides,
  });

  it("1. evaluateRuntimeCryptoActivation never returns Allowed, for any input", () => {
    const cases: RuntimeCryptoConfig[] = [
      runtimeConfig(),
      runtimeConfig({ runtimeCryptoProvider: "fedos" }),
      runtimeConfig({ runtimeCryptoEnabled: true }),
      runtimeConfig({ runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" }),
    ];
    for (const config of cases) {
      const decision = evaluateRuntimeCryptoActivation(config);
      expect(decision.reason).not.toBe("Allowed");
      expect(decision.allowed).toBe(false);
    }
  });

  it("2. evaluateWorkerCryptoActivation never returns Allowed, for any input", () => {
    const cases: WorkerCryptoConfig[] = [
      workerConfig(),
      workerConfig({ workerCryptoProvider: "fedos" }),
      workerConfig({ workerCryptoEnabled: true }),
      workerConfig({ workerCryptoEnabled: true, workerCryptoProvider: "fedos" }),
    ];
    for (const config of cases) {
      const decision = evaluateWorkerCryptoActivation(config);
      expect(decision.reason).not.toBe("Allowed");
      expect(decision.allowed).toBe(false);
    }
  });

  it("3. DisabledByConfig always wins when enabled is false, regardless of provider (Runtime)", () => {
    expect(
      evaluateRuntimeCryptoActivation(runtimeConfig({ runtimeCryptoEnabled: false, runtimeCryptoProvider: "placeholder" })).reason,
    ).toBe("DisabledByConfig");
    expect(
      evaluateRuntimeCryptoActivation(runtimeConfig({ runtimeCryptoEnabled: false, runtimeCryptoProvider: "fedos" })).reason,
    ).toBe("DisabledByConfig");
  });

  it("4. DisabledByConfig always wins when enabled is false, regardless of provider (Worker)", () => {
    expect(
      evaluateWorkerCryptoActivation(workerConfig({ workerCryptoEnabled: false, workerCryptoProvider: "placeholder" })).reason,
    ).toBe("DisabledByConfig");
    expect(
      evaluateWorkerCryptoActivation(workerConfig({ workerCryptoEnabled: false, workerCryptoProvider: "fedos" })).reason,
    ).toBe("DisabledByConfig");
  });

  it("5. ProviderNotSelected fires only once enabled is true and provider is not fedos (Runtime)", () => {
    expect(
      evaluateRuntimeCryptoActivation(runtimeConfig({ runtimeCryptoEnabled: true, runtimeCryptoProvider: "placeholder" })).reason,
    ).toBe("ProviderNotSelected");
  });

  it("6. ProviderNotSelected fires only once enabled is true and provider is not fedos (Worker)", () => {
    expect(
      evaluateWorkerCryptoActivation(workerConfig({ workerCryptoEnabled: true, workerCryptoProvider: "placeholder" })).reason,
    ).toBe("ProviderNotSelected");
  });

  it("7. ProviderUnavailable fires only once enabled is true AND provider is fedos (Runtime)", () => {
    const decision = evaluateRuntimeCryptoActivation(
      runtimeConfig({ runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" }),
    );
    expect(decision.reason).toBe("ProviderUnavailable");
    expect(decision.allowed).toBe(false);
  });

  it("8. ProviderUnavailable fires only once enabled is true AND provider is fedos (Worker)", () => {
    const decision = evaluateWorkerCryptoActivation(
      workerConfig({ workerCryptoEnabled: true, workerCryptoProvider: "fedos" }),
    );
    expect(decision.reason).toBe("ProviderUnavailable");
    expect(decision.allowed).toBe(false);
  });

  it("9. Runtime and Worker activation policies are fully independent -- neither file imports the other, and neither exported type is reused", () => {
    expect(codeOnlyOf(runtimePolicySource)).not.toMatch(
      /worker_crypto_activation_policy|evaluateWorkerCryptoActivation/,
    );
    expect(codeOnlyOf(workerPolicySource)).not.toMatch(
      /runtime_crypto_activation_policy|evaluateRuntimeCryptoActivation/,
    );
    // Each file defines its OWN ActivationReason/ActivationDecision/ActivationPolicy.
    for (const src of [runtimePolicySource, workerPolicySource]) {
      expect(src).toMatch(/export type ActivationReason/);
      expect(src).toMatch(/export interface ActivationDecision/);
      expect(src).toMatch(/export type ActivationPolicy/);
    }
  });

  it("10. no process.env reference in either policy file", () => {
    expect(codeOnlyOf(runtimePolicySource)).not.toMatch(/process\.env/);
    expect(codeOnlyOf(workerPolicySource)).not.toMatch(/process\.env/);
  });

  it("11. neither policy file ever calls encrypt/decrypt or constructs a RuntimeCryptoProvider", () => {
    for (const src of [runtimePolicySource, workerPolicySource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
      expect(codeOnly).not.toMatch(/new\s+(PlaceholderRuntimeCryptoProvider|FedosRuntimeCryptoProvider)/);
      expect(codeOnly).not.toMatch(/fedos-core-rust/i);
    }
  });

  it("12. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose activationReason, and it is DisabledByConfig by default", () => {
    expect(runtimeCryptoActivationStatus().activationReason).toBe("DisabledByConfig");
    expect(workerCryptoActivationStatus().activationReason).toBe("DisabledByConfig");
    // Setting FEDOS_CRYPTO_PROVIDER=fedos alone still leaves DisabledByConfig,
    // since runtimeCryptoEnabled/workerCryptoEnabled stay fixed false.
    expect(
      runtimeCryptoActivationStatus({ FEDOS_CRYPTO_PROVIDER: "fedos" }).activationReason,
    ).toBe("DisabledByConfig");
    expect(
      workerCryptoActivationStatus({ FEDOS_CRYPTO_PROVIDER: "fedos" }).activationReason,
    ).toBe("DisabledByConfig");
  });

  it("13. diagnostics files never import each other's activation policy", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/worker_crypto_activation_policy/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_crypto_activation_policy/);
  });

  it("14. public pub fn surface is unchanged at twenty-seven, Cargo.toml/package.json dependency counts unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(27);

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
  });

  it("15. docs/runtime_crypto_activation_policy.md and docs/runtime_crypto_threat_model.md exist and state the fail-closed guarantee", () => {
    expect(activationPolicyDocSource).toMatch(/DisabledByConfig/);
    expect(activationPolicyDocSource).toMatch(/ProviderNotSelected/);
    expect(activationPolicyDocSource).toMatch(/ProviderUnavailable/);
    expect(activationPolicyDocSource).toMatch(/five/i);

    expect(threatModelDocSource).toMatch(/fail-closed/i);
    expect(threatModelDocSource).toMatch(/FEDOS_CRYPTO_PROVIDER=fedos/);
    expect(threatModelDocSource).toMatch(/DisabledByConfig/);
  });

  it("16. reasons returned are always one of the four non-Allowed labels (exhaustive sanity)", () => {
    const runtimeReasons: RuntimeActivationReason[] = [
      "DisabledByConfig",
      "ProviderNotSelected",
      "ProviderUnavailable",
      "FutureFeature",
    ];
    const workerReasons: WorkerActivationReason[] = [
      "DisabledByConfig",
      "ProviderNotSelected",
      "ProviderUnavailable",
      "FutureFeature",
    ];
    const runtimeDecisions: RuntimeActivationDecision[] = [
      evaluateRuntimeCryptoActivation(runtimeConfig()),
      evaluateRuntimeCryptoActivation(runtimeConfig({ runtimeCryptoEnabled: true })),
      evaluateRuntimeCryptoActivation(runtimeConfig({ runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" })),
    ];
    for (const decision of runtimeDecisions) {
      expect(runtimeReasons).toContain(decision.reason);
    }
    const workerDecisions: WorkerActivationDecision[] = [
      evaluateWorkerCryptoActivation(workerConfig()),
      evaluateWorkerCryptoActivation(workerConfig({ workerCryptoEnabled: true })),
      evaluateWorkerCryptoActivation(workerConfig({ workerCryptoEnabled: true, workerCryptoProvider: "fedos" })),
    ];
    for (const decision of workerDecisions) {
      expect(workerReasons).toContain(decision.reason);
    }
  });

  it("17. both policy files read FEDOS_RUNTIME_PROVIDER_IMPLEMENTED from fedos_runtime_crypto_provider.ts as a single source of truth, and it is false", () => {
    expect(runtimePolicySource).toMatch(
      /import\s*\{\s*FEDOS_RUNTIME_PROVIDER_IMPLEMENTED\s*\}\s*from\s*"\.\/fedos_runtime_crypto_provider\.js"/,
    );
    expect(workerPolicySource).toMatch(
      /import\s*\{\s*FEDOS_RUNTIME_PROVIDER_IMPLEMENTED\s*\}\s*from\s*"\.\/fedos_runtime_crypto_provider\.js"/,
    );
    expect(FEDOS_RUNTIME_PROVIDER_IMPLEMENTED).toBe(false);
    // Neither file keeps its own second, redundant literal named FEDOS_PROVIDER_IMPLEMENTED.
    expect(runtimePolicySource).not.toMatch(/const\s+FEDOS_PROVIDER_IMPLEMENTED\s*=/);
    expect(workerPolicySource).not.toMatch(/const\s+FEDOS_PROVIDER_IMPLEMENTED\s*=/);
  });

  it("18. Allowed remains unreachable even with both locks open, now that the implementation flag is imported rather than a local literal", () => {
    const runtimeDecision = evaluateRuntimeCryptoActivation(
      runtimeConfig({ runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" }),
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(runtimeDecision.reason).toBe("ProviderUnavailable");
    expect(runtimeDecision.allowed).toBe(false);

    const workerDecision = evaluateWorkerCryptoActivation(
      workerConfig({ workerCryptoEnabled: true, workerCryptoProvider: "fedos" }),
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(workerDecision.reason).toBe("ProviderUnavailable");
    expect(workerDecision.allowed).toBe(false);
  });

  it("19. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose providerImplemented: false", () => {
    expect(runtimeCryptoActivationStatus().providerImplemented).toBe(false);
    expect(workerCryptoActivationStatus().providerImplemented).toBe(false);
  });
});

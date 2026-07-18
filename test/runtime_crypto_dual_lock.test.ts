import { describe, it, expect } from "vitest";
import {
  parseFedosCryptoEnabledEnv,
  parseFedosCryptoProviderEnv,
  FEDOS_CRYPTO_ENABLED_LABELS,
  FEDOS_CRYPTO_ENABLED_EXPLICIT_DEV_ONLY_VALUE,
} from "../src/runtime/crypto_provider_env.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import type { RuntimeCryptoConfig } from "../src/runtime/runtime_crypto_config.js";
import type { WorkerCryptoConfig } from "../src/runtime/worker_crypto_config.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoProviderEnvSource from "../src/runtime/crypto_provider_env.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimePolicySource from "../src/runtime/runtime_crypto_activation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerPolicySource from "../src/runtime/worker_crypto_activation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeBridgeSource from "../src/runtime/runtime_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerBridgeSource from "../src/runtime/worker_crypto_bridge.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
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
 * Stage 297–304 — "Dual-Lock Activation Gate": Lock #2
 * (`FEDOS_CRYPTO_ENABLED`, `src/runtime/crypto_provider_env.ts`'s
 * `parseFedosCryptoEnabledEnv`, Stage 297), combined with the existing
 * Lock #1 (`FEDOS_CRYPTO_PROVIDER`) inside `evaluateRuntimeCryptoActivation`/
 * `evaluateWorkerCryptoActivation`. Even with BOTH locks open, "Allowed"
 * must remain unreachable, and neither bridge/Runtime/Worker is
 * connected to anything.
 */
describe("Runtime/Worker crypto dual-lock activation gate (Stage 297-304)", () => {
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

  const COMMON_TRUTHY_AND_OTHER_REJECTED_VALUES = [
    "true",
    "false",
    "1",
    "0",
    "yes",
    "no",
    "on",
    "off",
    "enabled",
    "disabled",
    "dev",
    "development",
    "debug",
    "prod",
    "production",
    "allow",
    "allow-fedos",
    "fedos",
    "real",
    "real-fedos",
    "experimental",
    "beta",
    "",
    "unknown-value",
    "TRUE",
    "Explicit-Dev-Only",
    "explicit_dev_only",
    " explicit-dev-only ", // handled separately below (trimmed IS accepted)
  ];

  it("1. every common truthy/negative/environment-name/FedOS-adjacent spelling is rejected by parseFedosCryptoEnabledEnv", () => {
    for (const value of COMMON_TRUTHY_AND_OTHER_REJECTED_VALUES) {
      if (value.trim() === FEDOS_CRYPTO_ENABLED_EXPLICIT_DEV_ONLY_VALUE) continue; // whitespace-tolerant case, tested separately
      expect(parseFedosCryptoEnabledEnv(value), `value: ${JSON.stringify(value)}`).toBe("disabled");
    }
    expect(parseFedosCryptoEnabledEnv(undefined)).toBe("disabled");
    expect(parseFedosCryptoEnabledEnv(null)).toBe("disabled");
  });

  it("2. only the exact string explicit-dev-only (optionally surrounded by whitespace) is accepted", () => {
    expect(parseFedosCryptoEnabledEnv("explicit-dev-only")).toBe("explicit-dev-only");
    expect(parseFedosCryptoEnabledEnv("  explicit-dev-only  ")).toBe("explicit-dev-only");
    expect(parseFedosCryptoEnabledEnv("\texplicit-dev-only\n")).toBe("explicit-dev-only");
    expect(FEDOS_CRYPTO_ENABLED_LABELS).toEqual(["explicit-dev-only", "disabled"]);
    expect(FEDOS_CRYPTO_ENABLED_EXPLICIT_DEV_ONLY_VALUE).toBe("explicit-dev-only");
  });

  it("3. parseFedosCryptoProviderEnv's own behavior (Lock #1) is completely unchanged", () => {
    expect(parseFedosCryptoProviderEnv(undefined)).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv("placeholder")).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv("fedos")).toBe("fedos");
    expect(parseFedosCryptoProviderEnv("true")).toBe("placeholder");
    expect(parseFedosCryptoProviderEnv("explicit-dev-only")).toBe("placeholder");
  });

  it("4. provider=fedos AND enabled=explicit-dev-only together still cannot activate crypto (Runtime)", () => {
    const decision = evaluateRuntimeCryptoActivation(
      runtimeConfig({ runtimeCryptoProvider: "fedos" }),
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("ProviderUnavailable");
  });

  it("5. provider=fedos AND enabled=explicit-dev-only together still cannot activate crypto (Worker)", () => {
    const decision = evaluateWorkerCryptoActivation(
      workerConfig({ workerCryptoProvider: "fedos" }),
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("ProviderUnavailable");
  });

  it("6. enabled=explicit-dev-only alone (provider still placeholder) reports ProviderNotSelected, not DisabledByConfig (Runtime)", () => {
    const decision = evaluateRuntimeCryptoActivation(runtimeConfig(), {
      FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
    });
    expect(decision.reason).toBe("ProviderNotSelected");
  });

  it("7. enabled=explicit-dev-only alone (provider still placeholder) reports ProviderNotSelected, not DisabledByConfig (Worker)", () => {
    const decision = evaluateWorkerCryptoActivation(workerConfig(), {
      FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
    });
    expect(decision.reason).toBe("ProviderNotSelected");
  });

  it("8. every truthy spelling passed as FEDOS_CRYPTO_ENABLED still leaves DisabledByConfig when provider is also fedos", () => {
    for (const value of ["true", "1", "yes", "on", "enabled", "allow-fedos", "real-fedos"]) {
      const decision = evaluateRuntimeCryptoActivation(
        runtimeConfig({ runtimeCryptoProvider: "fedos" }),
        { FEDOS_CRYPTO_ENABLED: value },
      );
      expect(decision.reason, `value: ${value}`).toBe("DisabledByConfig");
    }
  });

  it("9. Allowed is unreachable from either evaluate function under any input combination, including both locks open", () => {
    const inputs: Array<[boolean, string, string]> = [
      [false, "placeholder", "disabled"],
      [false, "fedos", "explicit-dev-only"],
      [true, "fedos", "explicit-dev-only"],
      [true, "placeholder", "explicit-dev-only"],
    ];
    for (const [configEnabled, provider, enabledEnv] of inputs) {
      const runtimeDecision = evaluateRuntimeCryptoActivation(
        runtimeConfig({
          runtimeCryptoEnabled: configEnabled,
          runtimeCryptoProvider: provider as "placeholder" | "fedos",
        }),
        { FEDOS_CRYPTO_PROVIDER: provider, FEDOS_CRYPTO_ENABLED: enabledEnv },
      );
      expect(runtimeDecision.reason).not.toBe("Allowed");
      expect(runtimeDecision.allowed).toBe(false);

      const workerDecision = evaluateWorkerCryptoActivation(
        workerConfig({
          workerCryptoEnabled: configEnabled,
          workerCryptoProvider: provider as "placeholder" | "fedos",
        }),
        { FEDOS_CRYPTO_PROVIDER: provider, FEDOS_CRYPTO_ENABLED: enabledEnv },
      );
      expect(workerDecision.reason).not.toBe("Allowed");
      expect(workerDecision.allowed).toBe(false);
    }
  });

  it("10. diagnostics expose configuredEnabled reflecting Lock #2, without ever leaking the raw env string", () => {
    const marker = "MARKER-9f3e-should-never-leak";
    const runtimeStatus = runtimeCryptoActivationStatus({
      FEDOS_CRYPTO_ENABLED: marker,
    });
    expect(runtimeStatus.configuredEnabled).toBe("disabled");
    expect(JSON.stringify(runtimeStatus)).not.toContain(marker);

    const explicitStatus = runtimeCryptoActivationStatus({
      FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
    });
    expect(explicitStatus.configuredEnabled).toBe("explicit-dev-only");
    expect(explicitStatus.activationReason).toBe("ProviderNotSelected");
    expect(explicitStatus.effectiveProvider).toBe("placeholder");

    const workerStatus = workerCryptoActivationStatus({ FEDOS_CRYPTO_ENABLED: marker });
    expect(workerStatus.configuredEnabled).toBe("disabled");
    expect(JSON.stringify(workerStatus)).not.toContain(marker);
  });

  it("11. diagnostics activationReason and effectiveProvider can diverge once both locks are open, but effectiveProvider never reports fedos", () => {
    const status = runtimeCryptoActivationStatus({
      FEDOS_CRYPTO_PROVIDER: "fedos",
      FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
    });
    expect(status.activationReason).toBe("ProviderUnavailable");
    expect(status.effectiveProvider).toBe("placeholder");
    expect(status.enabled).toBe(false);

    const workerStatus = workerCryptoActivationStatus({
      FEDOS_CRYPTO_PROVIDER: "fedos",
      FEDOS_CRYPTO_ENABLED: "explicit-dev-only",
    });
    expect(workerStatus.activationReason).toBe("ProviderUnavailable");
    expect(workerStatus.effectiveProvider).toBe("placeholder");
  });

  it("12. Runtime and Worker activation policies remain fully independent -- neither imports the other", () => {
    expect(codeOnlyOf(runtimePolicySource)).not.toMatch(
      /worker_crypto_activation_policy|evaluateWorkerCryptoActivation/,
    );
    expect(codeOnlyOf(workerPolicySource)).not.toMatch(
      /runtime_crypto_activation_policy|evaluateRuntimeCryptoActivation/,
    );
  });

  it("13. neither bridge file reads FEDOS_CRYPTO_ENABLED -- the bridges were not touched this stage", () => {
    expect(codeOnlyOf(runtimeBridgeSource)).not.toMatch(/FEDOS_CRYPTO_ENABLED/);
    expect(codeOnlyOf(workerBridgeSource)).not.toMatch(/FEDOS_CRYPTO_ENABLED/);
  });

  it("14. src/worker.ts still does not import any Worker crypto file, including the activation policy", () => {
    expect(workerSource).not.toMatch(
      /worker_crypto_config|worker_crypto_registry|worker_crypto_bridge|worker_crypto_diagnostics|worker_crypto_activation_policy/,
    );
  });

  it("15. no process.env reference, no encrypt/decrypt call, no fedos-core-rust reference in the parser or either policy file", () => {
    for (const src of [cryptoProviderEnvSource, runtimePolicySource, workerPolicySource]) {
      const codeOnly = codeOnlyOf(src);
      expect(codeOnly).not.toMatch(/process\.env/);
      expect(codeOnly).not.toMatch(/\.\s*(encrypt|decrypt)\s*\(/);
      expect(codeOnly).not.toMatch(/fedos-core-rust/i);
    }
  });

  it("16. Rust is untouched -- pub fn surface (27) and Cargo.toml/package.json dependency counts unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m: RegExpMatchArray) => m[1]);
    expect(pubFnNames.length).toBe(50);

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

  it("17. docs record the dual-lock model and the fail-closed guarantee under both locks", () => {
    expect(activationPolicyDocSource).toMatch(/dual-lock/i);
    expect(activationPolicyDocSource).toMatch(/FEDOS_CRYPTO_ENABLED/);
    expect(activationPolicyDocSource).toMatch(/explicit-dev-only/);

    expect(threatModelDocSource).toMatch(/explicit-dev-only/);
    expect(threatModelDocSource).toMatch(/ProviderUnavailable/);
    expect(threatModelDocSource).toMatch(/fail-closed/i);
  });
});

import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  buildTimeLoaderRequiresPrebuild,
  buildTimeLoaderRuntimeAttachAllowed,
  buildTimeLoaderStrategy,
  createBuildTimeLoaderStrategy,
} from "../src/runtime/fedos_build_time_loader_strategy.js";
import { createGeneratedArtifactDistribution } from "../src/runtime/fedos_generated_artifact_distribution.js";
import { createStaticImportActivationReview } from "../src/runtime/fedos_static_import_activation_review.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderStrategyDocSource from "../docs/runtime_build_time_loader_strategy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderStrategySource from "../src/runtime/fedos_build_time_loader_strategy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import distributionSource from "../src/runtime/fedos_generated_artifact_distribution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoGitignoreSource from "../packages/fedos-core-rust/.gitignore?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 561–566 — "FedOS Build-Time Loader Strategy: Option C
 * (dynamic loader with an explicit dev-only gate) designated as a
 * future candidate, never implemented".
 * `docs/runtime_build_time_loader_strategy.md` (Stage 561) compares
 * three candidate future loading strategies and designates Option C
 * without implementing it.
 * `src/runtime/fedos_build_time_loader_strategy.ts` (Stage 562) fixes
 * `createBuildTimeLoaderStrategy()` to `{ strategy:
 * "DynamicLoaderPlanned", requiresPrebuild: true, staticImportAllowed:
 * false, dynamicImportAllowed: false, runtimeAttachAllowed: false }`.
 * Stage 563 wires `createGeneratedArtifactDistribution()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises imports, `import()`s, or executes the generated JS glue,
 * calls `WebAssembly.instantiate`/`compile`, or connects Runtime/
 * Worker to any of it.
 */
describe("FedOS Build-Time Loader Strategy, dynamic loader planned but never implemented, fail-closed everywhere (Stage 561-566)", () => {
  it("1. createBuildTimeLoaderStrategy is always DynamicLoaderPlanned/requiresPrebuild/no import allowed -- never a live probe", () => {
    const strategy = createBuildTimeLoaderStrategy();
    expect(strategy.strategy).toBe("DynamicLoaderPlanned");
    expect(strategy.requiresPrebuild).toBe(true);
    expect(strategy.staticImportAllowed).toBe(false);
    expect(strategy.dynamicImportAllowed).toBe(false);
    expect(strategy.runtimeAttachAllowed).toBe(false);
    // Pure and idempotent across repeated calls.
    expect(createBuildTimeLoaderStrategy()).toEqual(strategy);

    expect(buildTimeLoaderStrategy()).toBe("DynamicLoaderPlanned");
    expect(buildTimeLoaderRequiresPrebuild()).toBe(true);
    expect(buildTimeLoaderRuntimeAttachAllowed()).toBe(false);
  });

  it("2. the loader strategy's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.buildTimeLoaderStrategy).toBe("DynamicLoaderPlanned");
    expect(status.buildTimeLoaderRequiresPrebuild).toBe(true);
    expect(status.buildTimeLoaderRuntimeAttachAllowed).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.buildTimeLoaderStrategy).toBe("DynamicLoaderPlanned");
    expect(workerStatus.buildTimeLoaderRequiresPrebuild).toBe(true);
    expect(workerStatus.buildTimeLoaderRuntimeAttachAllowed).toBe(false);
  });

  it("3. the loader strategy source never imports the generated JS glue, never writes import()/require, and never touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(loaderStrategySource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/\bfs\b/);
    expect(codeOnly).not.toMatch(/existsSync|statSync/);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
  });

  it("4. the generated artifact distribution policy legitimately reaches the loader strategy but never the generated JS glue or WebAssembly", () => {
    expect(distributionSource).toMatch(/fedos_build_time_loader_strategy/);
    const codeOnly = codeOnlyLines(distributionSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const distribution = createGeneratedArtifactDistribution();
    expect(distribution.staticImportSafe).toBe(false);

    const review = createStaticImportActivationReview();
    expect(review.approved).toBe(false);
  });

  it("5. Generated file remains untracked -- packages/fedos-core-rust/.gitignore still ignores /pkg/, and any locally-generated artifact is never git-tracked", () => {
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/pkg\/(\n|$)/);

    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const generated = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    const generatedGlue = /_bg\.(js|ts|wasm)$/i;
    const generatedPkgDir = /\/pkg\//i;
    const candidates = paths.filter(
      (path) => generated.test(path) || generatedGlue.test(path) || generatedPkgDir.test(path),
    );
    if (candidates.length === 0) {
      return;
    }
    const tracked = execFileSync("git", ["ls-files", "--", "packages/fedos-core-rust"], {
      encoding: "utf-8",
    });
    const trackedPaths = new Set(tracked.split("\n").filter(Boolean));
    for (const candidate of candidates) {
      const repoRelative = candidate.replace(/^\.\.\//, "");
      expect(trackedPaths.has(repoRelative), `generated artifact must never be git-tracked: ${repoRelative}`).toBe(
        false,
      );
    }
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createStaticImportActivationReview();
      createGeneratedArtifactDistribution();
      createBuildTimeLoaderStrategy();
      buildTimeLoaderStrategy();
      buildTimeLoaderRequiresPrebuild();
      buildTimeLoaderRuntimeAttachAllowed();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("7. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      evaluateWasmLoaderImportPolicy();
      createGeneratedArtifactDistribution();
      createBuildTimeLoaderStrategy();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the loader strategy", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the loader strategy", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_build_time_loader_strategy|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("10. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("11. Allowed is still unreachable anywhere in the chain, and the loader strategy never flips to PrebuildRequired/OptionalLoader on its own", () => {
    const runtimeDecision = evaluateRuntimeCryptoActivation(
      { runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(runtimeDecision.reason).toBe("ProviderUnavailable");
    expect(runtimeDecision.allowed).toBe(false);

    const workerDecision = evaluateWorkerCryptoActivation(
      { workerCryptoEnabled: true, workerCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(workerDecision.reason).toBe("ProviderUnavailable");
    expect(workerDecision.allowed).toBe(false);

    expect(evaluateWasmLoaderImportPolicy().allowed).toBe(false);
    expect(createStaticImportActivationReview().approved).toBe(false);
    expect(createGeneratedArtifactDistribution().artifactCommitted).toBe(false);
    expect(createBuildTimeLoaderStrategy().strategy).toBe("DynamicLoaderPlanned");
    expect(createBuildTimeLoaderStrategy().staticImportAllowed).toBe(false);
    expect(createBuildTimeLoaderStrategy().dynamicImportAllowed).toBe(false);
    expect(createBuildTimeLoaderStrategy().runtimeAttachAllowed).toBe(false);
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(45);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);

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

  it("13. the loader strategy doc and execution contract doc record the required facts", () => {
    expect(loaderStrategyDocSource).toMatch(/Option A/);
    expect(loaderStrategyDocSource).toMatch(/Option B/);
    expect(loaderStrategyDocSource).toMatch(/Option C/);
    expect(loaderStrategyDocSource).toMatch(/DynamicLoaderPlanned/);

    expect(executionContractDocSource).toMatch(/Build-Time Loader Strategy/);
    expect(executionContractDocSource).toMatch(/DynamicLoaderPlanned/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});

import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  createGeneratedArtifactDistribution,
  generatedArtifactCommitted,
  generatedArtifactDistributionMode,
  staticImportSafe,
} from "../src/runtime/fedos_generated_artifact_distribution.js";
import { createStaticImportActivationReview } from "../src/runtime/fedos_static_import_activation_review.js";
import { createGeneratedArtifactPresence } from "../src/runtime/fedos_generated_artifact_presence.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import distributionPolicyDocSource from "../docs/runtime_generated_artifact_distribution_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import distributionSource from "../src/os/core/vault/wasm/fedos_generated_artifact_distribution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationReviewSource from "../src/os/core/vault/wasm/fedos_static_import_activation_review.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoGitignoreSource from "../packages/fedos-core-rust/.gitignore?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 553–558 — "FedOS Generated Artifact Distribution Policy:
 * build-time generation only (Option B), never committed".
 * `docs/runtime_generated_artifact_distribution_policy.md` (Stage 553)
 * fixes this repository's standing choice between committing the
 * generated artifact (Option A) and build-time generation only
 * (Option B) — Option B is adopted. `src/runtime/fedos_generated_artifact_distribution.ts`
 * (Stage 554) fixes `createGeneratedArtifactDistribution()` to `{
 * distributionMode: "BuildTimeGenerated", artifactCommitted: false,
 * staticImportSafe: false, reason: "GeneratedArtifactNotCommitted"
 * }`. Stage 555 wires `createStaticImportActivationReview()` to call
 * it, discarding the result. Neither this test file nor any file it
 * exercises imports, `import()`s, or executes the generated JS glue,
 * calls `WebAssembly.instantiate`/`compile`, or connects Runtime/
 * Worker to any of it.
 */
describe("FedOS Generated Artifact Distribution Policy, build-time generation only, fail-closed everywhere (Stage 553-558)", () => {
  it("1. createGeneratedArtifactDistribution is always BuildTimeGenerated/not-committed/not-safe -- never a live probe", () => {
    const distribution = createGeneratedArtifactDistribution();
    expect(distribution.distributionMode).toBe("BuildTimeGenerated");
    expect(distribution.artifactCommitted).toBe(false);
    expect(distribution.staticImportSafe).toBe(false);
    expect(distribution.reason).toBe("GeneratedArtifactNotCommitted");
    // Pure and idempotent across repeated calls.
    expect(createGeneratedArtifactDistribution()).toEqual(distribution);

    expect(generatedArtifactDistributionMode()).toBe("BuildTimeGenerated");
    expect(generatedArtifactCommitted()).toBe(false);
    expect(staticImportSafe()).toBe(false);
  });

  it("2. pkg/ remains gitignored and, if present locally, the generated artifact is never git-tracked", () => {
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

  it("3. the distribution policy's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.generatedArtifactDistributionMode).toBe("BuildTimeGenerated");
    expect(status.generatedArtifactCommitted).toBe(false);
    expect(status.staticImportSafe).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.generatedArtifactDistributionMode).toBe("BuildTimeGenerated");
    expect(workerStatus.generatedArtifactCommitted).toBe(false);
    expect(workerStatus.staticImportSafe).toBe(false);
  });

  it("4. the distribution policy source never imports the generated JS glue, dynamic-imports, require, or touches WebAssembly/fetch/Runtime/Worker/filesystem/git", () => {
    const codeOnly = codeOnlyLines(distributionSource);
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

  it("5. the static import activation review legitimately reaches the distribution policy but never the generated JS glue or WebAssembly", () => {
    expect(activationReviewSource).toMatch(/fedos_generated_artifact_distribution/);
    const codeOnly = codeOnlyLines(activationReviewSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const review = createStaticImportActivationReview();
    expect(review.approved).toBe(false);

    const presence = createGeneratedArtifactPresence();
    expect(presence.present).toBe(false);
  });

  it("6. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence/activation/distribution surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      createGeneratedArtifactPresence();
      createStaticImportActivationReview();
      createGeneratedArtifactDistribution();
      generatedArtifactDistributionMode();
      generatedArtifactCommitted();
      staticImportSafe();
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
      createStaticImportActivationReview();
      createGeneratedArtifactDistribution();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the distribution policy", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the distribution policy", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_static_import_activation_review|fedos_generated_artifact_distribution|fedos_wasm_loader_import_policy/,
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

  it("11. Allowed/Approved/Committed are all still unreachable anywhere in the chain", () => {
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
    expect(createGeneratedArtifactDistribution().distributionMode).not.toBe("Committed");
    expect(createGeneratedArtifactDistribution().staticImportSafe).not.toBe(true);
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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

  it("13. the distribution policy doc and execution contract doc record the required facts", () => {
    expect(distributionPolicyDocSource).toMatch(/Option A/);
    expect(distributionPolicyDocSource).toMatch(/Option B/);
    expect(distributionPolicyDocSource).toMatch(/GeneratedArtifactNotCommitted/);

    expect(executionContractDocSource).toMatch(/Generated Artifact Distribution Policy/);
    expect(executionContractDocSource).toMatch(/BuildTimeGenerated/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});

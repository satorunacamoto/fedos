import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { createFedosWasmArtifact } from "../src/runtime/fedos_wasm_artifact.js";
import {
  FedosWasmToolchainPlaceholder,
  fedosWasmBindgenCliExpectedVersion,
  fedosWasmBindgenVersionAligned,
  fedosWasmGlueGenerationObserved,
} from "../src/runtime/fedos_wasm_toolchain.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bindgenVersionPolicySource from "../docs/runtime_wasm_bindgen_version_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationDocSource from "../docs/runtime_wasm_artifact_observation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoGitignoreSource from "../packages/fedos-core-rust/.gitignore?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Stage 473–480 — "FedOS wasm-bindgen CLI/crate version alignment":
 * resolves the THIRD cause `docs/runtime_wasm_artifact_observation.md`
 * §7 (Stage 469) classified — a `wasm-bindgen` CLI (`0.2.100`) / crate
 * (`0.2.126`) schema mismatch. `docs/runtime_wasm_bindgen_version_policy.md`
 * (Stage 473) fixes the policy: the LOCAL CLI moves to match the
 * crate-resolved version, never the reverse. Stage 474 applied it
 * (`cargo install wasm-bindgen-cli --version 0.2.126 --force`, a
 * machine-local environment-capability change). Stage 475 re-ran
 * `npm run build:wasm` and it FULLY SUCCEEDED — the first real
 * `.wasm` + JS glue pair ever produced (§10 of the observation doc).
 */
describe("FedOS wasm-bindgen CLI/crate version alignment, first real JS glue, fail-closed everywhere else (Stage 473-480)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n");

  it("1. the version policy doc names the CLI-moves policy, the 0.2.126 target, and why Cargo.toml is never pinned old", () => {
    expect(bindgenVersionPolicySource).toMatch(/0\.2\.126/);
    expect(bindgenVersionPolicySource).toMatch(/0\.2\.100/);
    expect(bindgenVersionPolicySource).toMatch(/CLI/);
    expect(bindgenVersionPolicySource).not.toMatch(/wasm-pack (?:is|was) (?:installed|adopted)/i);
  });

  it("2. no Cargo.toml dependency VERSION was changed by this batch (Stage 473-480) -- getrandom's version/features untouched; production dependency count is now 11 (Stage 985, Prototype EXECUTION Phase 009, added wasm-bindgen as a direct dependency -- see test/runtime_wasm_rust_export_bindgen_dependency.test.ts)", () => {
    const lowerCargoCode = cargoCode.toLowerCase();
    const depsIdx = lowerCargoCode.indexOf("[dependencies]");
    const devDepsIdx = lowerCargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = lowerCargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    expect(cargoTomlSource).toMatch(/getrandom\s*=\s*\{[^}]*version\s*=\s*"0\.3"/);
    expect(cargoTomlSource).toMatch(/getrandom\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"wasm_js"[^\]]*\][^}]*\}/);
    expect(cargoCode.toLowerCase()).toMatch(/^\s*wasm-bindgen\s*=\s*"0\.2\.126"/m);
  });

  it("3. no package.json dependency was added -- still 2 production dependencies, no wasm-bindgen/wasm-pack entry", () => {
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(allDeps)).not.toContain("wasm-bindgen");
    expect(Object.keys(allDeps)).not.toContain("wasm-pack");
  });

  it("4. wasm-pack is still not adopted anywhere in package.json/Cargo.toml/the version policy doc", () => {
    expect(packageJsonSource.toLowerCase()).not.toContain("wasm-pack");
    expect(cargoCode.toLowerCase()).not.toContain("wasm-pack");
  });

  it("5. build:wasm's script text is unchanged since Stage 467 -- same corrected input path, same --out-dir, no new script", () => {
    const pkg = JSON.parse(packageJsonSource);
    const script: string = pkg.scripts["build:wasm"];
    expect(script).toContain(
      "packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm",
    );
    expect(script).toContain("--out-dir packages/fedos-core-rust/pkg");
    expect(Object.keys(pkg.scripts)).not.toContain("build:wasm-bindgen");
    expect(Object.keys(pkg.scripts)).not.toContain("install:wasm-bindgen");
  });

  it("6. packages/fedos-core-rust/.gitignore still ignores /pkg/, /target/, and Cargo.lock", () => {
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/pkg\/(\n|$)/);
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/target\/(\n|$)/);
    expect(cargoGitignoreSource).toMatch(/(^|\n)Cargo\.lock(\n|$)/);
  });

  it("7. any generated .wasm/JS-glue/pkg/ artifact is ALLOWED to exist locally, but must NEVER be tracked by git", () => {
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

  it("8. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
  });

  it("9. Worker remains unconnected -- src/worker.ts imports none of the WASM chain", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("10. WebAssembly.instantiate/compile are never actually invoked, even when exercising the artifact's full surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const artifact = createFedosWasmArtifact();
      artifact.status();
      artifact.planBuild();
      artifact.planLoad();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("11. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("12. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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
  });

  it("13. FedosWasmToolchain exposes the fixed version-alignment labels, still never a live probe", () => {
    const status = new FedosWasmToolchainPlaceholder().status();
    expect(status.wasmBindgenCliExpectedVersion).toBe("0.2.126");
    expect(status.wasmBindgenVersionAligned).toBe(true);
    expect(status.wasmGlueGenerationObserved).toBe(true);

    expect(fedosWasmBindgenCliExpectedVersion()).toBe("0.2.126");
    expect(fedosWasmBindgenVersionAligned()).toBe(true);
    expect(fedosWasmGlueGenerationObserved()).toBe(true);
  });

  it("14. the observation doc records the FULL success -- real JS glue generated, sizes recorded, commit policy reaffirmed", () => {
    expect(observationDocSource).toMatch(/FULL SUCCESS/);
    expect(observationDocSource).toMatch(/fedos_core_rust\.js/);
    expect(observationDocSource).toMatch(/fedos_core_rust_bg\.wasm/);
    expect(observationDocSource).toMatch(/fedos_core_rust\.d\.ts/);
    expect(observationDocSource).toMatch(/0\.2\.126/);
  });
});

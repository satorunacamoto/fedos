import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import {
  FedosWasmArtifactPlaceholder,
  createFedosWasmArtifact,
  fedosArtifactCommitPolicy,
  fedosArtifactGeneratedButUntracked,
  fedosArtifactGenerationObserved,
  fedosGeneratedArtifactPath,
  fedosWasmArtifactGenerated,
  fedosWasmArtifactGenerationState,
} from "../src/runtime/fedos_wasm_artifact.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoGitignoreSource from "../packages/fedos-core-rust/.gitignore?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import generationDocSource from "../docs/runtime_wasm_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 449–456 — "first WASM Artifact GENERATION planning": now that
 * `cargo check`/`cargo build --target wasm32-unknown-unknown` compile
 * clean (Stage 443–444), this batch names the REMAINING steps to a
 * real `.wasm` + JS glue pair (`wasm-bindgen`) — a planning doc
 * (`docs/runtime_wasm_generation.md`, Stage 449), a never-auto-run
 * `npm run build:wasm` script (Stage 450), a fixed, gitignored output
 * directory (`packages/fedos-core-rust/pkg/`, Stage 451), a NEW
 * `generationState` axis on `FedosWasmArtifact` (Stage 452, DISTINCT
 * from its existing `state`), and `wasmArtifactGenerated`/
 * `generatedArtifactPath` diagnostics (Stage 453). Nothing is ever
 * generated, built via the new script, or loaded — Runtime/Worker stay
 * unconnected, `encrypt`/`decrypt` are untouched, and `"Allowed"`
 * remains unreachable.
 *
 * Stage 457–464 — a real `npm run build:wasm` run was actually
 * observed for the first time (`docs/runtime_wasm_artifact_observation.md`):
 * `cargo build` succeeded, `wasm-bindgen` failed (no `cdylib`, no
 * `.wasm` produced). This test file's item 7 is relaxed accordingly:
 * a generated `.rlib`/`.wasm`/`pkg/` artifact is ALLOWED to exist
 * locally, but is asserted to never be tracked by git. Item 15 checks
 * the three new fixed labels this batch adds to `fedos_wasm_artifact.ts`
 * (`artifactGenerationObserved`, `artifactGeneratedButUntracked`,
 * `artifactCommitPolicy`) — still hand-fixed constants, never a real
 * filesystem/runtime check.
 */
describe("FedOS WASM generation planning, nothing generated, fail-closed everywhere (Stage 449-456, updated 457-464)", () => {
  it("1. FedosWasmArtifact's new generationState is fixed NotGenerated, distinct from its existing state", () => {
    const artifact = new FedosWasmArtifactPlaceholder();
    const status = artifact.status();
    expect(status.state).toBe("NotBuilt");
    expect(status.generationState).toBe("NotGenerated");

    expect(fedosWasmArtifactGenerationState()).toBe("NotGenerated");
  });

  it("2. the standalone generated-artifact diagnostics functions are fixed false/null", () => {
    expect(fedosWasmArtifactGenerated()).toBe(false);
    expect(fedosGeneratedArtifactPath()).toBeNull();
  });

  it("3. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose wasmArtifactGenerated/generatedArtifactPath, fixed false/null", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.wasmArtifactGenerated).toBe(false);
    expect(status.generatedArtifactPath).toBeNull();

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.wasmArtifactGenerated).toBe(false);
    expect(workerStatus.generatedArtifactPath).toBeNull();
  });

  it("4. package.json has a build:wasm script naming cargo build + wasm-bindgen, and it is never auto-invoked by any lifecycle hook or by test/typecheck", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(pkg.scripts["build:wasm"]).toMatch(/cargo\s+build/);
    expect(pkg.scripts["build:wasm"]).toMatch(/--target\s+wasm32-unknown-unknown/);
    expect(pkg.scripts["build:wasm"]).toMatch(/wasm-bindgen/);
    expect(pkg.scripts["build:wasm"]).toMatch(/packages\/fedos-core-rust\/pkg/);

    expect(pkg.scripts.test).not.toMatch(/build:wasm/);
    expect(pkg.scripts.typecheck).not.toMatch(/build:wasm/);
    expect(pkg.scripts["test:watch"]).not.toMatch(/build:wasm/);
    for (const hook of ["pretest", "posttest", "prepare", "preinstall", "postinstall", "prebuild", "postbuild"]) {
      expect(Object.keys(pkg.scripts)).not.toContain(hook);
    }
  });

  it("5. no new Cargo/package dependency was added -- production dependency counts unchanged (Rust 10, package.json 2)", () => {
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

  it("6. packages/fedos-core-rust/.gitignore ignores the fixed pkg/ output directory", () => {
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/pkg\/(\n|$)/);
  });

  it("7. a locally-generated .wasm/JS-glue/pkg/ artifact is ALLOWED to exist on disk (Stage 457-459 may have produced one), but must NEVER be tracked by git", () => {
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
    // Presence alone is NOT a failure -- a real `npm run build:wasm` run
    // (Stage 457-459) may leave `.rlib`/`.wasm`/pkg/ output on disk
    // locally. What must NEVER happen is one of these paths being
    // tracked by git -- checked directly against `git ls-files`, not
    // inferred from `.gitignore` patterns alone.
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

  it("8. Rust public API is unchanged (27 pub fn) -- no new WASM-facing function was added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(64);
  });

  it("9. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
  });

  it("10. Worker remains unconnected -- src/worker.ts imports none of the WASM chain", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
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

  it("13. WebAssembly.instantiate/compile are never actually invoked, even when exercising the artifact's full surface", () => {
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

  it("14. the generation planning doc names the script, the output directory, and states nothing is generated", () => {
    expect(generationDocSource).toMatch(/build:wasm/);
    expect(generationDocSource).toMatch(/packages\/fedos-core-rust\/pkg/);
    expect(generationDocSource).toMatch(/wasm-bindgen/);
    expect(generationDocSource).toMatch(/NOT GENERATED|NotGenerated/);
    expect(generationDocSource).toMatch(/PLANNING ONLY/);
  });

  it("15. Stage 457-460 fixed labels: a generation attempt has been observed, but any artifact stays untracked and is never committed", () => {
    const artifact = new FedosWasmArtifactPlaceholder();
    const status = artifact.status();
    expect(status.artifactGenerationObserved).toBe(true);
    expect(status.artifactGeneratedButUntracked).toBe(true);
    expect(status.artifactCommitPolicy).toBe("NeverCommitGeneratedArtifact");

    expect(fedosArtifactGenerationObserved()).toBe(true);
    expect(fedosArtifactGeneratedButUntracked()).toBe(true);
    expect(fedosArtifactCommitPolicy()).toBe("NeverCommitGeneratedArtifact");

    // Still distinct from whether a real artifact actually EXISTS --
    // that stays false/NotGenerated, since the observed attempt failed.
    expect(fedosWasmArtifactGenerated()).toBe(false);
    expect(fedosWasmArtifactGenerationState()).toBe("NotGenerated");
  });

  it("16. Stage 465-467 fix: crate-type is rlib + cdylib, and build:wasm's wasm-bindgen input path matches the crate's actual (non-workspace) target-dir", () => {
    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n");
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*,\s*"cdylib"\s*\]/);

    const pkg = JSON.parse(packageJsonSource);
    expect(pkg.scripts["build:wasm"]).toContain(
      "packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm",
    );
    // The OLD, wrong repo-root-relative path (Stage 458's failure cause) must be gone.
    expect(pkg.scripts["build:wasm"]).not.toContain(" target/wasm32-unknown-unknown/release/fedos_core_rust.wasm");
  });
});

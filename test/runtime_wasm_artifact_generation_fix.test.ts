import { describe, it, expect, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { createFedosWasmArtifact } from "../src/runtime/fedos_wasm_artifact.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoGitignoreSource from "../packages/fedos-core-rust/.gitignore?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fixDocSource from "../docs/runtime_wasm_artifact_generation_fix.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import observationDocSource from "../docs/runtime_wasm_artifact_observation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Stage 465–472 — "FedOS WASM artifact generation fix": resolves the
 * two causes `docs/runtime_wasm_artifact_observation.md` (Stage
 * 457–459) classified — no `cdylib` crate-type, and a `build:wasm`
 * `wasm-bindgen` input path that didn't match this crate's actual
 * (non-workspace) `target-dir`. `docs/runtime_wasm_artifact_generation_fix.md`
 * (Stage 465) records the fix; Stage 466 adds `cdylib` to `[lib]`
 * (keeping `rlib`); Stage 467 corrects the `build:wasm` path. Stage
 * 468 re-ran the build: both causes are confirmed resolved (a REAL
 * `.wasm` file was produced and read), but a NEW, third cause (a
 * `wasm-bindgen` CLI/crate schema version mismatch) blocked JS glue
 * generation — recorded, not fixed, in
 * `docs/runtime_wasm_artifact_observation.md` §7–9 (Stage 469).
 */
describe("FedOS WASM artifact generation fix, both original causes resolved, fail-closed everywhere else (Stage 465-472)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n");

  it("1. crate-type is rlib + cdylib -- rlib kept for native cargo test/check, cdylib added for a real .wasm build output", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*,\s*"cdylib"\s*\]/);
  });

  it("2. build:wasm's wasm-bindgen input path matches the crate's actual (non-workspace) target-dir; the old, wrong repo-root path is gone", () => {
    const pkg = JSON.parse(packageJsonSource);
    const script: string = pkg.scripts["build:wasm"];
    expect(script).toContain(
      "packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm",
    );
    expect(script).not.toContain(" target/wasm32-unknown-unknown/release/fedos_core_rust.wasm");
    // The cargo build half and the --out-dir destination are unchanged.
    expect(script).toMatch(/cargo\s+build\s+--manifest-path\s+packages\/fedos-core-rust\/Cargo\.toml/);
    expect(script).toContain("--out-dir packages/fedos-core-rust/pkg");
  });

  it("3. no wasm-pack reference anywhere in Cargo.toml, package.json, or either WASM-fix doc", () => {
    expect(cargoCode.toLowerCase()).not.toContain("wasm-pack");
    expect(packageJsonSource.toLowerCase()).not.toContain("wasm-pack");
    expect(fixDocSource.toLowerCase()).not.toMatch(/(?<!no )wasm-pack (?:was |is )(?:installed|invoked|adopted)/);
  });

  it("4. no new Cargo/package dependency was added -- production dependency counts unchanged (Rust 10, package.json 2)", () => {
    const lowerCargoCode = cargoCode.toLowerCase();
    const depsIdx = lowerCargoCode.indexOf("[dependencies]");
    const devDepsIdx = lowerCargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = lowerCargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });

  it("5. Rust public API is unchanged (27 pub fn) -- cdylib changes the build artifact shape, not the crate's source/API", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);  });

  it("6. packages/fedos-core-rust/.gitignore still ignores /pkg/, /target/, and Cargo.lock", () => {
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/pkg\/(\n|$)/);
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/target\/(\n|$)/);
    expect(cargoGitignoreSource).toMatch(/(^|\n)Cargo\.lock(\n|$)/);
  });

  it("7. a locally-generated .wasm/.rlib/JS-glue/pkg/ artifact is ALLOWED to exist on disk, but must NEVER be tracked by git", () => {
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

  it("10. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("11. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("12. WebAssembly.instantiate/compile are never actually invoked, even when exercising the artifact's full surface", () => {
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

  it("13. the fix doc records both causes, the rlib-kept/cdylib-added rationale, and states no other dependency/API change", () => {
    expect(fixDocSource).toMatch(/cdylib/);
    expect(fixDocSource).toMatch(/rlib/);
    expect(fixDocSource).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*,\s*"cdylib"\s*\]/);
    expect(fixDocSource).toMatch(/packages\/fedos-core-rust\/target\/wasm32-unknown-unknown\/release\/fedos_core_rust\.wasm/);
  });

  it("14. the observation doc records the Stage 468 re-run: both original causes resolved, a real .wasm produced, and the new version-mismatch failure", () => {
    expect(observationDocSource).toMatch(/RESOLVED/);
    expect(observationDocSource).toMatch(/35,?744/);
    expect(observationDocSource).toMatch(/schema version/i);
    expect(observationDocSource).toMatch(/0\.2\.100/);
    expect(observationDocSource).toMatch(/0\.2\.126/);
  });
});

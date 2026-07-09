import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_wasm_rust_export_bindgen_dependency.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Prototype EXECUTION Phase 009 — "Adopt wasm-bindgen Dependency":
 * adds `wasm-bindgen` as a direct `[dependencies]` entry
 * (`Cargo.toml`, Stage 985), pinned `0.2.126` to match the version
 * already resolved transitively and already used by `wasm-bindgen-cli`
 * -- a dependency-line-only adoption. No `#[wasm_bindgen]` attribute,
 * no new Rust function, no `version()`, no TypeScript change, and no
 * generated JS glue/`.wasm` output committed.
 */
describe("FedOS wasm-bindgen dependency adoption -- Cargo.toml change only, no #[wasm_bindgen]/Rust function/TypeScript change", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(2000);
  });

  it("2. wasm-bindgen is now a direct [dependencies] entry, pinned 0.2.126", () => {
    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n");
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    expect(productionDepsSection).toMatch(/^\s*wasm-bindgen\s*=\s*"0\.2\.126"/m);
  });

  it("3. Rust public API count is unchanged at 27 pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(30);
  });

  it("4. no #[wasm_bindgen] attribute existed anywhere in lib.rs at THIS Phase's own Stage 985 scope (Stage 986, Prototype EXECUTION Phase 010, later added exactly one -- see test/runtime_wasm_rust_version_export.test.ts)", () => {
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(3);
  });

  it("5. no version() function existed at THIS Phase's own Stage 985 scope (Stage 986, Prototype EXECUTION Phase 010, later added exactly one, importing wasm_bindgen -- see test/runtime_wasm_rust_version_export.test.ts)", () => {
    expect(libRsSource).toMatch(/pub\s+fn\s+version\s*\(/);
    expect(libRsSource).toMatch(/use\s+wasm_bindgen::prelude::\*;/);
  });

  it("6. production dependency count grows by exactly one (wasm-bindgen), to 11", () => {
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
  });

  it("7. package.json dependencies remain unchanged at 2", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("8. src/runtime/fedos_wasm_loader.ts is byte-for-byte untouched by this stage", () => {
    expect(wasmLoaderSource).not.toMatch(/\bversion\s*\(\s*\)\s*;/);
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("9. the design doc explicitly states what was added and what was deliberately NOT done", () => {
    expect(reviewDocSource).toMatch(/wasm-bindgen = "0\.2\.126"/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add any Rust function/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add `version\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add `#\\?\[wasm_bindgen\\?\]` to anything/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/runtime\/fedos_wasm_loader\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* regenerate or commit the JS glue/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* commit `target\/`, `Cargo\.lock`, or `pkg\/`/);
  });

  it("10. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_wasm_rust_export_bindgen_dependency/);
    expect(workerSource).not.toMatch(/runtime_wasm_rust_export_bindgen_dependency/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_wasm_rust_export_bindgen_dependency/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_wasm_rust_export_bindgen_dependency/);
  });

  it("11. diagnostics carry no new field introduced by this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/wasmBindgenDependencyAdopted/i);
    expect(workerDiagnosticsSource).not.toMatch(/wasmBindgenDependencyAdopted/i);
  });

  it("12. cross-references the Stage 977 export readiness review and the version-alignment policy this Phase follows", () => {
    expect(reviewDocSource).toMatch(/runtime_wasm_rust_export_readiness_review\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_bindgen_version_policy\.md/);
    expect(reviewDocSource).toMatch(/rust_dependency_adoption\.md/);
  });
});

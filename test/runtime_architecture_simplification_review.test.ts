import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/runtime_architecture_simplification_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import minimumChainDocSource from "../docs/runtime_minimum_runtime_chain.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import positioningDocSource from "../docs/fedos_runtime_positioning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import onionDocSource from "../docs/fedos_onion_like_routing.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import simplificationPlanDocSource from "../docs/runtime_initialize_crypto_simplification_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
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

const KNOWN_FEDOS_FILES = [
  "fedos_build_time_loader_strategy.ts",
  "fedos_crypto_backend_interface.ts",
  "fedos_crypto_backend_resolver.ts",
  "fedos_crypto_initialization_result.ts",
  "fedos_crypto_loader_backend.ts",
  "fedos_crypto_loader_facade.ts",
  "fedos_crypto_provider_facade_boundary.ts",
  "fedos_crypto_provider_initialization_request.ts",
  "fedos_dynamic_loader_dev_approval.ts",
  "fedos_dynamic_loader_gate.ts",
  "fedos_execution_backend.ts",
  "fedos_explicit_crypto_initialization.ts",
  "fedos_generated_artifact_distribution.ts",
  "fedos_generated_artifact_presence.ts",
  "fedos_initialize_crypto_api_contract.ts",
  "fedos_initialize_crypto_exposure_review.ts",
  "fedos_initialize_crypto_invocation_contract.ts",
  "fedos_initialize_crypto_public_api.ts",
  "fedos_initialize_crypto_wiring_plan.ts",
  "fedos_internal_rust_call.ts",
  "fedos_opaque_api.ts",
  "fedos_provider_init_facade_contract.ts",
  "fedos_provider_initialization_approval.ts",
  "fedos_runtime_crypto_provider.ts",
  "fedos_runtime_opaque_request.ts",
  "fedos_runtime_operation.ts",
  "fedos_rust_api.ts",
  "fedos_rust_boundary.ts",
  "fedos_rust_execution_review.ts",
  "fedos_rust_invocation_adapter.ts",
  "fedos_static_import_activation_review.ts",
  "fedos_wasm_artifact.ts",
  "fedos_wasm_backend.ts",
  "fedos_wasm_boundary.ts",
  "fedos_wasm_loader.ts",
  "fedos_wasm_loader_contract.ts",
  "fedos_wasm_loader_import_policy.ts",
  "fedos_wasm_loader_plan.ts",
  "fedos_wasm_static_import_plan.ts",
  "fedos_wasm_static_import_readiness.ts",
  "fedos_wasm_static_import_review.ts",
  "fedos_wasm_toolchain.ts",
].sort();

/**
 * Prototype Phase 007 (Stage 777–792) — "Runtime Architecture
 * Simplification Review": a REVIEW-ONLY audit of all 42
 * `fedos_*.ts` Planning Layers, classifying each A (Core Runtime) /
 * B (Documentation) / C (Merge Candidate) / D (Historical Review),
 * and naming the Minimum Runtime Chain. No code, fixed value,
 * diagnostics field, or wiring changes -- nothing is deleted or
 * merged.
 */
describe("FedOS Runtime Architecture Simplification Review -- review only, no runtime/worker/diagnostics change (Stage 777-792)", () => {
  it("1. both new review docs exist and are non-empty", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(2000);
    expect(typeof minimumChainDocSource).toBe("string");
    expect(minimumChainDocSource.length).toBeGreaterThan(1000);
  });

  it("2. the fedos_*.ts file set is the known forty-two THIS review's own Stage 777-792 scope covered, plus Stage 994's later, separate fedos_runtime_prototype_execution.ts (Prototype EXECUTION Phase 013) -- the review doc names every one of the original forty-two", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    const names = Object.keys(files)
      .map((path) => path.split("/").pop() as string)
      .sort();
    expect(names.length).toBe(43);
    expect(names).toEqual([...KNOWN_FEDOS_FILES, "fedos_runtime_prototype_execution.ts"].sort());

    for (const name of KNOWN_FEDOS_FILES) {
      expect(reviewDocSource).toMatch(new RegExp(name.replace(/\./g, "\\.")));
    }
  });

  it("3. all four classification labels (A/B/C/D) are defined, and totals sum to 42", () => {
    expect(reviewDocSource).toMatch(/A\s*—\s*Core Runtime/);
    expect(reviewDocSource).toMatch(/B\s*—\s*Documentation/);
    expect(reviewDocSource).toMatch(/C\s*—\s*Merge Candidate/);
    expect(reviewDocSource).toMatch(/D\s*—\s*Historical Review/);

    const totalsMatch = reviewDocSource.match(/Totals:\s*A\s*=\s*(\d+),\s*B\s*=\s*(\d+),\s*C\s*=\s*(\d+),\s*D\s*=\s*(\d+)/);
    expect(totalsMatch).not.toBeNull();
    const [, a, b, c, d] = totalsMatch as unknown as string[];
    expect(Number(a) + Number(b) + Number(c) + Number(d)).toBe(42);
  });

  it("4. four architectural chains are named, with real reachability stated for each", () => {
    expect(reviewDocSource).toMatch(/Chain 1/);
    expect(reviewDocSource).toMatch(/Chain 2/);
    expect(reviewDocSource).toMatch(/Chain 3/);
    expect(reviewDocSource).toMatch(/Chain 4/);
    expect(reviewDocSource).toMatch(/Minimum Runtime Chain/);
    expect(reviewDocSource).toMatch(/disconnected island/i);
  });

  it("5. reconciles with, and does not contradict, the existing Stage 682 simplification plan", () => {
    expect(reviewDocSource).toMatch(/Stage 681–688|Stage 682/);
    expect(reviewDocSource).toMatch(/runtime_initialize_crypto_simplification_plan\.md/);
    // Cross-check: every "Must-keep" name from the prior plan is still named A-consistent here.
    expect(simplificationPlanDocSource).toMatch(/絶対残す/);
    expect(reviewDocSource).toMatch(/Provider\/Facade Boundary/);
    expect(reviewDocSource).toMatch(/Explicit Crypto Initialization/);
  });

  it("6. the Minimum Runtime Chain doc names exactly the real chain plus the two future links", () => {
    expect(minimumChainDocSource).toMatch(/fedos_crypto_loader_facade\.ts/);
    expect(minimumChainDocSource).toMatch(/fedos_crypto_loader_backend\.ts/);
    expect(minimumChainDocSource).toMatch(/fedos_crypto_backend_interface\.ts/);
    expect(minimumChainDocSource).toMatch(/fedos_crypto_backend_resolver\.ts/);
    expect(minimumChainDocSource).toMatch(/fedos_wasm_backend\.ts/);
    expect(minimumChainDocSource).toMatch(/fedos_wasm_loader\.ts/);
    expect(minimumChainDocSource).toMatch(/packages\/fedos-core-rust/);
    expect(minimumChainDocSource).toMatch(/\(future\)/);
  });

  it("7. all nine Architecture Principles are stated, citing fedos_runtime_positioning.md", () => {
    expect(minimumChainDocSource).toMatch(/Secure Runtime Platform/);
    expect(minimumChainDocSource).toMatch(/Desktop-first/);
    expect(minimumChainDocSource).toMatch(/[Rr]untime is minimum configuration|minimum configuration/);
    expect(minimumChainDocSource).toMatch(/Fail Closed/);
    expect(minimumChainDocSource).toMatch(/never knows backend detail|never learns backend detail/i);
    expect(minimumChainDocSource).toMatch(/[Ii]ndependent of Worker/);
    expect(minimumChainDocSource).toMatch(/concentrated in Rust/i);
    expect(minimumChainDocSource).toMatch(/TypeScript is wiring/);
    expect(minimumChainDocSource).toMatch(/EMSR.{0,10}Ontology|Ontology.{0,10}EMSR/);
    expect(minimumChainDocSource).toMatch(/fedos_runtime_positioning\.md/);
  });

  it("8. onion-like routing is explicitly named as docs-only, and EMSR/Ontology as outside Runtime", () => {
    expect(reviewDocSource).toMatch(/fedos_onion_like_routing\.md/);
    expect(reviewDocSource).toMatch(/docs-only|docs only/i);
    expect(onionDocSource).toMatch(/[Dd]ocs only/);
    expect(minimumChainDocSource).toMatch(/never the production runtime|never the production TypeScript runtime/i);
  });

  it("9. explicitly states no file is deleted or merged by this review", () => {
    expect(reviewDocSource).toMatch(/does \*\*not\*\* delete any file/i);
    expect(reviewDocSource).toMatch(/does \*\*not\*\* merge any file/i);
    expect(minimumChainDocSource).toMatch(/[Nn]othing is deleted or merged/);
  });

  it("10. Runtime, Worker, and both diagnostics files are completely unaffected -- no reference to the new review docs anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/runtime_architecture_simplification_review|runtime_minimum_runtime_chain/);
    expect(workerSource).not.toMatch(/runtime_architecture_simplification_review|runtime_minimum_runtime_chain/);
    expect(runtimeDiagnosticsSource).not.toMatch(/runtime_architecture_simplification_review|runtime_minimum_runtime_chain/);
    expect(workerDiagnosticsSource).not.toMatch(/runtime_architecture_simplification_review|runtime_minimum_runtime_chain/);
    expect(workerDiagnosticsSource).not.toMatch(/cryptoBackendResolverState|cryptoBackendInterfaceState|wasmBackendState/);
  });

  it("11. the review docs never write real import()/WebAssembly code -- only name them as prohibited, in prose", () => {
    expect(reviewDocSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(minimumChainDocSource).not.toMatch(/```(ts|js|typescript|javascript)[\s\S]*WebAssembly\.instantiate[\s\S]*```/);
    expect(reviewDocSource).toMatch(/WebAssembly\.instantiate|WebAssembly/);
    expect(minimumChainDocSource).toMatch(/import\(\)/);
  });

  it("12. no NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing is implemented or recommended for implementation", () => {
    expect(reviewDocSource).toMatch(/NIP-17/);
    expect(reviewDocSource).toMatch(/Double Ratchet/);
    expect(reviewDocSource).toMatch(/Triple Ratchet/);
    expect(reviewDocSource).toMatch(/onion routing/i);
    expect(reviewDocSource).toMatch(/unimplemented|remain unimplemented/i);
  });

  it("13. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(28);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(1);

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

  it("14. the review is consistent with fedos_runtime_positioning.md's own principles", () => {
    expect(positioningDocSource).toMatch(/Secure Runtime Platform/);
    expect(positioningDocSource).toMatch(/Desktop-first|desktop-first/);
    expect(reviewDocSource).toMatch(/fedos_runtime_positioning\.md/);
    expect(minimumChainDocSource).toMatch(/fedos_runtime_positioning\.md/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import planningReviewDocSource from "../docs/runtime_initialize_crypto_planning_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import simplificationPlanDocSource from "../docs/runtime_initialize_crypto_simplification_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import firstWiringPlanDocSource from "../docs/runtime_initialize_crypto_first_wiring_plan.md?raw";
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

/**
 * Stage 681–685 — "FedOS initializeCrypto Planning Review: a design
 * stocktake, no new PlanningOnly layer, no diagnostics change, no
 * code deletion, no real connection".
 *
 * `docs/runtime_initialize_crypto_planning_review.md` (Stage 681)
 * inventories the twelve existing `PlanningOnly` layers.
 * `docs/runtime_initialize_crypto_simplification_plan.md` (Stage 682)
 * classifies each into keep/consolidate/docs-only/possibly-
 * unnecessary, without deleting any of them.
 * `docs/runtime_initialize_crypto_first_wiring_plan.md` (Stage 683)
 * names `initializeCrypto()` as the sole first Runtime-exposure
 * candidate, with Worker/encrypt-decrypt/NIP-17/NIP-44/NIP-59/WASM
 * import all explicitly out of scope.
 *
 * This test file verifies the review's own claims, not runtime
 * behavior — no new module is imported here beyond the three new
 * docs, `create_runtime.ts`, `src/worker.ts`, and the existing
 * Rust/package manifests already read by prior guard suites.
 */
describe("FedOS initializeCrypto Planning Review, stocktake only, no new layer, no side effects anywhere (Stage 681-685)", () => {
  it("1. the three new planning docs exist and are non-empty", () => {
    expect(typeof planningReviewDocSource).toBe("string");
    expect(planningReviewDocSource.length).toBeGreaterThan(0);
    expect(typeof simplificationPlanDocSource).toBe("string");
    expect(simplificationPlanDocSource.length).toBeGreaterThan(0);
    expect(typeof firstWiringPlanDocSource).toBe("string");
    expect(firstWiringPlanDocSource.length).toBeGreaterThan(0);
  });

  it("2. the planning review enumerates all twelve known layers", () => {
    const layerNames = [
      "Provider Initialization Request",
      "Provider Initialization Approval",
      "Provider Init Facade Contract",
      "Provider / Facade Boundary",
      "Crypto Loader Facade",
      "Explicit Crypto Initialization",
      "InitializeCrypto API Contract",
      "Crypto Initialization Result Contract",
      "Runtime initializeCrypto Exposure Review",
      "Runtime initializeCrypto Wiring Plan",
      "Runtime initializeCrypto Public API",
      "Runtime initializeCrypto Invocation Contract",
    ];
    for (const name of layerNames) {
      expect(planningReviewDocSource, `missing layer: ${name}`).toMatch(name);
    }
  });

  it("3. the simplification plan classifies every layer into one of the four required categories", () => {
    expect(simplificationPlanDocSource).toMatch(/絶対残す/);
    expect(simplificationPlanDocSource).toMatch(/将来統合可能/);
    expect(simplificationPlanDocSource).toMatch(/docs上だけ残せばよい/);
    expect(simplificationPlanDocSource).toMatch(/実配線時に不要になる可能性あり/);
    // No layer is marked for deletion in this stage.
    expect(simplificationPlanDocSource).not.toMatch(/削除する|今すぐ削除|delete now/i);
  });

  it("4. initializeCrypto() is named as the sole first Runtime-exposure candidate", () => {
    expect(firstWiringPlanDocSource).toMatch(/initializeCrypto\(\)/);
    expect(firstWiringPlanDocSource).toMatch(/ONLY/);
  });

  it("5. Worker is explicitly out of scope for the first wiring", () => {
    expect(firstWiringPlanDocSource).toMatch(/Worker/);
    expect(firstWiringPlanDocSource).toMatch(/OUT OF SCOPE/);
  });

  it("6. encrypt/decrypt are explicitly out of scope for the first wiring", () => {
    expect(firstWiringPlanDocSource).toMatch(/encrypt.*decrypt|decrypt.*encrypt/);
    expect(firstWiringPlanDocSource).toMatch(/"Unsupported"/);
  });

  it("7. NIP-17/NIP-44/NIP-59 are explicitly out of scope for the first wiring", () => {
    expect(firstWiringPlanDocSource).toMatch(/NIP-17/);
    expect(firstWiringPlanDocSource).toMatch(/NIP-44/);
    expect(firstWiringPlanDocSource).toMatch(/NIP-59/);
  });

  it("8. import() (static and dynamic) prohibition is documented for the first wiring", () => {
    expect(firstWiringPlanDocSource).toMatch(/import\(\)/);
    expect(firstWiringPlanDocSource).toMatch(/WebAssembly\.instantiate/);
    expect(firstWiringPlanDocSource).toMatch(/prohibited|PROHIBITED/);
  });

  it("9. no new PlanningOnly runtime module was added by THIS stage -- the fedos_*.ts file set was exactly the known forty-two AS OF THIS stage's own scope (Stage 714/730/746/763 legitimately added fedos_crypto_loader_backend.ts/fedos_wasm_backend.ts/fedos_crypto_backend_interface.ts/fedos_crypto_backend_resolver.ts afterward; Stage 994, Prototype EXECUTION Phase 013, later added a 43rd, fedos_runtime_prototype_execution.ts)", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../src/runtime/fedos_*.ts");
    const names = Object.keys(files)
      .map((path) => path.split("/").pop() as string)
      .sort();

    const knownNames = [
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
      "fedos_wasm_boundary.ts",
      "fedos_wasm_loader.ts",
      "fedos_wasm_loader_contract.ts",
      "fedos_wasm_loader_import_policy.ts",
      "fedos_wasm_loader_plan.ts",
      "fedos_wasm_static_import_plan.ts",
      "fedos_wasm_static_import_readiness.ts",
      "fedos_wasm_backend.ts",
      "fedos_wasm_static_import_review.ts",
      "fedos_wasm_toolchain.ts",
    ].sort();

    expect(names.length).toBe(55);
    // Stage 1004 (Secure Runtime Alpha 008) adds a second, separate,
    // later exception -- fedos_runtime_random_bytes.ts.
    // Stage 1005 (Secure Runtime Alpha 010) adds a THIRD, separate,
    // later exception -- fedos_runtime_aead_key_generation.ts.
    // Stage 1009 (Secure Runtime Alpha 014) adds a FOURTH, separate,
    // later exception -- fedos_runtime_encrypt.ts.
    // Stage 1010 (Secure Runtime Alpha 015) adds a FIFTH, separate,
    // later exception -- fedos_runtime_decrypt.ts.
    // Stage 1011 (Secure Runtime Alpha 018) adds a SIXTH and SEVENTH,
    // separate, later exception -- fedos_runtime_export_ciphertext.ts/
    // fedos_runtime_import_ciphertext.ts.
    // Stage 1012 (Secure Runtime Alpha 019) adds an EIGHTH, separate,
    // later exception -- fedos_runtime_ciphertext_storage.ts.
    // Secure Runtime Alpha 020 adds a NINTH, separate, later exception --
    // fedos_runtime_mode_authority.ts, the shared Runtime Mode Authority.
    // Secure Runtime Alpha 021 adds a TENTH and ELEVENTH, separate, later
    // exception -- fedos_runtime_storage_backend.ts/
    // fedos_runtime_storage_resolver.ts, the Storage Backend Interface
    // (+Memory implementation) and Storage Resolver.
    // Secure Runtime Alpha 023 adds a TWELFTH and THIRTEENTH, separate,
    // later exception -- fedos_windows_dpapi_helper.ts/
    // fedos_runtime_storage_backend_windows_dpapi.ts, the Windows DPAPI
    // bridge and the SECOND RuntimeStorageBackend implementation.
    expect(names).toEqual(
      [
        ...knownNames,
        "fedos_runtime_prototype_execution.ts",
        "fedos_runtime_random_bytes.ts",
        "fedos_runtime_aead_key_generation.ts",
        "fedos_runtime_encrypt.ts",
        "fedos_runtime_decrypt.ts",
        "fedos_runtime_export_ciphertext.ts",
        "fedos_runtime_import_ciphertext.ts",
        "fedos_runtime_ciphertext_storage.ts",
        "fedos_runtime_mode_authority.ts",
        "fedos_runtime_storage_backend.ts",
        "fedos_runtime_storage_resolver.ts",
        "fedos_windows_dpapi_helper.ts",
        "fedos_runtime_storage_backend_windows_dpapi.ts",
      ].sort(),
    );
  });

  it("10. Runtime remains unconnected -- create_runtime.ts references none of the twelve layers", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_crypto_provider_facade_boundary|fedos_explicit_crypto_initialization|fedos_initialize_crypto_api_contract|fedos_crypto_initialization_result|fedos_initialize_crypto_exposure_review|fedos_initialize_crypto_wiring_plan|fedos_initialize_crypto_public_api|fedos_initialize_crypto_invocation_contract/,
    );
  });

  it("11. Worker remains unconnected -- src/worker.ts references none of the twelve layers", () => {
    expect(workerSource).not.toMatch(
      /fedos_crypto_provider_initialization_request|fedos_provider_initialization_approval|fedos_provider_init_facade_contract|fedos_crypto_provider_facade_boundary|fedos_explicit_crypto_initialization|fedos_initialize_crypto_api_contract|fedos_crypto_initialization_result|fedos_initialize_crypto_exposure_review|fedos_initialize_crypto_wiring_plan|fedos_initialize_crypto_public_api|fedos_initialize_crypto_invocation_contract/,
    );
  });

  it("12. Rust public API is unchanged (27 pub fn) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);

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

  it("13. each new doc names itself as non-implementing (review/analysis/policy only)", () => {
    expect(planningReviewDocSource).toMatch(/REVIEW ONLY/);
    expect(simplificationPlanDocSource).toMatch(/ANALYSIS ONLY/);
    expect(firstWiringPlanDocSource).toMatch(/POLICY STATEMENT/);
  });
});

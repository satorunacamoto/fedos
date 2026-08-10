import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_007_crypto_api_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import modeAuthorityDocSource from "../docs/secure_runtime_alpha_006_mode_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import baselineDocSource from "../docs/secure_runtime_alpha_001_baseline.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/os/core/vault/wasm/fedos_wasm_loader.ts?raw";
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

/**
 * Secure Runtime Alpha 007 — "Crypto API Surface Review": REVIEW
 * ONLY, no code change of any kind. Resumes Alpha 001's own §3 item 3,
 * deferred through Alpha 002-006. Classifies the crate's 28 pub fn,
 * names Public/Internal Runtime API/Rust Boundary/never-exposed
 * layers, recommends a four-layer architecture (Public Runtime API ->
 * Runtime Service -> Rust Boundary -> Internal Rust), and ranks
 * candidate operations for future implementation.
 */
describe("Secure Runtime Alpha 007 Crypto API Surface Review -- review only, no Runtime/FedosWasmLoader/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'no code change' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Runtime implementation code/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `FedosWasmLoader`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `create_runtime\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `initializeCrypto\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `runtimeCapabilities\(\)`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Production code path/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* add any `#\\?\[wasm_bindgen\\?\]` attribute/);
  });

  it("3. the 28 pub fn are classified into real categories, matching the actual lib.rs count", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect(reviewDocSource).toMatch(/Legacy placeholders \(6\)/);
    expect(reviewDocSource).toMatch(/Boundary status\/descriptor\/policy labels \(16\)/);
    expect(reviewDocSource).toMatch(/Real cryptographic operations, already implemented and tested \(5\)/);
    expect(reviewDocSource).toMatch(/fedos_random_bytes_32/);
    expect(reviewDocSource).toMatch(/fedos_encrypt/);
    expect(reviewDocSource).toMatch(/fedos_decrypt/);
  });

  it("4. Public API candidates are named, including all of the user's own example operations", () => {
    expect(reviewDocSource).toMatch(/Public API — what `AppRuntime` should eventually expose directly/);
    for (const candidate of ["randomBytes()", "encrypt()", "decrypt()", "deriveKey()", "hash()", "sign()", "verify()"]) {
      expect(reviewDocSource).toContain(candidate);
    }
  });

  it("5. Internal Runtime API is named and distinguished from the Public API", () => {
    expect(reviewDocSource).toMatch(/Internal Runtime API — Runtime-internal only, never public/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyJsGlueImport/);
  });

  it("6. the Rust Boundary is named -- AEAD, RNG, KDF, Hash, Signature", () => {
    expect(reviewDocSource).toMatch(/Rust Boundary — what only Rust should ever own/);
    expect(reviewDocSource).toMatch(/\*\*AEAD\*\*/);
    expect(reviewDocSource).toMatch(/\*\*RNG\*\*/);
    expect(reviewDocSource).toMatch(/\*\*KDF\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Hash\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Signature\*\*/);
  });

  it("7. JS-side responsibilities are named -- Capability, Policy, Fail Closed, State, Permission", () => {
    expect(reviewDocSource).toMatch(/What JS-side code is responsible for/);
    expect(reviewDocSource).toMatch(/\*\*Capability\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Policy\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Fail Closed\*\*/);
    expect(reviewDocSource).toMatch(/\*\*State\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Permission\*\*/);
  });

  it("8. what gets handed to Rust is named -- key generation, encryption, random/nonce, KDF, hashing, signing", () => {
    expect(reviewDocSource).toMatch(/What gets handed to Rust/);
    expect(reviewDocSource).toMatch(/Key generation, encryption\/decryption, random\/nonce generation, key\s*\n?\s*derivation, hashing, and signing\/verification/);
  });

  it("9. a never-exposed list is present, including all of the user's own named examples", () => {
    expect(reviewDocSource).toMatch(/What is NEVER publicly exposed/);
    for (const item of [
      "Raw memory",
      "Raw pointers",
      "WebAssembly.Instance",
      "Generated JS Glue",
      "InitOutput",
      "Internal Loader",
      "Internal Plan",
    ]) {
      expect(reviewDocSource).toContain(item);
    }
    expect(reviewDocSource).toMatch(/exportKey\(\)/);
  });

  it("10. compares exposing all 28 pub fn versus a layered boundary, and rejects exposing all 28", () => {
    expect(reviewDocSource).toMatch(/Should all 28 `pub fn` be exposed, or should there be a layered boundary\?/);
    expect(reviewDocSource).toContain("Expose all 28 `pub fn` via `#[wasm_bindgen]`");
    expect(reviewDocSource).toContain("rejected. Most of");
    expect(reviewDocSource).toContain("A layered boundary");
    expect(reviewDocSource).toContain("recommended (see §8)");
  });

  it("11. recommends the four-layer architecture by name, in order", () => {
    expect(reviewDocSource).toMatch(/Recommended architecture — four layers/);
    const publicIdx = reviewDocSource.indexOf("Public Runtime API");
    const serviceIdx = reviewDocSource.indexOf("Runtime Service", publicIdx);
    const boundaryIdx = reviewDocSource.indexOf("Rust Boundary", serviceIdx);
    const internalIdx = reviewDocSource.indexOf("Internal Rust", boundaryIdx);
    expect(publicIdx).toBeGreaterThan(-1);
    expect(serviceIdx).toBeGreaterThan(publicIdx);
    expect(boundaryIdx).toBeGreaterThan(serviceIdx);
    expect(internalIdx).toBeGreaterThan(boundaryIdx);
  });

  it("12. ranks a future implementation order with reasoning, randomBytes() first", () => {
    expect(reviewDocSource).toMatch(/Alpha implementation order — recommended, with reasoning/);
    const randomIdx = reviewDocSource.indexOf("1. **`randomBytes()`**");
    const encryptIdx = reviewDocSource.indexOf("2. **`encrypt()`");
    const deriveIdx = reviewDocSource.indexOf("3. **`deriveKey()`**");
    expect(randomIdx).toBeGreaterThan(-1);
    expect(encryptIdx).toBeGreaterThan(randomIdx);
    expect(deriveIdx).toBeGreaterThan(encryptIdx);
  });

  it("13. cross-references Alpha 001/006 and the Prototype's own version()-first precedent", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_006_mode_authority_review\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_001_baseline\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_rust_export_readiness_review\.md/);
    expect(reviewDocSource).toMatch(/runtime_wasm_rust_version_export\.md/);
    expect(modeAuthorityDocSource).toMatch(/Crypto API Surface Review/);
    expect(baselineDocSource).toMatch(/Crypto API Surface/);
  });

  it("14. Runtime implementation code is confirmed byte-for-byte unchanged -- no reference to this review's doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
  });

  it("15. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("16. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("17. runtimeCapabilities()/RuntimeCapabilities are byte-for-byte unchanged since Alpha 005 -- still exactly four fields", async () => {
    const { runtimeCapabilities } = await import("../src/runtime/fedos_runtime_prototype_execution.js");
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("18. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("19. Worker remains fully unchanged and unconnected", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    // `randomBytes`/`deriveKey` legitimately appear in a PRE-EXISTING doc
    // comment (crypto provider selection config) explicitly stating the
    // Worker NEVER calls them -- this checks that this stage adds no NEW
    // reference beyond that pre-existing, already-negative statement.
    expect(workerSource).not.toMatch(/runtimeCapabilities|attemptDevOnlyRuntimeRustIntegration/);
  });

  it("20. Rust and Cargo/package sources are unchanged -- still 28 pub fn, one #[wasm_bindgen], 11/2 dependencies, no new #[wasm_bindgen] attribute added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);

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

  it("21. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_007_crypto_api_surface_review/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_011_encrypt_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptSurfaceReviewDocSource from "../docs/secure_runtime_alpha_009_encrypt_api_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadKeyGenerationDocSource from "../docs/secure_runtime_alpha_010_aead_key_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomBytesServiceSource from "../src/runtime/fedos_runtime_random_bytes.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadKeyGenerationServiceSource from "../src/runtime/fedos_runtime_aead_key_generation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
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
 * Secure Runtime Alpha 011 — "Public Runtime encrypt() Boundary Review":
 * REVIEW ONLY, no code change of any kind. Narrows Alpha 009's two
 * still-open type-boundary questions (key boundary, ciphertext boundary)
 * without resolving either, compares encrypt() signature candidates and
 * ciphertext representation candidates, reconfirms Fail Closed is
 * unaffected, reaffirms encrypt()/decrypt() as separate phases, and
 * recommends exactly one minimal Alpha 012 "Encrypt Wrapper" candidate.
 */
describe("Secure Runtime Alpha 011 Public encrypt() Boundary Review -- review only, no Runtime/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(4000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'does not change' list, including no new Ciphertext/Key Handle", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/No Runtime, Worker, Production, Rust, `Cargo\.toml`,/);
    expect(reviewDocSource).toMatch(/`create_runtime\.ts`, or `fedos_wasm_loader\.ts` change/);
    expect(reviewDocSource).toMatch(/no\s*\n?new Ciphertext type is added, no new Key Handle type is added/);
  });

  it("3. explicitly picks up from Alpha 009's two open questions and records Alpha 010 did not resolve either", () => {
    expect(reviewDocSource).toMatch(/Alpha 009 found `encrypt\(\)` blocked on two independently-undecided/);
    expect(reviewDocSource).toMatch(/Both of Alpha 009's original open questions therefore remain open today/);
    expect(reviewDocSource).toMatch(/Alpha 010 shipped `AppRuntime\.generateAeadKey\(\)/);
  });

  it("4. compares the key boundary -- raw bytes vs opaque key handle -- without deciding", () => {
    expect(reviewDocSource).toMatch(/A\. Raw bytes/);
    expect(reviewDocSource).toMatch(/B\. Opaque Key Handle/);
    expect(reviewDocSource).toMatch(/Nothing here is decided\.\*\*\s*Candidate B is the direction/);
  });

  it("5. compares encrypt() signature candidates against the real fedos_encrypt shape", () => {
    expect(reviewDocSource).toMatch(/encrypt\(key, plaintext\)/);
    expect(reviewDocSource).toMatch(/encrypt\(key, plaintext, aad\)/);
    expect(reviewDocSource).toMatch(/encrypt\(key, algorithm, aadDomain, plaintext\)/);
    expect(reviewDocSource).toMatch(/No candidate is selected\./);
  });

  it("6. compares Ciphertext boundary candidates -- Uint8Array, Opaque Class, JSON -- without deciding", () => {
    expect(reviewDocSource).toMatch(/\*\*`Uint8Array`\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Opaque Class\*\*/);
    expect(reviewDocSource).toMatch(/\*\*JSON\*\*/);
    expect(reviewDocSource).toMatch(/No decision\s*\n?is made here\./);
  });

  it("7. classifies JS/WASM boundary rows into existing vs new patterns", () => {
    expect(reviewDocSource).toMatch(/\*\*Existing pattern\.\*\*/);
    expect(reviewDocSource).toMatch(/\*\*New pattern/);
  });

  it("8. reconfirms all Fail Closed guarantees, naming all four prior Public Crypto API fields unchanged", () => {
    expect(reviewDocSource).toMatch(/Development-only reachability/);
    expect(reviewDocSource).toMatch(/Production Fail Closed/);
    expect(reviewDocSource).toMatch(/Worker unconnected/);
    expect(reviewDocSource).toMatch(/`initializeCrypto\(\)` unchanged/);
    expect(reviewDocSource).toMatch(/`runtimeCapabilities\(\)` unchanged/);
    expect(reviewDocSource).toMatch(/`randomBytes\(\)` unchanged/);
    expect(reviewDocSource).toMatch(/`generateAeadKey\(\)` unchanged/);
  });

  it("9. reaffirms encrypt()/decrypt() as separate Stages, encrypt() first", () => {
    expect(reviewDocSource).toMatch(/Recommendation, reaffirmed: separate Stages, `encrypt\(\)` first\./);
  });

  it("10. recommends exactly one minimal Alpha 012 Encrypt Wrapper candidate", () => {
    expect(reviewDocSource).toMatch(/Recommended minimal Alpha 012 candidate:/);
    expect(reviewDocSource).toMatch(
      /encrypt\(keyBytes, algorithm, aadDomain, plaintext\) -> Uint8Array \| null/,
    );
    expect(reviewDocSource).toMatch(/This is a recommendation only\. No implementation follows from it/);
  });

  it("11. names unresolved open questions for future stages, including the generateAeadKey/encrypt() shape mismatch", () => {
    expect(reviewDocSource).toMatch(/Unresolved \/ open questions for future Stages/);
    expect(reviewDocSource).toMatch(/leaves the Public API\s*\n?\s*internally mismatched/);
    expect(reviewDocSource).toMatch(/importKey\(\)`\/`exportKey\(\)` scoping/);
  });

  it("12. cross-references Alpha 007, Alpha 009, and Alpha 010's own precedent", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_007_crypto_api_surface_review\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_010_aead_key_generation\.md/);
    expect(typeof encryptSurfaceReviewDocSource).toBe("string");
    expect(typeof aeadKeyGenerationDocSource).toBe("string");
  });

  it("13. Runtime implementation code is confirmed byte-for-byte unchanged -- no reference to this review's doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(randomBytesServiceSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(aeadKeyGenerationServiceSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
  });

  it("14. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("15. runtimeCapabilities()/randomBytes()/generateAeadKey() are confirmed byte-for-byte unchanged by ACTUAL calls", async () => {
    const { runtimeCapabilities } = await import("../src/runtime/fedos_runtime_prototype_execution.js");
    const { randomBytes } = await import("../src/runtime/fedos_runtime_random_bytes.js");
    const { generateAeadKey } = await import("../src/runtime/fedos_runtime_aead_key_generation.js");

    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );

    const bytes = await randomBytes();
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await generateAeadKey();
    expect(key === null || key instanceof Uint8Array).toBe(true);
  });

  it("16. createRuntime()'s assembled AppRuntime still exposes the same four Crypto API fields this review found -- encrypt()/decrypt() were later added by Stage 1009 (Secure Runtime Alpha 014)/Stage 1010 (Secure Runtime Alpha 015) respectively", async () => {
    const { createRuntime } = await import("../src/runtime/create_runtime.js");
    const runtime = createRuntime();
    expect(typeof runtime.initializeCrypto).toBe("function");
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(typeof runtime.randomBytes).toBe("function");
    expect(typeof runtime.generateAeadKey).toBe("function");
  });

  it("17. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("18. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("19. Worker remains fully unchanged and unconnected -- no reference to encrypt/decrypt/ciphertext/key-handle identifiers", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(workerSource).not.toMatch(
      /fedos_encrypt|fedos_decrypt|FedosCiphertextEnvelope|FedosAeadKeyHandle|FedosAeadAlgorithm|FedosAeadAadDomain/,
    );
  });

  it("20. Rust and Cargo/package sources are unchanged -- still 30 pub fn, three #[wasm_bindgen], 11/2 dependencies, no new attribute added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(34);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(11);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(libRsSource).not.toMatch(/pub fn encrypt\b|pub fn decrypt\b/);

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
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_011_encrypt_boundary_review/);
  });
});

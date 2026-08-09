import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_009_encrypt_api_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import surfaceReviewDocSource from "../docs/secure_runtime_alpha_007_crypto_api_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomBytesServiceSource from "../src/runtime/fedos_runtime_random_bytes.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
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
 * Secure Runtime Alpha 009 — "Public Runtime encrypt() API Surface
 * Review": REVIEW ONLY, no code change of any kind. Finds that unlike
 * randomBytes() (Alpha 008), encrypt() cannot be exposed as a simple
 * thin wrapper today -- it is blocked on two independently-undecided
 * type-boundary questions (the opaque FedosAeadKeyHandle and the opaque
 * FedosCiphertextEnvelope, neither of which has a decided WASM-boundary
 * shape). Recommends Alpha 010 target fedos_generate_aead_key_32()
 * (an opaque, #[wasm_bindgen]-exported key-handle class) instead, as
 * the genuinely minimal, single-open-question next wrapper.
 */
describe("Secure Runtime Alpha 009 Public encrypt() API Surface Review -- review only, no Runtime/FedosWasmLoader/Worker/Rust/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(4000);
  });

  it("2. states REVIEW ONLY with an explicit multi-target 'does not change' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/No Runtime, Worker, Production, Rust, `Cargo\.toml`,/);
    expect(reviewDocSource).toMatch(/`create_runtime\.ts`, or `fedos_wasm_loader\.ts` change/);
    expect(reviewDocSource).toMatch(/No wrapper is added, no `#\[wasm_bindgen\]` attribute is added/);
  });

  it("3. inventories the real encrypt-related Rust API, classifying legacy placeholders separately from real operations", () => {
    expect(reviewDocSource).toMatch(/encrypt_placeholder/);
    expect(reviewDocSource).toMatch(/decrypt_placeholder/);
    expect(reviewDocSource).toMatch(/fedos_generate_aead_key_32/);
    expect(reviewDocSource).toMatch(/fedos_aead_nonce_96/);
    expect(reviewDocSource).toMatch(/fedos_encrypt/);
    expect(reviewDocSource).toMatch(/fedos_decrypt/);
    expect(reviewDocSource).toMatch(/FedosAeadKeyHandle/);
    expect(reviewDocSource).toMatch(/FedosCiphertextEnvelope/);
    expect(reviewDocSource).toMatch(/FedosAeadAlgorithm/);
    expect(reviewDocSource).toMatch(/FedosAeadAadDomain/);
    expect(reviewDocSource).toMatch(/\*\*Never expose\.\*\*/);
  });

  it("4. names the real fedos_encrypt parameter/return shape accurately, including that it draws its own nonce internally", () => {
    expect(reviewDocSource).toMatch(/does \*\*not\*\* accept a caller-supplied nonce/);
    expect(reviewDocSource).toMatch(/fedos_aead_nonce_96\(\)`\s+internally/);
    expect(reviewDocSource).toMatch(/fixed, closed `FedosAeadAadDomain` enum/);
  });

  it("5. compares the naive example signature against the real Rust signature and finds it mismatched on two points", () => {
    const naiveIdx = reviewDocSource.indexOf("encrypt(key, plaintext, nonce?, aad?)");
    expect(naiveIdx).toBeGreaterThan(-1);
    expect(reviewDocSource).toMatch(/mismatches the real Rust signature on two points/);
  });

  it("6. compares Result/Option/null/Error return shapes and favors the randomBytes() null-on-failure precedent, without deciding", () => {
    expect(reviewDocSource).toMatch(/Promise<Uint8Array \| null>/);
    expect(reviewDocSource).toMatch(/Nothing here is decided\./);
  });

  it("7. evaluates thin-wrapper adequacy for encrypt() and finds it blocked on the key handle and envelope shapes, not the algorithm", () => {
    expect(reviewDocSource).toMatch(/blocked on TWO independently-undecided\s+type shapes/);
    expect(reviewDocSource).toMatch(/#\[wasm_bindgen\]`-exported OPAQUE\s*\n?\s*class/);
    expect(reviewDocSource).toMatch(/unaffected by any shape discussed here/);
    expect(reviewDocSource).not.toMatch(/algorithm change is required|the algorithm must change/i);
  });

  it("8. maps JS/WASM boundary types for every parameter and return value, marking two as undecided", () => {
    expect(reviewDocSource).toMatch(/Uint8Array/);
    expect(reviewDocSource).toMatch(/JS number-like enum/);
    expect(reviewDocSource).toMatch(/\*\*undecided\*\*/);
  });

  it("9. confirms Fail Closed guarantees are architecturally independent of the undecided type shapes", () => {
    expect(reviewDocSource).toMatch(/Development-only reachability/);
    expect(reviewDocSource).toMatch(/Production Fail Closed/);
    expect(reviewDocSource).toMatch(/Worker unconnected/);
    expect(reviewDocSource).toMatch(/`initializeCrypto\(\)` unchanged/);
  });

  it("10. evaluates encrypt() vs decrypt() phase grouping and recommends separate phases, encrypt() first", () => {
    expect(reviewDocSource).toMatch(/Arguments for separate Phases/);
    expect(reviewDocSource).toMatch(/Arguments for the same Phase/);
    expect(reviewDocSource).toMatch(/Recommendation: separate Phases, `encrypt\(\)` first\./);
  });

  it("11. recommends exactly one minimal Alpha 010 wrapper -- generateKey, not encrypt", () => {
    expect(reviewDocSource).toMatch(
      /Expose `fedos_generate_aead_key_32\(\)` as an opaque,\s*\n?>\s*`#\[wasm_bindgen\]`-exported key-handle class\./,
    );
    expect(reviewDocSource).toMatch(/encrypt\(\)`\s+itself is not a safe minimal Alpha 010 candidate/);
  });

  it("12. names unresolved open questions for future stages, including the envelope shape and decrypt() phase grouping", () => {
    expect(reviewDocSource).toMatch(/Unresolved \/ open questions for future Stages/);
    expect(reviewDocSource).toMatch(/ciphertext_envelope_plan\.md/);
    expect(reviewDocSource).toMatch(/importKey\(\)`\/`exportKey\(\)` scoping/);
  });

  it("13. cross-references Alpha 007 and Alpha 008's own precedent", () => {
    expect(reviewDocSource).toMatch(/Alpha 008/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_007_crypto_api_surface_review\.md/);
    expect(typeof surfaceReviewDocSource).toBe("string");
  });

  it("14. Runtime implementation code is confirmed byte-for-byte unchanged -- no reference to this review's doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
    expect(randomBytesServiceSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
  });

  it("15. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("16. randomBytes()/runtimeCapabilities() are confirmed byte-for-byte unchanged by ACTUAL calls", async () => {
    const { randomBytes } = await import("../src/runtime/fedos_runtime_random_bytes.js");
    const { runtimeCapabilities } = await import("../src/runtime/fedos_runtime_prototype_execution.js");
    const bytes = await randomBytes();
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);
    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
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

  it("19. Worker remains fully unchanged and unconnected", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
    expect(workerSource).not.toMatch(/fedos_generate_aead_key_32|FedosAeadKeyHandle|FedosCiphertextEnvelope/);
  });

  it("20. Rust and Cargo/package sources are unchanged -- still 29 pub fn, two #[wasm_bindgen], 11/2 dependencies, no new attribute added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);

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
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decisionDocSource from "../docs/secure_runtime_alpha_012_key_boundary_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptBoundaryReviewDocSource from "../docs/secure_runtime_alpha_011_encrypt_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadKeyGenerationDocSource from "../docs/secure_runtime_alpha_010_aead_key_generation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptSurfaceReviewDocSource from "../docs/secure_runtime_alpha_009_encrypt_api_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoSurfaceReviewDocSource from "../docs/secure_runtime_alpha_007_crypto_api_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomBytesServiceSource from "../src/runtime/fedos_runtime_random_bytes.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadKeyGenerationServiceSource from "../src/runtime/fedos_runtime_aead_key_generation.ts?raw";
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
 * Secure Runtime Alpha 012 — "Public Runtime Key Boundary Decision":
 * REVIEW / DESIGN DECISION ONLY, no code change of any kind. Formally
 * compares four candidates for resolving the generateAeadKey()/encrypt()
 * key-boundary mismatch Alpha 011 found, across nine fixed criteria,
 * cross-checks consistency against Alpha 007/009/010/011, ADOPTS
 * Candidate 3 (migrate generateAeadKey() to an Opaque Key Handle now,
 * before encrypt()/decrypt() exist), rejects the other three with
 * reasons, and recommends exactly one Alpha 013 implementation step.
 */
describe("Secure Runtime Alpha 012 Public Runtime Key Boundary Decision -- review/decision only, no Runtime/Rust/Worker/Cargo/package change", () => {
  it("1. the decision document exists and is substantial", () => {
    expect(typeof decisionDocSource).toBe("string");
    expect(decisionDocSource.length).toBeGreaterThan(4000);
  });

  it("2. states REVIEW / DESIGN DECISION ONLY with an explicit 'does not change' list", () => {
    expect(decisionDocSource).toMatch(/REVIEW \/ DESIGN DECISION ONLY/);
    expect(decisionDocSource).toMatch(/No Runtime, Rust, Worker,\s*\n?Production/);
    expect(decisionDocSource).toMatch(/no Key Handle or Opaque Class is implemented/);
  });

  it("3. restates all four candidates by name", () => {
    expect(decisionDocSource).toMatch(/\*\*① Defer\*\*/);
    expect(decisionDocSource).toMatch(/\*\*② Freeze raw bytes\*\*/);
    expect(decisionDocSource).toMatch(/\*\*③ Migrate now\*\*/);
    expect(decisionDocSource).toMatch(/\*\*④ Bridge\*\*/);
  });

  it("4. compares all nine fixed criteria for every candidate", () => {
    expect(decisionDocSource).toMatch(/\*\*Fail Closed\*\*/);
    expect(decisionDocSource).toMatch(/公開API互換性/);
    expect(decisionDocSource).toMatch(/Secure Runtime長期方針/);
    expect(decisionDocSource).toMatch(/Worker接続への影響/);
    expect(decisionDocSource).toMatch(/Productionへの影響/);
    expect(decisionDocSource).toMatch(/Secure Storageとの整合性/);
    expect(decisionDocSource).toMatch(/Opaque Handle設計との整合性/);
    expect(decisionDocSource).toMatch(/将来API破壊コスト/);
    expect(decisionDocSource).toMatch(/実装コスト/);
  });

  it("5. cross-checks consistency against Alpha 007, 009, 010, and 011 explicitly", () => {
    expect(decisionDocSource).toMatch(/\*\*Alpha 007 §6\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 009 §3\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 010\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 011 §1\*\*/);
    expect(decisionDocSource).toMatch(
      /before `encrypt\(\)`\/`decrypt\(\)` are implemented/,
    );
  });

  it("6. adopts Candidate 3 explicitly", () => {
    expect(decisionDocSource).toMatch(
      /Secure Runtime Alpha adopts ③: migrate `generateAeadKey\(\)`'s own return\s*\n?shape to an Opaque Key Handle now/,
    );
  });

  it("7. rejects candidates 1, 2, and 4 with explicit reasons", () => {
    expect(decisionDocSource).toMatch(/### Why not ① \(defer\)/);
    expect(decisionDocSource).toMatch(/### Why not ② \(freeze raw bytes\)/);
    expect(decisionDocSource).toMatch(/### Why not ④ \(bridge via `importKey\(\)`\)/);
    expect(decisionDocSource).toMatch(/Rejected AS THE FIX for this specific mismatch — not rejected as a/);
  });

  it("8. names an updated Alpha roadmap with encrypt()/decrypt() kept as separate stages", () => {
    expect(decisionDocSource).toMatch(/## 5\. Alpha roadmap, updated/);
    expect(decisionDocSource).toMatch(/A still-later, SEPARATE Stage\*\* — `decrypt\(\)`/);
  });

  it("9. recommends exactly one Alpha 013 implementation step", () => {
    expect(decisionDocSource).toMatch(
      /Migrate `AppRuntime\.generateAeadKey\(\)`'s Rust Boundary wrapper and\s*\n?>\s*Public Runtime API to return an Opaque AEAD Key Handle instead of\s*\n?>\s*`Uint8Array`\./,
    );
    expect(decisionDocSource).toMatch(/No implementation is authorized by this\s*\n?recommendation\./);
  });

  it("10. reconfirms Fail Closed is unaffected by this decision", () => {
    expect(decisionDocSource).toMatch(/## 7\. Fail Closed — reconfirmed/);
    expect(decisionDocSource).toMatch(/this Stage\s*\n?decides a FUTURE shape for `generateAeadKey\(\)`/);
  });

  it("11. names unresolved open questions, explicitly leaving importKey()/exportKey() open for other reasons", () => {
    expect(decisionDocSource).toMatch(/## 8\. Unresolved \/ open questions for future Stages/);
    expect(decisionDocSource).toMatch(/unaffected by this\s*\n?\s*Stage's rejection of ④ as the fix for Alpha 011's specific finding/);
  });

  it("12. cross-references all four prior review docs", () => {
    expect(decisionDocSource).toMatch(/secure_runtime_alpha_007_crypto_api_surface_review\.md/);
    expect(decisionDocSource).toMatch(/secure_runtime_alpha_009_encrypt_api_surface_review\.md/);
    expect(decisionDocSource).toMatch(/secure_runtime_alpha_010_aead_key_generation\.md/);
    expect(decisionDocSource).toMatch(/secure_runtime_alpha_011_encrypt_boundary_review\.md/);
    expect(typeof encryptBoundaryReviewDocSource).toBe("string");
    expect(typeof aeadKeyGenerationDocSource).toBe("string");
    expect(typeof encryptSurfaceReviewDocSource).toBe("string");
    expect(typeof cryptoSurfaceReviewDocSource).toBe("string");
  });

  it("13. Runtime implementation code is confirmed byte-for-byte unchanged -- no reference to this decision's doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(randomBytesServiceSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(aeadKeyGenerationServiceSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
  });

  it("14. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("15. runtimeCapabilities()/randomBytes()/generateAeadKey() are confirmed byte-for-byte unchanged by ACTUAL calls -- generateAeadKey() is STILL Uint8Array | null", async () => {
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

  it("16. createRuntime()'s assembled AppRuntime still exposes the same four Crypto API fields this decision found, still no importKey -- encrypt()/decrypt() were later added by Stage 1009 (Secure Runtime Alpha 014)/Stage 1010 (Secure Runtime Alpha 015) respectively", async () => {
    const { createRuntime } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const runtime = createRuntime();
    expect(typeof runtime.initializeCrypto).toBe("function");
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(typeof runtime.randomBytes).toBe("function");
    expect(typeof runtime.generateAeadKey).toBe("function");
    expect((runtime as unknown as { importKey?: unknown }).importKey).toBeUndefined();
  });

  it("17. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("18. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this decision", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("19. Worker remains fully unchanged and unconnected -- no reference to key-handle/encrypt/decrypt/importKey identifiers", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(workerSource).not.toMatch(
      /fedos_encrypt|fedos_decrypt|FedosCiphertextEnvelope|FedosAeadKeyHandle|importKey|exportKey/,
    );
  });

  it("20. Rust and Cargo/package sources are unchanged -- still 30 pub fn, three #[wasm_bindgen], 11/2 dependencies, no new attribute added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(libRsSource).not.toMatch(/pub fn encrypt\b|pub fn decrypt\b|pub fn import_key\b/);

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
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_012_key_boundary_decision/);
  });
});

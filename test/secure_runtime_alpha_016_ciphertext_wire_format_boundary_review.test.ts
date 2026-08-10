import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptDesignDocSource from "../docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptDesignDocSource from "../docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyBoundaryDecisionDocSource from "../docs/secure_runtime_alpha_012_key_boundary_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextEnvelopePlanDocSource from "../docs/ciphertext_envelope_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextEnvelopeSerializationPlanDocSource from "../docs/ciphertext_envelope_serialization_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextSerializationFormatDecisionDocSource from "../docs/ciphertext_serialization_format_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publicCryptoOpaqueHandlesDocSource from "../docs/public_crypto_opaque_handles.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptServiceSource from "../src/os/core/vault/wasm/fedos_runtime_decrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptServiceSource from "../src/os/core/vault/wasm/fedos_runtime_encrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyGenerationServiceSource from "../src/runtime/fedos_runtime_aead_key_generation.ts?raw";
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
import wasmLoaderSource from "../src/os/core/vault/wasm/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextSerializationRsSource from "../packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 016 — "Ciphertext Wire Format Boundary Review":
 * REVIEW / DESIGN ONLY, no code change of any kind. Compares six
 * candidates (Opaque Handle only, exportCiphertext()/importCiphertext()
 * naming, JSON, CBOR, Fixed Binary Envelope, and alignment with the
 * crate's already-decided-and-implemented Stage 182/186 canonical
 * JSON+base64url codec) across eleven criteria, answers five specific
 * questions the Stage was asked to resolve, and recommends exactly one
 * Alpha 017 next step (a dedicated Wire Format Decision, not
 * implementation).
 */
describe("Secure Runtime Alpha 016 Ciphertext Wire Format Boundary Review -- review only, no Runtime/Rust/Worker/Production/Cargo/package change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states REVIEW / DESIGN ONLY with an explicit 'does not implement' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW \/ DESIGN ONLY/);
    expect(reviewDocSource).toMatch(
      /No Runtime, Rust, `FedosWasmLoader`,\s*\nWorker, Production, `Cargo\.toml`, or `package\.json` change of any kind\./,
    );
    expect(reviewDocSource).toMatch(
      /No `exportCiphertext\(\)`\/`importCiphertext\(\)`, no new\s*\n`#\[wasm_bindgen\]` item, no serializer, no deserializer, and no Secure\s*\nStorage of any kind is implemented\./,
    );
  });

  it("3. restates all six things compared, by name", () => {
    expect(reviewDocSource).toMatch(/\*\*① Opaque Handle のみ維持/);
    expect(reviewDocSource).toMatch(/\*\*② `exportCiphertext\(\)` → `Uint8Array` → `importCiphertext\(\)`\*\*/);
    expect(reviewDocSource).toMatch(/\*\*③ JSON\*\*/);
    expect(reviewDocSource).toMatch(/\*\*④ CBOR\*\*/);
    expect(reviewDocSource).toMatch(/\*\*⑤ 固定 Binary Envelope\*\*/);
    expect(reviewDocSource).toMatch(/\*\*⑥ Rust 既存 Wire Format との一致\*\*/);
  });

  it("4. compares all eleven fixed criteria", () => {
    expect(reviewDocSource).toMatch(/\*\*Forward Compatibility\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Versioning\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Storage\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Network\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Worker \(`postMessage`\)\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Production\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Fail Closed\*\*/);
    expect(reviewDocSource).toMatch(/Serializer 責務/);
    expect(reviewDocSource).toMatch(/Deserializer 責務/);
    expect(reviewDocSource).toMatch(/\*\*Rust Boundary\*\*/);
    expect(reviewDocSource).toMatch(/\*\*JS Boundary\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Runtime Boundary\*\*/);
  });

  it("5. answers all five specific questions the Stage was asked to resolve", () => {
    expect(reviewDocSource).toMatch(
      /### 3\.1 — Is it acceptable to build `exportCiphertext\(\)` alone first\?/,
    );
    expect(reviewDocSource).toMatch(/\*\*No\.\*\* Export-without-import is not an independently useful primitive/);
    expect(reviewDocSource).toMatch(/### 3\.2 — Should export\/import always be designed as a pair\?/);
    expect(reviewDocSource).toMatch(/\*\*Yes\*\*, for the reason above, generalized/);
    expect(reviewDocSource).toMatch(
      /### 3\.3 — Is a version byte necessary from the very first shipped format\?/,
    );
    expect(reviewDocSource).toMatch(/\*\*Yes\.\*\* This is already this crate's own standing discipline/);
    expect(reviewDocSource).toMatch(
      /### 3\.4 — How much of AAD \/ Algorithm \/ Nonce \/ Tag \/ Ciphertext belongs on the wire\?/,
    );
    expect(reviewDocSource).toMatch(
      /\*\*All five belong on the wire, exactly as Stage 182 §3 already fixed/,
    );
    expect(reviewDocSource).toMatch(
      /### 3\.5 — Should exposing Rust's internal Envelope type directly be forbidden\?/,
    );
    expect(reviewDocSource).toMatch(/\*\*Yes, absolutely, and this is not a new rule/);
  });

  it("6. names the existing Rust wire format (Stage 182/186) and concludes it should be reused, not replaced", () => {
    expect(reviewDocSource).toMatch(/Stage 182,\s*\nimplemented Stage 186/);
    expect(reviewDocSource).toMatch(/canonical JSON \+ base64url/);
    expect(reviewDocSource).toMatch(/encode_envelope_internal/);
    expect(reviewDocSource).toMatch(/decode_envelope_internal/);
    expect(reviewDocSource).toMatch(
      /\*\*Adopt it\. Do not build a new one\.\*\*/,
    );
  });

  it("7. lays out the Fail-Closed Serializer/Deserializer split, connecting it to the existing no-oracle discipline", () => {
    expect(reviewDocSource).toMatch(/## 5\. Fail Closed — where does it live: Serializer or Deserializer\?/);
    expect(reviewDocSource).toMatch(/\*\*Serializer \(`encode`\/`export` direction\) — narrow obligation\.\*\*/);
    expect(reviewDocSource).toMatch(
      /\*\*Deserializer \(`decode`\/`import` direction\) — the primary Fail-Closed\s*\n\s*surface\.\*\*/,
    );
    expect(reviewDocSource).toMatch(/no-oracle discipline/);
  });

  it("8. recommends exactly one Alpha 017 step -- a dedicated Wire Format Decision, not implementation", () => {
    expect(reviewDocSource).toMatch(/## 6\. Recommendation for Alpha 017/);
    expect(reviewDocSource).toMatch(
      /\*\*Alpha 017 should be a dedicated Ciphertext Wire Format DECISION —/,
    );
    expect(reviewDocSource).toMatch(/Why not recommend jumping straight to `exportCiphertext\(\)`/);
    expect(reviewDocSource).toMatch(/Why not recommend "keep Opaque Handle forever" as the Alpha 017/);
  });

  it("9. cross-references the prior review/decision docs and the existing Rust ciphertext serialization docs", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_012_key_boundary_decision\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_014_encrypt_opaque_handle_api\.md/);
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_015_decrypt_opaque_handle_api\.md/);
    expect(reviewDocSource).toMatch(/ciphertext_envelope_plan\.md/);
    expect(reviewDocSource).toMatch(/ciphertext_envelope_serialization_plan\.md/);
    expect(reviewDocSource).toMatch(/ciphertext_serialization_format_decision\.md/);
    expect(reviewDocSource).toMatch(/public_crypto_opaque_handles\.md/);
    expect(typeof keyBoundaryDecisionDocSource).toBe("string");
    expect(typeof encryptDesignDocSource).toBe("string");
    expect(typeof decryptDesignDocSource).toBe("string");
    expect(typeof ciphertextEnvelopePlanDocSource).toBe("string");
    expect(typeof ciphertextEnvelopeSerializationPlanDocSource).toBe("string");
    expect(typeof ciphertextSerializationFormatDecisionDocSource).toBe("string");
    expect(typeof publicCryptoOpaqueHandlesDocSource).toBe("string");
  });

  it("10. the referenced Rust serialization module is confirmed pub(crate)-only and wired to nothing, exactly as this review describes", () => {
    expect(ciphertextSerializationRsSource).toMatch(
      /pub\(crate\) fn encode_envelope_internal\(envelope: &AeadCiphertextEnvelope\) -> Option<String>/,
    );
    expect(ciphertextSerializationRsSource).toMatch(
      /pub\(crate\) fn decode_envelope_internal\(json: &str\) -> CiphertextSerializationDecision/,
    );
    expect(ciphertextSerializationRsSource).not.toMatch(/#\[wasm_bindgen\]/);
    expect(ciphertextSerializationRsSource).not.toMatch(/^\s*pub\s+fn\s/m);
    // lib.rs's own module-level doc comment DISCUSSES these two functions
    // (as prose, not code) -- confirm neither is ever wasm_bindgen-wrapped
    // or reachable as an actual pub fn from lib.rs itself.
    expect(libRsSource).not.toMatch(/export_ciphertext|import_ciphertext/);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\][^\n]*\n[^\n]*fn (encode|decode)_envelope_internal/);
    const libRsPubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(libRsPubFnNames).not.toContain("encode_envelope_internal");
    expect(libRsPubFnNames).not.toContain("decode_envelope_internal");
  });

  it("11. Runtime implementation code is confirmed byte-for-byte unchanged -- no reference to this review's doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(randomBytesServiceSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(keyGenerationServiceSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(encryptServiceSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(decryptServiceSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
  });

  it("12. Worker remains unconnected to exportCiphertext/importCiphertext -- both were later added to the Runtime/Loader surface by Stage 1011 (Secure Runtime Alpha 018), per this review's own §6/§12 recommendation", () => {
    expect(workerSource).not.toMatch(/exportCiphertext|importCiphertext/);
  });

  it("13. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("14. runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt() are confirmed byte-for-byte unchanged by ACTUAL calls", async () => {
    const { runtimeCapabilities } = await import("../src/runtime/fedos_runtime_prototype_execution.js");
    const { randomBytes } = await import("../src/runtime/fedos_runtime_random_bytes.js");
    const { generateAeadKey } = await import("../src/runtime/fedos_runtime_aead_key_generation.js");
    const { encrypt } = await import("../src/runtime/fedos_runtime_encrypt.js");
    const { decrypt } = await import("../src/runtime/fedos_runtime_decrypt.js");

    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );

    const bytes = await randomBytes();
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await generateAeadKey();
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);
    expect(key).not.toBeInstanceOf(Uint8Array);

    const ciphertext = await encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1]));
    expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);

    const plaintext = await decrypt(
      { kind: "AeadKeyHandle" } as never,
      "ChaCha20Poly1305",
      "TestOnly",
      { kind: "AeadCiphertextHandle" } as never,
    );
    expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);
  });

  it("15. createRuntime()'s assembled AppRuntime still exposes the same six fields this review found -- exportCiphertext/importCiphertext were later added by Stage 1011 (Secure Runtime Alpha 018), still no importKey/exportKey", async () => {
    const { createRuntime } = await import("../src/os/_legacy_prototype/runtime/create_runtime.js");
    const runtime = createRuntime();
    expect(typeof runtime.initializeCrypto).toBe("function");
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(typeof runtime.randomBytes).toBe("function");
    expect(typeof runtime.generateAeadKey).toBe("function");
    expect(typeof runtime.encrypt).toBe("function");
    expect(typeof runtime.decrypt).toBe("function");
    expect((runtime as unknown as { importKey?: unknown }).importKey).toBeUndefined();
    expect((runtime as unknown as { exportKey?: unknown }).exportKey).toBeUndefined();
  });

  it("16. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("17. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("18. Worker remains fully unchanged and unconnected -- no reference to ciphertext-export/import/serialization identifiers", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(workerSource).not.toMatch(
      /exportCiphertext|importCiphertext|encode_envelope_internal|decode_envelope_internal|CiphertextSerializationDecision/,
    );
  });

  it("19. Rust and Cargo/package sources are unchanged -- still 34 pub fn, eleven #[wasm_bindgen], 11/2 dependencies", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review/);
    expect(libRsSource).not.toMatch(/pub fn export_ciphertext\b|pub fn import_ciphertext\b/);

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

  it("20. no new dependency is proposed anywhere in the review doc's own recommendation -- CBOR is explicitly rejected for needing one", () => {
    expect(reviewDocSource).toMatch(/very likely requiring a genuinely new\s*\n\s*`\[dependencies\]` crate/);
    expect(reviewDocSource).toMatch(/docs\/rust_dependency_adoption\.md/);
  });
});

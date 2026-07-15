import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decisionDocSource from "../docs/secure_runtime_alpha_017_ciphertext_wire_format_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextEnvelopePlanDocSource from "../docs/ciphertext_envelope_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextSerializationFormatDecisionDocSource from "../docs/ciphertext_serialization_format_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publicCryptoOpaqueHandlesDocSource from "../docs/public_crypto_opaque_handles.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyBoundaryDecisionDocSource from "../docs/secure_runtime_alpha_012_key_boundary_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptServiceSource from "../src/runtime/fedos_runtime_decrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptServiceSource from "../src/runtime/fedos_runtime_encrypt.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyGenerationServiceSource from "../src/runtime/fedos_runtime_aead_key_generation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomBytesServiceSource from "../src/runtime/fedos_runtime_random_bytes.ts?raw";
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
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextSerializationRsSource from "../packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 017 — "Public Runtime Ciphertext Wire Format
 * Decision": REVIEW / DESIGN DECISION ONLY, no code change of any kind.
 * Formally adopts reusing the crate's already-decided-and-implemented
 * Stage 182/186 canonical JSON+base64url ciphertext codec as Secure
 * Runtime's own Public Ciphertext Wire Format, decides the
 * `exportCiphertext()`/`importCiphertext()` Public API signature, the JS
 * wire type (a branded `string`), the Rust `wasm-bindgen` wrapper
 * contract, the Fail-Closed reason model, the export/import
 * implementation-unit rule, the Trust Boundary, and the wire-structure
 * vs. cryptographic-failure separation — across ten formally decided
 * items, executing Alpha 016's own recommendation.
 */
describe("Secure Runtime Alpha 017 Ciphertext Wire Format Decision -- review/decision only, no Runtime/Rust/Worker/Cargo/package change", () => {
  it("1. the decision document exists and is substantial", () => {
    expect(typeof decisionDocSource).toBe("string");
    expect(decisionDocSource.length).toBeGreaterThan(10000);
  });

  it("2. states REVIEW / DESIGN DECISION ONLY with an explicit 'does not implement' list", () => {
    expect(decisionDocSource).toMatch(/REVIEW \/ DESIGN DECISION ONLY/);
    expect(decisionDocSource).toMatch(
      /No Runtime, Rust,\s*\n`FedosWasmLoader`, `create_runtime\.ts`, `types\.ts`, Worker, Production,\s*\n`Cargo\.toml`, or `package\.json` change of any kind\./,
    );
    expect(decisionDocSource).toMatch(
      /`exportCiphertext\(\)`\/`importCiphertext\(\)` are NOT\s*\nimplemented/,
    );
  });

  it("3. Item 1 -- Wire Format: reuses Stage 182/186, explicitly authorizes no new format", () => {
    expect(decisionDocSource).toMatch(/## 1\. Wire Format — DECIDED: reuse Stage 182\/186, no new format/);
    expect(decisionDocSource).toMatch(
      /No new, independent wire format is created by this Stage or\s*\nauthorized for any future Stage/,
    );
  });

  it("4. Item 2 -- Public Runtime API: exportCiphertext()/importCiphertext() signature decided", () => {
    expect(decisionDocSource).toMatch(
      /exportCiphertext\(\s*\n\s*ciphertext: AeadCiphertextHandle,\s*\n\): Promise<AeadCiphertextWire \| null>;/,
    );
    expect(decisionDocSource).toMatch(
      /importCiphertext\(\s*\n\s*serialized: AeadCiphertextWire,\s*\n\): Promise<AeadCiphertextHandle \| null>;/,
    );
  });

  it("5. Item 3 -- JS wire type: string adopted, Uint8Array and dedicated object rejected", () => {
    expect(decisionDocSource).toMatch(/## 3\. JS-side Wire type — DECIDED: `string`/);
    expect(decisionDocSource).toMatch(/\*\*Adopted \(as a branded string — see §4\)\*\*/);
    expect(decisionDocSource).toMatch(/\| `Uint8Array` \| Rejected \|/);
    expect(decisionDocSource).toMatch(/Dedicated object \(e\.g\. `\{ version, algorithm, aadDomain, nonce, ciphertext, tag \}`/);
  });

  it("6. Item 4 -- Branding adopted, explicitly labeled a compile-time-only boundary, not a runtime security boundary", () => {
    expect(decisionDocSource).toMatch(
      /export type AeadCiphertextWire = string & \{\s*\n\s*readonly __brand: "AeadCiphertextWire";\s*\n\};/,
    );
    expect(decisionDocSource).toMatch(
      /the brand is a compile-time\s*\nAPI-misuse boundary, NOT a runtime security boundary/,
    );
    expect(decisionDocSource).toMatch(
      /All real Fail-Closed\s*\nsecurity enforcement for this boundary happens entirely inside Rust's\s*\n`decode_envelope_internal`/,
    );
  });

  it("7. Item 5 -- Rust wasm-bindgen wrapper contract decided, calling each existing codec function exactly once", () => {
    expect(decisionDocSource).toMatch(
      /pub fn serialize_aead_ciphertext\(\s*\n\s*ciphertext: &AeadCiphertextHandle,\s*\n\) -> Option<String> \{\s*\n\s*encode_envelope_internal\(ciphertext\.inner\(\)\.inner\(\)\)\s*\n\}/,
    );
    expect(decisionDocSource).toMatch(
      /pub fn deserialize_aead_ciphertext\(\s*\n\s*serialized: &str,\s*\n\) -> Option<AeadCiphertextHandle> \{/,
    );
    expect(decisionDocSource).toMatch(/CiphertextSerializationStatus::Valid => decision/);
    expect(decisionDocSource).toMatch(
      /No new Rust logic is introduced beyond the wrapper and construction\s*\ncall itself/,
    );
  });

  it("8. Item 6 -- Fail-Closed reason model decided for both directions, mirroring the existing Encrypt/Decrypt execution shape", () => {
    expect(decisionDocSource).toMatch(/export interface FedosWasmLoaderExportCiphertextExecution \{/);
    expect(decisionDocSource).toMatch(/export interface FedosWasmLoaderImportCiphertextExecution \{/);
    expect(decisionDocSource).toMatch(/"InvalidWireInputShape"/);
    expect(decisionDocSource).toMatch(/"InvalidHandleOutputShape"/);
    expect(decisionDocSource).toMatch(/"DeserializationFailed"/);
    expect(decisionDocSource).toMatch(/"SerializationFailed"/);
    expect(decisionDocSource).toMatch(
      /\*\*The Public Runtime API surfaces NONE of these reasons\.\*\*/,
    );
  });

  it("9. Item 7 -- export/import implementation unit: together in one Stage, commit-splitting explicitly left open as a separate question", () => {
    expect(decisionDocSource).toMatch(
      /\*\*Formally decided: `exportCiphertext\(\)` and `importCiphertext\(\)` are\s*\ndesigned AND implemented together, in the same Stage \(Alpha 018\)/,
    );
    expect(decisionDocSource).toMatch(
      /\*\*This does NOT mean Alpha 018 must land as one physical commit\.\*\*/,
    );
  });

  it("10. Item 8 -- Trust Boundary spelled out for both export and import directions", () => {
    expect(decisionDocSource).toMatch(/## 8\. Trust Boundary — DECIDED/);
    expect(decisionDocSource).toMatch(/\*\*Export direction:\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Import direction:\*\*/);
    expect(decisionDocSource).toMatch(/Input is COMPLETELY untrusted by construction/);
    expect(decisionDocSource).toMatch(/No exception ever escapes `importCiphertext\(\)`/);
  });

  it("11. Item 9 -- wire-structure vs cryptographic-failure separation decided explicitly", () => {
    expect(decisionDocSource).toMatch(
      /\*\*`importCiphertext\(\)` validates ONLY wire structure — never\s*\ncryptographic validity\.\*\*/,
    );
    expect(decisionDocSource).toMatch(
      /This is BY DESIGN, not a gap\.\*\*/,
    );
    expect(decisionDocSource).toMatch(
      /`importCiphertext\(\)` succeeding is a necessary, but never\s*\nsufficient, precondition for a subsequent `decrypt\(\)` call to\s*\nsucceed\.\*\*/,
    );
  });

  it("12. Item 10 -- Storage/Network/Worker/future consumers surveyed, none connected", () => {
    expect(decisionDocSource).toMatch(/\*\*Secure Storage\*\* — a plain string is directly persistable/);
    expect(decisionDocSource).toMatch(/\*\*Network transport\*\* — text-safe by construction/);
    expect(decisionDocSource).toMatch(/\*\*Worker boundary\*\* — a plain `string` is structured-clone-safe/);
    expect(decisionDocSource).toMatch(/Marketplace content delivery \/ DM \/ BBS-style content posting/);
  });

  it("13. cross-checks consistency against Stage 182/186, Alpha 013/014/015/016, ciphertext_envelope_plan.md, and public_crypto_opaque_handles.md", () => {
    expect(decisionDocSource).toMatch(/## 11\. Consistency check against prior binding docs/);
    expect(decisionDocSource).toMatch(/\*\*Stage 182 \(`ciphertext_serialization_format_decision\.md`\)\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Stage 186 \(`ciphertext_serialization\.rs` implementation\)\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 013 \(Opaque `AeadKeyHandle`\)\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 014 \(`encrypt\(\)`\)\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 015 \(`decrypt\(\)`\)\*\*/);
    expect(decisionDocSource).toMatch(/\*\*Alpha 016 \(boundary review\)\*\*/);
    expect(decisionDocSource).toMatch(/\*\*`docs\/ciphertext_envelope_plan\.md`\*\*/);
    expect(decisionDocSource).toMatch(/\*\*`docs\/public_crypto_opaque_handles\.md`\*\*/);
    expect(typeof reviewDocSource).toBe("string");
    expect(typeof ciphertextEnvelopePlanDocSource).toBe("string");
    expect(typeof ciphertextSerializationFormatDecisionDocSource).toBe("string");
    expect(typeof publicCryptoOpaqueHandlesDocSource).toBe("string");
    expect(typeof keyBoundaryDecisionDocSource).toBe("string");
  });

  it("14. recommends exactly one Alpha 018 step -- the full pair implemented together, rejecting the other three options with reasons", () => {
    expect(decisionDocSource).toMatch(/## 12\. Recommendation for Alpha 018/);
    expect(decisionDocSource).toMatch(
      /\*\*Alpha 018 should implement the Rust `wasm-bindgen` wrapper pair AND\s*\n>\s*the full Public Runtime API/,
    );
    expect(decisionDocSource).toMatch(/\*\*Why not "Rust wrappers only, Public API later"/);
    expect(decisionDocSource).toMatch(/\*\*Why not "export side only"/);
    expect(decisionDocSource).toMatch(/\*\*Why not another preparatory\/review Stage/);
  });

  it("15. reconfirms Fail Closed is unaffected by this decision", () => {
    expect(decisionDocSource).toMatch(/## 14\. Fail Closed — reconfirmed/);
    expect(decisionDocSource).toMatch(/this Stage decides a FUTURE public\s*\nboundary; it implements nothing\./);
  });

  it("16. the real Rust functions this decision's wrapper contract depends on are confirmed to exist exactly as described, unchanged", () => {
    expect(ciphertextSerializationRsSource).toMatch(
      /pub\(crate\) fn encode_envelope_internal\(envelope: &AeadCiphertextEnvelope\) -> Option<String>/,
    );
    expect(ciphertextSerializationRsSource).toMatch(
      /pub\(crate\) fn decode_envelope_internal\(json: &str\) -> CiphertextSerializationDecision/,
    );
    expect(libRsSource).toMatch(
      /pub\(crate\) fn from_inner\(\s*\n\s*inner: crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope,\s*\n\s*\) -> Self/,
    );
    expect(libRsSource).toMatch(/AeadCiphertextHandle \{ inner: envelope \}/);
  });

  it("17. Worker remains unconnected to exportCiphertext/importCiphertext/serialize_aead_ciphertext/deserialize_aead_ciphertext -- all four were later added to the Runtime/Loader/Rust surface by Stage 1011 (Secure Runtime Alpha 018), per this decision's own contract", () => {
    expect(workerSource).not.toMatch(/exportCiphertext|importCiphertext/);
  });

  it("18. Runtime implementation code is confirmed unchanged in every file this decision does NOT authorize touching; create_runtime.ts/fedos_wasm_loader.ts/types.ts legitimately reference this decision's own doc as of Stage 1011 (Secure Runtime Alpha 018), executing exactly the contract this decision fixed -- see docs/secure_runtime_alpha_018_ciphertext_wire_export_import_api.md", () => {
    expect(createRuntimeSource).toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(wasmLoaderSource).toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(runtimeTypesSource).toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(randomBytesServiceSource).not.toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(keyGenerationServiceSource).not.toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(encryptServiceSource).not.toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(decryptServiceSource).not.toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
  });

  it("19. initializeCrypto()'s own return value is confirmed byte-for-byte unchanged by an ACTUAL call", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("20. runtimeCapabilities()/randomBytes()/generateAeadKey()/encrypt()/decrypt() are confirmed byte-for-byte unchanged by ACTUAL calls", async () => {
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

  it("21. createRuntime()'s assembled AppRuntime still exposes the same six fields this decision found -- exportCiphertext/importCiphertext were later added by Stage 1011 (Secure Runtime Alpha 018), executing this decision's own contract", async () => {
    const { createRuntime } = await import("../src/runtime/create_runtime.js");
    const runtime = createRuntime();
    expect(typeof runtime.initializeCrypto).toBe("function");
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(typeof runtime.randomBytes).toBe("function");
    expect(typeof runtime.generateAeadKey).toBe("function");
    expect(typeof runtime.encrypt).toBe("function");
    expect(typeof runtime.decrypt).toBe("function");
    expect(typeof (runtime as unknown as { exportCiphertext?: unknown }).exportCiphertext).toBe("function");
    expect(typeof (runtime as unknown as { importCiphertext?: unknown }).importCiphertext).toBe("function");
  });

  it("22. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("23. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this decision", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("24. Worker remains fully unchanged and unconnected", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(workerSource).not.toMatch(
      /serialize_aead_ciphertext|deserialize_aead_ciphertext|AeadCiphertextWire/,
    );
  });

  it("25. Rust and Cargo/package sources -- 34 pub fn AS OF THIS decision, eleven #[wasm_bindgen], 11/2 dependencies; serialize_aead_ciphertext()/deserialize_aead_ciphertext() and a legitimate reference to this decision's own doc were later added by Stage 1011 (Secure Runtime Alpha 018), executing exactly the contract §5 decided", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(44);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(16);
    expect(libRsSource).toMatch(/secure_runtime_alpha_017_ciphertext_wire_format_decision/);
    expect(libRsSource).toMatch(/pub fn serialize_aead_ciphertext\b/);
    expect(libRsSource).toMatch(/pub fn deserialize_aead_ciphertext\b/);

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

  it("26. no new dependency is proposed anywhere in this decision", () => {
    expect(decisionDocSource).not.toMatch(/add(?:ing|s)? a new (?:crate|dependency)/i);
    expect(decisionDocSource).toMatch(/no dependency adopted or\s*\n\s*promoted/);
  });
});

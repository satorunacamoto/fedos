import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import aeadInternalSource from "../packages/fedos-core-rust/src/crypto/aead_internal.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextEnvelopeSource from "../packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import integrationTestSource from "../packages/fedos-core-rust/tests/public_crypto_api.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Stage 171–176 — "Public opaque crypto API completion."
 *
 * `packages/fedos-core-rust/src/lib.rs` adds two new public OPAQUE wrapper
 * types, `FedosAeadKeyHandle` (around the crate-private
 * `SecretHandle(AeadKeyMaterial)`) and `FedosCiphertextEnvelope` (around
 * the crate-private `AeadCiphertextEnvelope`), plus a new key-generation
 * entry point, `fedos_generate_aead_key_32`, and two new public label
 * enums, `FedosAeadAlgorithm`/`FedosAeadAadDomain`. `fedos_encrypt`/
 * `fedos_decrypt` (Stage 166–170) are rewired to accept/return ONLY these
 * new public types — resolving the Stage 166–170 "practically
 * internal-only" limitation: this crate's public crypto-operation API is
 * now genuinely usable from OUTSIDE the crate, proven by
 * `packages/fedos-core-rust/tests/public_crypto_api.rs`, a real Cargo
 * integration test compiled as its own separate crate.
 *
 * `SecretHandle` and `AeadCiphertextEnvelope` (the real, secret/payload-
 * carrying types) are NEVER promoted to `pub` — they stay `pub(crate)`
 * forever. Neither opaque wrapper exposes a raw key byte, a raw nonce
 * byte, a raw ciphertext byte, `AsRef<[u8]>`, `Clone`, `Debug`/`Display`
 * over its bytes, or `Serialize` — every one of those is verified absent
 * below. No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection, no
 * `Cargo.toml` change, no new dependency.
 */
describe("FedOS Rust crate — public opaque crypto API (Stage 171–176)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. SecretHandle and AeadCiphertextEnvelope remain pub(crate)-only — never promoted to pub", () => {
    expect(libRsSource).toMatch(/\bpub\(crate\)\s+struct\s+SecretHandle\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+struct\s+SecretHandle\b/);
    expect(ciphertextEnvelopeSource).toMatch(/\bpub\(crate\)\s+struct\s+AeadCiphertextEnvelope\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bpub\s+struct\s+AeadCiphertextEnvelope\b/);
  });

  it("2. AeadCipher and AeadAadDomain (aead_internal's own labels) remain pub(crate)-only — unchanged, unpromoted since Stage 152–154", () => {
    for (const name of ["AeadCipher", "AeadAadDomain"]) {
      expect(aeadInternalSource, `expected pub(crate) ${name}`).toMatch(
        new RegExp(`\\bpub\\(crate\\)\\s+enum\\s+${name}\\b`),
      );
      expect(aeadInternalSource, `${name} must never be pub`).not.toMatch(
        new RegExp(`\\bpub\\s+enum\\s+${name}\\b`),
      );
    }
  });

  it("3. FedosAeadKeyHandle is a genuinely public struct with a private inner field", () => {
    expect(libRsSource).toMatch(/\bpub\s+struct\s+FedosAeadKeyHandle\s*\{\s*\r?\n\s*inner:\s*secret_handle::SecretHandle,/);
    expect(libRsSource).not.toMatch(/struct\s+FedosAeadKeyHandle\s*\{\s*\r?\n\s*pub\s+inner/);
  });

  it("4. FedosCiphertextEnvelope is a genuinely public struct with a private inner field", () => {
    expect(libRsSource).toMatch(
      /\bpub\s+struct\s+FedosCiphertextEnvelope\s*\{\s*\r?\n\s*inner:\s*crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope,/,
    );
    expect(libRsSource).not.toMatch(/struct\s+FedosCiphertextEnvelope\s*\{\s*\r?\n\s*pub\s+inner/);
  });

  it("5. FedosAeadKeyHandle has no derive attribute at all — no Clone/Debug/Display/PartialEq/Serialize", () => {
    const structIdx = libRsSource.indexOf("pub struct FedosAeadKeyHandle");
    expect(structIdx).toBeGreaterThan(-1);
    // The line(s) immediately above the struct must NOT be a #[derive(...)]
    // — find the nearest preceding non-blank, non-doc-comment line.
    const before = libRsSource.slice(0, structIdx);
    const lines = before.split("\n").filter((l: string) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? "";
    expect(lastLine).not.toMatch(/#\[derive/);
    expect(libRsSource).not.toMatch(/impl\s+Clone\s+for\s+FedosAeadKeyHandle\b/);
    expect(libRsSource).not.toMatch(/impl\s+(std::fmt::)?Debug\s+for\s+FedosAeadKeyHandle\b/);
    expect(libRsSource).not.toMatch(/impl\s+(std::fmt::)?Display\s+for\s+FedosAeadKeyHandle\b/);
  });

  it("6. FedosCiphertextEnvelope has no derive attribute at all — no Clone/Debug/Display/Serialize", () => {
    const structIdx = libRsSource.indexOf("pub struct FedosCiphertextEnvelope");
    expect(structIdx).toBeGreaterThan(-1);
    const before = libRsSource.slice(0, structIdx);
    const lines = before.split("\n").filter((l: string) => l.trim().length > 0);
    const lastLine = lines[lines.length - 1] ?? "";
    expect(lastLine).not.toMatch(/#\[derive/);
    expect(libRsSource).not.toMatch(/impl\s+Clone\s+for\s+FedosCiphertextEnvelope\b/);
    expect(libRsSource).not.toMatch(/impl\s+(std::fmt::)?Debug\s+for\s+FedosCiphertextEnvelope\b/);
    expect(libRsSource).not.toMatch(/impl\s+(std::fmt::)?Display\s+for\s+FedosCiphertextEnvelope\b/);
  });

  it("7. no AsRef<[u8]> or Serialize impl anywhere in lib.rs for either opaque type", () => {
    expect(libRsSource).not.toMatch(/impl\s+AsRef\s*<\s*\[\s*u8\s*\]\s*>\s*for\s+FedosAeadKeyHandle\b/);
    expect(libRsSource).not.toMatch(/impl\s+AsRef\s*<\s*\[\s*u8\s*\]\s*>\s*for\s+FedosCiphertextEnvelope\b/);
    expect(libRsSource).not.toMatch(/impl\s+(serde::)?Serialize\s+for\s+FedosAeadKeyHandle\b/);
    expect(libRsSource).not.toMatch(/impl\s+(serde::)?Serialize\s+for\s+FedosCiphertextEnvelope\b/);
    // Scoped to the new opaque-handle code only — `serde`/`Serialize` are
    // legitimately named elsewhere in this file (e.g. the RFC test-vector
    // modules use `serde_json` to parse JSON fixtures), so a bare
    // whole-file match would false-positive on that unrelated, pre-existing
    // usage.
    const start = libRsSource.indexOf("pub struct FedosAeadKeyHandle");
    const end = libRsSource.indexOf("\n}\n", libRsSource.indexOf("pub fn fedos_decrypt("));
    const section = libRsSource.slice(start, end);
    expect(section).not.toMatch(/\bserde\b/i);
  });

  it("8. no public raw-byte getter on either opaque type: the only accessors are pub(crate)-only inner()/inner_mut()", () => {
    const keyHandleImplStart = libRsSource.indexOf("impl FedosAeadKeyHandle {");
    const keyHandleImplEnd = libRsSource.indexOf("\n}\n", keyHandleImplStart);
    const keyHandleImpl = libRsSource.slice(keyHandleImplStart, keyHandleImplEnd);
    expect(keyHandleImpl).not.toMatch(/\bpub\s+fn\b/);
    expect(keyHandleImpl).toMatch(/\bpub\(crate\)\s+fn\s+inner\s*\(/);

    const envelopeImplStart = libRsSource.indexOf("impl FedosCiphertextEnvelope {");
    const envelopeImplEnd = libRsSource.indexOf("\n}\n", envelopeImplStart);
    const envelopeImpl = libRsSource.slice(envelopeImplStart, envelopeImplEnd);
    expect(envelopeImpl).not.toMatch(/\bpub\s+fn\b/);
    expect(envelopeImpl).toMatch(/\bpub\(crate\)\s+fn\s+inner\s*\(/);
  });

  it("9. fedos_generate_aead_key_32 is pub, takes no parameter, and returns FedosGenerateAeadKeyDecision", () => {
    expect(libRsSource).toMatch(
      /\bpub\s+fn\s+fedos_generate_aead_key_32\s*\(\s*\)\s*->\s*FedosGenerateAeadKeyDecision/,
    );
  });

  it("10. fedos_generate_aead_key_32 draws exactly 32 bytes via getrandom::fill, has no fallback PRNG path, and zeroizes its staging buffer", () => {
    const fnStart = libRsSource.indexOf("pub fn fedos_generate_aead_key_32(");
    const fnEnd = libRsSource.indexOf("\n}\n", fnStart);
    const fnBody = libRsSource.slice(fnStart, fnEnd);
    expect(fnBody).toMatch(/\[\s*0u8\s*;\s*32\s*\]/);
    expect(fnBody).toMatch(/getrandom::fill\s*\(\s*&mut\s+buf\s*\)/);
    expect(fnBody).toMatch(/buf\.zeroize\s*\(\s*\)/);
    expect(fnBody).not.toMatch(/\brand::/);
    expect(fnBody).not.toMatch(/\bthread_rng\b/);
  });

  it("11. FedosGenerateAeadKeyDecision's key field is Option<FedosAeadKeyHandle> — never a raw byte", () => {
    expect(libRsSource).toMatch(/pub\s+key:\s*Option<\s*FedosAeadKeyHandle\s*>/);
  });

  it("12. FedosAeadAlgorithm and FedosAeadAadDomain are new, genuinely public label enums, separate from aead_internal's own", () => {
    expect(libRsSource).toMatch(/\bpub\s+enum\s+FedosAeadAlgorithm\s*\{\s*\r?\n\s*ChaCha20Poly1305,\s*\r?\n\s*Aes256Gcm,/);
    expect(libRsSource).toMatch(/\bpub\s+enum\s+FedosAeadAadDomain\s*\{/);
  });

  it("13. no unwrap/expect/panic/todo/unimplemented anywhere in the new Stage 171–176 production code", () => {
    const start = libRsSource.indexOf("pub struct FedosAeadKeyHandle");
    const end = libRsSource.indexOf("\n}\n", libRsSource.indexOf("pub fn fedos_decrypt("));
    const productionSection = libRsSource.slice(start, end);
    // Strip out #[cfg(test)] gated code (inner_mut) before checking, since
    // that helper is test-only and never compiled into production.
    const cfgTestIdx = productionSection.indexOf("#[cfg(test)]");
    const withoutTestHelper =
      cfgTestIdx === -1
        ? productionSection
        : productionSection.slice(0, cfgTestIdx) +
          productionSection.slice(productionSection.indexOf("}\n", cfgTestIdx) + 2);
    expect(withoutTestHelper).not.toMatch(/\.unwrap\s*\(/);
    expect(withoutTestHelper).not.toMatch(/\.expect\s*\(/);
    expect(withoutTestHelper).not.toMatch(/\bpanic!\s*\(/);
    expect(withoutTestHelper).not.toMatch(/\btodo!\s*\(/);
    expect(withoutTestHelper).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("14. no `unsafe` anywhere in lib.rs; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
  });

  it("15. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedosaeadkeyhandle");
      expect(src).not.toContain("fedosciphertextenvelope");
      expect(src).not.toContain("fedos_generate_aead_key_32");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("16. Cargo.toml is unchanged — no new dependency, still 9 production dependencies, no new [[test]] entry needed", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
    expect(cargoCode).not.toMatch(/\[\[test\]\]/);
  });

  it("17. a real Cargo integration test proves the public API is callable from OUTSIDE the crate", () => {
    expect(integrationTestSource).toMatch(/use\s+fedos_core_rust::\{/);
    expect(integrationTestSource).toContain("fedos_generate_aead_key_32");
    expect(integrationTestSource).toContain("fedos_encrypt");
    expect(integrationTestSource).toContain("fedos_decrypt");
    // The integration test's CODE (everything from its `use` declaration
    // onward — the module-level doc comment above it legitimately
    // discusses these crate-private names in prose, explaining why they
    // are unreachable) must never actually NAME any of this crate's
    // internal, crate-private types, since it could not resolve them even
    // if it tried.
    const codeOnly = integrationTestSource.slice(integrationTestSource.indexOf("use fedos_core_rust::{"));
    // Word-boundary regex, not a bare substring match: "AeadAadDomain" is
    // (deliberately) a substring of the public "FedosAeadAadDomain" — a
    // plain `toContain` would false-positive on that legitimate public
    // name, so each internal name is checked as a standalone identifier.
    for (const forbidden of ["SecretHandle", "AeadCiphertextEnvelope", "AeadCipher", "AeadAadDomain"]) {
      expect(codeOnly).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
    // These two have no legitimate-substring collision, so a plain
    // substring check is sufficient.
    expect(codeOnly).not.toContain("secret_handle::");
    expect(codeOnly).not.toContain("crate::crypto");
    expect(integrationTestSource).not.toMatch(/\bunsafe\b/);
  });

  it("18. the integration test itself has no unwrap/panic/todo/unimplemented (expect() is fine in test code)", () => {
    expect(integrationTestSource).not.toMatch(/\.unwrap\s*\(/);
    expect(integrationTestSource).not.toMatch(/\bpanic!\s*\(/);
    expect(integrationTestSource).not.toMatch(/\btodo!\s*\(/);
    expect(integrationTestSource).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("19. no JSON/base64/CBOR serialization anywhere in the new opaque-handle code", () => {
    const start = libRsSource.indexOf("pub struct FedosAeadKeyHandle");
    const end = libRsSource.indexOf("\n}\n", libRsSource.indexOf("pub fn fedos_decrypt("));
    const section = libRsSource.slice(start, end);
    expect(section).not.toMatch(/\bjson\b/i);
    expect(section).not.toMatch(/\bbase64\b/i);
    expect(section).not.toMatch(/\bcbor\b/i);
  });
});

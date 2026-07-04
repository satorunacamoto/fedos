import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextEnvelopeSource from "../packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 166–170 — the public `fedos_encrypt`/`fedos_decrypt` API + docs.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains this crate's FIRST public
 * crypto-operation functions: `pub fn fedos_encrypt` and
 * `pub fn fedos_decrypt`. Per the explicit Stage 166–170 scope, these are
 * the ONLY new public items besides their own `FedosEncryptStatus`/
 * `FedosEncryptDecision`/`FedosDecryptStatus`/`FedosDecryptDecision` result
 * types — `fedos_encrypt` accepts only a `SecretHandle` (never a raw key
 * byte) and returns only its own `FedosEncryptDecision`; `fedos_decrypt`
 * accepts only a `SecretHandle` and an internal ciphertext-envelope
 * reference and returns only its own `FedosDecryptDecision`.
 *
 * Deliberate, reviewed, documented scope limit (see
 * `docs/public_crypto_api.md`): `SecretHandle` and the ciphertext envelope
 * type stay `pub(crate)` — these two functions are `pub` in NAME this
 * stage, not yet practically callable from outside this crate until a
 * future stage also exposes public-facing wrappers for those types. No
 * Runtime/Worker/Storage/Nostr/NIP-44/WASM connection, no serialization,
 * no public raw key/nonce/HKDF/AEAD-implementation-type exposure, no new
 * crate dependency, no `Cargo.toml` change — every one of those is
 * verified absent below.
 */
describe("FedOS Rust crate — public fedos_encrypt/fedos_decrypt API (Stage 166–170)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. fedos_encrypt and fedos_decrypt are declared pub fn at the crate root", () => {
    expect(libRsSource).toMatch(/\bpub\s+fn\s+fedos_encrypt\s*\(/);
    expect(libRsSource).toMatch(/\bpub\s+fn\s+fedos_decrypt\s*\(/);
  });

  it("2. fedos_encrypt accepts exactly (AeadCipher, &SecretHandle, AeadAadDomain, &[u8]) and returns FedosEncryptDecision", () => {
    expect(libRsSource).toMatch(
      /pub\s+fn\s+fedos_encrypt\s*\(\s*algorithm:\s*crate::crypto::aead_internal::AeadCipher,\s*key:\s*&secret_handle::SecretHandle,\s*aad_domain:\s*crate::crypto::aead_internal::AeadAadDomain,\s*plaintext:\s*&\[\s*u8\s*\],?\s*\)\s*->\s*FedosEncryptDecision/,
    );
  });

  it("3. fedos_decrypt accepts exactly (&SecretHandle, &AeadCiphertextEnvelope) and returns FedosDecryptDecision", () => {
    expect(libRsSource).toMatch(
      /pub\s+fn\s+fedos_decrypt\s*\(\s*key:\s*&secret_handle::SecretHandle,\s*envelope:\s*&crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope,?\s*\)\s*->\s*FedosDecryptDecision/,
    );
  });

  it("4. fedos_encrypt never accepts a caller-supplied nonce — it draws its own via fedos_aead_nonce_96", () => {
    expect(libRsSource).not.toMatch(/fn\s+fedos_encrypt[^)]*nonce\s*:/);
    const fnStart = libRsSource.indexOf("pub fn fedos_encrypt(");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = libRsSource.slice(fnStart, fnStart + 1500);
    expect(fnBody).toMatch(/fedos_aead_nonce_96\s*\(\s*\)/);
  });

  it("5. FedosEncryptDecision's envelope field and FedosDecryptDecision's plaintext field are typed as documented", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\)\s+envelope:\s*Option<\s*crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope\s*>/,
    );
    expect(libRsSource).toMatch(/pub\s+plaintext:\s*Option<Vec<u8>>/);
  });

  it("6. FedosDecryptStatus::AuthenticationFailed is a single fixed label — decrypt never distinguishes tamper cause", () => {
    expect(libRsSource).toMatch(/enum\s+FedosDecryptStatus\s*\{[^}]*AuthenticationFailed/s);
  });

  it("7. no public raw key/nonce byte parameter or return type anywhere in fedos_encrypt/fedos_decrypt's own declarations", () => {
    const encryptStart = libRsSource.indexOf("pub fn fedos_encrypt(");
    const decryptStart = libRsSource.indexOf("pub fn fedos_decrypt(");
    for (const start of [encryptStart, decryptStart]) {
      expect(start).toBeGreaterThan(-1);
      const signature = libRsSource.slice(start, libRsSource.indexOf(")", libRsSource.indexOf("{", start)));
      expect(signature).not.toMatch(/:\s*\[\s*u8\s*;\s*32\s*\]/);
      expect(signature).not.toMatch(/:\s*\[\s*u8\s*;\s*12\s*\]/);
    }
  });

  it("8. no public HKDF/serialization exposure introduced by this stage: no JSON/base64/CBOR/serde/Hkdf:: in lib.rs's new public functions", () => {
    const encryptStart = libRsSource.indexOf("pub fn fedos_encrypt(");
    const decryptEnd = libRsSource.indexOf("\n}\n", libRsSource.indexOf("pub fn fedos_decrypt("));
    const publicApiSection = libRsSource.slice(encryptStart, decryptEnd);
    expect(publicApiSection).not.toMatch(/\bserde\b/i);
    expect(publicApiSection).not.toMatch(/\bjson\b/i);
    expect(publicApiSection).not.toMatch(/\bbase64\b/i);
    expect(publicApiSection).not.toMatch(/\bcbor\b/i);
    expect(publicApiSection).not.toMatch(/\bHkdf::/);
  });

  it("9. SecretHandle and AeadCiphertextEnvelope stay pub(crate)-only — the documented minimal-scope limitation", () => {
    expect(libRsSource).toMatch(/\bpub\(crate\)\s+struct\s+SecretHandle\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+struct\s+SecretHandle\b/);
    expect(ciphertextEnvelopeSource).toMatch(/\bpub\(crate\)\s+struct\s+AeadCiphertextEnvelope\b/);
    expect(ciphertextEnvelopeSource).not.toMatch(/\bpub\s+struct\s+AeadCiphertextEnvelope\b/);
  });

  it("10. the crate's public pub fn surface grows from twenty-four to exactly twenty-six", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(26);
    expect(pubFnNames).toContain("fedos_encrypt");
    expect(pubFnNames).toContain("fedos_decrypt");
  });

  it("11. Cargo.toml is unchanged — no new dependency, still 9 production dependencies", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(9);
  });

  it("12. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedos_encrypt");
      expect(src).not.toContain("fedos_decrypt");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("13. cargo test coverage exists for encrypt/decrypt roundtrip, wrong key, wrong nonce, wrong AAD, authentication failure, cleared handle, and placeholder rejection", () => {
    expect(libRsSource).toContain("fedos_encrypt_then_fedos_decrypt_round_trips_for_both_ciphers");
    expect(libRsSource).toContain("fedos_encrypt_rejects_a_wrong_kinded_key");
    expect(libRsSource).toContain("fedos_decrypt_rejects_a_cleared_key");
    expect(libRsSource).toContain("fedos_decrypt_rejects_a_wrong_nonce");
    expect(libRsSource).toContain("fedos_decrypt_rejects_a_wrong_aad_domain");
    expect(libRsSource).toContain("fedos_decrypt_reports_authentication_failed_for_tampered_ciphertext");
    expect(libRsSource).toContain("fedos_decrypt_rejects_a_stage_157_158_placeholder_envelope");
  });

  it("14. no unwrap/expect/panic/todo/unimplemented in fedos_encrypt/fedos_decrypt's own production bodies", () => {
    const encryptStart = libRsSource.indexOf("pub fn fedos_encrypt(");
    const decryptEnd = libRsSource.indexOf("\n}\n", libRsSource.indexOf("pub fn fedos_decrypt("));
    const publicApiSection = libRsSource.slice(encryptStart, decryptEnd);
    expect(publicApiSection).not.toMatch(/\.unwrap\s*\(/);
    expect(publicApiSection).not.toMatch(/\.expect\s*\(/);
    expect(publicApiSection).not.toMatch(/\bpanic!\s*\(/);
    expect(publicApiSection).not.toMatch(/\btodo!\s*\(/);
    expect(publicApiSection).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("15. no `unsafe` anywhere in lib.rs; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
  });
});

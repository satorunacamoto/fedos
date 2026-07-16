import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serializationSource from "../packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nip44SchemaSource from "../packages/fedos-core-rust/src/crypto/nip44_vector_schema.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptedPayloadSource from "../src/storage/encrypted_payload.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Stage 186–188 — "Ciphertext serialization implementation in Rust +
 * NIP-44 vector schema guard."
 *
 * `packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs` (new)
 * implements the Stage 182 canonical-JSON-+-base64url decision:
 * `encode_envelope_internal`/`decode_envelope_internal`, hand-written
 * against the STANDARD LIBRARY ONLY — no `serde_json`/base64 crate
 * promotion, `Cargo.toml` unchanged. `packages/fedos-core-rust/src/crypto/nip44_vector_schema.rs`
 * (new, `#[cfg(test)]`-only) completes `docs/nip44_vector_readiness.md`
 * §3's step 1 (vector schema guard) — schema/presence checks on
 * `test-vectors/nip44/nip44-v2.json` only, no cryptographic verification,
 * no secp256k1 dependency. This stage is still crate-private-only
 * implementation: no public API addition, no NIP-44 cryptography, no
 * TypeScript serialization, no Runtime/Worker/Storage/Nostr/WASM
 * connection — every one of those is verified absent below.
 */
describe("FedOS Rust crate — ciphertext serialization implementation + NIP-44 vector schema guard (Stage 186–188)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. crypto.rs declares ciphertext_serialization as pub(crate), and nip44_vector_schema as #[cfg(test)]-only (never pub(crate)/pub)", () => {
    expect(cryptoModSource).toMatch(/\bpub\(crate\)\s+mod\s+ciphertext_serialization\s*;/);
    expect(cryptoModSource).not.toMatch(/\bpub\s+mod\s+ciphertext_serialization\b/);
    expect(cryptoModSource).toMatch(/#\[cfg\(test\)\]\s*\r?\n\s*mod\s+nip44_vector_schema\s*;/);
    expect(cryptoModSource).not.toMatch(/\bpub\(crate\)\s+mod\s+nip44_vector_schema\b/);
    expect(cryptoModSource).not.toMatch(/\bpub\s+mod\s+nip44_vector_schema\b/);
  });

  it("2. encode_envelope_internal and decode_envelope_internal are pub(crate)-only, never pub", () => {
    for (const name of ["encode_envelope_internal", "decode_envelope_internal"]) {
      expect(serializationSource, `expected pub(crate) fn ${name}`).toMatch(
        new RegExp(`\\bpub\\(crate\\)\\s+fn\\s+${name}\\b`),
      );
      expect(serializationSource, `${name} must never be pub`).not.toMatch(
        new RegExp(`\\bpub\\s+fn\\s+${name}\\b`),
      );
    }
  });

  it("3. encode_envelope_internal accepts &AeadCiphertextEnvelope and returns Option<String>; decode_envelope_internal accepts &str and returns CiphertextSerializationDecision", () => {
    expect(serializationSource).toMatch(
      /pub\(crate\)\s+fn\s+encode_envelope_internal\s*\(\s*envelope:\s*&AeadCiphertextEnvelope\s*,?\s*\)\s*->\s*Option<\s*String\s*>/,
    );
    expect(serializationSource).toMatch(
      /pub\(crate\)\s+fn\s+decode_envelope_internal\s*\(\s*json:\s*&str\s*,?\s*\)\s*->\s*CiphertextSerializationDecision/,
    );
  });

  it("4. the canonical field order v/alg/aad/n/ct/tag is hard-coded into the encoder's format string", () => {
    const fnStart = serializationSource.indexOf("pub(crate) fn encode_envelope_internal(");
    const fnEnd = serializationSource.indexOf("\n}\n", fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = serializationSource.slice(fnStart, fnEnd);
    const vIdx = fnBody.indexOf('\\"v\\":');
    const algIdx = fnBody.indexOf('\\"alg\\":\\"');
    const aadIdx = fnBody.indexOf('\\"aad\\":\\"');
    const nIdx = fnBody.indexOf('\\"n\\":\\"');
    const ctIdx = fnBody.indexOf('\\"ct\\":\\"');
    const tagIdx = fnBody.indexOf('\\"tag\\":\\"');
    for (const idx of [vIdx, algIdx, aadIdx, nIdx, ctIdx, tagIdx]) {
      expect(idx).toBeGreaterThan(-1);
    }
    expect(vIdx).toBeLessThan(algIdx);
    expect(algIdx).toBeLessThan(aadIdx);
    expect(aadIdx).toBeLessThan(nIdx);
    expect(nIdx).toBeLessThan(ctIdx);
    expect(ctIdx).toBeLessThan(tagIdx);
  });

  it("5. the decoder requires the same v/alg/aad/n/ct/tag order via sequential strip_prefix calls", () => {
    // Search tokens use \\" to represent the literal backslash-quote pair
    // Rust's escaped string literals produce in the RAW source text
    // (e.g. `strip_prefix("{\"v\":")`) — a plain `"` would not match.
    const searchTokens = [
      'strip_prefix("{\\"v\\":")',
      'strip_prefix(",\\"alg\\":\\"")',
      'strip_prefix(",\\"aad\\":\\"")',
      'strip_prefix(",\\"n\\":\\"")',
      'strip_prefix(",\\"ct\\":\\"")',
      'strip_prefix(",\\"tag\\":\\"")',
    ];
    let lastIdx = -1;
    for (const searchToken of searchTokens) {
      const foundIdx = serializationSource.indexOf(searchToken);
      expect(foundIdx, `expected to find ${searchToken}`).toBeGreaterThan(-1);
      expect(foundIdx).toBeGreaterThan(lastIdx);
      lastIdx = foundIdx;
    }
  });

  it("6. no unwrap/expect/panic/todo/unimplemented/unreachable in ciphertext_serialization.rs's own production code", () => {
    const firstCfgTestIdx = serializationSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1 ? serializationSource : serializationSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(productionOnly).not.toMatch(/\btodo!\s*\(/);
    expect(productionOnly).not.toMatch(/\bunimplemented!\s*\(/);
    expect(productionOnly).not.toMatch(/\bunreachable!\s*\(/);
  });

  it("7. no `unsafe` anywhere in the new modules; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(serializationSource).not.toContain("unsafe");
    expect(nip44SchemaSource).not.toContain("unsafe");
  });

  it("8. Cargo.toml is unchanged since this stage: still 10 production dependencies (Stage 194 separately added k256; see test/nip44_pre_adoption_guard.test.ts), serde/serde_json/hex remain dev-dependencies-only, no base64/CBOR/rust-secp256k1 crate", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const devDepsSection = cargoCode.slice(devDepsIdx);
    const productionDepLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(productionDepLines.length).toBe(11);
    for (const forbidden of ["serde", "serde_json", "hex", "base64", "cbor", "secp256k1"]) {
      expect(
        productionDepLines.some((line: string) => line.trim().startsWith(`${forbidden} `) || line.trim().startsWith(`${forbidden}=`)),
        `expected ${forbidden} to be absent from [dependencies]`,
      ).toBe(false);
    }
    expect(devDepsSection).toMatch(/^\s*serde\s*=/m);
    expect(devDepsSection).toMatch(/^\s*serde_json\s*=/m);
    expect(devDepsSection).toMatch(/^\s*hex\s*=/m);
  });

  it("9. the crate's public pub fn surface is unchanged at twenty-seven — this stage adds no public API", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(45);
    for (const name of pubFnNames) {
      expect(name.toLowerCase()).not.toContain("encode_envelope");
      expect(name.toLowerCase()).not.toContain("decode_envelope");
      expect(name.toLowerCase()).not.toContain("nip44");
    }
  });

  it("10. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("ciphertext_serialization");
      expect(src).not.toContain("encode_envelope_internal");
      expect(src).not.toContain("decode_envelope_internal");
      expect(src).not.toContain("nip44_vector_schema");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("11. ciphertext_serialization.rs is not wired to fedos_encrypt/fedos_decrypt, aead_envelope_bridge, or ciphertext_transport yet", () => {
    expect(serializationSource).not.toMatch(/\bsuper::aead_envelope_bridge::/);
    expect(serializationSource).not.toMatch(/\bsuper::ciphertext_transport::/);
    expect(libRsSource).not.toMatch(/fedos_encrypt[\s\S]{0,400}encode_envelope_internal/);
    expect(libRsSource).not.toMatch(/fedos_decrypt[\s\S]{0,400}decode_envelope_internal/);
  });

  it("12. nip44_vector_schema.rs performs no cryptographic verification: no ECDH/HKDF/HMAC/secp256k1/encrypt/decrypt call", () => {
    // Note: a bare `fn ...conversation_key...(`/`calc_padded_len` check is
    // deliberately NOT included here — this module's own schema-check
    // test names (e.g. `get_message_keys_data_is_an_object_carrying_a_
    // conversation_key_and_a_keys_array`) legitimately contain those
    // words descriptively, without implementing any derivation; the
    // `::`-qualified real crypto call patterns below are specific enough
    // to avoid that false-positive while still catching an actual import/call.
    for (const forbidden of [
      /\bsecp256k1::/i,
      /\bk256::/i,
      /\bHkdf::/,
      /\bhmac::Hmac\b/,
      /\bChaCha20Poly1305::/,
      /\bAes256Gcm::/,
    ]) {
      expect(nip44SchemaSource).not.toMatch(forbidden);
    }
  });

  it("13. nip44_vector_schema.rs is #[cfg(test)]-gated and includes the existing vector file via include_str!", () => {
    expect(nip44SchemaSource).toContain("#![cfg(test)]");
    expect(nip44SchemaSource).toMatch(/include_str!\(\s*"[^"]*test-vectors\/nip44\/nip44-v2\.json"\s*\)/);
  });

  it("14. no NIP-44 implementation exists anywhere in this crate's production code", () => {
    for (const forbidden of [
      /\bfn\s+\w*conversation_key\w*\s*\(/i,
      /\bfn\s+\w*nip44\w*_(encrypt|decrypt)\s*\(/i,
      /\bsecp256k1::/i,
    ]) {
      expect(libRsSource).not.toMatch(forbidden);
      expect(serializationSource).not.toMatch(forbidden);
    }
  });

  it("15. serialization stays Rust-only: no TypeScript JSON.stringify/parser or base64 codec was added to mirror it", () => {
    expect(encryptedPayloadSource).not.toMatch(/\bJSON\.parse\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/\bJSON\.stringify\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/\batob\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/\bbtoa\s*\(/);
    expect(encryptedPayloadSource).not.toMatch(/base64url?Encode|encodeBase64|decodeBase64/i);
    for (const src of [storageTypesSource, noopStorageSource, federationTypesSource, runtimeSource, workerSource]) {
      expect(src).not.toMatch(/\bJSON\.stringify\s*\(\s*[^)]*envelope/i);
      expect(src).not.toMatch(/canonical.?json.?base64url/i);
    }
  });

  it("16. package.json is unchanged — no new dependency, still 2 production dependencies, no base64/CBOR library", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      expect(dep.toLowerCase()).not.toMatch(/base64|cbor|msgpack/);
    }
  });

  it("17. cargo test coverage exists for round trip, canonical order, every rejection cause, and NIP-44 schema categories", () => {
    for (const testName of [
      "encode_then_decode_round_trips_for_both_ciphers_and_every_aad_domain",
      "encode_emits_keys_in_the_exact_canonical_order_with_no_whitespace",
      "decode_rejects_a_reordered_document_even_if_every_field_is_otherwise_present",
      "decode_rejects_an_unknown_trailing_field",
      "decode_rejects_a_document_missing_the_tag_field",
      "decode_rejects_invalid_base64url_in_the_nonce_field",
      "decode_rejects_an_unrecognized_version",
      "decode_rejects_an_unrecognized_algorithm_label",
      "decode_rejects_an_unrecognized_aad_domain_label",
    ]) {
      expect(serializationSource).toContain(testName);
    }
    for (const testName of [
      "nip44_v2_json_parses_and_is_non_empty",
      "nip44_v2_contains_exactly_the_eight_expected_categories_no_more_no_fewer",
      "every_expected_category_has_the_documented_shouldpass_polarity_and_non_empty_data",
    ]) {
      expect(nip44SchemaSource).toContain(testName);
    }
  });
});

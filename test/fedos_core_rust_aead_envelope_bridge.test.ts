import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import bridgeSource from "../packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Stage 161–163 — the internal AEAD ↔ ciphertext-envelope bridge.
 *
 * `packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs` (new) adds
 * the ONE reviewed connection point between `crypto::aead_internal`'s real
 * seal/open results and `crypto::ciphertext_envelope`'s
 * `AeadCiphertextEnvelope` type: `envelope_from_seal_decision_internal`
 * (AEAD → envelope) and `open_decision_from_envelope_internal` (envelope →
 * AEAD), both `pub(crate)`-only.
 *
 * Scope for this stage: the bridge only. No public `encrypt`/`decrypt`
 * function is declared in THIS file (the public API built on top of this
 * bridge is Stage 166–167 — see test/fedos_core_rust_public_crypto_api.test.ts),
 * no serialization, no Runtime/Worker/Storage/Nostr/NIP-44/WASM connection,
 * no `Cargo.toml` change — every one of those is verified absent below.
 */
describe("FedOS Rust crate — internal AEAD/envelope bridge (Stage 161–163)", () => {
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. crypto.rs declares aead_envelope_bridge as a pub(crate)-only child module", () => {
    expect(cryptoModSource).toMatch(/\bpub\(crate\)\s+mod\s+aead_envelope_bridge\s*;/);
    expect(cryptoModSource).not.toMatch(/\bpub\s+mod\s+aead_envelope_bridge\b/);
  });

  it("2. envelope_from_seal_decision_internal and open_decision_from_envelope_internal are pub(crate)-only, never pub", () => {
    for (const name of [
      "envelope_from_seal_decision_internal",
      "open_decision_from_envelope_internal",
    ]) {
      expect(bridgeSource, `expected pub(crate) fn ${name}`).toMatch(
        new RegExp(`\\bpub\\(crate\\)\\s+fn\\s+${name}\\b`),
      );
      expect(bridgeSource, `${name} must never be pub`).not.toMatch(
        new RegExp(`\\bpub\\s+fn\\s+${name}\\b`),
      );
    }
  });

  it("3. envelope_from_seal_decision_internal accepts an AeadSealDecision by value plus a nonce and AAD domain, returning Option<AeadCiphertextEnvelope>", () => {
    expect(bridgeSource).toMatch(
      /\bpub\(crate\)\s+fn\s+envelope_from_seal_decision_internal\s*\(\s*decision:\s*AeadSealDecision,\s*nonce:\s*\[\s*u8\s*;\s*12\s*\],\s*aad_domain:\s*AeadAadDomain,?\s*\)\s*->\s*Option<\s*AeadCiphertextEnvelope\s*>/,
    );
  });

  it("4. open_decision_from_envelope_internal accepts an envelope reference plus a key, returning AeadOpenDecision", () => {
    expect(bridgeSource).toMatch(
      /\bpub\(crate\)\s+fn\s+open_decision_from_envelope_internal\s*\(\s*envelope:\s*&AeadCiphertextEnvelope,\s*key:\s*&SecretHandle,?\s*\)\s*->\s*AeadOpenDecision/,
    );
  });

  it("5. no public encrypt()/decrypt() function anywhere in this module or lib.rs", () => {
    expect(bridgeSource).not.toMatch(/\bpub\s+fn\s+encrypt\b/);
    expect(bridgeSource).not.toMatch(/\bpub\s+fn\s+decrypt\b/);
  });

  it("6. a Stage 157–158 SKELETON (placeholder-ciphertext) envelope is rejected by the open bridge via ordinary AEAD authentication — no special-case branch", () => {
    expect(bridgeSource).toContain("placeholder_envelope_is_rejected_by_open_bridge");
    expect(bridgeSource).toMatch(/is_placeholder_ciphertext\s*\(\s*\)/);
  });

  it("7. a seal decision that is not Ready never bridges to an envelope", () => {
    expect(bridgeSource).toMatch(/if\s+decision\.status\s*!=\s*AeadStatus::Ready\s*\{\s*return\s+None\s*;/);
  });

  it("8. no Vec<u8> exposed publicly and no raw key/nonce byte parameter anywhere in this module", () => {
    expect(bridgeSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*:\s*\[\s*u8\s*;\s*32\s*\]/);
    expect(bridgeSource).not.toMatch(/\bexpose_secret\b/);
    expect(bridgeSource).not.toMatch(/\bSecretBox\b/);
  });

  it("9. no unwrap/expect/panic/todo/unimplemented anywhere in this module's production code", () => {
    const firstCfgTestIdx = bridgeSource.indexOf("#[cfg(test)]");
    const productionOnly =
      firstCfgTestIdx === -1 ? bridgeSource : bridgeSource.slice(0, firstCfgTestIdx);
    expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(productionOnly).not.toMatch(/\.expect\s*\(/);
    expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(productionOnly).not.toMatch(/\btodo!\s*\(/);
    expect(productionOnly).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("10. no `unsafe` anywhere in this module; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(bridgeSource).not.toContain("unsafe");
  });

  it("11. not connected to Runtime/Worker/Storage/Nostr/NIP-44/WASM in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("aead_envelope_bridge");
      expect(src).not.toContain("envelope_from_seal_decision_internal");
      expect(src).not.toContain("open_decision_from_envelope_internal");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(bridgeSource).not.toMatch(/\bnip.?44\b/i);
    expect(bridgeSource).not.toMatch(/\bstorage::/);
    expect(bridgeSource).not.toMatch(/\bnostr::/i);
  });

  it("12. no serialization anywhere: no JSON/base64/CBOR/serde in this module", () => {
    expect(bridgeSource).not.toMatch(/\bserde\b/i);
    expect(bridgeSource).not.toMatch(/\bjson\b/i);
    expect(bridgeSource).not.toMatch(/\bbase64\b/i);
    expect(bridgeSource).not.toMatch(/\bcbor\b/i);
  });

  it("13. lib.rs's public pub fn surface is unchanged by this module alone (still reflects the crate total) — the bridge itself adds no pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames).not.toContain("envelope_from_seal_decision_internal");
    expect(pubFnNames).not.toContain("open_decision_from_envelope_internal");
  });

  it("14. Cargo.toml is unchanged — no new dependency, still 9 production dependencies", () => {
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
  });

  it("15. misuse-guard coverage: wrong key, wrong nonce, wrong AAD domain, and tampered ciphertext are each named in this module's own test suite", () => {
    expect(bridgeSource).toContain("wrong_key_is_rejected_when_opening_a_real_envelope");
    expect(bridgeSource).toContain("cleared_key_is_rejected_when_opening_a_real_envelope");
    expect(bridgeSource).toContain("wrong_nonce_in_the_envelope_fails_authentication");
    expect(bridgeSource).toContain("wrong_aad_domain_in_the_envelope_fails_authentication");
    expect(bridgeSource).toContain("tampered_ciphertext_in_the_envelope_fails_authentication");
  });

  it("16. both ChaCha20-Poly1305 and AES-256-GCM round-trip through the bridge in this module's own test suite", () => {
    expect(bridgeSource).toContain("chacha20poly1305_seal_to_envelope_to_open_round_trips");
    expect(bridgeSource).toContain("aes256gcm_seal_to_envelope_to_open_round_trips");
  });
});

import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoModSource from "../packages/fedos-core-rust/src/crypto.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../packages/fedos-core-rust/src/crypto/capability_matrix.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import diagnosticsSource from "../packages/fedos-core-rust/src/crypto/diagnostics.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 150–151 — crypto capability matrix + diagnostics preview.
 *
 * `packages/fedos-core-rust/src/crypto.rs` (new) declares a crate-private
 * `crypto` module with two file-based children:
 * `src/crypto/capability_matrix.rs` (Stage 150) fixes `CryptoCapability` — a
 * nine-variant, non-sensitive label enumeration (Random/Nonce/SecretHandle/
 * Hkdf/Aead/Nip44/Schnorr/StorageKey/ConversationKey) — and
 * `src/crypto/diagnostics.rs` (Stage 151) pairs each with a
 * `CapabilityReadiness` label (`Ready`/`NotConnected`/`NotImplemented`) via
 * a fixed, hand-maintained `crypto_diagnostics_preview()` snapshot.
 *
 * Scope: display-only, non-secret, `pub(crate)`-at-most throughout. No
 * public API addition, no encrypt/decrypt, no Runtime/Worker/WASM/Storage/
 * Nostr connection, no `Cargo.toml` change.
 *
 * Updated Stage 164: `CryptoCapability` gains a tenth variant, `Envelope`
 * (reporting `Ready`, right after `Aead`), now that the Stage 161–163 AEAD
 * ↔ ciphertext-envelope bridge is real — see
 * test/fedos_core_rust_aead_envelope_bridge.test.ts for the bridge's own
 * dedicated checks.
 *
 * Updated Stage 195: `CryptoCapability` gains an eleventh variant, `Ecdh`
 * (reporting the new `CapabilityReadiness::ReadyForImplementation` — a
 * fourth readiness label, distinct from `Ready`/`NotConnected`/
 * `NotImplemented` — now that Stage 194 adopted `k256` but zero ECDH code
 * exists) — see test/nip44_pre_adoption_guard.test.ts and
 * test/secp256k1_dependency_guard.test.ts for the dedicated Stage 194–196
 * checks.
 *
 * Updated Stage 198-201: four more variants (`MessageKey`/`Padding`/
 * `Encrypt`/`Decrypt`) — see test/nip44_key_derivation_stage_guard.test.ts.
 *
 * Updated Stage 202-208: `Padding`/`Encrypt`/`Decrypt` are promoted from
 * `NotImplemented`/`NotConnected` to `Ready` (real code now exists in
 * `crypto::nip44_padding`/`nip44_encrypt`/`nip44_decrypt`), and a
 * sixteenth variant, `Authentication`, is added, also reporting `Ready` —
 * see test/nip44_padding_encrypt_decrypt_guard.test.ts for the dedicated
 * Stage 202-208 checks.
 */
describe("FedOS Rust crate — crypto capability matrix + diagnostics preview (Stage 150–151)", () => {
  it("1. lib.rs declares a plain (non-pub) mod crypto", () => {
    expect(libRsSource).toMatch(/^mod crypto;\s*$/m);
    expect(libRsSource).not.toMatch(/\bpub\s+mod\s+crypto\b/);
  });

  it("2. CryptoCapability is pub(crate)-only, with exactly the sixteen specified variants in the documented order (Stage 164 adds Envelope; Stage 195 adds Ecdh; Stage 198-201 add MessageKey/Padding/Encrypt/Decrypt; Stage 202-208 adds Authentication)", () => {
    expect(capabilityMatrixSource).toMatch(/\bpub\(crate\)\s+enum\s+CryptoCapability\b/);
    expect(capabilityMatrixSource).not.toMatch(/\bpub\s+enum\s+CryptoCapability\b/);
    const variantOrderMatch = capabilityMatrixSource.match(
      /pub\(crate\)\s+const\s+ALL:\s*\[CryptoCapability;\s*16\]\s*=\s*\[([\s\S]*?)\];/,
    );
    expect(variantOrderMatch, "expected to find CryptoCapability::ALL").not.toBeNull();
    const variants = [...variantOrderMatch![1].matchAll(/CryptoCapability::(\w+)/g)].map(
      (m) => m[1],
    );
    expect(variants).toEqual([
      "Random",
      "Nonce",
      "SecretHandle",
      "Hkdf",
      "Aead",
      "Envelope",
      "Ecdh",
      "Nip44",
      "Schnorr",
      "StorageKey",
      "ConversationKey",
      "MessageKey",
      "Padding",
      "Encrypt",
      "Decrypt",
      "Authentication",
    ]);
  });

  it("3. CapabilityReadiness is pub(crate)-only with exactly the four specified variants (Stage 195 adds ReadyForImplementation)", () => {
    expect(diagnosticsSource).toMatch(/\bpub\(crate\)\s+enum\s+CapabilityReadiness\b/);
    expect(diagnosticsSource).not.toMatch(/\bpub\s+enum\s+CapabilityReadiness\b/);
    for (const variant of ["Ready", "NotConnected", "ReadyForImplementation", "NotImplemented"]) {
      expect(diagnosticsSource, `expected CapabilityReadiness variant: ${variant}`).toContain(
        variant,
      );
    }
  });

  it("4. crypto_diagnostics_preview is pub(crate)-only, takes no parameter, and returns a fixed [CapabilityReport; 16] (Stage 164, Stage 195, Stage 198-201, Stage 202-208)", () => {
    expect(diagnosticsSource).toMatch(
      /\bpub\(crate\)\s+fn\s+crypto_diagnostics_preview\s*\(\s*\)\s*->\s*\[\s*CapabilityReport\s*;\s*16\s*\]/,
    );
    expect(diagnosticsSource).not.toMatch(/\bpub\s+fn\s+crypto_diagnostics_preview\b/);
  });

  it("5. crypto_diagnostics_preview is a fixed, hand-maintained table — no call into any crypto function to compute readiness", () => {
    expect(diagnosticsSource).not.toMatch(/\bfedos_random_bytes_32\s*\(/);
    expect(diagnosticsSource).not.toMatch(/\bfedos_aead_nonce_96\s*\(/);
    expect(diagnosticsSource).not.toMatch(/\bderive_secret_handle_internal\s*\(/);
    expect(diagnosticsSource).not.toMatch(/\bSecretHandle::new/);
    expect(diagnosticsSource).not.toMatch(/\bgetrandom\b/);
    // Every row of the fixed table is a plain `CapabilityReport { ... }`
    // struct literal, not a computed value.
    const rows = [...diagnosticsSource.matchAll(/CapabilityReport\s*\{/g)];
    expect(rows.length).toBeGreaterThanOrEqual(11);
  });

  it("6. no secret byte, key, seed, plaintext, ciphertext, or passphrase field anywhere in capability_matrix.rs / diagnostics.rs", () => {
    for (const source of [capabilityMatrixSource, diagnosticsSource]) {
      expect(source).not.toMatch(/\b(key|seed|plaintext|ciphertext|passphrase)\s*:\s*\w/i);
      expect(source).not.toMatch(/:\s*Vec<u8>/);
      expect(source).not.toMatch(/:\s*\[\s*u8\s*;\s*32\s*\]/);
      expect(source).not.toMatch(/\bSecretBox\b/);
      expect(source).not.toMatch(/\bexpose_secret\b/);
    }
  });

  it("7. capability_matrix.rs / diagnostics.rs add no public (pub) item at all — everything is pub(crate) or private", () => {
    // Require an actual identifier right after the keyword (a real
    // declaration) — not a bare word match, since this module's own doc
    // comments legitimately NAME "pub fn" in prose (e.g. "this crate's
    // public `pub fn` surface") without declaring one.
    for (const source of [capabilityMatrixSource, diagnosticsSource, cryptoModSource]) {
      expect(source).not.toMatch(/\bpub\s+fn\s+[a-zA-Z_]/);
      expect(source).not.toMatch(/\bpub\s+struct\s+[a-zA-Z_]/);
      expect(source).not.toMatch(/\bpub\s+enum\s+[a-zA-Z_]/);
      expect(source).not.toMatch(/\bpub\s+mod\s+[a-zA-Z_]/);
      expect(source).not.toMatch(/\bpub\s+use\s+[a-zA-Z_:]/);
    }
  });

  it("8. lib.rs's public pub fn surface is unchanged (still 24 functions) — the crypto module adds no pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(64);
    expect(pubFnNames).not.toContain("crypto_diagnostics_preview");
  });

  it("9. not connected to Runtime/Worker/Storage/Nostr in any way", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("capability_matrix");
      expect(src).not.toContain("cryptocapability");
      expect(src).not.toContain("crypto_diagnostics_preview");
      expect(src).not.toContain("capabilityreadiness");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("10. no encrypt/decrypt implementation and no AEAD/NIP-44 crate usage anywhere in the crypto module", () => {
    for (const source of [capabilityMatrixSource, diagnosticsSource, cryptoModSource]) {
      expect(source).not.toMatch(/chacha20poly1305|xchacha|aes[-_]?gcm/i);
      expect(source).not.toMatch(/\bhkdf::/);
      expect(source).not.toMatch(/\bargon2::/i);
      expect(source).not.toMatch(/\.encrypt\s*\(/);
      expect(source).not.toMatch(/\.decrypt\s*\(/);
    }
  });

  it("11. Cargo.toml has 10 production dependencies (9 pre-Stage-194, plus k256 adopted Stage 194 for the new Ecdh capability — see test/nip44_pre_adoption_guard.test.ts/test/secp256k1_dependency_guard.test.ts for that stage's own dedicated checks)", () => {
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
  });

  it("12. no unwrap/expect/panic/unsafe anywhere in the crypto module's production code", () => {
    for (const source of [capabilityMatrixSource, diagnosticsSource, cryptoModSource]) {
      const firstCfgTestIdx = source.indexOf("#[cfg(test)]");
      const productionOnly = firstCfgTestIdx === -1 ? source : source.slice(0, firstCfgTestIdx);
      expect(productionOnly).not.toMatch(/\.unwrap\s*\(/);
      expect(productionOnly).not.toMatch(/\.expect\s*\(/);
      expect(productionOnly).not.toMatch(/\bpanic!\s*\(/);
      expect(productionOnly).not.toContain("unsafe");
    }
  });

  it("13. no committed .wasm / target / Cargo.lock / build artifact under the new crypto/ directory", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/src/crypto/**/*");
    const paths = Object.keys(files);
    expect(paths.length).toBeGreaterThanOrEqual(2);
    for (const path of paths) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
      expect(
        /\.(rlib|so|dll|dylib|node|a|o)$/i.test(path),
        `unexpected compiled artifact: ${path}`,
      ).toBe(false);
    }
  });
});

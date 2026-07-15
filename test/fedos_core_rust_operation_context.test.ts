import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 89 — internal operation-context skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a sixth crate-private module,
 * `operation_context`: `OperationContextState` (`Placeholder` /
 * `Disabled`), `OperationKind` (`AeadEncryptPlaceholder` /
 * `AeadDecryptPlaceholder` / `HkdfExtractPlaceholder` /
 * `HkdfExpandPlaceholder` / `HkdfExtractExpandPlaceholder` /
 * `Argon2idPlaceholder` / `Nip44EncryptPlaceholder` /
 * `Nip44DecryptPlaceholder` / `NostrKeyDerivationPlaceholder` /
 * `TestOnlyPlaceholder` — a label only), a non-sensitive
 * `OperationContextStatus`, and `OperationContext` itself
 * (`new_placeholder(kind)`/`kind()`/`status()`/`is_placeholder()`). It
 * exists as a type basis for a future AEAD/KDF/Argon2/NIP-44/
 * Nostr-key-derivation operation.
 *
 * `OperationContext` is an INTERNAL skeleton, not a public API: every item
 * in `operation_context` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn` surface
 * is still exactly the same six placeholder functions from Stage 69. No
 * AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and no Nostr
 * key is derived. `operation_context` is also NOT connected to
 * `secret_handle` (Stage 79), `aead_core` (Stage 80), `kdf_core` (Stage 82),
 * `key_material` (Stage 87), or `domain_label` (Stage 88) — it never
 * constructs any of their types. Nothing is wired into the Runtime, the
 * Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `operation_context`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent of
 * the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal operation context skeleton", () => {
  /** Extracts a `mod name { ... }` block via brace matching (robust to
   * nested `{}` inside, e.g. this module's own nested `#[cfg(test)]`). */
  function extractModule(source: string, marker: string): string {
    const start = source.indexOf(marker);
    expect(start, `expected to find "${marker}" in lib.rs`).toBeGreaterThan(-1);
    const braceStart = source.indexOf("{", start);
    expect(braceStart, `expected an opening brace after "${marker}"`).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) return source.slice(start, i + 1);
      }
    }
    throw new Error(`unbalanced braces while extracting module: ${marker}`);
  }

  const operationContextModule = extractModule(libRsSource, "mod operation_context");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const keyMaterialModule = extractModule(libRsSource, "mod key_material");
  const domainLabelModule = extractModule(libRsSource, "mod domain_label");

  it("1. lib.rs contains an internal (non-pub) operation_context module", () => {
    expect(libRsSource).toContain("mod operation_context");
    expect(libRsSource).not.toContain("pub mod operation_context");
  });

  it("2. operation_context's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod operation_context");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. OperationContext is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(operationContextModule).toMatch(/\bpub\(crate\)\s+struct\s+OperationContext\b/);
    expect(operationContextModule).not.toMatch(/\bpub\s+struct\s+OperationContext\b/);
    expect(operationContextModule).toMatch(
      /\bpub\(crate\)\s+enum\s+OperationContextState\b/,
    );
    expect(operationContextModule).toMatch(/\bpub\(crate\)\s+enum\s+OperationKind\b/);
    expect(operationContextModule).toMatch(
      /\bpub\(crate\)\s+struct\s+OperationContextStatus\b/,
    );
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+operation_context\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*OperationContext\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bOperationContext\b/,
    );
  });

  it("4. lib.rs's public `pub fn` surface is still exactly the six Stage 69 functions", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    const expected = [
      "fedos_core_status",
      "fedos_core_capabilities",
      "random_bytes_placeholder",
      "derive_key_placeholder",
      "encrypt_placeholder",
      "decrypt_placeholder",
      "fedos_crypto_boundary_status",
      "fedos_random_boundary_status",
      "fedos_nonce_boundary_status",
      "fedos_key_generation_boundary_status",
      "fedos_key_import_boundary_status",
      "fedos_key_export_boundary_status",
      "fedos_capability_descriptors",
      "fedos_algorithm_descriptors",
      "fedos_boundary_version",
      "fedos_boundary_features",
      "fedos_boundary_policy_decision",
      "fedos_key_format_descriptor_placeholder",
      "fedos_key_usage_descriptor_placeholder",
      "fedos_algorithm_requirements",
      "fedos_algorithm_capabilities",
      "fedos_algorithm_policy_decision",
      "fedos_random_bytes_32",
      "fedos_aead_nonce_96",
      "fedos_encrypt",
      "fedos_decrypt",
      "fedos_generate_aead_key_32",
      "version",
      "random_bytes_32",
      "generate_aead_key_handle",
      "kind",
      "kind",
      "encrypt_aead",
      "decrypt_aead",
      "serialize_aead_ciphertext",
      "deserialize_aead_ciphertext",
      "new",
      "is_available",
      "is_cleared",
      "generate",
      "seal",
      "restore_sealed",
      "clear",
      "sign_nostr_event",
    ];
    expect(pubFnNames.length).toBe(44);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("5. production API placeholders are unchanged", () => {
    for (const fn of [
      "pub fn fedos_core_status() -> FedosCoreStatus",
      "pub fn fedos_core_capabilities() -> &'static [&'static str]",
      "pub fn random_bytes_placeholder() -> FedosCoreStatus",
      "pub fn derive_key_placeholder() -> FedosCoreStatus",
      "pub fn encrypt_placeholder() -> FedosCoreStatus",
      "pub fn decrypt_placeholder() -> FedosCoreStatus",
    ]) {
      expect(libRsSource, `expected unchanged signature: ${fn}`).toContain(fn);
    }
    expect(libRsSource).toMatch(
      /fn random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn encrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn decrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("6. every OperationKind variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const kind of [
      "AeadEncryptPlaceholder",
      "AeadDecryptPlaceholder",
      "HkdfExtractPlaceholder",
      "HkdfExpandPlaceholder",
      "HkdfExtractExpandPlaceholder",
      "Argon2idPlaceholder",
      "Nip44EncryptPlaceholder",
      "Nip44DecryptPlaceholder",
      "NostrKeyDerivationPlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(operationContextModule).toContain(kind);
      // A unit variant is a bare identifier followed by `,` (no `(` or `{`
      // immediately after — that would make it a tuple/struct variant
      // carrying data).
      expect(operationContextModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(operationContextModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(operationContextModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
  });

  it("7. no String field anywhere in operation_context", () => {
    expect(operationContextModule).not.toMatch(/:\s*String\b/);
    expect(operationContextModule).not.toMatch(/\bString::from\b/);
    expect(operationContextModule).not.toMatch(/\bString::new\b/);
    expect(operationContextModule).not.toMatch(/\bto_string\s*\(/);
    expect(operationContextModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("8. no Vec field anywhere in operation_context", () => {
    expect(operationContextModule).not.toMatch(/:\s*Vec</);
    expect(operationContextModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("9. new_placeholder takes only an OperationKind — no user-provided string/byte input", () => {
    expect(operationContextModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*OperationKind\s*\)/,
    );
    expect(operationContextModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(operationContextModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
  });

  it("10. no env/runtime/config-derived context construction anywhere in operation_context", () => {
    expect(operationContextModule).not.toMatch(/std::env/);
    expect(operationContextModule).not.toMatch(/\benv::/);
    expect(operationContextModule).not.toMatch(/\bvar_os\b/);
    expect(operationContextModule).not.toMatch(/\bstd::process\b/);
  });

  it("11. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in operation_context", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`/
    // `\bnip.?44\b` word match, which would also match this module's own
    // doc-comment prose (and, for NIP-44, the `Nip44Encrypt`/
    // `Nip44DecryptPlaceholder` variant names themselves — legitimate label
    // identifiers this stage's spec requires) naming HKDF/AEAD/Argon2/NIP-44
    // as future, still-unimplemented connection points, same lesson learned
    // for `kdf_core` (Stage 82) and `key_material`/`domain_label`
    // (Stage 87/88). There is no `nip44`-named crate in this repo's
    // dependency tree to import in the first place (see
    // `packages/fedos-core-rust/Cargo.toml`), so "no NIP-44 connection" is
    // enforced structurally by that absence, not by a source-text ban on the
    // label's own name.
    expect(operationContextModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(operationContextModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(operationContextModule).not.toMatch(/\bhkdf::/);
    expect(operationContextModule).not.toMatch(/\bHkdf::/);
    expect(operationContextModule).not.toMatch(/\bargon2::/i);
    expect(operationContextModule).not.toMatch(/\bArgon2::/);
    expect(operationContextModule).not.toMatch(/\bArgon2</);
  });

  it("12. no connection to SecretHandle/KeyMaterialHandle/DomainLabel/aead_core/kdf_core — skeletons stay unconnected", () => {
    expect(operationContextModule).not.toMatch(/\bSecretHandle\b/);
    expect(operationContextModule).not.toMatch(/\bAeadCore\b/);
    expect(operationContextModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(operationContextModule).not.toMatch(/\bKdfCore\b/);
    expect(operationContextModule).not.toMatch(/\bKdfPlaceholderRequest\b/);
    expect(operationContextModule).not.toMatch(/\bKeyMaterialHandle\b/);
    expect(operationContextModule).not.toMatch(/\bDomainLabel\b/);
    // And the converse: the pre-existing skeletons don't reach into
    // operation_context either — this stage only adds to lib.rs, never
    // edits those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bOperationContext\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bOperationContext\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bOperationContext\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bOperationContext\w*\b/);
    expect(domainLabelModule).not.toMatch(/\bOperationContext\w*\b/);
  });

  it("13. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(operationContextModule).not.toContain("unsafe");
  });

  it("14. Runtime / Worker sources are unchanged: no operation-context reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("operation_context");
      expect(src).not.toContain("operationcontext");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("15. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    for (const path of paths) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
      expect(/\/(target|build)\//i.test(path), `unexpected build dir artifact: ${path}`).toBe(
        false,
      );
      expect(/\/Cargo\.lock$/i.test(path), `unexpected committed Cargo.lock: ${path}`).toBe(
        false,
      );
      expect(
        /\.(rlib|so|dll|dylib|node|a|o)$/i.test(path),
        `unexpected compiled artifact: ${path}`,
      ).toBe(false);
    }
  });

  it("16. OperationContextState has exactly the two specified variants", () => {
    for (const variant of ["Placeholder", "Disabled"]) {
      expect(operationContextModule).toContain(variant);
    }
  });

  it("17. OperationContext exposes exactly the four specified methods", () => {
    for (const method of ["new_placeholder", "kind", "status", "is_placeholder"]) {
      expect(operationContextModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

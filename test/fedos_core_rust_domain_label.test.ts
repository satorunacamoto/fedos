import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 88 — internal domain-separation-label skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a fifth crate-private module,
 * `domain_label`: `DomainLabelState` (`Placeholder` / `Disabled`),
 * `DomainLabelKind` (`FedosMasterPlaceholder` / `AeadKeyPlaceholder` /
 * `KdfOutputPlaceholder` / `NostrKeyPlaceholder` / `Nip44Placeholder` /
 * `TestOnlyPlaceholder` — a label identity only), a non-sensitive
 * `DomainLabelStatus`, and `DomainLabel` itself
 * (`new_placeholder(kind)`/`kind()`/`status()`/`as_static_label()`). Every
 * label `as_static_label()` can return is a fixed `&'static str` literal
 * chosen at compile time — never a user-, environment-, or config-derived
 * string, and never built/formatted/concatenated at runtime.
 *
 * `DomainLabel` is an INTERNAL skeleton, not a public API: every item in
 * `domain_label` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn` surface
 * is still exactly the same six placeholder functions from Stage 69. No
 * HKDF/AEAD/NIP-44 operation is implemented or called, and no Nostr key is
 * derived. `domain_label` is also NOT connected to `secret_handle` (Stage
 * 79), `aead_core` (Stage 80), `kdf_core` (Stage 82), or `key_material`
 * (Stage 87) — it never constructs any of their types. Nothing is wired
 * into the Runtime, the Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `domain_label`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent of
 * the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal domain label skeleton", () => {
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

  const domainLabelModule = extractModule(libRsSource, "mod domain_label");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const keyMaterialModule = extractModule(libRsSource, "mod key_material");

  it("1. lib.rs contains an internal (non-pub) domain_label module", () => {
    expect(libRsSource).toContain("mod domain_label");
    expect(libRsSource).not.toContain("pub mod domain_label");
  });

  it("2. domain_label's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod domain_label");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. DomainLabel is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(domainLabelModule).toMatch(/\bpub\(crate\)\s+struct\s+DomainLabel\b/);
    expect(domainLabelModule).not.toMatch(/\bpub\s+struct\s+DomainLabel\b/);
    expect(domainLabelModule).toMatch(/\bpub\(crate\)\s+enum\s+DomainLabelState\b/);
    expect(domainLabelModule).toMatch(/\bpub\(crate\)\s+enum\s+DomainLabelKind\b/);
    expect(domainLabelModule).toMatch(/\bpub\(crate\)\s+struct\s+DomainLabelStatus\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+domain_label\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*DomainLabel\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bDomainLabel\b/);
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
    ];
    expect(pubFnNames.length).toBe(33);
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

  it("6. every DomainLabelKind label is a fixed static string literal, matching the documented table", () => {
    const expectedLabels = [
      "fedos:placeholder:master",
      "fedos:placeholder:aead-key",
      "fedos:placeholder:kdf-output",
      "fedos:placeholder:nostr-key",
      "fedos:placeholder:nip44",
      "fedos:placeholder:test-only",
    ];
    for (const label of expectedLabels) {
      expect(domainLabelModule).toContain(`"${label}"`);
    }
    // The label table lives inside a `const fn` — a compile-time-evaluable
    // function, itself evidence there is no runtime string construction.
    expect(domainLabelModule).toMatch(/\bconst\s+fn\s+as_static_label\b/);
    expect(domainLabelModule).toMatch(/->\s*&'static\s+str\b/);
  });

  it("7. no String field anywhere in domain_label", () => {
    expect(domainLabelModule).not.toMatch(/:\s*String\b/);
    expect(domainLabelModule).not.toMatch(/\bString::from\b/);
    expect(domainLabelModule).not.toMatch(/\bString::new\b/);
    expect(domainLabelModule).not.toMatch(/\bto_string\s*\(/);
    expect(domainLabelModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("8. no Vec field anywhere in domain_label", () => {
    expect(domainLabelModule).not.toMatch(/:\s*Vec</);
    expect(domainLabelModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("9. new_placeholder takes only a DomainLabelKind — no user-provided string/byte input", () => {
    expect(domainLabelModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*DomainLabelKind\s*\)/,
    );
    expect(domainLabelModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(domainLabelModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
  });

  it("10. no env/runtime/config-derived label construction anywhere in domain_label", () => {
    expect(domainLabelModule).not.toMatch(/std::env/);
    expect(domainLabelModule).not.toMatch(/\benv::/);
    expect(domainLabelModule).not.toMatch(/\bvar_os\b/);
    expect(domainLabelModule).not.toMatch(/\bstd::process\b/);
  });

  it("11. no connection to secret_handle/aead_core/kdf_core/key_material — skeletons stay unconnected", () => {
    expect(domainLabelModule).not.toMatch(/\bSecretHandle\b/);
    expect(domainLabelModule).not.toMatch(/\bAeadCore\b/);
    expect(domainLabelModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(domainLabelModule).not.toMatch(/\bKdfCore\b/);
    expect(domainLabelModule).not.toMatch(/\bKdfPlaceholderRequest\b/);
    expect(domainLabelModule).not.toMatch(/\bKeyMaterialHandle\b/);
    // No HKDF/AEAD implementation reference either — specific Rust-usage
    // patterns only, not a bare word match (this module's own doc comment
    // legitimately names HKDF/AEAD/NIP-44 in prose as future connection
    // points it does NOT implement).
    expect(domainLabelModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(domainLabelModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(domainLabelModule).not.toMatch(/\bhkdf::/);
    expect(domainLabelModule).not.toMatch(/\bHkdf::/);
    expect(domainLabelModule).not.toMatch(/\bargon2::/i);
    expect(domainLabelModule).not.toMatch(/\bArgon2::/);
    // And the converse: the pre-existing skeletons don't reach into
    // domain_label either — this stage only adds to lib.rs, never edits
    // those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bDomainLabel\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bDomainLabel\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bDomainLabel\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bDomainLabel\w*\b/);
  });

  it("12. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(domainLabelModule).not.toContain("unsafe");
  });

  it("13. Runtime / Worker sources are unchanged: no domain-label reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("domain_label");
      expect(src).not.toContain("domainlabel");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("14. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("15. DomainLabelState has exactly the two specified variants; DomainLabelKind has exactly the six specified variants", () => {
    for (const variant of ["Placeholder", "Disabled"]) {
      expect(domainLabelModule).toContain(variant);
    }
    for (const kind of [
      "FedosMasterPlaceholder",
      "AeadKeyPlaceholder",
      "KdfOutputPlaceholder",
      "NostrKeyPlaceholder",
      "Nip44Placeholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(domainLabelModule).toContain(kind);
    }
  });

  it("16. DomainLabel exposes exactly the four specified methods", () => {
    for (const method of ["new_placeholder", "kind", "status", "as_static_label"]) {
      expect(domainLabelModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

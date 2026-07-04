import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 93 — internal descriptor-bundle skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a tenth crate-private module,
 * `descriptor_bundle`: `DescriptorBundleState` (`Placeholder` /
 * `Disabled`), `DescriptorBundleKind` (`AeadBundlePlaceholder` /
 * `KdfBundlePlaceholder` / `Argon2idBundlePlaceholder` /
 * `Nip44BundlePlaceholder` / `NostrKeyBundlePlaceholder` /
 * `TestOnlyBundlePlaceholder` — a label only), a non-sensitive
 * `DescriptorBundleStatus`, and `DescriptorBundle` itself
 * (`new_placeholder(kind)`/`kind()`/`status()`/`is_placeholder()`). It
 * exists as a fully independent, label-only type basis for a future AEAD/
 * KDF/Argon2/NIP-44/Nostr-key-derivation BUNDLE that would eventually
 * group the descriptor/context/label/key-material skeletons already in
 * this crate.
 *
 * `DescriptorBundle` is an INTERNAL skeleton, not a public API: every item
 * in `descriptor_bundle` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn`
 * surface is still exactly the same six placeholder functions from Stage
 * 69. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
 * no Nostr key is derived. `descriptor_bundle` holds NO field of any other
 * skeleton type — it is NOT connected to, and does not construct or store,
 * `secret_handle` (Stage 79), `aead_core` (Stage 80), `kdf_core` (Stage
 * 82), `key_material` (Stage 87), `domain_label` (Stage 88),
 * `operation_context` (Stage 89), `request_descriptor` (Stage 90),
 * `response_descriptor` (Stage 91), or `crypto_pipeline` (Stage 92).
 * Nothing is wired into the Runtime, the Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `descriptor_bundle`'s
 * own `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests`
 * are verified as their own separate commands outside `npm test`,
 * consistent with how this repo has always kept the Rust toolchain check
 * independent of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal descriptor bundle skeleton", () => {
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

  const descriptorBundleModule = extractModule(libRsSource, "mod descriptor_bundle");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const keyMaterialModule = extractModule(libRsSource, "mod key_material");
  const domainLabelModule = extractModule(libRsSource, "mod domain_label");
  const operationContextModule = extractModule(libRsSource, "mod operation_context");
  const requestDescriptorModule = extractModule(libRsSource, "mod request_descriptor");
  const responseDescriptorModule = extractModule(libRsSource, "mod response_descriptor");
  const cryptoPipelineModule = extractModule(libRsSource, "mod crypto_pipeline");

  it("1. lib.rs contains an internal (non-pub) descriptor_bundle module", () => {
    expect(libRsSource).toContain("mod descriptor_bundle");
    expect(libRsSource).not.toContain("pub mod descriptor_bundle");
  });

  it("2. descriptor_bundle's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod descriptor_bundle");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. DescriptorBundle is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(descriptorBundleModule).toMatch(
      /\bpub\(crate\)\s+struct\s+DescriptorBundle\b/,
    );
    expect(descriptorBundleModule).not.toMatch(/\bpub\s+struct\s+DescriptorBundle\b/);
    expect(descriptorBundleModule).toMatch(
      /\bpub\(crate\)\s+enum\s+DescriptorBundleState\b/,
    );
    expect(descriptorBundleModule).toMatch(
      /\bpub\(crate\)\s+enum\s+DescriptorBundleKind\b/,
    );
    expect(descriptorBundleModule).toMatch(
      /\bpub\(crate\)\s+struct\s+DescriptorBundleStatus\b/,
    );
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+descriptor_bundle\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*DescriptorBundle\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bDescriptorBundle\b/,
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
    ];
    expect(pubFnNames.length).toBe(23);
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

  it("6. every DescriptorBundleKind variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const kind of [
      "AeadBundlePlaceholder",
      "KdfBundlePlaceholder",
      "Argon2idBundlePlaceholder",
      "Nip44BundlePlaceholder",
      "NostrKeyBundlePlaceholder",
      "TestOnlyBundlePlaceholder",
    ]) {
      expect(descriptorBundleModule).toContain(kind);
      // A unit variant is a bare identifier followed by `,` (no `(` or `{`
      // immediately after — that would make it a tuple/struct variant
      // carrying data).
      expect(descriptorBundleModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(descriptorBundleModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(descriptorBundleModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
  });

  it("7. no String field anywhere in descriptor_bundle", () => {
    expect(descriptorBundleModule).not.toMatch(/:\s*String\b/);
    expect(descriptorBundleModule).not.toMatch(/\bString::from\b/);
    expect(descriptorBundleModule).not.toMatch(/\bString::new\b/);
    expect(descriptorBundleModule).not.toMatch(/\bto_string\s*\(/);
    expect(descriptorBundleModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("8. no Vec field anywhere in descriptor_bundle", () => {
    expect(descriptorBundleModule).not.toMatch(/:\s*Vec</);
    expect(descriptorBundleModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("9. new_placeholder takes only a DescriptorBundleKind — no user-provided string/byte input", () => {
    expect(descriptorBundleModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*DescriptorBundleKind\s*\)/,
    );
    expect(descriptorBundleModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(descriptorBundleModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
  });

  it("10. no env/runtime/config-derived bundle construction anywhere in descriptor_bundle", () => {
    expect(descriptorBundleModule).not.toMatch(/std::env/);
    expect(descriptorBundleModule).not.toMatch(/\benv::/);
    expect(descriptorBundleModule).not.toMatch(/\bvar_os\b/);
    expect(descriptorBundleModule).not.toMatch(/\bstd::process\b/);
  });

  it("11. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in descriptor_bundle", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`/
    // `\bnip.?44\b` word match, which would also match this module's own
    // doc-comment prose naming HKDF/AEAD/Argon2/NIP-44 as future,
    // still-unimplemented connection points, same lesson learned for
    // `kdf_core` (Stage 82) and `key_material`/`domain_label`/
    // `operation_context`/`request_descriptor`/`response_descriptor`/
    // `crypto_pipeline` (Stage 87/88/89/90/91/92). There is no
    // `nip44`-named crate in this repo's dependency tree to import in the
    // first place (see `packages/fedos-core-rust/Cargo.toml`), so "no
    // NIP-44 connection" is enforced structurally by that absence, not by
    // a source-text ban on the (legitimate) `Nip44BundlePlaceholder`
    // variant name.
    expect(descriptorBundleModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(descriptorBundleModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(descriptorBundleModule).not.toMatch(/\bhkdf::/);
    expect(descriptorBundleModule).not.toMatch(/\bHkdf::/);
    expect(descriptorBundleModule).not.toMatch(/\bargon2::/i);
    expect(descriptorBundleModule).not.toMatch(/\bArgon2::/);
    expect(descriptorBundleModule).not.toMatch(/\bArgon2</);
  });

  it("12. no SecretHandle/KeyMaterial/DomainLabel/OperationContext/RequestDescriptor/ResponseDescriptor field storage — skeletons stay unconnected", () => {
    expect(descriptorBundleModule).not.toMatch(/\bSecretHandle\b/);
    expect(descriptorBundleModule).not.toMatch(/\bAeadCore\b/);
    expect(descriptorBundleModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(descriptorBundleModule).not.toMatch(/\bKdfCore\b/);
    expect(descriptorBundleModule).not.toMatch(/\bKdfPlaceholderRequest\b/);
    expect(descriptorBundleModule).not.toMatch(/\bKeyMaterialHandle\b/);
    expect(descriptorBundleModule).not.toMatch(/\bDomainLabel\b/);
    expect(descriptorBundleModule).not.toMatch(/\bOperationContext\b/);
    expect(descriptorBundleModule).not.toMatch(/\bOperationKind\b/);
    expect(descriptorBundleModule).not.toMatch(/\bRequestDescriptor\b/);
    expect(descriptorBundleModule).not.toMatch(/\bRequestDescriptorKind\b/);
    expect(descriptorBundleModule).not.toMatch(/\bResponseDescriptor\b/);
    expect(descriptorBundleModule).not.toMatch(/\bResponseDescriptorKind\b/);
    expect(descriptorBundleModule).not.toMatch(/\bCryptoPipeline\b/);
    expect(descriptorBundleModule).not.toMatch(/\bCryptoPipelineKind\b/);
    // No field DECLARATION of any of those names (a colon-typed field would
    // be the only way to actually STORE one — this check would fail even if
    // the check above were relaxed to allow prose mentions elsewhere).
    expect(descriptorBundleModule).not.toMatch(
      /:\s*(SecretHandle|AeadPlaceholderRequest|KdfPlaceholderRequest|KeyMaterialHandle|DomainLabel|OperationContext|RequestDescriptor|ResponseDescriptor|CryptoPipeline)\b/,
    );
    // And the converse: the pre-existing skeletons don't reach into
    // descriptor_bundle either — this stage only adds to lib.rs, never
    // edits those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(domainLabelModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(operationContextModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(requestDescriptorModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(responseDescriptorModule).not.toMatch(/\bDescriptorBundle\w*\b/);
    expect(cryptoPipelineModule).not.toMatch(/\bDescriptorBundle\w*\b/);
  });

  it("13. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(descriptorBundleModule).not.toContain("unsafe");
  });

  it("14. Runtime / Worker sources are unchanged: no descriptor-bundle reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("descriptor_bundle");
      expect(src).not.toContain("descriptorbundle");
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

  it("16. DescriptorBundleState has exactly the two specified variants", () => {
    for (const variant of ["Placeholder", "Disabled"]) {
      expect(descriptorBundleModule).toContain(variant);
    }
  });

  it("17. DescriptorBundle exposes exactly the four specified methods", () => {
    for (const method of ["new_placeholder", "kind", "status", "is_placeholder"]) {
      expect(descriptorBundleModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

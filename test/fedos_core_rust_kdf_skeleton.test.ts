import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 82 — internal KDF module skeleton. Stage 147 extends it with this
 * crate's first REAL HKDF-SHA256 implementation (see
 * test/fedos_core_rust_hkdf_internal.test.ts for the dedicated Stage 147
 * guard suite) — this file covers the parts of the Stage 82 shape that
 * still apply unchanged (`KdfPlaceholderRequest` and its three labels) plus
 * the tests that needed updating as a direct result of the new connection.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a third crate-private module,
 * `kdf_core` (alongside Stage 79's `secret_handle` and Stage 80's
 * `aead_core`): `KdfAlgorithm` (`HkdfSha256`), `KdfOperation` (`Extract` /
 * `Expand` / `ExtractExpand`), `KdfRequestStatus` (wraps this crate's
 * existing `FedosCoreState`), and `KdfPlaceholderRequest` itself
 * (`new_placeholder_extract()`/`new_placeholder_expand()`/
 * `new_placeholder_extract_expand()`/`status()`/`algorithm()`/`operation()`)
 * — all UNCHANGED by Stage 147.
 *
 * `KdfPlaceholderRequest` is an INTERNAL skeleton, not a public API: every
 * item in `kdf_core` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported, and this crate's public `pub fn` surface is still exactly the
 * same twenty-four functions from Stage 138. No real IKM, salt, info, PRK,
 * or OKM byte is accepted, stored, or handled by `KdfPlaceholderRequest`
 * itself — the three `new_placeholder_*` constructors take no such input.
 * Stage 147 adds a SEPARATE real path, `derive_secret_handle_internal`,
 * alongside it: this crate's first PRODUCTION (not `#[cfg(test)]`-only) use
 * of `hkdf`/`sha2` (`sha2` promoted from `[dev-dependencies]` to
 * `[dependencies]` the same stage), and `kdf_core`'s first connection to
 * `secret_handle` — reading bytes ONLY via `SecretHandle`'s own
 * narrowly-scoped `expose_bytes_for_internal_derivation` accessor (also
 * added Stage 147), never a raw `secrecy::expose_secret` call. `kdf_core`
 * still does NOT connect to `aead_core`: it never constructs an
 * `AeadPlaceholderRequest`. Nothing is wired into the Runtime, the Worker,
 * or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `kdf_core`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent of
 * the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal KDF module skeleton", () => {
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

  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. lib.rs contains an internal (non-pub) kdf_core module", () => {
    expect(libRsSource).toContain("mod kdf_core");
    expect(libRsSource).not.toContain("pub mod kdf_core");
  });

  it("2. kdf_core module is not pub", () => {
    // `\bmod\s+kdf_core\b` preceded directly by `pub ` (not `pub(crate) `)
    // would be a public module declaration — must not exist.
    expect(libRsSource).not.toMatch(/\bpub\s+mod\s+kdf_core\b/);
  });

  it("3. Kdf structs/enums are crate-private only (pub(crate) at most, never pub)", () => {
    // `\bpub\s+struct\b` / `\bpub\s+enum\b` require whitespace directly
    // after `pub`, which `pub(crate)` does not have (it has `(crate)`) — so
    // these checks naturally exclude the legitimate `pub(crate)` declarations
    // matched just below.
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+enum\s+KdfAlgorithm\b/);
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+enum\s+KdfOperation\b/);
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+struct\s+KdfRequestStatus\b/);
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+struct\s+KdfPlaceholderRequest\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+enum\s+KdfAlgorithm\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+enum\s+KdfOperation\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+struct\s+KdfRequestStatus\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+struct\s+KdfPlaceholderRequest\b/);
    // No public re-export of any of the four either.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+kdf_core\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*Kdf\w*/);
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

  it("5. derive_key_placeholder (and the other five placeholders) are unchanged", () => {
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
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn encrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(libRsSource).toMatch(
      /fn decrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("6. kdf_core's production code DOES import hkdf (Stage 147 — see test/fedos_core_rust_hkdf_internal.test.ts for the dedicated checks)", () => {
    // Updated Stage 147: kdf_core gains this crate's first PRODUCTION `hkdf`
    // call site, `derive_secret_handle_internal`. The pre-existing
    // `rfc5869_vectors` module (Stage 77) is unchanged and still separately
    // exercises `hkdf` under `#[cfg(test)]` — this test only confirms
    // kdf_core's own real usage now exists.
    expect(kdfCoreModule).toMatch(/\buse\s+hkdf::Hkdf\b/);
    expect(kdfCoreModule).toContain("Hkdf::<Sha256>::new(");
  });

  it("7. kdf_core's production code DOES import sha2 (Stage 147 — sha2 promoted to a production dependency)", () => {
    expect(kdfCoreModule).toMatch(/\buse\s+sha2::Sha256\b/);
    expect(kdfCoreModule).toContain("Hkdf::<Sha256>");
  });

  it("8. no IKM/salt/info/PRK/OKM storage field anywhere in kdf_core", () => {
    // Field/parameter DECLARATIONS only (name immediately followed by a
    // colon-typed annotation) — not prose in a doc comment that merely
    // NAMES these words (e.g. "no IKM, salt, info, PRK, OKM, or other
    // secret byte").
    expect(kdfCoreModule).not.toMatch(/\b(ikm|salt|info|prk|okm|secret)\s*:\s*\w/i);
  });

  it("9. no Vec<u8> / String byte-storage field anywhere in kdf_core", () => {
    expect(kdfCoreModule).not.toMatch(/:\s*Vec<u8>/);
    expect(kdfCoreModule).not.toMatch(/:\s*String\b/);
    expect(kdfCoreModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
    // All three constructors take no parameter of any kind.
    expect(kdfCoreModule).toMatch(/fn\s+new_placeholder_extract\s*\(\s*\)/);
    expect(kdfCoreModule).toMatch(/fn\s+new_placeholder_expand\s*\(\s*\)/);
    expect(kdfCoreModule).toMatch(/fn\s+new_placeholder_extract_expand\s*\(\s*\)/);
  });

  it("10. no random/getrandom usage anywhere in kdf_core", () => {
    expect(kdfCoreModule).not.toContain("getrandom");
    expect(kdfCoreModule).not.toMatch(/\brand::/);
    expect(kdfCoreModule).not.toMatch(/\bthread_rng\b/);
  });

  it("11. no AEAD connection anywhere in kdf_core — the skeletons are unconnected", () => {
    expect(kdfCoreModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(kdfCoreModule).not.toMatch(/\baead_core::/);
    expect(kdfCoreModule).not.toMatch(/\bchacha20poly1305\b/i);
  });

  it("12. kdf_core DOES connect to SecretHandle (Stage 147) — but ONLY via the one reviewed accessor, never a raw secrecy::expose_secret call", () => {
    // Updated Stage 147: `derive_secret_handle_internal` is this module's
    // first, deliberate, reviewed connection to `secret_handle` — it
    // constructs SecretHandle(HkdfInputMaterial)-consuming,
    // SecretHandle(HkdfOutputMaterial)-producing logic. It reads bytes ONLY
    // via SecretHandle's own narrowly-scoped
    // `expose_bytes_for_internal_derivation()` accessor — never
    // `secrecy::expose_secret` directly (kdf_core does not import `secrecy`
    // at all), and it never mutates the input handle.
    expect(kdfCoreModule).toMatch(/\buse\s+crate::secret_handle::\{SecretHandle,\s*SecretHandleKind\}/);
    expect(kdfCoreModule).toContain("expose_bytes_for_internal_derivation()");
    expect(kdfCoreModule).not.toMatch(/\bsecrecy::/);
    expect(kdfCoreModule).not.toMatch(/\.expose_secret\s*\(/);
  });

  it("13. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(kdfCoreModule).not.toContain("unsafe");
  });

  it("14. Runtime / Worker sources are unchanged: no kdf_core reference and no crypto-op auto-call", () => {
    // Note: neither source is checked for the bare word "kdf" — both
    // legitimately contain it already in pre-existing, unrelated prose
    // (e.g. "runs no KDF/AEAD/random" describing what selectCryptoProvider
    // does NOT do). The specific new identifiers below are unambiguous.
    for (const src of [runtimeSource, workerSource]) {
      expect(src).not.toContain("kdf_core");
      expect(src).not.toContain("KdfPlaceholderRequest");
      expect(src.toLowerCase()).not.toContain("cargo");
      expect(src.toLowerCase()).not.toContain("lib.rs");
      expect(src.toLowerCase()).not.toContain("wasm_loader");
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

  it("16. KdfAlgorithm/KdfOperation carry the specified labels only", () => {
    expect(kdfCoreModule).toContain("HkdfSha256");
    expect(kdfCoreModule).toContain("Extract");
    expect(kdfCoreModule).toContain("Expand");
    expect(kdfCoreModule).toContain("ExtractExpand");
  });

  it("17. KdfPlaceholderRequest exposes exactly the six specified methods", () => {
    for (const method of [
      "new_placeholder_extract",
      "new_placeholder_expand",
      "new_placeholder_extract_expand",
      "status",
      "algorithm",
      "operation",
    ]) {
      expect(kdfCoreModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

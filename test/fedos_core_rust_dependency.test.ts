import { describe, it, expect } from "vitest";
// The Rust crate files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 74 — `chacha20poly1305` dependency adoption tests.
 * Updated Stage 76 — `hkdf` dependency adoption tests.
 * Updated Stage 77 — `sha2` becomes a dev-dependency (test 6 below); RFC 5869
 * HKDF vector wiring itself has its own dedicated test file, see
 * test/fedos_core_rust_hkdf_wiring.test.ts.
 * Updated Stage 78 — `zeroize` / `secrecy` / `subtle` dependency-adoption
 * tests (tests 3–5 below). This trio is adopted together, ahead of any real
 * secret type, as a foundation for a future secret-handle skeleton (Stage 79
 * candidate) — no code anywhere in `src/lib.rs` imports, references, or
 * calls any of the three yet.
 *
 * `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
 * has exactly FIVE entries: `chacha20poly1305` (Stage 74, RustCrypto AEAD,
 * wired to the RFC 8439 vectors under `#[cfg(test)]` in Stage 75), `hkdf`
 * (Stage 76, RustCrypto KDF, wired to the RFC 5869 HKDF-SHA256 vectors at
 * test-vectors/kdf/hkdf-rfc5869.json under `#[cfg(test)]` in Stage 77), and
 * `zeroize` / `secrecy` / `subtle` (Stage 78, secret-handling foundation —
 * no vector to wire, no code path uses them yet). `derive_key_placeholder`
 * is untouched, no random/key is generated, no secret type is defined, no
 * zeroization or constant-time-compare behavior exists, and no other crypto
 * crate (argon2 / aes-gcm / rand / getrandom) or wasm-bindgen is added.
 *
 * `cargo check` (green as of this stage) is verified as its own separate
 * command outside `npm test`, consistent with how this repo has always kept
 * the Rust toolchain check independent of the vitest/TypeScript test run.
 *
 * Update (Stage 75): test 15 below is scoped to lib.rs's PRODUCTION code
 * (everything before the first `#[cfg(test)]`) rather than the whole file,
 * because Stage 75 adds a `#[cfg(test)]`-only module that legitimately
 * imports and calls `chacha20poly1305` to verify it against the RFC 8439
 * vectors — see test/fedos_core_rust_rfc8439_wiring.test.ts for that stage's
 * own dedicated tests. Stage 76 extends the same production-code check to
 * also forbid any `hkdf` usage outside `#[cfg(test)]`. Stage 77 adds a SECOND
 * `#[cfg(test)]`-only module, `rfc5869_vectors`, that legitimately imports and
 * calls `hkdf` — it lands after lib.rs's FIRST `#[cfg(test)]` marker (the
 * pre-existing placeholder tests module), so test 15's slice cutoff still
 * excludes it and the production-code assertion is unaffected. Stage 78 adds
 * NO new `#[cfg(test)]` module (unlike Stage 75/77) — `zeroize`/`secrecy`/
 * `subtle` are not exercised anywhere in `src/lib.rs`, production or test —
 * so tests 12–14 below scan the ENTIRE file, not just the production slice.
 */
describe("FedOS Rust crate — chacha20poly1305 + hkdf + zeroize/secrecy/subtle dependency adoption", () => {
  // TOML comments legitimately NAME both the adopted and the still-forbidden
  // crates; strip comments before scanning so descriptive text never trips a
  // guard (same approach as test/fedos_core_rust_skeleton.test.ts).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  const depsIdx = cargoCode.indexOf("[dependencies]");
  const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
  const productionDepsSection =
    devDepsIdx === -1 ? cargoCode.slice(depsIdx) : cargoCode.slice(depsIdx, devDepsIdx);

  it("1. Cargo.toml contains chacha20poly1305", () => {
    expect(cargoCode).toContain("[dependencies]");
    expect(cargoCode).toContain("chacha20poly1305");
    expect(productionDepsSection).toMatch(/chacha20poly1305\s*=/);
  });

  it("2. Cargo.toml contains hkdf", () => {
    expect(cargoCode).toContain("[dependencies]");
    expect(cargoCode).toContain("hkdf");
    // hkdf is a production dependency, not a dev-dependency: it appears
    // before the [dev-dependencies] header.
    expect(productionDepsSection).toMatch(/\bhkdf\s*=/);
  });

  it("3. Cargo.toml contains zeroize (production dependency, Stage 78)", () => {
    expect(cargoCode).toContain("zeroize");
    expect(productionDepsSection).toMatch(/\bzeroize\s*=/);
  });

  it("4. Cargo.toml contains secrecy (production dependency, Stage 78)", () => {
    expect(cargoCode).toContain("secrecy");
    expect(productionDepsSection).toMatch(/\bsecrecy\s*=/);
  });

  it("5. Cargo.toml contains subtle (production dependency, Stage 78)", () => {
    expect(cargoCode).toContain("subtle");
    expect(productionDepsSection).toMatch(/\bsubtle\s*=/);
  });

  it("6. sha2 remains a dev-dependency only — never production", () => {
    // Stage 77 wires the RFC 5869 HKDF-SHA256 vectors to `cargo test`, which
    // requires a concrete hash algorithm crate to instantiate
    // `Hkdf::<Sha256>`. `sha2` is added, but ONLY under [dev-dependencies] —
    // it is used exclusively by the #[cfg(test)]-only `rfc5869_vectors`
    // module and must never become a production dependency of this crate.
    expect(cargoCode).not.toContain("sha-2");
    expect(productionDepsSection).not.toMatch(/\bsha2\b/);
    expect(cargoCode).toContain("[dev-dependencies]");
    const devDepsSection = cargoCode.slice(devDepsIdx);
    expect(devDepsSection).toMatch(/\bsha2\s*=/);
  });

  it("7. Cargo.toml does not contain argon2", () => {
    expect(cargoCode).not.toContain("argon2");
  });

  it("8. Cargo.toml does not contain aes-gcm", () => {
    expect(cargoCode).not.toContain("aes-gcm");
    expect(cargoCode).not.toContain("aes_gcm");
  });

  it("9. Cargo.toml does not contain rand / getrandom", () => {
    expect(cargoCode).not.toContain("getrandom");
    expect(cargoCode).not.toContain("rand_core");
    expect(cargoCode).not.toMatch(/\brand\b/);
  });

  it("10. Cargo.toml does not contain wasm-bindgen", () => {
    expect(cargoCode).not.toContain("wasm-bindgen");
    expect(cargoCode).not.toContain("wasm_bindgen");
  });

  it("11. crate-type remains rlib only", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*\]/);
    expect(cargoCode).not.toContain("cdylib");
    expect(cargoCode).not.toContain("staticlib");
    expect(cargoCode).not.toContain("wasm32");
  });

  it("12. production lib.rs has no Secret/SecretBox/ExposeSecret usage", () => {
    // Stage 78 adds no #[cfg(test)] module either, so this scans the whole
    // file — `secrecy` is not exercised anywhere, production or test.
    expect(libRsSource).not.toMatch(/\buse\s+secrecy\b/);
    expect(libRsSource).not.toMatch(/\bsecrecy::/);
    expect(libRsSource).not.toMatch(/\bSecretBox\b/);
    expect(libRsSource).not.toMatch(/\bSecret(String|Box|Vec)?\s*[<(]/);
    expect(libRsSource).not.toMatch(/\bExposeSecret\b/);
    expect(libRsSource).not.toMatch(/\bexpose_secret\s*\(/);
  });

  it("13. production lib.rs has no Zeroize derive or zeroize call", () => {
    expect(libRsSource).not.toMatch(/\buse\s+zeroize\b/);
    expect(libRsSource).not.toMatch(/\bzeroize::/);
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*\bZeroize/);
    expect(libRsSource).not.toMatch(/\bZeroizing\b/);
    expect(libRsSource).not.toMatch(/\.zeroize\s*\(\)/);
  });

  it("14. production lib.rs has no ConstantTimeEq/subtle usage", () => {
    expect(libRsSource).not.toMatch(/\buse\s+subtle\b/);
    expect(libRsSource).not.toMatch(/\bsubtle::/);
    expect(libRsSource).not.toMatch(/\bConstantTimeEq\b/);
    expect(libRsSource).not.toMatch(/\bChoice::/);
    expect(libRsSource).not.toMatch(/\.ct_eq\s*\(/);
  });

  it("15. lib.rs's production code implements neither AEAD nor HKDF (placeholder names only, no chacha20poly1305/hkdf usage outside #[cfg(test)])", () => {
    // Stage 75 wires the RFC 8439 vectors to a #[cfg(test)]-only module
    // (see test/fedos_core_rust_rfc8439_wiring.test.ts), which DOES import
    // and call chacha20poly1305 — but only inside #[cfg(test)]. The
    // PRODUCTION code (everything before the first #[cfg(test)]) must still
    // neither import, reference, nor call into chacha20poly1305 (or any
    // other AEAD), exactly as Stage 74 left it — and, as of Stage 76, must
    // likewise neither import, reference, nor call into hkdf.
    const firstCfgTest = libRsSource.indexOf("#[cfg(test)]");
    expect(firstCfgTest).toBeGreaterThan(-1);
    const productionCode = libRsSource.slice(0, firstCfgTest);
    expect(productionCode).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(productionCode).not.toMatch(/\bchacha20poly1305::/);
    expect(productionCode).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(productionCode).not.toMatch(/\buse\s+hkdf\b/);
    expect(productionCode).not.toMatch(/\bhkdf::/i);
    expect(productionCode).not.toMatch(/\bHkdf\b/);
    expect(productionCode).not.toContain("^=");
    // The placeholder entry points still exist (in production code) and
    // still do nothing real — placeholder API unchanged since Stage 69.
    expect(productionCode).toContain("fn fedos_core_status(");
    expect(productionCode).toContain("fn fedos_core_capabilities(");
    expect(productionCode).toContain("fn encrypt_placeholder(");
    expect(productionCode).toContain("fn decrypt_placeholder(");
    expect(productionCode).toContain("fn random_bytes_placeholder(");
    expect(productionCode).toContain("fn derive_key_placeholder(");
  });

  it("16. derive_key_placeholder is unchanged: still a no-op placeholder, no HKDF/secret call", () => {
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("17. lib.rs still has #![forbid(unsafe_code)] and no unsafe usage", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
  });

  it("18. no .wasm file is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    for (const path of Object.keys(files)) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("19. no target/ or build artifacts (including Cargo.lock) are committed", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const forbiddenCompiled = /\.(rlib|so|dll|dylib|node|a|o)$/i;
    const forbiddenDir = /\/(target|build)\//i;
    const forbiddenLock = /\/Cargo\.lock$/i;
    for (const path of paths) {
      expect(forbiddenCompiled.test(path), `unexpected compiled artifact: ${path}`).toBe(false);
      expect(forbiddenDir.test(path), `unexpected build dir artifact: ${path}`).toBe(false);
      // Cargo.lock stays uncommitted (library crate; reproducibility via a
      // lockfile digest is deferred to the future build-manifest stage).
      expect(forbiddenLock.test(path), `unexpected committed Cargo.lock: ${path}`).toBe(false);
    }
  });

  it("20. Runtime / Worker sources are unchanged: no crypto-crate reference and no auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("chacha20poly1305");
      expect(src).not.toContain("hkdf");
      // Note: "zeroize" is NOT checked here — it already appears in a
      // pre-existing, unrelated doc comment in create_runtime.ts ("runs no
      // KDF/AEAD/random/zeroize") describing what selectCryptoProvider does
      // NOT do; that prose predates Stage 78 and is not a crate reference.
      expect(src).not.toContain("secrecy");
      expect(src).not.toContain("subtle::");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    // Neither source calls a crypto operation or a WASM loader's `.load(`.
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });
});

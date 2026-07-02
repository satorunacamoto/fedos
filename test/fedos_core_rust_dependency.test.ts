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
 *
 * `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
 * now has exactly TWO entries: `chacha20poly1305` (Stage 74, RustCrypto AEAD,
 * wired to the RFC 8439 vectors under `#[cfg(test)]` in Stage 75) and `hkdf`
 * (Stage 76, RustCrypto KDF, so a future stage can wire the RFC 5869
 * HKDF-SHA256 vectors at test-vectors/kdf/hkdf-rfc5869.json to `cargo test`).
 * Stage 76 is dependency-adoption + build-check ONLY, exactly like Stage 74:
 * `src/lib.rs`'s production code is unchanged, no HKDF is implemented, no
 * vector is loaded, `derive_key_placeholder` is untouched, no random/key is
 * generated, `sha2` is deliberately NOT added (see test 3 below), and no
 * other crypto crate (argon2 / aes-gcm / rand / getrandom / zeroize / secrecy
 * / subtle) or wasm-bindgen is added.
 *
 * `cargo check` (green as of this stage) is verified as its own separate
 * command outside `npm test`, consistent with how this repo has always kept
 * the Rust toolchain check independent of the vitest/TypeScript test run.
 *
 * Update (Stage 75): test 11 below is scoped to lib.rs's PRODUCTION code
 * (everything before the first `#[cfg(test)]`) rather than the whole file,
 * because Stage 75 adds a `#[cfg(test)]`-only module that legitimately
 * imports and calls `chacha20poly1305` to verify it against the RFC 8439
 * vectors — see test/fedos_core_rust_rfc8439_wiring.test.ts for that stage's
 * own dedicated tests. Stage 76 extends the same production-code check to
 * also forbid any `hkdf` usage outside `#[cfg(test)]` (there is no
 * `#[cfg(test)]` module using `hkdf` yet — that is Stage 77 candidate work).
 */
describe("FedOS Rust crate — chacha20poly1305 + hkdf dependency adoption", () => {
  // TOML comments legitimately NAME both the adopted and the still-forbidden
  // crates; strip comments before scanning so descriptive text never trips a
  // guard (same approach as test/fedos_core_rust_skeleton.test.ts).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. Cargo.toml contains chacha20poly1305", () => {
    expect(cargoCode).toContain("[dependencies]");
    expect(cargoCode).toContain("chacha20poly1305");
    expect(cargoCode).toMatch(/chacha20poly1305\s*=/);
  });

  it("2. Cargo.toml contains hkdf", () => {
    expect(cargoCode).toContain("[dependencies]");
    expect(cargoCode).toContain("hkdf");
    expect(cargoCode).toMatch(/\bhkdf\s*=/);
    // hkdf is a production dependency, not a dev-dependency: it appears
    // before the [dev-dependencies] header.
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection =
      devDepsIdx === -1 ? cargoCode.slice(depsIdx) : cargoCode.slice(depsIdx, devDepsIdx);
    expect(productionDepsSection).toMatch(/\bhkdf\s*=/);
  });

  it("3. Cargo.toml does not contain sha2 — hkdf builds standalone without a concrete digest crate", () => {
    // hkdf depends only on hmac (generic over `digest`), so no concrete hash
    // algorithm crate is required to add hkdf or run `cargo check`. sha2 is
    // deferred to the future stage that actually instantiates
    // `Hkdf::<Sha256>` to wire the RFC 5869 HKDF-SHA256 vectors — see the
    // Cargo.toml comment above the hkdf entry and docs/rust_dependency_adoption.md.
    expect(cargoCode).not.toMatch(/\bsha2\b/);
    expect(cargoCode).not.toContain("sha-2");
  });

  it("4. Cargo.toml does not contain argon2", () => {
    expect(cargoCode).not.toContain("argon2");
  });

  it("5. Cargo.toml does not contain aes-gcm", () => {
    expect(cargoCode).not.toContain("aes-gcm");
    expect(cargoCode).not.toContain("aes_gcm");
  });

  it("6. Cargo.toml does not contain rand / getrandom", () => {
    expect(cargoCode).not.toContain("getrandom");
    expect(cargoCode).not.toContain("rand_core");
    expect(cargoCode).not.toMatch(/\brand\b/);
  });

  it("7. Cargo.toml does not contain zeroize / secrecy / subtle", () => {
    for (const dep of ["zeroize", "secrecy", "subtle"]) {
      expect(cargoCode, `Cargo.toml must not depend on ${dep}`).not.toContain(dep);
    }
  });

  it("8. Cargo.toml does not contain wasm-bindgen", () => {
    expect(cargoCode).not.toContain("wasm-bindgen");
    expect(cargoCode).not.toContain("wasm_bindgen");
  });

  it("9. crate-type remains rlib only", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*\]/);
    expect(cargoCode).not.toContain("cdylib");
    expect(cargoCode).not.toContain("staticlib");
    expect(cargoCode).not.toContain("wasm32");
  });

  it("10. lib.rs still has #![forbid(unsafe_code)] and no unsafe usage", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
  });

  it("11. lib.rs's production code implements neither AEAD nor HKDF (placeholder names only, no chacha20poly1305/hkdf usage outside #[cfg(test)])", () => {
    // Stage 75 wires the RFC 8439 vectors to a #[cfg(test)]-only module
    // (see test/fedos_core_rust_rfc8439_wiring.test.ts), which DOES import
    // and call chacha20poly1305 — but only inside #[cfg(test)]. The
    // PRODUCTION code (everything before the first #[cfg(test)]) must still
    // neither import, reference, nor call into chacha20poly1305 (or any
    // other AEAD), exactly as Stage 74 left it — and, as of Stage 76, must
    // likewise neither import, reference, nor call into hkdf (there is no
    // #[cfg(test)] module using hkdf yet either).
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
    // still do nothing real.
    expect(productionCode).toContain("fn encrypt_placeholder(");
    expect(productionCode).toContain("fn decrypt_placeholder(");
    expect(productionCode).toContain("fn random_bytes_placeholder(");
    expect(productionCode).toContain("fn derive_key_placeholder(");
  });

  it("12. derive_key_placeholder is unchanged: still a no-op placeholder, no HKDF call", () => {
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("13. no .wasm file is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    for (const path of Object.keys(files)) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("14. no target/ or build artifacts (including Cargo.lock) are committed", () => {
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

  it("15. Runtime / Worker sources are unchanged: no crypto-crate reference and no auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("chacha20poly1305");
      expect(src).not.toContain("hkdf");
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

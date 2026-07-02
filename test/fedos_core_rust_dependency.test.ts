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
 *
 * `packages/fedos-core-rust/Cargo.toml` gains exactly ONE dependency,
 * `chacha20poly1305` (RustCrypto), so a future stage can wire the RFC 8439
 * vectors (test-vectors/aead/chacha20poly1305-rfc8439.json) to `cargo test`.
 * This stage is dependency-adoption + build-check ONLY: `src/lib.rs` is
 * unchanged, no crypto is implemented, no vector is loaded, no random/nonce/key
 * is generated, and no other crypto crate (hkdf / argon2 / aes-gcm / rand /
 * getrandom / zeroize / secrecy / subtle) or wasm-bindgen is added.
 *
 * `cargo check` (green as of this stage) is verified as its own separate
 * command outside `npm test`, consistent with how this repo has always kept
 * the Rust toolchain check independent of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — chacha20poly1305 dependency adoption", () => {
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

  it("2. Cargo.toml does not contain hkdf", () => {
    expect(cargoCode).not.toContain("hkdf");
  });

  it("3. Cargo.toml does not contain argon2", () => {
    expect(cargoCode).not.toContain("argon2");
  });

  it("4. Cargo.toml does not contain rand / getrandom", () => {
    expect(cargoCode).not.toContain("getrandom");
    expect(cargoCode).not.toContain("rand_core");
    expect(cargoCode).not.toMatch(/\brand\b/);
  });

  it("5. Cargo.toml does not contain zeroize / secrecy / subtle", () => {
    for (const dep of ["zeroize", "secrecy", "subtle"]) {
      expect(cargoCode, `Cargo.toml must not depend on ${dep}`).not.toContain(dep);
    }
  });

  it("6. Cargo.toml does not contain aes-gcm", () => {
    expect(cargoCode).not.toContain("aes-gcm");
    expect(cargoCode).not.toContain("aes_gcm");
  });

  it("7. Cargo.toml does not contain wasm-bindgen", () => {
    expect(cargoCode).not.toContain("wasm-bindgen");
    expect(cargoCode).not.toContain("wasm_bindgen");
  });

  it("8. crate-type remains rlib only", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*\]/);
    expect(cargoCode).not.toContain("cdylib");
    expect(cargoCode).not.toContain("staticlib");
    expect(cargoCode).not.toContain("wasm32");
  });

  it("9. lib.rs still has #![forbid(unsafe_code)] and no unsafe usage", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
  });

  it("10. lib.rs does not implement encrypt/decrypt (placeholder names only, no chacha20poly1305 usage)", () => {
    // The dependency was added to Cargo.toml only — lib.rs is unchanged and
    // must not import, reference, or call into it (or any other AEAD).
    expect(libRsSource).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(libRsSource).not.toMatch(/\bchacha20poly1305::/);
    expect(libRsSource).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(libRsSource).not.toContain("^=");
    // The placeholder entry points still exist and still do nothing real.
    expect(libRsSource).toContain("fn encrypt_placeholder(");
    expect(libRsSource).toContain("fn decrypt_placeholder(");
    expect(libRsSource).toContain("fn random_bytes_placeholder(");
    expect(libRsSource).toContain("fn derive_key_placeholder(");
  });

  it("11. no .wasm file is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    for (const path of Object.keys(files)) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("12. no target/ or build artifacts (including Cargo.lock) are committed", () => {
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
      // Stage 74 keeps Cargo.lock uncommitted (library crate; reproducibility
      // via a lockfile digest is deferred to the build-manifest stage).
      expect(forbiddenLock.test(path), `unexpected committed Cargo.lock: ${path}`).toBe(false);
    }
  });

  it("13. Runtime / Worker sources are unchanged: no crypto-crate reference and no auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("chacha20poly1305");
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

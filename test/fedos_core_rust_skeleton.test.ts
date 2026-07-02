import { describe, it, expect } from "vitest";
import {
  createFedosCoreCrypto,
  PlaceholderFedosCoreCrypto,
} from "../packages/fedos-core-rust/src/index.js";
// The Rust skeleton files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import pkgReadmeSource from "../packages/fedos-core-rust/README.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 69 — minimal FedOS Rust crate skeleton tests.
 *
 * The crate is a placeholder skeleton ONLY: no crypto deps, no wasm-bindgen, no
 * `unsafe`, no cryptography, no random, and no compiled/WASM artifact. The TS
 * boundary is unchanged and stays importable; the Runtime/Worker are not wired.
 */
describe("FedOS Rust crate skeleton", () => {
  it("1. Cargo.toml exists with the expected package identity", () => {
    expect(cargoTomlSource.length).toBeGreaterThan(0);
    expect(cargoTomlSource).toMatch(/name\s*=\s*"fedos-core-rust"/);
    expect(cargoTomlSource).toMatch(/version\s*=\s*"0\.0\.0"/);
    expect(cargoTomlSource).toMatch(/edition\s*=\s*"2021"/);
  });

  it("2. src/lib.rs exists with the expected placeholder API", () => {
    expect(libRsSource.length).toBeGreaterThan(0);
    for (const fn of [
      "fn fedos_core_status(",
      "fn fedos_core_capabilities(",
      "fn random_bytes_placeholder(",
      "fn derive_key_placeholder(",
      "fn encrypt_placeholder(",
      "fn decrypt_placeholder(",
    ]) {
      expect(libRsSource).toContain(fn);
    }
    expect(libRsSource).toContain("enum FedosCoreState");
    expect(libRsSource).toContain("struct FedosCoreStatus");
  });

  // TOML comments legitimately NAME the forbidden crates ("no argon2 …"); the
  // guards below inspect the comment-stripped manifest so a descriptive comment
  // never trips them.
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("3. Cargo.toml has no crypto dependencies", () => {
    for (const dep of [
      "chacha20poly1305",
      "aes-gcm",
      "aes_gcm",
      "hkdf",
      "argon2",
      "getrandom",
      "zeroize",
      "secrecy",
      "subtle",
      "bip39",
      "secp256k1",
      "libsodium",
      "ring",
    ]) {
      expect(cargoCode, `Cargo.toml must not depend on ${dep}`).not.toContain(dep);
    }
    // The [dependencies] table is present but empty (no `name = ...` line).
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    expect(cargoCode).toContain("[dependencies]");
    expect(depsSection).not.toMatch(/^\s*[a-z0-9_-]+\s*=/m);
  });

  it("4. Cargo.toml has no wasm-bindgen / cdylib / WASM target", () => {
    expect(cargoCode).not.toContain("wasm-bindgen");
    expect(cargoCode).not.toContain("wasm_bindgen");
    expect(cargoCode).not.toContain("cdylib");
    expect(cargoCode).not.toContain("wasm32");
  });

  it("5. lib.rs has no `unsafe` usage (and forbids it at the crate level)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    // No `unsafe` block / fn / impl / trait — `unsafe_code` in the attribute is
    // one word (no boundary+whitespace) so it is not matched here.
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
  });

  it("6. lib.rs imports no crypto crate (no `use`/`extern crate` of a cipher/KDF)", () => {
    expect(libRsSource).not.toMatch(/\bextern\s+crate\b/);
    expect(libRsSource).not.toMatch(
      /\buse\s+(chacha20poly1305|aes|aes_gcm|aead|hkdf|argon2|zeroize|secrecy|subtle|bip39|secp256k1|nostr|wasm_bindgen)\b/,
    );
  });

  it("7. lib.rs has no random / getrandom usage", () => {
    expect(libRsSource).not.toContain("getrandom");
    expect(libRsSource).not.toMatch(/\buse\s+rand\b/);
    expect(libRsSource).not.toMatch(/\brand::/);
    expect(libRsSource).not.toMatch(/\bthread_rng\b/);
  });

  it("8. lib.rs has no encryption implementation beyond placeholder names", () => {
    // The encrypt/decrypt entry points exist as names...
    expect(libRsSource).toContain("encrypt_placeholder");
    expect(libRsSource).toContain("decrypt_placeholder");
    // ...but no real AEAD/cipher primitive and no hand-rolled XOR cipher.
    expect(libRsSource).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(libRsSource).not.toContain("^=");
  });

  it("9. no .wasm file is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    for (const path of Object.keys(files)) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("10. no build/ or target/ artifact is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    for (const path of Object.keys(files)) {
      expect(/\/(build|target)\//i.test(path), `unexpected build artifact: ${path}`).toBe(false);
    }
  });

  it("11. the package README states placeholder / skeleton only", () => {
    const lower = pkgReadmeSource.toLowerCase();
    expect(lower).toContain("skeleton");
    expect(lower).toContain("no cryptography");
    expect(lower).toContain("placeholder");
  });

  it("12. the existing TS package boundary still loads and stays inert", () => {
    const core = createFedosCoreCrypto();
    expect(core).toBeInstanceOf(PlaceholderFedosCoreCrypto);
    expect(core.getStatus().state).toBe("unavailable");
  });

  it("13. Runtime / Worker sources do not auto-wire the Rust crate or WASM", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    // The runtime never calls a WASM loader's `.load(`.
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });
});

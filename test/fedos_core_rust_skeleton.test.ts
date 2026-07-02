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
 * Updated Stage 74: `Cargo.toml` now depends on `chacha20poly1305` (a
 * *production* dependency; see test/fedos_core_rust_dependency.test.ts for
 * the dedicated Stage 74 checks) — `src/lib.rs` is unchanged.
 * Updated Stage 75: `Cargo.toml` also gains a `[dev-dependencies]` table
 * (`serde`/`serde_json`/`hex`, test-only) and `src/lib.rs` gains a
 * `#[cfg(test)]`-only module that imports and calls `chacha20poly1305` to
 * verify it against the RFC 8439 vectors — see
 * test/fedos_core_rust_rfc8439_wiring.test.ts for the dedicated Stage 75
 * checks.
 * Updated Stage 76: `Cargo.toml`'s `[dependencies]` (production) table gains
 * a SECOND entry, `hkdf` (see test/fedos_core_rust_dependency.test.ts for the
 * dedicated Stage 76 checks) — `src/lib.rs` remains unchanged; nothing
 * imports or calls `hkdf` anywhere, production or test.
 * Updated Stage 77: `Cargo.toml` gains a `sha2` `[dev-dependencies]` entry
 * (test-only) and `src/lib.rs` gains a second `#[cfg(test)]`-only module,
 * `rfc5869_vectors`, that imports and calls `hkdf` + `sha2` to verify the
 * `hkdf` dependency against the RFC 5869 HKDF-SHA256 vectors — see
 * test/fedos_core_rust_hkdf_wiring.test.ts for the dedicated Stage 77 checks.
 * Test 3 below now also asserts `sha2` is absent from the PRODUCTION
 * `[dependencies]` table (it stays a dev-dependency only).
 * Tests 3, 6, and 8 below are scoped to PRODUCTION code/dependencies only
 * (excluding `[dev-dependencies]` and excluding everything from the first
 * `#[cfg(test)]` onward) so they keep verifying exactly what they always
 * verified: the crate's public, non-test surface still implements no
 * cryptography.
 *
 * The crate is still a placeholder skeleton: no wasm-bindgen, no `unsafe`, no
 * *production* cryptography implementation, no random, and no compiled/WASM
 * artifact. The TS boundary is unchanged and stays importable; the
 * Runtime/Worker are not wired.
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

  it("3. Cargo.toml's [dependencies] (production) table depends on chacha20poly1305 + hkdf only — no other crypto dependency", () => {
    for (const dep of [
      "aes-gcm",
      "aes_gcm",
      "argon2",
      // sha2 is NOT in this list: since Stage 77 it is a legitimate
      // [dev-dependencies] entry (used only by the #[cfg(test)]-only
      // rfc5869_vectors module) — its absence from PRODUCTION dependencies
      // is asserted separately below instead of via this whole-file scan.
      "getrandom",
      "rand_core",
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
    // The [dependencies] (production) table has exactly two entries:
    // chacha20poly1305 (Stage 74) and hkdf (Stage 76). Stop at the next
    // top-level `[section]` header (Stage 75 adds `[dev-dependencies]` right
    // after it) so its test-only entries (serde/serde_json/hex/sha2) are not
    // counted here.
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(2);
    expect(depLines.some((line: string) => line.includes("chacha20poly1305"))).toBe(true);
    expect(depLines.some((line: string) => /^\s*hkdf\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*sha2\s*=/.test(line))).toBe(false);
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

  // Stage 75 adds a #[cfg(test)]-only module that legitimately imports and
  // calls chacha20poly1305 to verify it against the RFC 8439 vectors (see
  // test/fedos_core_rust_rfc8439_wiring.test.ts). Tests 6 and 8 below scope
  // themselves to lib.rs's PRODUCTION code — everything before the first
  // `#[cfg(test)]` — which must still implement no cryptography at all.
  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);

  it("6. lib.rs's production code imports no crypto crate (no `use`/`extern crate` of a cipher/KDF)", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(productionLibRs).not.toMatch(/\bextern\s+crate\b/);
    expect(productionLibRs).not.toMatch(
      /\buse\s+(chacha20poly1305|aes|aes_gcm|aead|hkdf|argon2|zeroize|secrecy|subtle|bip39|secp256k1|nostr|wasm_bindgen)\b/,
    );
  });

  it("7. lib.rs has no random / getrandom usage", () => {
    expect(libRsSource).not.toContain("getrandom");
    expect(libRsSource).not.toMatch(/\buse\s+rand\b/);
    expect(libRsSource).not.toMatch(/\brand::/);
    expect(libRsSource).not.toMatch(/\bthread_rng\b/);
  });

  it("8. lib.rs's production code has no encryption implementation beyond placeholder names", () => {
    // The encrypt/decrypt entry points exist as names...
    expect(productionLibRs).toContain("encrypt_placeholder");
    expect(productionLibRs).toContain("decrypt_placeholder");
    // ...but no real AEAD/cipher primitive and no hand-rolled XOR cipher,
    // outside the #[cfg(test)]-only RFC 8439 verification module.
    expect(productionLibRs).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(productionLibRs).not.toContain("^=");
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

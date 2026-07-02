import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
import rfc5869Vectors from "../test-vectors/kdf/hkdf-rfc5869.json";

/**
 * Stage 77 — wire the RFC 5869 HKDF-SHA256 vectors
 * (`test-vectors/kdf/hkdf-rfc5869.json`, imported Stage 73) to `cargo test`,
 * using the `hkdf` dependency adopted Stage 76, following the exact same
 * pattern Stage 75 used for the RFC 8439 AEAD vectors.
 *
 * This is verification WIRING only: a new `#[cfg(test)]`-only module in
 * `packages/fedos-core-rust/src/lib.rs` reads the vector file and asserts the
 * `hkdf` dependency reproduces the RFC's known-answer PRK/OKM bytes when
 * instantiated with `sha2::Sha256`. The crate's PUBLIC API
 * (`fedos_core_status`, `fedos_core_capabilities`, `random_bytes_placeholder`,
 * `derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder`) is
 * untouched and still implements no cryptography; nothing is wired into the
 * Runtime, the Worker, or `CryptoProvider`; no random/key is generated; and
 * there is still no public `deriveKey` implementation.
 *
 * `sha2` is added this stage, but ONLY as a `[dev-dependencies]` entry — it
 * is used exclusively by the new `rfc5869_vectors` module to instantiate
 * `Hkdf::<Sha256>` and is never a production dependency (see
 * test/fedos_core_rust_dependency.test.ts test 3 and
 * test/fedos_core_rust_skeleton.test.ts test 3 for the dedicated checks).
 *
 * `cargo test` (green as of this stage) and `cargo check` / `cargo check
 * --tests` are verified as their own separate commands outside `npm test`,
 * consistent with how this repo has always kept the Rust toolchain check
 * independent of the vitest/TypeScript test run.
 *
 * Update (Stage 78): tests 1 and 3 below now expect `zeroize` / `secrecy` /
 * `subtle` as three ADDITIONAL production dependency-table entries (five
 * total) — Stage 78 adopts this secret-handling foundation trio (see
 * test/fedos_core_rust_dependency.test.ts for its dedicated checks) but
 * wires no code and does not affect anything else this file asserts about
 * the RFC 5869 wiring.
 *
 * Update (Stage 84): tests 1 and 3 below now expect `argon2` as a SIXTH
 * production dependency-table entry — Stage 84 adopts it as a dependency +
 * build-check ONLY (see test/fedos_core_rust_dependency.test.ts for its
 * dedicated checks) but wires no code and does not affect anything else this
 * file asserts about the RFC 5869 wiring.
 */
describe("FedOS Rust crate — RFC 5869 HKDF vectors wired to cargo test", () => {
  // TOML comments legitimately NAME both allowed and still-forbidden crates;
  // strip comments before scanning (same approach as the other Rust tests).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. Cargo.toml's [dependencies] (production) table still has chacha20poly1305 + hkdf (plus zeroize/secrecy/subtle, Stage 78; plus argon2, Stage 84)", () => {
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(6);
    expect(depLines.some((line: string) => line.includes("chacha20poly1305"))).toBe(true);
    expect(depLines.some((line: string) => /^\s*hkdf\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*zeroize\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*secrecy\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*subtle\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*argon2\s*=/.test(line))).toBe(true);
  });

  it("2. serde / serde_json / hex / sha2 are dev-dependencies only — not production dependencies", () => {
    expect(cargoCode).toContain("[dev-dependencies]");
    const devDepsSection = cargoCode.slice(cargoCode.indexOf("[dev-dependencies]"));
    for (const dep of ["serde", "serde_json", "hex", "sha2"]) {
      expect(devDepsSection, `expected ${dep} under [dev-dependencies]`).toContain(dep);
    }
    // None of them appear inside the [dependencies] (production) table.
    const depsSection = cargoCode.slice(
      cargoCode.indexOf("[dependencies]"),
      cargoCode.indexOf("[dev-dependencies]"),
    );
    for (const dep of ["serde", "serde_json", "hex", "sha2"]) {
      expect(depsSection, `${dep} must not be a production dependency`).not.toContain(dep);
    }
  });

  it("3. Cargo.toml still excludes every other named crypto crate and wasm-bindgen", () => {
    for (const dep of [
      "aes-gcm",
      "aes_gcm",
      // zeroize / secrecy / subtle are NOT in this list: since Stage 78
      // they are legitimate PRODUCTION dependencies (a secret-handling
      // foundation) — see test/fedos_core_rust_dependency.test.ts tests 3–5.
      // argon2 is likewise NOT in this list: since Stage 84 it is a
      // legitimate PRODUCTION dependency — see
      // test/fedos_core_rust_dependency.test.ts test 6.
      "getrandom",
      "rand_core",
      "wasm-bindgen",
      "wasm_bindgen",
    ]) {
      expect(cargoCode, `Cargo.toml must not depend on ${dep}`).not.toContain(dep);
    }
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*\]/);
    expect(cargoCode).not.toContain("cdylib");
    expect(cargoCode).not.toContain("wasm32");
  });

  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
  const testOnlyLibRs = firstCfgTestIdx === -1 ? "" : libRsSource.slice(firstCfgTestIdx);

  it("4. lib.rs contains a #[cfg(test)] module wired to the RFC 5869 vector file", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(libRsSource).toContain("mod rfc5869_vectors");
    // Reads the Stage 73 vector file verbatim via include_str! (no filesystem
    // IO at test runtime), at a path stable relative to this crate.
    expect(libRsSource).toMatch(
      /include_str!\(\s*"\.\.\/\.\.\/\.\.\/test-vectors\/kdf\/hkdf-rfc5869\.json"\s*\)/,
    );
    // Actually imports and uses the hkdf + sha2 dependencies — but only
    // inside the #[cfg(test)]-scoped tail of the file.
    expect(testOnlyLibRs).toMatch(/\buse\s+hkdf\b/);
    expect(testOnlyLibRs).toMatch(/\buse\s+sha2\b/);
    expect(testOnlyLibRs).toContain("Hkdf");
    expect(testOnlyLibRs).toContain("Sha256");
  });

  it("5. lib.rs's public placeholder API is unchanged from Stage 69/74/76", () => {
    for (const fn of [
      "pub fn fedos_core_status() -> FedosCoreStatus",
      "pub fn fedos_core_capabilities() -> &'static [&'static str]",
      "pub fn random_bytes_placeholder() -> FedosCoreStatus",
      "pub fn derive_key_placeholder() -> FedosCoreStatus",
      "pub fn encrypt_placeholder() -> FedosCoreStatus",
      "pub fn decrypt_placeholder() -> FedosCoreStatus",
    ]) {
      expect(productionLibRs, `expected unchanged signature: ${fn}`).toContain(fn);
    }
    // Every placeholder operation still returns the same inert helper, doing
    // no real work — unchanged since Stage 69, including derive_key_placeholder
    // (no HKDF call was added to it).
    expect(productionLibRs).toMatch(
      /fn random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toMatch(
      /fn encrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toMatch(
      /fn decrypt_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("6. no public deriveKey / HKDF implementation exists anywhere in lib.rs", () => {
    // No `pub fn` anywhere in the file takes bytes in/out or calls into
    // hkdf — every `pub fn` is one of the six placeholder names (a `pub` on
    // the test-only structs' derive is not a function).
    const pubFns = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    const allowedPubFns = new Set([
      "fedos_core_status",
      "fedos_core_capabilities",
      "random_bytes_placeholder",
      "derive_key_placeholder",
      "encrypt_placeholder",
      "decrypt_placeholder",
    ]);
    for (const name of pubFns) {
      expect(allowedPubFns.has(name), `unexpected public function: ${name}`).toBe(true);
    }
    // The #[cfg(test)] module's own test functions are not `pub`.
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+rfc5869/);
  });

  it("7. no .wasm / Cargo.lock / target / build artifact is committed to the package", () => {
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
      expect(/\.(rlib|so|dll|dylib|node|a|o)$/i.test(path), `unexpected compiled artifact: ${path}`).toBe(
        false,
      );
    }
  });

  it("8. Runtime / Worker sources are unchanged: no crypto-crate reference and no auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("hkdf");
      expect(src).not.toContain("rfc5869");
      expect(src).not.toContain("sha2");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("9. the imported RFC 5869 vector file used by cargo test has at least one shouldPass=true case", () => {
    // Sanity check on the same file lib.rs's include_str! points at: this
    // repo's test suite and the Rust test must be exercising a real,
    // non-empty vector set.
    const vectors = (rfc5869Vectors as { vectors: Array<{ shouldPass: boolean }> }).vectors;
    expect(Array.isArray(vectors)).toBe(true);
    expect(vectors.some((v) => v.shouldPass === true)).toBe(true);
  });
});

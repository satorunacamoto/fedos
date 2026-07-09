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
 * Updated Stage 78: `Cargo.toml`'s `[dependencies]` (production) table gains
 * THREE more entries, `zeroize` / `secrecy` / `subtle` (a secret-handling
 * foundation adopted together, ahead of any real secret type — see
 * test/fedos_core_rust_dependency.test.ts for the dedicated Stage 78
 * checks). `src/lib.rs` remains completely unchanged — no `#[cfg(test)]`
 * module is added this stage (unlike Stage 75/77), since there is no vector
 * file for a dependency-adoption-only Stage to wire. Test 3 below now
 * expects FIVE production dependency-table entries.
 * Updated Stage 79: `Cargo.toml` is UNCHANGED (still five production
 * entries); `src/lib.rs` gains a crate-private `secret_handle` module — an
 * INTERNAL-ONLY secret-handle skeleton, `pub(crate)` at most, never `pub` —
 * that imports and uses `zeroize`/`secrecy` in PRODUCTION code for the first
 * time, against a fixed non-secret placeholder marker only. Its own nested
 * `#[cfg(test)] mod tests` is now lib.rs's FIRST `#[cfg(test)]` occurrence,
 * so `firstCfgTestIdx` below shifts earlier accordingly (harmlessly — see
 * test 6's own comment). See test/fedos_core_rust_secret_handle.test.ts for
 * the dedicated Stage 79 checks.
 * Updated Stage 84: `Cargo.toml`'s `[dependencies]` (production) table gains
 * a SIXTH entry, `argon2` (see test/fedos_core_rust_dependency.test.ts for
 * the dedicated Stage 84 checks) — `src/lib.rs` remains unchanged; nothing
 * imports or calls `argon2` anywhere, production or test. Test 3 below now
 * expects SIX production dependency-table entries.
 * Tests 3, 6, and 8 below are scoped to PRODUCTION code/dependencies only
 * (excluding `[dev-dependencies]` and excluding everything from the first
 * `#[cfg(test)]` onward) so they keep verifying exactly what they always
 * verified: the crate's public, non-test surface still implements no
 * cryptography (Stage 79's `secret_handle` module is the sole, deliberate
 * exception for `zeroize`/`secrecy`, per test 6 below).
 *
 * Updated Stage 102: `src/lib.rs` gains this crate's first new PUBLIC items
 * since Stage 69 — a label-only crypto-API boundary (`FedosCryptoOperation`,
 * `FedosCryptoAlgorithm`, `FedosCryptoBoundaryState`,
 * `FedosCryptoBoundaryStatus`, `FedosCryptoRequestDescriptor`,
 * `FedosCryptoResponseDescriptor`, and `fedos_crypto_boundary_status()`) —
 * see test/fedos_core_rust_public_api_boundary.test.ts for the dedicated
 * Stage 102 checks. Test 8 below is now scoped to specific crate-usage
 * patterns rather than a bare AEAD-name substring match, because the new
 * `FedosCryptoAlgorithm::Aes256Gcm`/`ChaCha20Poly1305` labels legitimately
 * contain those substrings without importing or calling any AEAD crate.
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

  it("3. Cargo.toml's [dependencies] (production) table depends on chacha20poly1305 + hkdf + zeroize/secrecy/subtle + argon2 + aes-gcm + getrandom + sha2 + k256 only — no other crypto dependency", () => {
    for (const dep of [
      // sha2 is NOT in this list: since Stage 77 it is a legitimate
      // [dev-dependencies] entry (used only by the #[cfg(test)]-only
      // rfc5869_vectors module) — its absence from PRODUCTION dependencies
      // is asserted separately below instead of via this whole-file scan.
      // zeroize / secrecy / subtle are likewise NOT in this list: since
      // Stage 78 they are legitimate PRODUCTION dependencies (a
      // secret-handling foundation adopted ahead of any real secret type) —
      // see test/fedos_core_rust_dependency.test.ts tests 3–5 for their
      // dedicated presence checks. argon2 is likewise NOT in this list:
      // since Stage 84 it is a legitimate PRODUCTION dependency — see
      // test/fedos_core_rust_dependency.test.ts test 6. aes-gcm is likewise
      // NOT in this list: since Stage 101 it is a legitimate PRODUCTION
      // dependency, adopted AND wired to the NIST AES-256-GCM vectors in
      // the same Stage — see
      // test/fedos_core_rust_aes_gcm_wiring.test.ts. getrandom is likewise
      // NOT in this list: since Stage 104 it is a legitimate PRODUCTION
      // dependency, this crate's own CSPRNG entropy source, adopted
      // build-check ONLY — see test/fedos_core_rust_dependency.test.ts
      // test 21 and docs/public_random_design.md. k256 is likewise NOT in
      // this list: since Stage 194 it is a legitimate PRODUCTION
      // dependency (arithmetic-only feature) — see
      // test/secp256k1_dependency_guard.test.ts for its dedicated checks.
      // rand_core is likewise excluded from this forbidden list's own
      // wording concern: it still names no PRODUCTION dependency LINE
      // (k256's `arithmetic` feature pulls it in only as a transitive,
      // trait-only dependency — see Cargo.toml's own REVIEWED EXCEPTION
      // comment) — this test's `cargoCode` strips `#`-comments, so this
      // forbidden-word check still only matches an actual dependency
      // declaration, never prose.
      "rand_core",
      "bip39",
      "secp256k1",
      "libsodium",
      "ring",
    ]) {
      expect(cargoCode, `Cargo.toml must not depend on ${dep}`).not.toContain(dep);
    }
    // The [dependencies] (production) table has exactly eleven entries:
    // chacha20poly1305 (Stage 74), hkdf (Stage 76), zeroize/secrecy/subtle
    // (Stage 78), argon2 (Stage 84), aes-gcm (Stage 101), getrandom
    // (Stage 104), sha2 (Stage 147, PROMOTED from [dev-dependencies] —
    // see test/fedos_core_rust_hkdf_internal.test.ts for the dedicated Stage
    // 147 checks), k256 (Stage 194), and wasm-bindgen (Stage 985, PHASE 009 —
    // see test/runtime_wasm_rust_export_bindgen_dependency.test.ts). Stop at
    // the next top-level `[section]` header (Stage 75 adds
    // `[dev-dependencies]` right after it) so its remaining test-only
    // entries (serde/serde_json/hex) are not counted here.
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
    expect(depLines.some((line: string) => line.includes("getrandom"))).toBe(true);
    expect(depLines.some((line: string) => line.includes("chacha20poly1305"))).toBe(true);
    expect(depLines.some((line: string) => /^\s*hkdf\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*zeroize\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*secrecy\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*subtle\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*argon2\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*aes-gcm\s*=/.test(line))).toBe(true);
    expect(depLines.some((line: string) => /^\s*sha2\s*=/.test(line))).toBe(true);
  });

  it("4. Cargo.toml has no wasm32 build target declared (crate-type's cdylib, Stage 466, is a build-output shape, not a target); wasm-bindgen became a direct dependency at Stage 985 (Prototype EXECUTION Phase 009) -- see test/runtime_wasm_rust_export_bindgen_dependency.test.ts for its dedicated checks", () => {
    expect(cargoCode).not.toContain("wasm32");
    expect(cargoCode).toContain("wasm-bindgen");
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
  // Stage 79 adds a crate-private `secret_handle` module (with its OWN
  // nested `#[cfg(test)] mod tests`, now lib.rs's first `#[cfg(test)]`
  // occurrence) that legitimately imports `zeroize`/`secrecy` in production
  // code — see test/fedos_core_rust_secret_handle.test.ts.
  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);

  it("6. lib.rs's production code (up to the FIRST #[cfg(test)] marker, inside secret_handle's own nested tests) imports no crypto/AEAD/KDF crate (zeroize/secrecy/wasm_bindgen are the sole exceptions, Stage 79/986)", () => {
    // NOTE: `kdf_core` (and its Stage 147 `hkdf`/`sha2` usage) lands textually
    // AFTER this slice's cutoff (the first `#[cfg(test)]` marker is inside
    // `secret_handle`'s own nested `#[cfg(test)] mod tests`, Stage 79) — so
    // this test's scope never reaches kdf_core at all, exactly as it never
    // reached `aead_core`'s or `kdf_core`'s OWN pre-existing content before
    // Stage 147 either. See test/fedos_core_rust_hkdf_internal.test.ts and
    // test/fedos_core_rust_kdf_skeleton.test.ts for the dedicated checks on
    // kdf_core's real hkdf/sha2 usage.
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(productionLibRs).not.toMatch(/\bextern\s+crate\b/);
    expect(productionLibRs).not.toMatch(
      /\buse\s+(chacha20poly1305|aes|aes_gcm|aead|hkdf|sha2|argon2|subtle|bip39|secp256k1|nostr)\b/,
    );
    // zeroize/secrecy ARE used in production code as of Stage 79 (see
    // test/fedos_core_rust_secret_handle.test.ts for the dedicated checks
    // that this stays crate-private and touches no real secret byte).
    expect(productionLibRs).toMatch(/\buse\s+zeroize\b/);
    expect(productionLibRs).toMatch(/\buse\s+secrecy\b/);
    // wasm_bindgen::prelude IS used in production code as of Stage 986 (see
    // test/runtime_wasm_rust_version_export.test.ts for the dedicated checks
    // that it backs exactly one function, version(), and no other change).
    expect(productionLibRs).toMatch(/\buse\s+wasm_bindgen::prelude::\*;/);
  });

  it("7. lib.rs's only real getrandom CALLS are fedos_random_bytes_32 (Stage 137), fedos_aead_nonce_96 (Stage 138), and fedos_generate_aead_key_32 (Stage 171–176) — every other mention is prose naming them, never a fallback PRNG", () => {
    // Through Stage 136 this asserted "no getrandom/rand CALL usage"
    // outright. Stage 137 is the first real implementation behind this
    // crate's public API (see test/fedos_core_rust_random_bytes.test.ts
    // for the dedicated checks), Stage 138 adds a second, independent
    // call site (see test/fedos_core_rust_aead_nonce.test.ts), and Stage
    // 171–176 adds a THIRD, independent call site for key generation (see
    // test/fedos_core_rust_public_opaque_crypto_api.test.ts) — narrowed
    // here to "exactly these three call sites, and nothing else calls
    // getrandom/rand/thread_rng." Several doc comments legitimately NAME
    // `getrandom`/`thread_rng` in prose (to describe the stage or say a
    // fallback is never used) — a bare word match would false-positive on
    // that prose, so this checks actual CALL/import syntax instead.
    expect(libRsSource).not.toMatch(/\buse\s+getrandom\b/);
    const getrandomCallSites = libRsSource.match(/getrandom::fill\s*\(/g) ?? [];
    expect(getrandomCallSites.length).toBe(3);
    expect(libRsSource).not.toMatch(/\buse\s+rand\b/);
    expect(libRsSource).not.toMatch(/\brand::/);
    expect(libRsSource).not.toMatch(/\bthread_rng\s*\(/);
  });

  it("8. lib.rs's production code has no encryption implementation beyond placeholder names", () => {
    // The encrypt/decrypt entry points exist as names...
    expect(productionLibRs).toContain("encrypt_placeholder");
    expect(productionLibRs).toContain("decrypt_placeholder");
    // ...but no real AEAD/cipher primitive and no hand-rolled XOR cipher,
    // outside the #[cfg(test)]-only RFC 8439 verification module. Specific
    // crate-usage patterns only — NOT a bare substring match: Stage 102's
    // public `FedosCryptoAlgorithm::Aes256Gcm`/`ChaCha20Poly1305` labels
    // legitimately contain these substrings without importing or calling
    // any AEAD crate (see test/fedos_core_rust_public_api_boundary.test.ts
    // for the dedicated Stage 102 checks).
    expect(productionLibRs).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(productionLibRs).not.toMatch(/\bchacha20poly1305::/);
    expect(productionLibRs).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(productionLibRs).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(productionLibRs).not.toMatch(/\baes_gcm::/);
    expect(productionLibRs).not.toMatch(/\bAes256Gcm::new\b/);
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

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
 * Updated Stage 77 — `sha2` becomes a dev-dependency (test 7 below); RFC 5869
 * HKDF vector wiring itself has its own dedicated test file, see
 * test/fedos_core_rust_hkdf_wiring.test.ts.
 * Updated Stage 78 — `zeroize` / `secrecy` / `subtle` dependency-adoption
 * tests (tests 3–5 below). This trio is adopted together, ahead of any real
 * secret type, as a foundation for a future secret-handle skeleton.
 * Updated Stage 79 — the secret-handle skeleton itself lands: a
 * crate-private `secret_handle` module in `src/lib.rs` that legitimately
 * uses `zeroize`/`secrecy` internally, against a fixed non-secret
 * placeholder marker only — see test/fedos_core_rust_secret_handle.test.ts
 * for its dedicated checks, and tests 13/14 below for how this file's own
 * `zeroize`/`secrecy` guards were relaxed accordingly.
 * Updated Stage 84 — `argon2` dependency-adoption tests (test 6 below,
 * replacing the old "does not contain argon2" check). Dependency + build
 * check ONLY, exactly like every prior dependency Stage: no code anywhere in
 * `src/lib.rs` imports, references, or calls `argon2` (test 12 below), no
 * RFC 9106 Argon2id vector is wired, and `derive_key_placeholder` is
 * unchanged (test 17 below). `argon2`'s `default-features = false` (no
 * `features` enabled) explicitly excludes its default `rand`/`password-hash`
 * feature set, so it pulls in NO `rand_core`/`getrandom` at all — test 9
 * below keeps its original "does not contain" wording (stricter than
 * "unless argon2 pulls transitive deps only", since this crate's exact
 * feature configuration avoids that transitive dependency entirely; see
 * `packages/fedos-core-rust/Cargo.toml`'s own comment above the `argon2`
 * entry for the full reasoning).
 * Updated Stage 101 — `aes-gcm` dependency-adoption test (test 8 below,
 * replacing the old "does not contain aes-gcm" check — this crate's SECOND
 * AEAD, adopted AND wired to the NIST AES-256-GCM vectors in the same
 * Stage, unlike every prior dependency which wired its vector file in a
 * later Stage). `aes-gcm`'s `default-features = false`, `features =
 * ["aes", "alloc"]` explicitly excludes its optional `getrandom` feature,
 * so it pulls in no CSPRNG dependency either.
 *
 * `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
 * has exactly SEVEN entries: `chacha20poly1305` (Stage 74, RustCrypto AEAD,
 * wired to the RFC 8439 vectors under `#[cfg(test)]` in Stage 75), `hkdf`
 * (Stage 76, RustCrypto KDF, wired to the RFC 5869 HKDF-SHA256 vectors at
 * test-vectors/kdf/hkdf-rfc5869.json under `#[cfg(test)]` in Stage 77),
 * `zeroize` / `secrecy` / `subtle` (Stage 78, secret-handling foundation),
 * `argon2` (Stage 84, password-hashing/KDF — not yet wired to
 * test-vectors/kdf/argon2id-rfc9106.json, imported Stage 73), and `aes-gcm`
 * (Stage 101, RustCrypto AEAD, wired to the NIST AES-256-GCM vectors at
 * test-vectors/aead/aes256gcm-nist.json under `#[cfg(test)]` in the SAME
 * Stage — see test/fedos_core_rust_aes_gcm_wiring.test.ts).
 * `derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
 * untouched, no random/key is generated, no type anywhere holds a real
 * key/seed/plaintext/ciphertext/passphrase byte, `subtle`-based
 * constant-time-compare behavior does not exist yet (Stage 79 deliberately
 * does not use `subtle`), and no other crypto crate (rand / getrandom) or
 * wasm-bindgen is added.
 *
 * Updated Stage 102: test 16's production-code scan is now specific
 * crate-usage patterns rather than a bare AEAD-name substring match — the
 * new public `FedosCryptoAlgorithm::Aes256Gcm`/`ChaCha20Poly1305` labels
 * added in `src/lib.rs` legitimately contain those substrings without
 * importing or calling any AEAD crate. See
 * test/fedos_core_rust_public_api_boundary.test.ts for the dedicated Stage
 * 102 checks; `Cargo.toml` itself is unchanged by Stage 102.
 *
 * `cargo check` (green as of this stage) is verified as its own separate
 * command outside `npm test`, consistent with how this repo has always kept
 * the Rust toolchain check independent of the vitest/TypeScript test run.
 *
 * Update (Stage 75): test 16 below is scoped to lib.rs's PRODUCTION code
 * (everything before the first `#[cfg(test)]`) rather than the whole file,
 * because Stage 75 adds a `#[cfg(test)]`-only module that legitimately
 * imports and calls `chacha20poly1305` to verify it against the RFC 8439
 * vectors — see test/fedos_core_rust_rfc8439_wiring.test.ts for that stage's
 * own dedicated tests. Stage 76 extends the same production-code check to
 * also forbid any `hkdf` usage outside `#[cfg(test)]`. Stage 77 adds a SECOND
 * `#[cfg(test)]`-only module, `rfc5869_vectors`, that legitimately imports and
 * calls `hkdf` — it lands after lib.rs's FIRST `#[cfg(test)]` marker (the
 * pre-existing placeholder tests module), so test 16's slice cutoff still
 * excludes it and the production-code assertion is unaffected. Stage 84
 * extends the same production-code check to also forbid any `argon2` usage
 * outside `#[cfg(test)]` (there is no `#[cfg(test)]` module using `argon2`
 * yet either — that is Stage 85 candidate work).
 *
 * Update (Stage 79): `src/lib.rs` gains a crate-private `secret_handle`
 * module — the first PRODUCTION code (not `#[cfg(test)]`-only) in this crate
 * to actually import and use `zeroize`/`secrecy` — with its own nested
 * `#[cfg(test)] mod tests` for its unit tests (see
 * test/fedos_core_rust_secret_handle.test.ts for the dedicated Stage 79
 * checks). Because that nested test module is now lib.rs's FIRST
 * `#[cfg(test)]` occurrence, test 16's production-code slice below now ends
 * there instead of at the pre-existing placeholder tests module — this does
 * not change what test 16 asserts (the six placeholder functions and the
 * chacha20poly1305/hkdf/argon2 absence checks all still hold on the smaller
 * slice, since `secret_handle`'s own production content mentions none of
 * them). Tests 13 and 14 are relaxed from "no usage anywhere" to "no PUBLIC
 * exposure" for exactly this reason: `secrecy`/`zeroize` are now
 * legitimately used, but only inside the crate-private `secret_handle`
 * module, never via a `pub` item. Test 15 (`subtle`) is UNCHANGED — Stage 79
 * deliberately does not use `subtle` yet (see the module's own doc comment
 * in `src/lib.rs`), so the whole-file "no usage at all" check still holds.
 */
describe("FedOS Rust crate — chacha20poly1305 + hkdf + zeroize/secrecy/subtle + argon2 dependency adoption", () => {
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

  /** Extracts a `mod name { ... }` block via brace matching (same helper
   * pattern used throughout this repo's other fedos_core_rust_*.test.ts
   * files). */
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

  it("6. Cargo.toml contains argon2 (production dependency, Stage 84)", () => {
    expect(cargoCode).toContain("[dependencies]");
    expect(cargoCode).toContain("argon2");
    expect(productionDepsSection).toMatch(/\bargon2\s*=/);
  });

  it("7. sha2 is a PRODUCTION dependency (Stage 147, promoted from [dev-dependencies])", () => {
    // Stage 77 originally added `sha2` under [dev-dependencies] only, for the
    // #[cfg(test)]-only `rfc5869_vectors` module to instantiate
    // `Hkdf::<Sha256>` against the RFC 5869 vectors. Stage 147 promotes it to
    // [dependencies] (production) — the ONLY Cargo.toml change that stage
    // makes — because `kdf_core`'s new `derive_secret_handle_internal`
    // instantiates `Hkdf::<Sha256>` in PRODUCTION code for the first time.
    // sha2 must NOT also remain listed under [dev-dependencies] (a stale
    // duplicate entry, not a real dependency-adoption pattern anywhere else
    // in this crate).
    expect(cargoCode).not.toContain("sha-2");
    expect(productionDepsSection).toMatch(/^sha2\s*=/m);
    expect(cargoCode).toContain("[dev-dependencies]");
    const devDepsSection = cargoCode.slice(devDepsIdx);
    expect(devDepsSection).not.toMatch(/^sha2\s*=/m);
  });

  it("8. Cargo.toml contains aes-gcm (production dependency, Stage 101)", () => {
    // Stage 101 adopts `aes-gcm` AND wires it to the NIST AES-256-GCM
    // vectors in the same stage — see
    // test/fedos_core_rust_aes_gcm_wiring.test.ts for the dedicated Stage
    // 101 checks (helper presence/visibility, no production `aes-gcm`
    // reference, `aead_core` unchanged and still placeholder-only, public
    // `pub fn` count still 6 as of Stage 101 — Stage 102 later adds a
    // seventh, see test/fedos_core_rust_public_api_boundary.test.ts — no
    // production key/nonce/plaintext/ciphertext/tag storage field,
    // Runtime/Worker untouched, no committed build artifact).
    expect(cargoCode).toContain("[dependencies]");
    expect(cargoCode).toContain("aes-gcm");
    expect(productionDepsSection).toMatch(/aes-gcm\s*=/);
  });

  it("9. Cargo.toml contains getrandom (production dependency, Stage 104), but not the full rand/rand_core crates", () => {
    // Stage 104 adopts `getrandom` directly — this crate's first CSPRNG
    // entropy source — as its own, independent `[dependencies]`
    // (production) entry, build-check ONLY (not imported/called anywhere
    // in src/lib.rs — see test/fedos_core_rust_dependency.test.ts test 21
    // below and docs/public_random_design.md for the dedicated Stage 104
    // checks/design record). `argon2` (Stage 84) and `aes-gcm` (Stage 101)
    // are separately configured to exclude THEIR OWN optional `rand`/
    // `getrandom` convenience features (see their own Cargo.toml comments)
    // — that remains true and unrelated to this crate's own direct
    // `getrandom` adoption. The full, higher-level `rand`/`rand_core`
    // crates (the `Rng`/`CryptoRng` trait ecosystem) remain ABSENT.
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    expect(productionDepsSection).toMatch(/^getrandom\s*=/m);
    expect(cargoCode).not.toContain("rand_core");
    // No standalone `rand = "..."` dependency LINE anywhere (comments are
    // already stripped from cargoCode, so this only matches a real entry).
    expect(cargoCode).not.toMatch(/^rand\s*=/m);
  });

  it("10. Cargo.toml declares wasm-bindgen as a direct dependency (Stage 985, Prototype EXECUTION Phase 009), and lib.rs now imports it for exactly one #[wasm_bindgen] function, version() (Stage 986, Prototype EXECUTION Phase 010)", () => {
    expect(cargoCode).toContain("wasm-bindgen");
    expect(libRsSource).toMatch(/use wasm_bindgen::prelude::\*;/);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
  });

  it("11. crate-type is rlib + cdylib (Stage 466 -- WASM artifact generation fix), never staticlib/wasm32 as a literal token", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*,\s*"cdylib"\s*\]/);
    expect(cargoCode).not.toContain("staticlib");
    expect(cargoCode).not.toContain("wasm32");
  });

  it("12. production lib.rs has no Argon2 implementation", () => {
    // `\bArgon2\b` (a bare, case-matched word) is deliberately NOT checked
    // here: this crate's PRE-EXISTING doc comments (Stage 69's crate-level
    // summary, Stage 79's `secret_handle` doc) already legitimately say
    // "Argon2" in plain English prose ("no AEAD/HKDF/Argon2/NIP-44
    // operation..."), predating this stage and describing what the crate
    // does NOT do — not a Rust code reference. `Argon2::`/`Argon2<`/
    // `Argon2::new(` are actual Rust usage patterns and would not appear in
    // that prose, so they are the precise checks below (mirroring how test
    // 16 checks `\bHkdf\b` — a pattern that happens not to collide with the
    // pre-existing "HKDF" all-caps prose, unlike "Argon2").
    const firstCfgTest = libRsSource.indexOf("#[cfg(test)]");
    expect(firstCfgTest).toBeGreaterThan(-1);
    const productionCode = libRsSource.slice(0, firstCfgTest);
    expect(productionCode).not.toMatch(/\buse\s+argon2\b/);
    expect(productionCode).not.toMatch(/\bargon2::/i);
    expect(productionCode).not.toMatch(/\bArgon2::/);
    expect(productionCode).not.toMatch(/\bArgon2</);
    expect(productionCode).not.toMatch(/\bArgon2\s*\(/);
    expect(productionCode).not.toMatch(/\bArgon2\s*\{/);
  });

  it("13. SecretBox/Secret usage (Stage 79, crate-private secret_handle module) is never exposed via a pub item", () => {
    // Stage 79 adds a crate-private `secret_handle` module that legitimately
    // imports and uses `secrecy::SecretBox` — see
    // test/fedos_core_rust_secret_handle.test.ts for its dedicated checks
    // (SecretHandle is `pub(crate)`, never `pub`, never re-exported, and
    // holds no Vec<u8>/String secret field — that module-scoped check lives
    // there, not here, since this file's `libRsSource` also legitimately
    // contains unrelated `String` fields elsewhere, e.g. the `rfc8439_vectors`/
    // `rfc5869_vectors` test-vector-parsing structs' `id: String` field).
    // This test only asserts the PUBLIC-API boundary stays clean.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+secrecy\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+struct\s+\w*[Ss]ecret\w*/);
    expect(libRsSource).not.toMatch(/\bpub\s+enum\s+\w*[Ss]ecret\w*/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w*[Ss]ecret\w*/);
  });

  it("14. Zeroize usage (Stage 79, crate-private secret_handle module) is never exposed via a pub item", () => {
    // `zeroize` is legitimately imported and called inside the crate-private
    // `secret_handle` module (Stage 79), only against the non-secret
    // `PlaceholderMarker` — see test/fedos_core_rust_secret_handle.test.ts.
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+zeroize\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w*[Zz]eroiz\w*/);
    expect(libRsSource).not.toMatch(/\bpub\s+struct\s+\w*[Zz]eroiz\w*/);
    // derive_key_placeholder (the one placeholder function this stage's
    // topic could plausibly touch) still calls nothing but the shared
    // placeholder helper — see test 17 below for its exact body assertion.
  });

  it("15. RIPPLE (Secure Runtime Alpha 149): production lib.rs had no ConstantTimeEq/subtle usage AS OF this Stage's own dependency-adoption scope (subtle was adopted but not yet consumed anywhere inside lib.rs itself, though crypto/nip44_hmac.rs already used it in a separate file -- see that file's own test); Stage 1015 (Secure Runtime Alpha 149) legitimately adds lib.rs's own FIRST subtle usage, inside the crate-private master_root module's own constant-time Root Handle comparison, mirroring crypto::nip44_hmac::verify_hmac_internal's own established discipline exactly -- reconfirmed here as the CURRENT state: subtle is used, but ONLY inside master_root, and ONLY for a boolean-returning comparison, never to expose a byte", () => {
    const masterRootBody = (libRsSource.match(/\/\/\/ Stage 1012 \(Secure Runtime Alpha 146\)[\s\S]*?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
    expect(masterRootBody.length).toBeGreaterThan(0);
    const outsideMasterRoot = libRsSource.replace(masterRootBody, "");
    expect(outsideMasterRoot).not.toMatch(/\buse\s+subtle\b/);
    expect(outsideMasterRoot).not.toMatch(/\bsubtle::/);
    expect(outsideMasterRoot).not.toMatch(/\bConstantTimeEq\b/);
    expect(outsideMasterRoot).not.toMatch(/\bChoice::/);
    expect(outsideMasterRoot).not.toMatch(/\.ct_eq\s*\(/);
    expect(masterRootBody).toMatch(/use subtle::ConstantTimeEq;/);
    expect(masterRootBody).toMatch(/\.ct_eq\(/);
  });

  it("16. lib.rs's production code implements neither AEAD nor Argon2 anywhere, and implements HKDF ONLY inside the reviewed kdf_core module (Stage 147)", () => {
    // Stage 75 wires the RFC 8439 vectors to a #[cfg(test)]-only module
    // (see test/fedos_core_rust_rfc8439_wiring.test.ts), which DOES import
    // and call chacha20poly1305 — but only inside #[cfg(test)]. The
    // PRODUCTION code (everything before the first #[cfg(test)]) must still
    // neither import, reference, nor call into chacha20poly1305 (or any
    // other AEAD), exactly as Stage 74 left it. Stage 84 extends the same
    // rule to `argon2`: adopted as a dependency, but not
    // imported/referenced/called anywhere in production code (there is no
    // #[cfg(test)] module using it yet either — that is Stage 85 candidate
    // work; test 12 above covers this same rule as its own dedicated check).
    //
    // Update (Stage 147): `hkdf` is now legitimately used in PRODUCTION code,
    // but ONLY inside the crate-private `kdf_core` module's
    // `derive_secret_handle_internal` — see
    // test/fedos_core_rust_hkdf_internal.test.ts for the dedicated checks
    // that this real implementation stays crate-private, adds no `pub fn`,
    // and does not connect to AEAD/Runtime/Worker/WASM. This test's `hkdf`
    // checks are scoped to PRODUCTION code MINUS `kdf_core` (mirroring how
    // tests 13/14 above were relaxed, Stage 79, for `secret_handle`'s own
    // legitimate `zeroize`/`secrecy` usage) — every OTHER production module
    // must still have no `hkdf` reference at all.
    const firstCfgTest = libRsSource.indexOf("#[cfg(test)]");
    expect(firstCfgTest).toBeGreaterThan(-1);
    const productionCode = libRsSource.slice(0, firstCfgTest);
    const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
    const productionCodeOutsideKdfCore = productionCode.replace(kdfCoreModule, "");
    expect(productionCode).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(productionCode).not.toMatch(/\bchacha20poly1305::/);
    // Specific crate-usage patterns only — NOT a bare AEAD-name substring
    // match: Stage 102's public `FedosCryptoAlgorithm::Aes256Gcm`/
    // `ChaCha20Poly1305` labels legitimately contain these substrings
    // without importing or calling any AEAD crate (see
    // test/fedos_core_rust_public_api_boundary.test.ts for the dedicated
    // Stage 102 checks).
    expect(productionCode).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(productionCode).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(productionCode).not.toMatch(/\baes_gcm::/);
    expect(productionCode).not.toMatch(/\bAes256Gcm::new\b/);
    expect(productionCodeOutsideKdfCore).not.toMatch(/\buse\s+hkdf\b/);
    expect(productionCodeOutsideKdfCore).not.toMatch(/\bhkdf::/i);
    expect(productionCodeOutsideKdfCore).not.toMatch(/\bHkdf\b/);
    // Inside kdf_core itself, hkdf IS legitimately used — confirm the
    // reviewed call site actually exists rather than merely permitting it.
    expect(kdfCoreModule).toMatch(/\buse\s+hkdf::Hkdf\b/);
    expect(kdfCoreModule).toContain("Hkdf::<Sha256>::new(");
    expect(productionCode).not.toMatch(/\buse\s+argon2\b/);
    expect(productionCode).not.toMatch(/\bargon2::/i);
    // `\bArgon2\b` (bare word) is NOT checked here — see test 12's own
    // comment for why: pre-existing prose already legitimately says
    // "Argon2" describing what this crate does NOT do.
    expect(productionCode).not.toMatch(/\bArgon2::/);
    expect(productionCode).not.toMatch(/\bArgon2</);
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

  it("17. derive_key_placeholder is unchanged: still a no-op placeholder, no HKDF/Argon2/secret call", () => {
    expect(libRsSource).toMatch(
      /fn derive_key_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("18. lib.rs still has #![forbid(unsafe_code)] and no unsafe usage", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
  });

  it("19. no .wasm file is committed to the package", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    for (const path of Object.keys(files)) {
      expect(/\.wasm$/i.test(path), `unexpected WASM binary: ${path}`).toBe(false);
    }
  });

  it("20. no target/ or build artifacts (including Cargo.lock) are committed", () => {
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

  it("21. Runtime / Worker sources are unchanged: no crypto-crate reference and no auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("chacha20poly1305");
      expect(src).not.toContain("hkdf");
      expect(src).not.toContain("argon2");
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

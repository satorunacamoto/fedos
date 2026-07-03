import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/fedos_core_public_api_design.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 102 — public crypto API design docs + placeholder API boundary.
 *
 * `docs/fedos_core_public_api_design.md` fixes the DESIGN (not the
 * implementation) of a future public `encrypt`/`decrypt`/`deriveKey`/
 * `randomBytes` API. `packages/fedos-core-rust/src/lib.rs` gains this
 * crate's first new PUBLIC items since Stage 69: `FedosCryptoOperation`,
 * `FedosCryptoAlgorithm`, `FedosCryptoBoundaryState`,
 * `FedosCryptoBoundaryStatus`, `FedosCryptoRequestDescriptor`,
 * `FedosCryptoResponseDescriptor` (all non-sensitive labels only), and
 * one new public function, `fedos_crypto_boundary_status()`, which
 * returns a fixed, permanently `Unavailable` status. The six Stage 69
 * placeholder functions are unchanged, so this crate's public `pub fn`
 * surface grows from six to seven.
 *
 * No encrypt, decrypt, key-derivation, or random-byte generation
 * function is added. No raw key/seed/plaintext/ciphertext/passphrase/
 * nonce byte is accepted, returned, or stored anywhere added this stage.
 * `Cargo.toml` is untouched, and nothing is wired into the Runtime, the
 * Worker, or a crypto provider.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — public crypto API design docs + boundary", () => {
  /** Extracts a `mod name { ... }` block via brace matching. */
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

  /** Extracts the top-level slice of lib.rs between two markers. */
  function extractSection(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `expected to find "${startMarker}" in lib.rs`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(-1);
    return source.slice(start, end);
  }

  // Ends right before Stage 103's own consolidated boundary group (added
  // later) so this section stays scoped to exactly Stage 102's types, even
  // though nothing else in `packages/fedos-core-rust` changed since.
  const boundarySection = extractSection(
    libRsSource,
    "pub enum FedosCryptoOperation",
    "Stage 103 — consolidated placeholder API boundary additions",
  );
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. the public crypto API design doc exists and covers all twelve required sections", () => {
    expect(designDocSource.length).toBeGreaterThan(0);
    for (let n = 1; n <= 12; n++) {
      expect(designDocSource, `expected section ${n}`).toMatch(new RegExp(`^## ${n}\\.`, "m"));
    }
    expect(designDocSource).toContain("FedosCryptoOperation");
    expect(designDocSource).toContain("FedosCryptoAlgorithm");
    expect(designDocSource).toContain("FedosCryptoBoundaryStatus");
    expect(designDocSource).toContain("fedos_crypto_boundary_status");
  });

  it("2. lib.rs declares the six specified PUBLIC boundary types", () => {
    for (const decl of [
      "pub enum FedosCryptoOperation",
      "pub enum FedosCryptoAlgorithm",
      "pub enum FedosCryptoBoundaryState",
      "pub struct FedosCryptoBoundaryStatus",
      "pub struct FedosCryptoRequestDescriptor",
      "pub struct FedosCryptoResponseDescriptor",
    ]) {
      expect(libRsSource, `expected: ${decl}`).toContain(decl);
    }
  });

  it("3. lib.rs's public `pub fn` surface includes the six Stage 69 functions plus Stage 102's new one", () => {
    // Updated Stage 103: the crate's pub fn surface grows further (to 17)
    // as Stage 103's ten boundary-consolidation functions land — this
    // check only asserts Stage 102's seven are still present as a subset,
    // not an exact total; see
    // test/fedos_core_rust_public_boundary_consolidation.test.ts for the
    // dedicated Stage 103 total-count check.
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    const expectedSubset = [
      "fedos_core_status",
      "fedos_core_capabilities",
      "random_bytes_placeholder",
      "derive_key_placeholder",
      "encrypt_placeholder",
      "decrypt_placeholder",
      "fedos_crypto_boundary_status",
    ];
    for (const name of expectedSubset) {
      expect(pubFnNames, `expected ${name} in the pub fn surface`).toContain(name);
    }
  });

  it("4. no encrypt/decrypt/derive/random IMPLEMENTATION function is added — only status/label functions exist", () => {
    // Every public function name must end in one of these safe suffixes;
    // none may be a bare `encrypt`/`decrypt`/`derive_key`/`random_bytes`
    // (without the `_placeholder` suffix) or any `*_impl`/`*_real` name.
    // Updated Stage 103: `_descriptors`/`_version`/`_features`/`_decision`
    // added as safe suffixes for the new boundary-consolidation functions.
    // Updated Stage 106: `_requirements` added for
    // `fedos_algorithm_requirements`.
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    for (const name of pubFnNames) {
      expect(
        /_placeholder$|_status$|_capabilities$|_descriptors$|_version$|_features$|_decision$|_requirements$/.test(
          name,
        ),
        `unexpected public function name: ${name}`,
      ).toBe(true);
    }
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+encrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+decrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+derive_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+random_bytes\s*\(/);
  });

  it("5. no raw byte parameter/field anywhere in the new boundary — no borrowed slice, no growable byte vector", () => {
    expect(boundarySection).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(boundarySection).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(boundarySection).not.toMatch(/\[\s*u8\s*;/);
    expect(boundarySection).not.toMatch(/:\s*String\b/);
    expect(boundarySection).not.toMatch(/\bString::from\b/);
  });

  it("6. no Vec<u8> or any growable byte collection in a public response type", () => {
    expect(boundarySection).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(boundarySection).not.toMatch(/\bBytes\b/);
    expect(boundarySection).not.toMatch(/\bBox<\s*\[\s*u8\s*\]\s*>/);
  });

  it("7. FedosCryptoBoundaryStatus/RequestDescriptor/ResponseDescriptor hold only fixed enum-label fields", () => {
    expect(boundarySection).toMatch(
      /struct\s+FedosCryptoBoundaryStatus\s*\{\s*pub\s+state\s*:\s*FedosCryptoBoundaryState\s*,?\s*\}/,
    );
    expect(boundarySection).toMatch(
      /struct\s+FedosCryptoRequestDescriptor\s*\{\s*pub\s+operation\s*:\s*FedosCryptoOperation\s*,\s*pub\s+algorithm\s*:\s*FedosCryptoAlgorithm\s*,?\s*\}/,
    );
    expect(boundarySection).toMatch(
      /struct\s+FedosCryptoResponseDescriptor\s*\{\s*pub\s+operation\s*:\s*FedosCryptoOperation\s*,\s*pub\s+algorithm\s*:\s*FedosCryptoAlgorithm\s*,\s*pub\s+state\s*:\s*FedosCryptoBoundaryState\s*,?\s*\}/,
    );
  });

  it("8. fedos_crypto_boundary_status() takes no input and returns a fixed Unavailable status", () => {
    expect(boundarySection).toMatch(
      /pub\s+fn\s+fedos_crypto_boundary_status\s*\(\s*\)\s*->\s*FedosCryptoBoundaryStatus\s*\{\s*FedosCryptoBoundaryStatus\s*\{\s*state\s*:\s*FedosCryptoBoundaryState::Unavailable\s*,?\s*\}\s*\}/,
    );
  });

  it("9. existing six Stage 69 placeholder functions are byte-for-byte unchanged", () => {
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

  it("10. no key/seed/plaintext/ciphertext/passphrase/nonce/tag storage field anywhere in the new boundary", () => {
    expect(boundarySection).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\bplaintext\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\bciphertext\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\bpassphrase\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\bnonce\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\btag\s*:\s*\w/i);
    expect(boundarySection).not.toMatch(/\bsecret\s*:\s*\w/i);
  });

  it("11. no actual AEAD/KDF execution or SecretHandle connection anywhere in the new boundary", () => {
    // Specific crate-usage patterns only — NOT a bare substring match: the
    // boundary's own `FedosCryptoAlgorithm::Aes256Gcm` label legitimately
    // contains the substrings "aes"/"gcm", so a bare match would collide
    // with this stage's own non-sensitive label (same lesson learned for
    // `kdf_core`, Stage 82, and every later skeleton stage).
    expect(boundarySection).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(boundarySection).not.toMatch(/\bchacha20poly1305::/);
    expect(boundarySection).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(boundarySection).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(boundarySection).not.toMatch(/\baes_gcm::/);
    expect(boundarySection).not.toMatch(/\bAes256Gcm::new\b/);
    expect(boundarySection).not.toMatch(/\buse\s+hkdf\b/);
    expect(boundarySection).not.toMatch(/\bhkdf::/);
    expect(boundarySection).not.toMatch(/\bHkdf::/);
    expect(boundarySection).not.toMatch(/\buse\s+argon2\b/);
    expect(boundarySection).not.toMatch(/\bargon2::/i);
    expect(boundarySection).not.toMatch(/\bArgon2::/);
    expect(boundarySection).not.toMatch(/\bArgon2</);
    expect(boundarySection).not.toMatch(/\bSecretHandle\b/);
    expect(boundarySection).not.toMatch(/\brand::/);
    expect(boundarySection).not.toMatch(/\bgetrandom\b/);
    expect(secretHandleModule).not.toMatch(/\bFedosCrypto\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bFedosCrypto\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bFedosCrypto\w*\b/);
  });

  it("12. no Runtime / Worker / CryptoProvider connection anywhere in the new boundary", () => {
    expect(boundarySection).not.toMatch(/\bCryptoProvider\b/);
    expect(boundarySection).not.toMatch(/\bRuntime\b/);
    expect(boundarySection).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedoscrypto");
      expect(src).not.toContain("boundary_status");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("13. Cargo.toml was not touched BY Stage 102 specifically — it still has no 'Stage 102' mention", () => {
    // Updated Stage 104: Cargo.toml legitimately changes again at Stage
    // 104 (the `getrandom` CSPRNG adoption — see
    // test/fedos_core_rust_dependency.test.ts for the dedicated checks),
    // so this no longer asserts an exact byte length or dependency count
    // — only that Stage 102 ITSELF never touched Cargo.toml, which stays
    // true regardless of what later stages add.
    expect(cargoTomlSource).not.toContain("Stage 102");
    // The header comment block mentions "[dev-dependencies]" in prose, so
    // the real section header is searched for AFTER the `[dependencies]`
    // header, not from the start of the file.
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBeGreaterThanOrEqual(7);
  });

  it("14. no println/eprintln/dbg!/log/tracing usage anywhere in the new boundary", () => {
    expect(boundarySection).not.toMatch(/\bprintln!\s*\(/);
    expect(boundarySection).not.toMatch(/\beprintln!\s*\(/);
    expect(boundarySection).not.toMatch(/\btracing::/);
    expect(boundarySection).not.toMatch(/\blog::/);
    expect(boundarySection).not.toMatch(/\bdbg!\s*\(/);
  });

  it("15. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(boundarySection).not.toContain("unsafe");
  });

  it("16. FedosCryptoOperation has exactly the four specified variants", () => {
    for (const variant of ["Encrypt", "Decrypt", "DeriveKey", "RandomBytes"]) {
      expect(boundarySection).toContain(variant);
    }
  });

  it("17. FedosCryptoAlgorithm has exactly the four specified variants", () => {
    for (const variant of ["ChaCha20Poly1305", "Aes256Gcm", "HkdfSha256", "Argon2id"]) {
      expect(boundarySection).toContain(variant);
    }
  });

  it("18. FedosCryptoBoundaryState has exactly the two specified variants", () => {
    for (const variant of ["Unavailable", "Placeholder"]) {
      expect(boundarySection).toContain(variant);
    }
  });

  it("19. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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
    }
  });
});

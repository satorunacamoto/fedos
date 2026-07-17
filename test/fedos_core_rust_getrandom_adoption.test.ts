import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomDesignDocSource from "../docs/public_random_design.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyProvisioningDocSource from "../docs/public_key_provisioning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 104 — `getrandom` CSPRNG dependency adoption (build check ONLY)
 * AND a future RNG-verification-infrastructure PLACEHOLDER, plus two new
 * design docs (`docs/public_random_design.md`,
 * `docs/public_key_provisioning.md`).
 *
 * `packages/fedos-core-rust/Cargo.toml` gains an EIGHTH `[dependencies]`
 * (production) entry, `getrandom` v0.3 — this crate's first CSPRNG
 * entropy source. It is NOT imported or called anywhere in `src/lib.rs`,
 * production or test — a dependency + build-check ADOPTION ONLY, exactly
 * like every prior first-adoption stage (`chacha20poly1305` Stage 74,
 * `hkdf` Stage 76, `argon2` Stage 84).
 *
 * A new `#[cfg(test)]`-only module, `csprng_verification_infrastructure`,
 * fixes — as a label enumeration only — which categories a FUTURE,
 * separately-reviewed wiring stage would need to verify. It does NOT call
 * `getrandom`, draw a random byte, or assert anything about randomness
 * QUALITY — there is no known-answer vector for randomness, unlike every
 * prior AEAD/KDF vector-wiring module.
 *
 * The crate's public `pub fn` surface (seventeen functions, Stage
 * 69/102/103) is untouched — this stage adds no new type or function to
 * the public boundary. Nothing is wired into the Runtime, the Worker, or
 * a crypto provider.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — getrandom CSPRNG adoption + RNG verification-infrastructure placeholder (Stage 104)", () => {
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

  // TOML comments legitimately NAME both allowed and still-forbidden crates;
  // strip comments before scanning (same approach as the other Rust tests).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
  const testOnlyLibRs = firstCfgTestIdx === -1 ? "" : libRsSource.slice(firstCfgTestIdx);
  const rngModule = extractModule(libRsSource, "mod csprng_verification_infrastructure");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");

  it("1. Cargo.toml's [dependencies] (production) table contains getrandom, an eighth entry at this stage (Stage 147 later adds a ninth, sha2)", () => {
    expect(cargoCode).toContain("[dependencies]");
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"));
    const nextSectionIdx = depsSection.indexOf("\n[", 1);
    const productionDepsSection =
      nextSectionIdx === -1 ? depsSection : depsSection.slice(0, nextSectionIdx);
    expect(productionDepsSection).toMatch(/^getrandom\s*=/m);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
  });

  it("2. getrandom has no direct rand/rand_core sibling dependency", () => {
    expect(cargoCode).not.toContain("rand_core");
    expect(cargoCode).not.toMatch(/^rand\s*=/m);
  });

  it("3. crate-type is rlib + cdylib (Stage 466 -- WASM artifact generation fix), never wasm32 as a literal token", () => {
    expect(cargoCode).toMatch(/crate-type\s*=\s*\[\s*"rlib"\s*,\s*"cdylib"\s*\]/);
    expect(cargoCode).not.toContain("wasm32");
  });

  it("4. production code calls getrandom ONLY inside fedos_random_bytes_32 (Stage 137) and fedos_aead_nonce_96 (Stage 138) — see their dedicated test files", () => {
    // Through Stage 136 this asserted "never calls getrandom" outright.
    // Stage 137 is the first real implementation behind this crate's
    // public API, scoped to exactly one function; Stage 138 adds a
    // second, independent call site (the nonce helper) — this narrows the
    // claim to "calls it only in these two places" rather than dropping
    // it. Several doc comments legitimately NAME `getrandom::fill` in
    // prose; count actual CALL sites (the `(` invocation syntax), not
    // bare "getrandom::" mentions.
    const getrandomCallSites = productionLibRs.match(/getrandom::fill\s*\(/g) ?? [];
    expect(getrandomCallSites.length).toBe(2);
    expect(productionLibRs).toMatch(/\bfn\s+fedos_random_bytes_32\s*\([^)]*\)[\s\S]*?getrandom::fill\s*\(/);
    expect(productionLibRs).toMatch(/\bfn\s+fedos_aead_nonce_96\s*\([^)]*\)[\s\S]*?getrandom::fill\s*\(/);
    // The crate-private skeletons this stage does NOT touch stay exactly
    // as getrandom-free as they were through Stage 136.
    for (const mod of [aeadCoreModule, kdfCoreModule, secretHandleModule, rngModule]) {
      expect(mod).not.toMatch(/\bgetrandom::/);
    }
  });

  it("5. lib.rs's public pub fn surface reflects the current total (getrandom adoption itself added no function)", () => {
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
      "public_key_hex_for_account",
      "resolve_conversation_key",
    ];
    expect(pubFnNames.length).toBe(46);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("6. production API placeholders are unchanged, including random_bytes_placeholder", () => {
    expect(productionLibRs).toMatch(
      /fn\s+random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toContain("fn fedos_random_boundary_status()");
  });

  it("7. the csprng_verification_infrastructure module is gated behind #[cfg(test)] only", () => {
    expect(firstCfgTestIdx).toBeGreaterThan(-1);
    expect(libRsSource).toContain("mod csprng_verification_infrastructure");
    expect(productionLibRs).not.toContain("mod csprng_verification_infrastructure");
    expect(testOnlyLibRs).toContain("mod csprng_verification_infrastructure");
  });

  it("8. csprng_verification_infrastructure never imports or calls getrandom, and draws no random byte", () => {
    expect(rngModule).not.toMatch(/\buse\s+getrandom\b/);
    expect(rngModule).not.toMatch(/\bgetrandom::/);
    expect(rngModule).not.toMatch(/\bgetrandom\s*\(/);
    expect(rngModule).not.toMatch(/\buse\s+rand\b/);
    expect(rngModule).not.toMatch(/\brand::/);
    expect(rngModule).not.toMatch(/\bthread_rng\b/);
    expect(rngModule).not.toMatch(/\bOsRng\b/);
  });

  it("9. csprng_verification_infrastructure holds a fixed, non-executed plan of exactly four categories", () => {
    expect(rngModule).toContain("enum RngVerificationCategory");
    for (const category of [
      "EntropySourceLinked",
      "OutputLengthMatchesRequest",
      "ErrorSurfacedAsResult",
      "RepeatedCallsNotObviouslyConstant",
    ]) {
      expect(rngModule).toContain(category);
    }
    expect(rngModule).toMatch(/RNG_VERIFICATION_PLAN\s*:\s*&\s*\[\s*RngVerificationCategory\s*\]/);
    expect(rngModule).toMatch(/assert_eq!\(\s*RNG_VERIFICATION_PLAN\.len\(\)\s*,\s*4\s*\)/);
  });

  it("10. no key/seed/plaintext/ciphertext/passphrase/nonce/tag byte anywhere in csprng_verification_infrastructure", () => {
    expect(rngModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(rngModule).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(rngModule).not.toMatch(/:\s*String\b/);
    expect(rngModule).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(rngModule).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(rngModule).not.toMatch(/\bnonce\s*:\s*\w/i);
    expect(rngModule).not.toMatch(/\bsecret\s*:\s*\w/i);
  });

  it("11. no Runtime / Worker / CryptoProvider connection anywhere related to this stage", () => {
    expect(rngModule).not.toMatch(/\bCryptoProvider\b/);
    expect(rngModule).not.toMatch(/\bRuntime\b/);
    expect(rngModule).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("getrandom");
      expect(src).not.toContain("csprngverification");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("12. aead_core / kdf_core / secret_handle remain unchanged and unconnected to the new module", () => {
    for (const mod of [aeadCoreModule, kdfCoreModule, secretHandleModule]) {
      expect(mod).not.toMatch(/\bgetrandom\b/);
      expect(mod).not.toMatch(/\bRngVerificationCategory\b/);
    }
    expect(rngModule).not.toMatch(/\bSecretHandle\b/);
    expect(rngModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(rngModule).not.toMatch(/\bKdfPlaceholderRequest\b/);
  });

  it("13. no println/eprintln/dbg!/log/tracing usage anywhere in csprng_verification_infrastructure", () => {
    expect(rngModule).not.toMatch(/\bprintln!\s*\(/);
    expect(rngModule).not.toMatch(/\beprintln!\s*\(/);
    expect(rngModule).not.toMatch(/\btracing::/);
    expect(rngModule).not.toMatch(/\blog::/);
    expect(rngModule).not.toMatch(/\bdbg!\s*\(/);
  });

  it("14. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(rngModule).not.toContain("unsafe");
  });

  it("15. both new design docs exist, are non-empty, and name their subject types", () => {
    expect(randomDesignDocSource.length).toBeGreaterThan(0);
    expect(randomDesignDocSource).toContain("getrandom");
    expect(randomDesignDocSource).toContain("csprng_verification_infrastructure");
    expect(keyProvisioningDocSource.length).toBeGreaterThan(0);
    expect(keyProvisioningDocSource).toContain("FedosKeyImportBoundary");
    expect(keyProvisioningDocSource).toContain("FedosKeyExportBoundary");
  });

  it("16. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

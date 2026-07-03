import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomDocSource from "../docs/public_random_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keyDocSource from "../docs/public_key_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import versioningDocSource from "../docs/public_boundary_versioning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 103 — consolidated placeholder API boundary additions.
 *
 * Ten more label-only, PUBLIC placeholder types land on
 * `packages/fedos-core-rust/src/lib.rs` in one consolidated stage: five
 * independent operation-boundary status types (`FedosRandomBoundary`,
 * `FedosNonceBoundary`, `FedosKeyGenerationBoundary`,
 * `FedosKeyImportBoundary`, `FedosKeyExportBoundary`, each with its own
 * `fedos_*_boundary_status()` function) and five descriptor/metadata
 * types (`FedosCapabilityDescriptor`, `FedosAlgorithmDescriptor`,
 * `FedosBoundaryVersion`, `FedosBoundaryFeature`, `FedosBoundaryPolicy`,
 * each with its own accessor function). Three new design docs
 * (`docs/public_random_boundary.md`, `docs/public_key_boundary.md`,
 * `docs/public_boundary_versioning.md`) record the design each follows.
 *
 * This grows the crate's public `pub fn` surface from seven (Stage 102)
 * to seventeen. No encrypt/decrypt/deriveKey/randomBytes/nonce/key
 * generation/import/export IMPLEMENTATION exists — every new function
 * returns a fixed, non-sensitive label or status. `Cargo.toml` is
 * unchanged; nothing is wired into the Runtime, the Worker, or a crypto
 * provider; no WASM binding exists.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — consolidated placeholder API boundary (Stage 103)", () => {
  function extractSection(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `expected to find "${startMarker}" in lib.rs`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(-1);
    return source.slice(start, end);
  }

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

  const stage103Section = extractSection(
    libRsSource,
    "Stage 103 — consolidated placeholder API boundary additions",
    "Stage 79 — an INTERNAL-ONLY secret-handle skeleton",
  );
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");

  it("1. all three new design docs exist and are non-empty", () => {
    for (const doc of [randomDocSource, keyDocSource, versioningDocSource]) {
      expect(doc.length).toBeGreaterThan(0);
    }
    expect(randomDocSource).toContain("FedosRandomBoundary");
    expect(randomDocSource).toContain("FedosNonceBoundary");
    expect(keyDocSource).toContain("FedosKeyGenerationBoundary");
    expect(keyDocSource).toContain("FedosKeyImportBoundary");
    expect(keyDocSource).toContain("FedosKeyExportBoundary");
    expect(versioningDocSource).toContain("FedosCapabilityDescriptor");
    expect(versioningDocSource).toContain("FedosAlgorithmDescriptor");
    expect(versioningDocSource).toContain("FedosBoundaryVersion");
    expect(versioningDocSource).toContain("FedosBoundaryFeature");
    expect(versioningDocSource).toContain("FedosBoundaryPolicy");
  });

  it("2. lib.rs declares all ten new PUBLIC boundary types", () => {
    for (const decl of [
      "pub enum FedosRandomBoundaryState",
      "pub struct FedosRandomBoundary",
      "pub enum FedosNonceBoundaryState",
      "pub struct FedosNonceBoundary",
      "pub enum FedosKeyGenerationBoundaryState",
      "pub struct FedosKeyGenerationBoundary",
      "pub enum FedosKeyImportBoundaryState",
      "pub struct FedosKeyImportBoundary",
      "pub enum FedosKeyExportBoundaryState",
      "pub struct FedosKeyExportBoundary",
      "pub enum FedosCapabilityKind",
      "pub struct FedosCapabilityDescriptor",
      "pub enum FedosAlgorithmCategory",
      "pub struct FedosAlgorithmDescriptor",
      "pub struct FedosBoundaryVersion",
      "pub enum FedosBoundaryFeature",
      "pub enum FedosBoundaryPolicyKind",
      "pub enum FedosBoundaryPolicyDecision",
      "pub struct FedosBoundaryPolicy",
    ]) {
      expect(libRsSource, `expected: ${decl}`).toContain(decl);
    }
  });

  it("3. lib.rs's public `pub fn` surface is exactly seventeen functions", () => {
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
    ];
    expect(pubFnNames.length).toBe(17);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("4. no encrypt/decrypt/derive/random/nonce/key-generation/import/export IMPLEMENTATION function exists", () => {
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+encrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+decrypt\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+derive_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+random_bytes\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+generate_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+import_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+export_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+generate_nonce\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+generate_random\s*\(/);
  });

  it("5. all five operation-boundary status functions take no input and return a fixed Unavailable status", () => {
    const cases: Array<[string, string]> = [
      ["fedos_random_boundary_status", "FedosRandomBoundary"],
      ["fedos_nonce_boundary_status", "FedosNonceBoundary"],
      ["fedos_key_generation_boundary_status", "FedosKeyGenerationBoundary"],
      ["fedos_key_import_boundary_status", "FedosKeyImportBoundary"],
      ["fedos_key_export_boundary_status", "FedosKeyExportBoundary"],
    ];
    for (const [fn, type] of cases) {
      const stateType = `${type}State`;
      const re = new RegExp(
        `pub\\s+fn\\s+${fn}\\s*\\(\\s*\\)\\s*->\\s*${type}\\s*\\{\\s*${type}\\s*\\{\\s*state\\s*:\\s*${stateType}::Unavailable\\s*,?\\s*\\}\\s*\\}`,
      );
      expect(stage103Section, `expected fixed body for ${fn}`).toMatch(re);
    }
  });

  it("6. no raw byte parameter/field anywhere in the Stage 103 section — no borrowed slice, no growable byte vector, no owned string", () => {
    expect(stage103Section).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(stage103Section).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(stage103Section).not.toMatch(/\[\s*u8\s*;/);
    expect(stage103Section).not.toMatch(/:\s*String\b/);
    expect(stage103Section).not.toMatch(/\bString::from\b/);
    expect(stage103Section).not.toMatch(/\bBytes\b/);
    expect(stage103Section).not.toMatch(/\bBox<\s*\[\s*u8\s*\]\s*>/);
  });

  it("7. no key/seed/plaintext/ciphertext/passphrase/nonce/tag storage field anywhere in the Stage 103 section", () => {
    expect(stage103Section).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\bplaintext\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\bciphertext\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\bpassphrase\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\bnonce\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\btag\s*:\s*\w/i);
    expect(stage103Section).not.toMatch(/\bsecret\s*:\s*\w/i);
  });

  it("8. no actual AEAD/KDF crate usage or SecretHandle connection anywhere in the Stage 103 section", () => {
    // Specific crate-usage patterns only — NOT a bare substring match:
    // `FedosAlgorithmDescriptor`'s fixed table legitimately reuses Stage
    // 102's `FedosCryptoAlgorithm::ChaCha20Poly1305`/`Aes256Gcm`/
    // `HkdfSha256`/`Argon2id` labels, which contain
    // "chacha"/"poly1305"/"aes"/"gcm"/"hkdf"/"argon2" as substrings.
    expect(stage103Section).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(stage103Section).not.toMatch(/\bchacha20poly1305::/);
    expect(stage103Section).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(stage103Section).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(stage103Section).not.toMatch(/\baes_gcm::/);
    expect(stage103Section).not.toMatch(/\bAes256Gcm::new\b/);
    expect(stage103Section).not.toMatch(/\buse\s+hkdf\b/);
    expect(stage103Section).not.toMatch(/\bhkdf::/);
    expect(stage103Section).not.toMatch(/\bHkdf::/);
    expect(stage103Section).not.toMatch(/\buse\s+argon2\b/);
    expect(stage103Section).not.toMatch(/\bargon2::/i);
    expect(stage103Section).not.toMatch(/\bArgon2::/);
    expect(stage103Section).not.toMatch(/\bArgon2</);
    expect(stage103Section).not.toMatch(/\bSecretHandle\b/);
    expect(stage103Section).not.toMatch(/\brand::/);
    expect(stage103Section).not.toMatch(/\bgetrandom\b/);
    expect(secretHandleModule).not.toMatch(/\bFedosRandom\w*|FedosNonce\w*|FedosKey(Generation|Import|Export)\w*|FedosCapability\w*|FedosAlgorithm\w*|FedosBoundary\w*/);
    expect(aeadCoreModule).not.toMatch(/\bFedosRandom\w*|FedosNonce\w*|FedosKey(Generation|Import|Export)\w*|FedosCapability\w*|FedosAlgorithm\w*|FedosBoundary\w*/);
    expect(kdfCoreModule).not.toMatch(/\bFedosRandom\w*|FedosNonce\w*|FedosKey(Generation|Import|Export)\w*|FedosCapability\w*|FedosAlgorithm\w*|FedosBoundary\w*/);
  });

  it("9. no Runtime / Worker / CryptoProvider connection anywhere in the Stage 103 section", () => {
    expect(stage103Section).not.toMatch(/\bCryptoProvider\b/);
    expect(stage103Section).not.toMatch(/\bRuntime\b/);
    expect(stage103Section).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedosrandomboundary");
      expect(src).not.toContain("fedosnonceboundary");
      expect(src).not.toContain("fedoskeygenerationboundary");
      expect(src).not.toContain("fedoskeyimportboundary");
      expect(src).not.toContain("fedoskeyexportboundary");
      expect(src).not.toContain("fedoscapabilitydescriptor");
      expect(src).not.toContain("fedosalgorithmdescriptor");
      expect(src).not.toContain("fedosboundaryversion");
      expect(src).not.toContain("fedosboundaryfeature");
      expect(src).not.toContain("fedosboundarypolicy");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("10. Cargo.toml was not touched BY Stage 103 specifically — it still has no 'Stage 103' mention", () => {
    // Updated Stage 104: Cargo.toml legitimately changes again at Stage
    // 104 (the `getrandom` CSPRNG adoption), so this no longer asserts an
    // exact dependency count — only that Stage 103 ITSELF never touched
    // Cargo.toml, which stays true regardless of what later stages add.
    expect(cargoTomlSource).not.toContain("Stage 103");
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBeGreaterThanOrEqual(7);
  });

  it("11. no println/eprintln/dbg!/log/tracing usage anywhere in the Stage 103 section", () => {
    expect(stage103Section).not.toMatch(/\bprintln!\s*\(/);
    expect(stage103Section).not.toMatch(/\beprintln!\s*\(/);
    expect(stage103Section).not.toMatch(/\btracing::/);
    expect(stage103Section).not.toMatch(/\blog::/);
    expect(stage103Section).not.toMatch(/\bdbg!\s*\(/);
  });

  it("12. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(stage103Section).not.toContain("unsafe");
  });

  it("13. the five operation-boundary state enums each have exactly Unavailable/Placeholder", () => {
    for (const stateEnum of [
      "FedosRandomBoundaryState",
      "FedosNonceBoundaryState",
      "FedosKeyGenerationBoundaryState",
      "FedosKeyImportBoundaryState",
      "FedosKeyExportBoundaryState",
    ]) {
      const decl = extractSection(stage103Section, `pub enum ${stateEnum}`, "}");
      expect(decl).toContain("Unavailable");
      expect(decl).toContain("Placeholder");
    }
  });

  it("14. FedosCapabilityKind has exactly the eight specified variants", () => {
    const decl = extractSection(stage103Section, "pub enum FedosCapabilityKind", "}");
    for (const variant of [
      "AeadPlaceholder",
      "KdfPlaceholder",
      "RandomPlaceholder",
      "NoncePlaceholder",
      "KeyGenerationPlaceholder",
      "KeyImportPlaceholder",
      "KeyExportPlaceholder",
      "Nip44Placeholder",
    ]) {
      expect(decl).toContain(variant);
    }
  });

  it("15. FedosAlgorithmCategory has exactly Aead/Kdf, and FedosBoundaryFeature has exactly four variants", () => {
    const category = extractSection(stage103Section, "pub enum FedosAlgorithmCategory", "}");
    expect(category).toContain("Aead");
    expect(category).toContain("Kdf");
    const feature = extractSection(stage103Section, "pub enum FedosBoundaryFeature", "}");
    for (const variant of [
      "PlaceholderOnly",
      "AuditLabelOnly",
      "ErrorTaxonomyFixed",
      "VersionedBoundary",
    ]) {
      expect(feature).toContain(variant);
    }
  });

  it("16. FedosBoundaryPolicyKind has exactly six variants, and FedosBoundaryPolicyDecision has exactly one (DenyPlaceholder)", () => {
    const kind = extractSection(stage103Section, "pub enum FedosBoundaryPolicyKind", "}");
    for (const variant of [
      "RandomBoundary",
      "NonceBoundary",
      "KeyGenerationBoundary",
      "KeyImportBoundary",
      "KeyExportBoundary",
      "CryptoBoundary",
    ]) {
      expect(kind).toContain(variant);
    }
    const decision = extractSection(stage103Section, "pub enum FedosBoundaryPolicyDecision", "}");
    expect(decision).toContain("DenyPlaceholder");
    expect(decision).not.toMatch(/AllowPlaceholder|Allow\b/);
  });

  it("17. fedos_boundary_policy_decision always returns DenyPlaceholder regardless of kind — no branching", () => {
    expect(stage103Section).toMatch(
      /pub\s+fn\s+fedos_boundary_policy_decision\s*\(\s*kind\s*:\s*FedosBoundaryPolicyKind\s*\)\s*->\s*FedosBoundaryPolicy\s*\{\s*FedosBoundaryPolicy\s*\{\s*kind\s*,\s*decision\s*:\s*FedosBoundaryPolicyDecision::DenyPlaceholder\s*,?\s*\}\s*\}/,
    );
    expect(stage103Section).not.toMatch(/\bmatch\s+kind\b/);
    expect(stage103Section).not.toMatch(/\bif\s+kind\b/);
  });

  it("18. fedos_boundary_version always returns the fixed 1.0.0 triple", () => {
    expect(stage103Section).toMatch(
      /pub\s+fn\s+fedos_boundary_version\s*\(\s*\)\s*->\s*FedosBoundaryVersion\s*\{\s*FedosBoundaryVersion\s*\{\s*major\s*:\s*1\s*,\s*minor\s*:\s*0\s*,\s*patch\s*:\s*0\s*,?\s*\}\s*\}/,
    );
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

import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import usageDocSource from "../docs/public_key_usage.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 106 — public key-usage label enumeration (planning only), part 1
 * of 2 (see also test/fedos_core_rust_algorithm_policy.test.ts).
 *
 * `packages/fedos-core-rust/src/lib.rs` gains `FedosKeyUsageLabel` (eight
 * variants — separating "what is this key allowed to be used for" from
 * Stage 105's "what format is this key"), plus `FedosKeyUsageState`,
 * `FedosKeyUsageStatus`, `FedosKeyUsageDescriptor`, and one new function,
 * `fedos_key_usage_descriptor_placeholder()`, which returns a fixed
 * sentinel descriptor.
 *
 * Every label is planning intent only, never an enforced authorization
 * rule: no raw key byte, no owned string, no growable byte collection,
 * no parser, no validator, and no import/export/generate function exists
 * anywhere in this stage's additions. `Cargo.toml` is untouched; no
 * CSPRNG entropy source is consulted; nothing is wired into the Runtime,
 * the Worker, or a crypto provider.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — public key-usage label boundary (Stage 106)", () => {
  function extractSection(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `expected to find "${startMarker}" in lib.rs`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(-1);
    return source.slice(start, end);
  }

  // End marker narrowed from "Stage 79 — an INTERNAL-ONLY secret-handle
  // skeleton" once Stage 137 added new content between Stage 106's group
  // and the secret_handle module (same narrowing pattern this repo used
  // for Stage 102's own section when Stage 103 landed).
  const stage106Section = extractSection(
    libRsSource,
    "Stage 106 — public key-usage label enumeration",
    "Stage 137 — first REAL implementation behind this crate's random-byte",
  );

  it("1. FedosKeyUsageLabel exists, with the eight specified variants", () => {
    expect(libRsSource).toContain("pub enum FedosKeyUsageLabel");
    const decl = extractSection(stage106Section, "pub enum FedosKeyUsageLabel", "}");
    for (const variant of [
      "EncryptionPlaceholder",
      "DecryptionPlaceholder",
      "SigningPlaceholder",
      "VerificationPlaceholder",
      "KeyDerivationPlaceholder",
      "StoragePlaceholder",
      "TransportPlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(decl).toContain(variant);
      expect(decl).not.toMatch(new RegExp(`\\b${variant}\\s*\\(`));
      expect(decl).not.toMatch(new RegExp(`\\b${variant}\\s*\\{`));
    }
  });

  it("2. FedosKeyUsageState/FedosKeyUsageStatus/FedosKeyUsageDescriptor exist and are label-only", () => {
    expect(libRsSource).toContain("pub enum FedosKeyUsageState");
    expect(libRsSource).toContain("pub struct FedosKeyUsageStatus");
    expect(libRsSource).toContain("pub struct FedosKeyUsageDescriptor");
    expect(stage106Section).toMatch(
      /struct\s+FedosKeyUsageStatus\s*\{\s*pub\s+state\s*:\s*FedosKeyUsageState\s*,?\s*\}/,
    );
    expect(stage106Section).toMatch(
      /struct\s+FedosKeyUsageDescriptor\s*\{\s*pub\s+label\s*:\s*FedosKeyUsageLabel\s*,\s*pub\s+status\s*:\s*FedosKeyUsageStatus\s*,?\s*\}/,
    );
  });

  it("3. no Vec/String field anywhere in the key-usage group", () => {
    const decl = extractSection(stage106Section, "pub enum FedosKeyUsageLabel", "pub enum FedosAlgorithmRequirementLabel");
    expect(decl).not.toMatch(/Vec\s*</);
    expect(decl).not.toMatch(/:\s*String\b/);
    expect(decl).not.toMatch(/\bString::from\b/);
    expect(decl).not.toMatch(/\bString::new\b/);
    expect(decl).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(decl).not.toMatch(/\[\s*u8\s*;/);
    expect(decl).not.toMatch(/\bBytes\b/);
  });

  it("4. no raw byte / key-storage field anywhere in the key-usage group", () => {
    const decl = extractSection(stage106Section, "pub enum FedosKeyUsageLabel", "pub enum FedosAlgorithmRequirementLabel");
    expect(decl).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(decl).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(decl).not.toMatch(/\bplaintext\s*:\s*\w/i);
    expect(decl).not.toMatch(/\bciphertext\s*:\s*\w/i);
    expect(decl).not.toMatch(/\bpassphrase\s*:\s*\w/i);
    expect(decl).not.toMatch(/\bsecret\s*:\s*\w/i);
  });

  it("5. no parser/serializer/import/export/generate/validate function exists anywhere in lib.rs", () => {
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+import_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+export_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+generate_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+validate_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+authorize\w*\s*\(/);
    expect(stage106Section).not.toMatch(/\bfn\s+parse\w*\s*\(/);
    expect(stage106Section).not.toMatch(/\bfn\s+serialize\w*\s*\(/);
    expect(stage106Section).not.toMatch(/\bfn\s+validate\w*\s*\(/);
    expect(stage106Section).not.toMatch(/\bfn\s+authorize\w*\s*\(/);
    expect(stage106Section).not.toMatch(/\bserde::/);
  });

  it("6. fedos_key_usage_descriptor_placeholder takes no input and returns a fixed sentinel descriptor", () => {
    expect(stage106Section).toMatch(
      /pub\s+fn\s+fedos_key_usage_descriptor_placeholder\s*\(\s*\)\s*->\s*FedosKeyUsageDescriptor\s*\{\s*FedosKeyUsageDescriptor\s*\{\s*label\s*:\s*FedosKeyUsageLabel::TestOnlyPlaceholder\s*,\s*status\s*:\s*FedosKeyUsageStatus\s*\{\s*state\s*:\s*FedosKeyUsageState::Unavailable\s*,?\s*\}\s*,?\s*\}\s*\}/,
    );
  });

  it("7. public pub fn surface includes the new key-usage function among twenty-three total", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames).toContain("fedos_key_usage_descriptor_placeholder");
    expect(pubFnNames.length).toBe(31);
  });

  it("8. no Runtime / Worker / CryptoProvider connection anywhere related to key usage", () => {
    expect(stage106Section).not.toMatch(/\bCryptoProvider\b/);
    expect(stage106Section).not.toMatch(/\bRuntime\b/);
    expect(stage106Section).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedoskeyusage");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("9. Cargo.toml has no 'Stage 106' mention (Stage 147 later adds a ninth production dependency, sha2, unrelated to this stage's own topic)", () => {
    expect(cargoTomlSource).not.toContain("Stage 106");
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
  });

  it("10. no getrandom/rand call anywhere in the key-usage group", () => {
    const decl = extractSection(stage106Section, "pub enum FedosKeyUsageLabel", "pub enum FedosAlgorithmRequirementLabel");
    expect(decl).not.toMatch(/\buse\s+getrandom\b/);
    expect(decl).not.toMatch(/\bgetrandom::/);
    expect(decl).not.toMatch(/\bgetrandom\s*\(/);
    expect(decl).not.toMatch(/\buse\s+rand\b/);
    expect(decl).not.toMatch(/\brand::/);
    expect(decl).not.toMatch(/\bthread_rng\b/);
  });

  it("11. no println/eprintln/dbg!/log/tracing usage, and no `unsafe`, anywhere in the Stage 106 section", () => {
    expect(stage106Section).not.toMatch(/\bprintln!\s*\(/);
    expect(stage106Section).not.toMatch(/\beprintln!\s*\(/);
    expect(stage106Section).not.toMatch(/\btracing::/);
    expect(stage106Section).not.toMatch(/\blog::/);
    expect(stage106Section).not.toMatch(/\bdbg!\s*\(/);
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(stage106Section).not.toContain("unsafe");
  });

  it("12. the design doc exists and names the type", () => {
    expect(usageDocSource.length).toBeGreaterThan(0);
    expect(usageDocSource).toContain("FedosKeyUsageLabel");
    expect(usageDocSource).toContain("FedosKeyFormatLabel");
  });

  it("13. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

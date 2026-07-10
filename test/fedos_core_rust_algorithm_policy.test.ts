import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import policyDocSource from "../docs/public_algorithm_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 106 — public algorithm policy metadata (planning only), part 2 of
 * 2 (see also test/fedos_core_rust_key_usage_label.test.ts).
 *
 * `packages/fedos-core-rust/src/lib.rs` gains three fixed relational
 * label tables over Stage 102's four `FedosCryptoAlgorithm` candidates:
 * `FedosAlgorithmRequirement` (`fedos_algorithm_requirements()`),
 * `FedosAlgorithmCapability` (`fedos_algorithm_capabilities()`), and
 * `FedosAlgorithmPolicy` (`fedos_algorithm_policy_decision(algorithm)`,
 * mirroring Stage 103's `FedosBoundaryPolicy` always-deny pattern).
 *
 * Every label is planning intent only, never a real validation rule,
 * capability grant, or enforced approval: no raw byte, no owned string,
 * no growable byte collection exists anywhere in this stage's additions.
 * `Cargo.toml` is untouched; no CSPRNG entropy source is consulted;
 * nothing is wired into the Runtime, the Worker, or a crypto provider.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — public algorithm policy metadata (Stage 106)", () => {
  function extractSection(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `expected to find "${startMarker}" in lib.rs`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(-1);
    return source.slice(start, end);
  }

  const stage106Section = extractSection(
    libRsSource,
    "Stage 106 — public key-usage label enumeration",
    "Stage 137 — first REAL implementation behind this crate's random-byte",
  );
  // The algorithm-policy group is the tail of stage106Section, starting
  // at its first declaration — sliced directly, since stage106Section
  // itself already ends right where Stage 137's marker begins (narrowed
  // from "Stage 79" once Stage 137 added new content between Stage 106's
  // group and the secret_handle module — same narrowing pattern this
  // repo used for Stage 102's own section when Stage 103 landed).
  const algorithmPolicyStart = stage106Section.indexOf("pub enum FedosAlgorithmRequirementLabel");
  expect(algorithmPolicyStart, "expected to find FedosAlgorithmRequirementLabel").toBeGreaterThan(
    -1,
  );
  const algorithmPolicySection = stage106Section.slice(algorithmPolicyStart);

  it("1. FedosAlgorithmRequirementLabel/FedosAlgorithmRequirement exist, label-only", () => {
    expect(libRsSource).toContain("pub enum FedosAlgorithmRequirementLabel");
    expect(libRsSource).toContain("pub struct FedosAlgorithmRequirement");
    const decl = extractSection(
      algorithmPolicySection,
      "pub enum FedosAlgorithmRequirementLabel",
      "}",
    );
    for (const variant of [
      "RequiresKeyPlaceholder",
      "RequiresNoncePlaceholder",
      "RequiresSaltPlaceholder",
      "RequiresNoAdditionalInputPlaceholder",
    ]) {
      expect(decl).toContain(variant);
      expect(decl).not.toMatch(new RegExp(`\\b${variant}\\s*\\(`));
    }
    expect(algorithmPolicySection).toMatch(
      /struct\s+FedosAlgorithmRequirement\s*\{\s*pub\s+algorithm\s*:\s*FedosCryptoAlgorithm\s*,\s*pub\s+requirement\s*:\s*FedosAlgorithmRequirementLabel\s*,?\s*\}/,
    );
  });

  it("2. FedosAlgorithmCapabilityLabel/FedosAlgorithmCapability exist, label-only", () => {
    expect(libRsSource).toContain("pub enum FedosAlgorithmCapabilityLabel");
    expect(libRsSource).toContain("pub struct FedosAlgorithmCapability");
    const decl = extractSection(
      algorithmPolicySection,
      "pub enum FedosAlgorithmCapabilityLabel",
      "}",
    );
    for (const variant of ["AeadEncryptPlaceholder", "AeadDecryptPlaceholder", "KdfDerivePlaceholder"]) {
      expect(decl).toContain(variant);
      expect(decl).not.toMatch(new RegExp(`\\b${variant}\\s*\\(`));
    }
    expect(algorithmPolicySection).toMatch(
      /struct\s+FedosAlgorithmCapability\s*\{\s*pub\s+algorithm\s*:\s*FedosCryptoAlgorithm\s*,\s*pub\s+capability\s*:\s*FedosAlgorithmCapabilityLabel\s*,?\s*\}/,
    );
  });

  it("3. FedosAlgorithmPolicyDecision/FedosAlgorithmPolicy exist — a single, always-deny decision", () => {
    expect(libRsSource).toContain("pub enum FedosAlgorithmPolicyDecision");
    expect(libRsSource).toContain("pub struct FedosAlgorithmPolicy");
    const decl = extractSection(
      algorithmPolicySection,
      "pub enum FedosAlgorithmPolicyDecision",
      "}",
    );
    expect(decl).toContain("NotYetApprovedPlaceholder");
    expect(algorithmPolicySection).toMatch(
      /struct\s+FedosAlgorithmPolicy\s*\{\s*pub\s+algorithm\s*:\s*FedosCryptoAlgorithm\s*,\s*pub\s+decision\s*:\s*FedosAlgorithmPolicyDecision\s*,?\s*\}/,
    );
  });

  it("4. fedos_algorithm_requirements/fedos_algorithm_capabilities are fixed const-backed slices, no dynamic collection", () => {
    expect(algorithmPolicySection).toMatch(
      /const\s+FEDOS_ALGORITHM_REQUIREMENTS\s*:\s*&\s*\[\s*FedosAlgorithmRequirement\s*\]/,
    );
    expect(algorithmPolicySection).toMatch(
      /pub\s+fn\s+fedos_algorithm_requirements\s*\(\s*\)\s*->\s*&'static\s*\[\s*FedosAlgorithmRequirement\s*\]\s*\{\s*FEDOS_ALGORITHM_REQUIREMENTS\s*\}/,
    );
    expect(algorithmPolicySection).toMatch(
      /const\s+FEDOS_ALGORITHM_CAPABILITIES\s*:\s*&\s*\[\s*FedosAlgorithmCapability\s*\]/,
    );
    expect(algorithmPolicySection).toMatch(
      /pub\s+fn\s+fedos_algorithm_capabilities\s*\(\s*\)\s*->\s*&'static\s*\[\s*FedosAlgorithmCapability\s*\]\s*\{\s*FEDOS_ALGORITHM_CAPABILITIES\s*\}/,
    );
    expect(algorithmPolicySection).not.toMatch(/\bVec::new\b/);
    expect(algorithmPolicySection).not.toMatch(/\bvec!\s*\[/);
    expect(algorithmPolicySection).not.toMatch(/\bHashMap\b/);
    expect(algorithmPolicySection).not.toMatch(/\blazy_static\b/);
    expect(algorithmPolicySection).not.toMatch(/\bonce_cell\b/);
  });

  it("5. fedos_algorithm_policy_decision always returns NotYetApprovedPlaceholder regardless of algorithm — no branching", () => {
    expect(algorithmPolicySection).toMatch(
      /pub\s+fn\s+fedos_algorithm_policy_decision\s*\(\s*algorithm\s*:\s*FedosCryptoAlgorithm\s*\)\s*->\s*FedosAlgorithmPolicy\s*\{\s*FedosAlgorithmPolicy\s*\{\s*algorithm\s*,\s*decision\s*:\s*FedosAlgorithmPolicyDecision::NotYetApprovedPlaceholder\s*,?\s*\}\s*\}/,
    );
    expect(algorithmPolicySection).not.toMatch(/\bmatch\s+algorithm\b/);
    expect(algorithmPolicySection).not.toMatch(/\bif\s+algorithm\b/);
  });

  it("6. no Vec<u8>/String/raw-byte field anywhere in the algorithm-policy group", () => {
    expect(algorithmPolicySection).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(algorithmPolicySection).not.toMatch(/:\s*String\b/);
    expect(algorithmPolicySection).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(algorithmPolicySection).not.toMatch(/\[\s*u8\s*;/);
    expect(algorithmPolicySection).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(algorithmPolicySection).not.toMatch(/\bnonce\s*:\s*\w/i);
    expect(algorithmPolicySection).not.toMatch(/\bsecret\s*:\s*\w/i);
  });

  it("7. no actual AEAD/KDF crate usage anywhere — specific crate-usage patterns only, not a bare substring match", () => {
    // The fixed requirement/capability tables legitimately reuse Stage
    // 102's `FedosCryptoAlgorithm::ChaCha20Poly1305`/`Aes256Gcm`/
    // `HkdfSha256`/`Argon2id` labels, which contain
    // "chacha"/"poly1305"/"aes"/"gcm"/"hkdf"/"argon2" as substrings.
    expect(algorithmPolicySection).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(algorithmPolicySection).not.toMatch(/\bChaCha20Poly1305::new\b/);
    expect(algorithmPolicySection).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(algorithmPolicySection).not.toMatch(/\bAes256Gcm::new\b/);
    expect(algorithmPolicySection).not.toMatch(/\buse\s+hkdf\b/);
    expect(algorithmPolicySection).not.toMatch(/\bHkdf::/);
    expect(algorithmPolicySection).not.toMatch(/\buse\s+argon2\b/);
    expect(algorithmPolicySection).not.toMatch(/\bArgon2::/);
  });

  it("8. no Runtime / Worker / CryptoProvider connection anywhere related to algorithm policy", () => {
    expect(algorithmPolicySection).not.toMatch(/\bCryptoProvider\b/);
    expect(algorithmPolicySection).not.toMatch(/\bRuntime\b/);
    expect(algorithmPolicySection).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedosalgorithmpolicy");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
    }
  });

  it("9. Cargo.toml has no 'Stage 106' mention (Stage 147 later adds a ninth production dependency, sha2, unrelated to this stage's own topic)", () => {
    expect(cargoTomlSource).not.toContain("Stage 106");
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    // Updated Stage 147: sha2 promoted to [dependencies] makes this nine.
    expect(depLines.length).toBe(11);
  });

  it("10. no getrandom/rand call anywhere in the algorithm-policy group", () => {
    expect(algorithmPolicySection).not.toMatch(/\buse\s+getrandom\b/);
    expect(algorithmPolicySection).not.toMatch(/\bgetrandom::/);
    expect(algorithmPolicySection).not.toMatch(/\bgetrandom\s*\(/);
    expect(algorithmPolicySection).not.toMatch(/\buse\s+rand\b/);
    expect(algorithmPolicySection).not.toMatch(/\brand::/);
  });

  it("11. no `unsafe`, no println!/log usage anywhere in the algorithm-policy group", () => {
    expect(algorithmPolicySection).not.toContain("unsafe");
    expect(algorithmPolicySection).not.toMatch(/\bprintln!\s*\(/);
    expect(algorithmPolicySection).not.toMatch(/\btracing::/);
    expect(algorithmPolicySection).not.toMatch(/\blog::/);
  });

  it("12. public pub fn surface includes all three new algorithm-policy functions among twenty-three total", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    for (const fn of [
      "fedos_algorithm_requirements",
      "fedos_algorithm_capabilities",
      "fedos_algorithm_policy_decision",
    ]) {
      expect(pubFnNames).toContain(fn);
    }
    expect(pubFnNames.length).toBe(36);
  });

  it("13. the design doc exists and names all three types", () => {
    expect(policyDocSource.length).toBeGreaterThan(0);
    expect(policyDocSource).toContain("FedosAlgorithmRequirement");
    expect(policyDocSource).toContain("FedosAlgorithmCapability");
    expect(policyDocSource).toContain("FedosAlgorithmPolicy");
  });

  it("14. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

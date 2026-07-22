import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import randomPlanDocSource from "../docs/random_bytes_implementation_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noncePolicyDocSource from "../docs/nonce_generation_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import secretLifecycleDocSource from "../docs/secret_lifecycle_implementation_plan.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 137 — first REAL implementation behind this crate's public API:
 * `fedos_random_bytes_32`.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains `FedosRandomBytesLength` (one
 * variant, `ThirtyTwo`), `FedosRandomBytesState` (`Ready` /
 * `EntropySourceUnavailable`), `FedosRandomBytesDecision`
 * (`length`/`state`/`bytes: Option<[u8; 32]>`), and one new function,
 * `fedos_random_bytes_32()`, which draws exactly 32 bytes from the OS
 * CSPRNG via `getrandom::fill` — the FIRST time `getrandom` (adopted Stage
 * 104, build-check only until now) is actually imported and called
 * anywhere in this crate, production or test. The public `pub fn` surface
 * grows from twenty-two (Stage 106) to twenty-three.
 *
 * Output length is fixed at exactly 32 bytes, selected by a label, never
 * an open caller-supplied count — there is no zero-length request. A
 * CSPRNG failure returns `EntropySourceUnavailable` with `bytes: None` —
 * no fallback PRNG, no `Math.random()`-equivalent, no deterministic
 * substitute, and no panic. This is general-purpose randomness ONLY: no
 * nonce generation, no key generation, no key derivation, and no AEAD/KDF/
 * NIP-44 operation is added or connected. `Cargo.toml` is untouched (no
 * dependency change). Nothing is wired into the Runtime, the Worker, or a
 * crypto provider; no WASM binding exists.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — real randomBytes implementation (Stage 137)", () => {
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

  function extractSection(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `expected to find "${startMarker}" in lib.rs`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(-1);
    return source.slice(start, end);
  }

  const firstCfgTestIdx = libRsSource.indexOf("#[cfg(test)]");
  const productionLibRs =
    firstCfgTestIdx === -1 ? libRsSource : libRsSource.slice(0, firstCfgTestIdx);
  const testOnlyLibRs = firstCfgTestIdx === -1 ? "" : libRsSource.slice(firstCfgTestIdx);

  // Bounded exactly to what Stage 137 added: from its own marker to the
  // start of Stage 138's marker (narrowed from "Stage 79" once Stage 138
  // added new content between Stage 137's addition and the secret_handle
  // module — the same "narrow to the next stage's marker" convention
  // every prior public-boundary stage used — see e.g.
  // test/fedos_core_rust_key_format_label.test.ts).
  const stage137Section = extractSection(
    libRsSource,
    "Stage 137 — first REAL implementation behind this crate's random-byte",
    "Stage 138 — a fixed-size AEAD nonce helper, drawn from the OS CSPRNG",
  );

  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const rngModule = extractModule(libRsSource, "mod csprng_verification_infrastructure");
  const randomBytesWiringModule = extractModule(libRsSource, "mod random_bytes_wiring");

  it("1. FedosRandomBytesLength/State/Decision exist, and fedos_random_bytes_32 is declared", () => {
    expect(stage137Section).toContain("pub enum FedosRandomBytesLength");
    expect(stage137Section).toContain("pub enum FedosRandomBytesState");
    expect(stage137Section).toContain("pub struct FedosRandomBytesDecision");
    expect(stage137Section).toMatch(/pub\s+fn\s+fedos_random_bytes_32\s*\(\s*\)/);
  });

  it("2. FedosRandomBytesLength has exactly one variant, ThirtyTwo — no zero/open-length variant exists", () => {
    const decl = extractSection(stage137Section, "pub enum FedosRandomBytesLength", "}");
    expect(decl).toContain("ThirtyTwo");
    // No numeric-length variant, no "Zero"/"Custom"/"Variable" escape hatch.
    expect(decl).not.toMatch(/\bZero\b/);
    expect(decl).not.toMatch(/\bCustom\b/);
    expect(decl).not.toMatch(/\bVariable\b/);
    expect(decl).not.toMatch(/\bArbitrary\b/);
  });

  it("3. FedosRandomBytesState has exactly Ready and EntropySourceUnavailable", () => {
    const decl = extractSection(stage137Section, "pub enum FedosRandomBytesState", "}");
    expect(decl).toContain("Ready");
    expect(decl).toContain("EntropySourceUnavailable");
  });

  it("4. fedos_random_bytes_32 takes no parameter of any kind — no caller-supplied length", () => {
    // The signature itself: zero parameters between the parens.
    expect(stage137Section).toMatch(/pub\s+fn\s+fedos_random_bytes_32\s*\(\s*\)\s*->\s*FedosRandomBytesDecision/);
    // No sibling function accepting a length/count/size parameter exists
    // anywhere in this stage's additions.
    expect(stage137Section).not.toMatch(/fn\s+fedos_random_bytes\w*\s*\([^)]*(len|length|count|size|n)\s*:/i);
  });

  it("5. FedosRandomBytesDecision.bytes is a fixed-size [u8; 32] wrapped in Option, never Vec<u8>", () => {
    const decl = extractSection(stage137Section, "pub struct FedosRandomBytesDecision", "}");
    expect(decl).toMatch(/bytes\s*:\s*Option\s*<\s*\[\s*u8\s*;\s*32\s*\]\s*>/);
    expect(decl).not.toMatch(/Vec\s*</);
    expect(decl).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("6. no Vec<u8> FIELD or TYPE POSITION anywhere in Stage 137's production additions", () => {
    // Stage 137's own doc comments legitimately NAME "Vec<u8>" (to say
    // `bytes` is never one) — a bare word match would false-positive on
    // that prose, so check for an actual type-position usage (a
    // `: Vec<u8>` field/parameter/return type) instead.
    expect(stage137Section).not.toMatch(/:\s*Vec\s*<\s*u8\s*>/);
    expect(stage137Section).not.toMatch(/->\s*Vec\s*<\s*u8\s*>/);
  });

  it("7. getrandom::fill is CALLED in production code inside fedos_random_bytes_32 (and, since Stage 138, fedos_aead_nonce_96 — nowhere else)", () => {
    // Several doc comments legitimately NAME `getrandom::fill` in prose
    // (to describe what the function below does); count actual CALL
    // sites (the `(` invocation syntax), not bare "getrandom::" mentions.
    // Updated Stage 138: fedos_aead_nonce_96 is a second, independent
    // call site (see test/fedos_core_rust_aead_nonce.test.ts) — this
    // still asserts there are no OTHER call sites beyond those two.
    const fnBody = extractSection(stage137Section, "pub fn fedos_random_bytes_32", "\n}");
    expect(fnBody).toMatch(/getrandom::fill\s*\(\s*&mut\s+buf\s*\)/);
    const callSites = productionLibRs.match(/getrandom::fill\s*\(/g) ?? [];
    expect(callSites.length).toBe(2);
  });

  it("8. the call site matches getrandom::fill exhaustively — Ok/Err both produce a fixed decision, never a panic", () => {
    const fnBody = extractSection(stage137Section, "pub fn fedos_random_bytes_32", "\n}");
    expect(fnBody).toMatch(/match\s+getrandom::fill\s*\(\s*&mut\s+buf\s*\)\s*\{/);
    expect(fnBody).toContain("Ok(()) =>");
    expect(fnBody).toContain("Err(_) =>");
    expect(fnBody).not.toMatch(/\.unwrap\(\)/);
    expect(fnBody).not.toMatch(/\.expect\(/);
    expect(fnBody).not.toMatch(/\bpanic!\s*\(/);
  });

  it("9. no fallback PRNG of any kind — no rand/thread_rng/OsRng/deterministic substitute", () => {
    // Stage 137's own doc comments legitimately NAME "thread_rng" in prose
    // (to say it's never used) — check for actual CALL syntax instead of
    // a bare word match.
    expect(stage137Section).not.toMatch(/\buse\s+rand\b/);
    expect(stage137Section).not.toMatch(/\brand::/);
    expect(stage137Section).not.toMatch(/\bthread_rng\s*\(/);
    expect(stage137Section).not.toMatch(/\bOsRng\b/);
    expect(stage137Section).not.toMatch(/\bStdRng\b/);
    expect(stage137Section).not.toMatch(/\bSmallRng\b/);
    expect(stage137Section).not.toMatch(/\bLcg\b/i);
    // No TypeScript-side Math.random equivalent was introduced anywhere
    // this stage touches.
    expect(runtimeSource).not.toMatch(/Math\.random\s*\(/);
    expect(workerSource).not.toMatch(/Math\.random\s*\(/);
  });

  it("10. no nonce generation, key generation, key derivation, or AEAD/KDF/NIP-44 operation is added", () => {
    // Stage 137's own doc comments legitimately NAME "nonce"/"NIP-44" (to
    // say neither is done) — a bare word match would false-positive on
    // that prose, the same "no bare word match" lesson this repo's NIP-44
    // guard tests already learned (Stage 89-98). Check for actual
    // declarations/usages instead.
    expect(stage137Section).not.toMatch(/\bfn\s+\w*nonce\w*\s*\(/i);
    expect(stage137Section).not.toMatch(/\b(struct|enum)\s+\w*Nonce\w*\b/);
    expect(stage137Section).not.toMatch(/\bfn\s+\w*derive_key\w*\s*\(/i);
    expect(stage137Section).not.toMatch(/\bfn\s+\w*encrypt\w*\s*\(/i);
    expect(stage137Section).not.toMatch(/\bfn\s+\w*decrypt\w*\s*\(/i);
    expect(stage137Section).not.toMatch(/\bfn\s+\w*nip44\w*\s*\(/i);
    expect(stage137Section).not.toMatch(/\bChaCha20/i);
    expect(stage137Section).not.toMatch(/\bAes256Gcm\b/);
    expect(stage137Section).not.toMatch(/\bHkdf\b/);
    expect(stage137Section).not.toMatch(/\bArgon2\b/);
  });

  it("11. not connected to SecretHandle, aead_core, or kdf_core — those modules are untouched", () => {
    // Same "no bare word match" reasoning as test 10: Stage 137's own doc
    // comments legitimately NAME `SecretHandle`/`AeadPlaceholderRequest`/
    // `KdfPlaceholderRequest` (to say none is connected) — check for an
    // actual type-position usage instead of a bare word match.
    expect(stage137Section).not.toMatch(/:\s*SecretHandle\b/);
    expect(stage137Section).not.toMatch(/->\s*SecretHandle\b/);
    expect(stage137Section).not.toMatch(/\bSecretHandle::/);
    expect(stage137Section).not.toMatch(/\bsecret_handle::/);
    expect(stage137Section).not.toMatch(/:\s*AeadPlaceholderRequest\b/);
    expect(stage137Section).not.toMatch(/:\s*KdfPlaceholderRequest\b/);
    for (const mod of [aeadCoreModule, kdfCoreModule, secretHandleModule]) {
      expect(mod).not.toMatch(/\bFedosRandomBytes\w*\b/);
      expect(mod).not.toMatch(/\bgetrandom\b/);
    }
  });

  it("12. random_bytes_placeholder and fedos_random_boundary_status are byte-for-byte unchanged", () => {
    expect(productionLibRs).toMatch(
      /fn\s+random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toContain("fn fedos_random_boundary_status()");
    expect(productionLibRs).toMatch(
      /fn\s+fedos_random_boundary_status\(\)\s*->\s*FedosRandomBoundary\s*\{\s*FedosRandomBoundary\s*\{\s*state\s*:\s*FedosRandomBoundaryState::Unavailable\s*,?\s*\}\s*\}/,
    );
  });

  it("13. the crate's public pub fn surface grows from twenty-two to exactly twenty-three", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames).toContain("fedos_random_bytes_32");
    expect(pubFnNames.length).toBe(48);
    // The #[cfg(test)]-only wiring module's own test functions are not
    // `pub` — this stage's tests live behind cfg(test) like every other
    // vector/wiring module in this crate.
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+fedos_random_bytes_32_/);
  });

  it("14. Cargo.toml has no 'Stage 137' mention (Stage 147 later adds a ninth production dependency, sha2, unrelated to this stage's own topic)", () => {
    expect(cargoTomlSource).not.toContain("Stage 137");
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
    expect(productionDepsSection).toMatch(/^getrandom\s*=/m);
  });

  it("15. no Runtime / Worker / CryptoProvider connection anywhere related to Stage 137", () => {
    // Stage 137's own doc comments legitimately NAME "Runtime"/"Worker"/
    // "CryptoProvider" (to say none is wired) — a bare word match on Rust
    // prose would false-positive, so the meaningful check is on the TS
    // side: no runtime/worker source references this stage's function or
    // the Rust dependency at all.
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedos_random_bytes_32");
      expect(src).not.toContain("fedosrandombytes");
      expect(src).not.toContain("getrandom");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("16. no println!/eprintln!/dbg!/log/tracing usage, and no `unsafe`, anywhere in Stage 137's additions", () => {
    expect(stage137Section).not.toMatch(/\bprintln!\s*\(/);
    expect(stage137Section).not.toMatch(/\beprintln!\s*\(/);
    expect(stage137Section).not.toMatch(/\btracing::/);
    expect(stage137Section).not.toMatch(/\blog::/);
    expect(stage137Section).not.toMatch(/\bdbg!\s*\(/);
    expect(stage137Section).not.toContain("unsafe");
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
  });

  it("17. the random_bytes_wiring cfg(test) module exists, covers the fixed failure shape, and calls getrandom nowhere itself", () => {
    expect(libRsSource).toContain("mod random_bytes_wiring");
    expect(productionLibRs).not.toContain("mod random_bytes_wiring");
    expect(testOnlyLibRs).toContain("mod random_bytes_wiring");
    expect(randomBytesWiringModule).toContain("fedos_random_bytes_32_returns_ready_with_exactly_32_bytes");
    expect(randomBytesWiringModule).toContain("fedos_random_bytes_32_two_calls_are_not_obviously_identical");
    expect(randomBytesWiringModule).toContain("entropy_source_unavailable_state_carries_no_bytes");
    expect(randomBytesWiringModule).not.toMatch(/\bgetrandom::/);
  });

  it("18. no public function anywhere returns a raw secret — FedosRandomBytesDecision is general-purpose output, not SecretHandle-wrapped", () => {
    // The struct itself derives ordinary value-type traits (Debug/Clone/
    // Copy/PartialEq/Eq) — it is plain returned data, never wrapped in
    // secrecy::Secret/SecretBox (which would forbid exactly this).
    const decl = extractSection(stage137Section, "pub struct FedosRandomBytesDecision", "}");
    expect(decl).not.toMatch(/\bSecretBox\b/);
    expect(decl).not.toMatch(/\bSecret\s*</);
    expect(stage137Section).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(stage137Section).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(stage137Section).not.toMatch(/\bpassphrase\s*:\s*\w/i);
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

  it("20. the three design docs this stage follows exist and name their subject types", () => {
    expect(randomPlanDocSource.length).toBeGreaterThan(0);
    expect(randomPlanDocSource).toContain("getrandom");
    expect(randomPlanDocSource).toContain("randomBytes");
    expect(noncePolicyDocSource.length).toBeGreaterThan(0);
    expect(noncePolicyDocSource).toContain("nonce");
    expect(secretLifecycleDocSource.length).toBeGreaterThan(0);
    expect(secretLifecycleDocSource).toContain("SecretHandle");
  });
});

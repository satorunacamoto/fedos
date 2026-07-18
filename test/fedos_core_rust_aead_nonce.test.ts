import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noncePolicyDocSource from "../docs/nonce_generation_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 138 — a fixed-size AEAD nonce helper: `fedos_aead_nonce_96`.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains `FedosAeadNonceKind` (one
 * variant, `NinetySixBit`), `FedosNonceState` (`Ready` /
 * `EntropySourceUnavailable`), `FedosAeadNonceDecision`
 * (`kind`/`state`/`nonce: Option<[u8; 12]>`), and one new function,
 * `fedos_aead_nonce_96()`, which draws exactly 12 bytes (96 bits) from
 * the OS CSPRNG via `getrandom::fill` — a SECOND real call site of the
 * `getrandom` dependency, independent of `fedos_random_bytes_32` (Stage
 * 137) and not implemented by calling it. The public `pub fn` surface
 * grows from twenty-three (Stage 137) to twenty-four.
 *
 * This is a nonce-DRAWING helper ONLY — it performs no AEAD seal/open, no
 * encryption, no decryption, and no key derivation/generation, and is not
 * connected to `encrypt_placeholder`/`decrypt_placeholder` (Stage 69),
 * `aead_core` (Stage 80), `kdf_core` (Stage 82), or `SecretHandle` (Stage
 * 79). The nonce is never deterministic, never a counter, and never
 * derived from a seed/password/user input, per
 * `docs/nonce_generation_policy.md` (Stage 134). Output size is fixed at
 * 96 bits, selected by a label, never an open caller-supplied count; a
 * CSPRNG failure returns `EntropySourceUnavailable` with `nonce: None` —
 * no fallback PRNG, no panic. `Cargo.toml` is untouched; nothing is wired
 * into the Runtime, the Worker, or a crypto provider; no WASM binding
 * exists.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — AEAD nonce helper (Stage 138)", () => {
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

  // Bounded exactly to what Stage 138 added: from its own marker to the
  // start of Stage 79's secret_handle module (the same "narrow to the
  // next stage's marker" convention every prior public-boundary stage
  // used).
  const stage138Section = extractSection(
    libRsSource,
    "Stage 138 — a fixed-size AEAD nonce helper, drawn from the OS CSPRNG",
    "Stage 79 — an INTERNAL-ONLY secret-handle skeleton",
  );

  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadNonceWiringModule = extractModule(libRsSource, "mod aead_nonce_wiring");
  const randomBytesWiringModule = extractModule(libRsSource, "mod random_bytes_wiring");

  it("1. FedosAeadNonceKind/FedosNonceState/FedosAeadNonceDecision exist, and fedos_aead_nonce_96 is declared", () => {
    expect(stage138Section).toContain("pub enum FedosAeadNonceKind");
    expect(stage138Section).toContain("pub enum FedosNonceState");
    expect(stage138Section).toContain("pub struct FedosAeadNonceDecision");
    expect(stage138Section).toMatch(/pub\s+fn\s+fedos_aead_nonce_96\s*\(\s*\)/);
  });

  it("2. FedosAeadNonceKind has exactly one variant, NinetySixBit — no zero/variable/caller-length variant exists", () => {
    const decl = extractSection(stage138Section, "pub enum FedosAeadNonceKind", "}");
    expect(decl).toContain("NinetySixBit");
    expect(decl).not.toMatch(/\bZero\b/);
    expect(decl).not.toMatch(/\bCustom\b/);
    expect(decl).not.toMatch(/\bVariable\b/);
    expect(decl).not.toMatch(/\bArbitrary\b/);
    expect(decl).not.toMatch(/\bCounter\b/);
  });

  it("3. FedosNonceState has exactly Ready and EntropySourceUnavailable, and is independent of FedosRandomBytesState", () => {
    const decl = extractSection(stage138Section, "pub enum FedosNonceState", "}");
    expect(decl).toContain("Ready");
    expect(decl).toContain("EntropySourceUnavailable");
    // Doc comments legitimately NAME `FedosRandomBytesState` (to say
    // this is a separate type) — check for an actual type-position reuse
    // (a field/return typed as it) instead of a bare word match.
    expect(stage138Section).not.toMatch(/:\s*FedosRandomBytesState\b/);
    expect(stage138Section).not.toMatch(/->\s*FedosRandomBytesState\b/);
  });

  it("4. fedos_aead_nonce_96 takes no parameter of any kind — no caller-supplied length", () => {
    expect(stage138Section).toMatch(
      /pub\s+fn\s+fedos_aead_nonce_96\s*\(\s*\)\s*->\s*FedosAeadNonceDecision/,
    );
    expect(stage138Section).not.toMatch(
      /fn\s+fedos_aead_nonce\w*\s*\([^)]*(len|length|count|size|n)\s*:/i,
    );
  });

  it("5. FedosAeadNonceDecision.nonce is a fixed-size [u8; 12] wrapped in Option, never Vec<u8>", () => {
    const decl = extractSection(stage138Section, "pub struct FedosAeadNonceDecision", "}");
    expect(decl).toMatch(/nonce\s*:\s*Option\s*<\s*\[\s*u8\s*;\s*12\s*\]\s*>/);
    expect(decl).not.toMatch(/Vec\s*</);
    expect(decl).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("6. no Vec<u8> FIELD or TYPE POSITION anywhere in Stage 138's production additions", () => {
    // Doc comments legitimately NAME "Vec<u8>" in prose (to say `nonce` is
    // never one) — check for an actual type-position usage instead.
    expect(stage138Section).not.toMatch(/:\s*Vec\s*<\s*u8\s*>/);
    expect(stage138Section).not.toMatch(/->\s*Vec\s*<\s*u8\s*>/);
  });

  it("7. getrandom::fill is CALLED exactly once inside fedos_aead_nonce_96, and is independent of fedos_random_bytes_32's own call", () => {
    const fnBody = extractSection(stage138Section, "pub fn fedos_aead_nonce_96", "\n}");
    expect(fnBody).toMatch(/getrandom::fill\s*\(\s*&mut\s+buf\s*\)/);
    const callSitesInStage138 = stage138Section.match(/getrandom::fill\s*\(/g) ?? [];
    expect(callSitesInStage138.length).toBe(1);
    // Whole-file count is 2 (this helper + fedos_random_bytes_32) — see
    // test/fedos_core_rust_random_bytes.test.ts for the dedicated check
    // on that call site specifically.
    const callSitesTotal = productionLibRs.match(/getrandom::fill\s*\(/g) ?? [];
    expect(callSitesTotal.length).toBe(2);
  });

  it("8. the call site matches getrandom::fill exhaustively — Ok/Err both produce a fixed decision, never a panic", () => {
    const fnBody = extractSection(stage138Section, "pub fn fedos_aead_nonce_96", "\n}");
    expect(fnBody).toMatch(/match\s+getrandom::fill\s*\(\s*&mut\s+buf\s*\)\s*\{/);
    expect(fnBody).toContain("Ok(()) =>");
    expect(fnBody).toContain("Err(_) =>");
    expect(fnBody).not.toMatch(/\.unwrap\(\)/);
    expect(fnBody).not.toMatch(/\.expect\(/);
    expect(fnBody).not.toMatch(/\bpanic!\s*\(/);
  });

  it("9. no fallback PRNG, no deterministic/counter nonce, and no seed/password/user-input derivation", () => {
    // Doc comments legitimately NAME "thread_rng"/"counter"/"seed"/
    // "password" in prose (to say none is used) — check for actual
    // CALL/field-position syntax instead of a bare word match, the same
    // lesson learned in test/fedos_core_rust_random_bytes.test.ts.
    expect(stage138Section).not.toMatch(/\buse\s+rand\b/);
    expect(stage138Section).not.toMatch(/\brand::/);
    expect(stage138Section).not.toMatch(/\bthread_rng\s*\(/);
    expect(stage138Section).not.toMatch(/\bOsRng\b/);
    expect(stage138Section).not.toMatch(/\bStdRng\b/);
    // No counter field, no seed/password/user-id parameter anywhere.
    expect(stage138Section).not.toMatch(/\bcounter\s*:\s*\w/i);
    expect(stage138Section).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(stage138Section).not.toMatch(/\bpassword\s*:\s*\w/i);
    expect(stage138Section).not.toMatch(/\buser_id\s*:\s*\w/i);
    expect(stage138Section).not.toMatch(/\bpubkey\s*:\s*\w/i);
    expect(stage138Section).not.toMatch(/\btimestamp\s*:\s*\w/i);
    // No TypeScript-side Math.random equivalent anywhere this stage touches.
    expect(runtimeSource).not.toMatch(/Math\.random\s*\(/);
    expect(workerSource).not.toMatch(/Math\.random\s*\(/);
  });

  it("10. no encrypt/decrypt/deriveKey/AEAD seal-open function is added — nonce helper only", () => {
    // Doc comments legitimately NAME "encrypt"/"decrypt"/"AEAD"/"key
    // derivation" in prose (to say none is done) — check for actual
    // fn-shaped declarations instead of a bare word match.
    expect(stage138Section).not.toMatch(/\bfn\s+\w*encrypt\w*\s*\(/i);
    expect(stage138Section).not.toMatch(/\bfn\s+\w*decrypt\w*\s*\(/i);
    expect(stage138Section).not.toMatch(/\bfn\s+\w*derive_key\w*\s*\(/i);
    expect(stage138Section).not.toMatch(/\bfn\s+\w*seal\w*\s*\(/i);
    expect(stage138Section).not.toMatch(/\bfn\s+\w*open\w*\s*\(/i);
    expect(stage138Section).not.toMatch(/\bfn\s+\w*nip44\w*\s*\(/i);
    // Doc comments legitimately NAME "ChaCha20-Poly1305"/"AES-256-GCM" in
    // prose (this helper's 96-bit size matches both) — no bare word
    // match; check for an actual import/type-usage instead.
    expect(stage138Section).not.toMatch(/\buse\s+chacha20poly1305\b/);
    expect(stage138Section).not.toMatch(/\bChaCha20Poly1305::/);
    expect(stage138Section).not.toMatch(/\buse\s+aes_gcm\b/);
    expect(stage138Section).not.toMatch(/\bAes256Gcm::/);
    expect(stage138Section).not.toMatch(/\buse\s+hkdf\b/);
    expect(stage138Section).not.toMatch(/\bHkdf::/);
    expect(stage138Section).not.toMatch(/\buse\s+argon2\b/);
    expect(stage138Section).not.toMatch(/\bArgon2::/);
  });

  it("11. not connected to SecretHandle, aead_core, kdf_core, or fedos_random_bytes_32 — each stays independent", () => {
    // Doc comments legitimately NAME `SecretHandle`/`aead_core`/`kdf_core`
    // (to say none is connected) — check for actual type-position usage
    // instead of a bare word match.
    expect(stage138Section).not.toMatch(/:\s*SecretHandle\b/);
    expect(stage138Section).not.toMatch(/->\s*SecretHandle\b/);
    expect(stage138Section).not.toMatch(/\bSecretHandle::/);
    expect(stage138Section).not.toMatch(/\bsecret_handle::/);
    expect(stage138Section).not.toMatch(/:\s*AeadPlaceholderRequest\b/);
    expect(stage138Section).not.toMatch(/:\s*KdfPlaceholderRequest\b/);
    // fedos_aead_nonce_96 never calls fedos_random_bytes_32, and vice
    // versa — each draws its own bytes independently.
    const nonceFnBody = extractSection(stage138Section, "pub fn fedos_aead_nonce_96", "\n}");
    expect(nonceFnBody).not.toMatch(/\bfedos_random_bytes_32\s*\(/);
    expect(randomBytesWiringModule).not.toMatch(/\bfedos_aead_nonce_96\s*\(/);
    for (const mod of [aeadCoreModule, kdfCoreModule, secretHandleModule]) {
      expect(mod).not.toMatch(/\bFedosAeadNonce\w*\b/);
      expect(mod).not.toMatch(/\bFedosNonceState\b/);
    }
  });

  it("12. random_bytes_placeholder, fedos_random_boundary_status, and fedos_nonce_boundary_status are byte-for-byte unchanged", () => {
    expect(productionLibRs).toMatch(
      /fn\s+random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
    expect(productionLibRs).toMatch(
      /fn\s+fedos_random_boundary_status\(\)\s*->\s*FedosRandomBoundary\s*\{\s*FedosRandomBoundary\s*\{\s*state\s*:\s*FedosRandomBoundaryState::Unavailable\s*,?\s*\}\s*\}/,
    );
    expect(productionLibRs).toMatch(
      /fn\s+fedos_nonce_boundary_status\(\)\s*->\s*FedosNonceBoundary\s*\{\s*FedosNonceBoundary\s*\{\s*state\s*:\s*FedosNonceBoundaryState::Unavailable\s*,?\s*\}\s*\}/,
    );
  });

  it("13. the crate's public pub fn surface grows from twenty-three to exactly twenty-four", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames).toContain("fedos_aead_nonce_96");
    expect(pubFnNames.length).toBe(50);
    expect(testOnlyLibRs).not.toMatch(/\bpub\s+fn\s+fedos_aead_nonce_96_/);
  });

  it("14. Cargo.toml has no 'Stage 138' mention (Stage 147 later adds a ninth production dependency, sha2, unrelated to this stage's own topic)", () => {
    expect(cargoTomlSource).not.toContain("Stage 138");
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    // Updated Stage 147: sha2 is promoted from [dev-dependencies] to
    // [dependencies] (see test/fedos_core_rust_dependency.test.ts test 7 and
    // test/fedos_core_rust_hkdf_internal.test.ts for the dedicated checks),
    // making this nine, not eight — unrelated to this stage's own topic.
    expect(depLines.length).toBe(11);
    expect(productionDepsSection).toMatch(/^getrandom\s*=/m);
  });

  it("15. no Runtime / Worker / CryptoProvider connection anywhere related to Stage 138", () => {
    // The meaningful check is on the TS side: no runtime/worker source
    // references this stage's function or the Rust dependency at all —
    // a bare word match on Rust prose would false-positive, since this
    // stage's own doc comments legitimately name Runtime/Worker to say
    // neither is wired.
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedos_aead_nonce_96");
      expect(src).not.toContain("fedosaeadnonce");
      expect(src).not.toContain("getrandom");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt|nonce)\s*\(/i);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt|nonce)\s*\(/i);
  });

  it("16. no println!/eprintln!/dbg!/log/tracing usage, and no `unsafe`, anywhere in Stage 138's additions", () => {
    expect(stage138Section).not.toMatch(/\bprintln!\s*\(/);
    expect(stage138Section).not.toMatch(/\beprintln!\s*\(/);
    expect(stage138Section).not.toMatch(/\btracing::/);
    expect(stage138Section).not.toMatch(/\blog::/);
    expect(stage138Section).not.toMatch(/\bdbg!\s*\(/);
    expect(stage138Section).not.toContain("unsafe");
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
  });

  it("17. the aead_nonce_wiring cfg(test) module exists, covers the fixed failure shape, and calls getrandom nowhere itself", () => {
    expect(libRsSource).toContain("mod aead_nonce_wiring");
    expect(productionLibRs).not.toContain("mod aead_nonce_wiring");
    expect(testOnlyLibRs).toContain("mod aead_nonce_wiring");
    expect(aeadNonceWiringModule).toContain(
      "fedos_aead_nonce_96_returns_ready_with_exactly_12_bytes",
    );
    expect(aeadNonceWiringModule).toContain(
      "fedos_aead_nonce_96_two_calls_are_not_obviously_identical",
    );
    expect(aeadNonceWiringModule).toContain("entropy_source_unavailable_state_carries_no_nonce");
    expect(aeadNonceWiringModule).not.toMatch(/\bgetrandom::/);
  });

  it("18. no public function anywhere returns a raw secret — FedosAeadNonceDecision is a nonce (not secret), never SecretHandle-wrapped", () => {
    const decl = extractSection(stage138Section, "pub struct FedosAeadNonceDecision", "}");
    expect(decl).not.toMatch(/\bSecretBox\b/);
    expect(decl).not.toMatch(/\bSecret\s*</);
    expect(stage138Section).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(stage138Section).not.toMatch(/\bpassphrase\s*:\s*\w/i);
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

  it("20. the nonce policy doc exists, names this helper's design, and states AEAD is not yet connected", () => {
    expect(noncePolicyDocSource.length).toBeGreaterThan(0);
    expect(noncePolicyDocSource).toContain("random nonce");
    expect(noncePolicyDocSource).toMatch(/counter/i);
  });
});

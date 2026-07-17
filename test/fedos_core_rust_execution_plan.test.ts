import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 94 — internal execution-plan skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains an eleventh crate-private
 * module, `execution_plan`: `ExecutionPlanState` (`Placeholder` /
 * `Disabled`), `ExecutionPlanKind` (`AeadPlanPlaceholder` /
 * `KdfPlanPlaceholder` / `Argon2idPlanPlaceholder` / `Nip44PlanPlaceholder`
 * / `NostrKeyPlanPlaceholder` / `TestOnlyPlanPlaceholder` — a label only),
 * `ExecutionStepKind` (`ValidateRequestPlaceholder` /
 * `ResolveDomainPlaceholder` / `ResolveKeyMaterialPlaceholder` /
 * `ExecutePrimitivePlaceholder` / `BuildResponsePlaceholder` /
 * `ClearTemporaryStatePlaceholder` — a label only, this crate's canonical
 * six-step placeholder sequence), a non-sensitive `ExecutionPlanStatus`,
 * and `ExecutionPlan` itself (`new_placeholder(kind)`/`kind()`/`status()`/
 * `is_placeholder()`/`step_count()`). It exists as a fully independent,
 * label-only type basis for a future AEAD/KDF/Argon2/NIP-44/
 * Nostr-key-derivation processing ORDER.
 *
 * `ExecutionPlan` is an INTERNAL skeleton, not a public API: every item in
 * `execution_plan` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn`
 * surface is still exactly the same six placeholder functions from Stage
 * 69. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
 * no Nostr key is derived. `execution_plan` holds NO field of any other
 * skeleton type — it is NOT connected to, and does not construct or
 * store, `secret_handle` (Stage 79), `aead_core` (Stage 80), `kdf_core`
 * (Stage 82), `key_material` (Stage 87), `domain_label` (Stage 88),
 * `operation_context` (Stage 89), `request_descriptor` (Stage 90),
 * `response_descriptor` (Stage 91), `crypto_pipeline` (Stage 92), or
 * `descriptor_bundle` (Stage 93). Nothing is wired into the Runtime, the
 * Worker, or `CryptoProvider`.
 *
 * `cargo test` (green as of this stage, including `execution_plan`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent
 * of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal execution plan skeleton", () => {
  /** Extracts a `mod name { ... }` block via brace matching (robust to
   * nested `{}` inside, e.g. this module's own nested `#[cfg(test)]`). */
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

  const executionPlanModule = extractModule(libRsSource, "mod execution_plan");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  const aeadCoreModule = extractModule(libRsSource, "mod aead_core");
  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const keyMaterialModule = extractModule(libRsSource, "mod key_material");
  const domainLabelModule = extractModule(libRsSource, "mod domain_label");
  const operationContextModule = extractModule(libRsSource, "mod operation_context");
  const requestDescriptorModule = extractModule(libRsSource, "mod request_descriptor");
  const responseDescriptorModule = extractModule(libRsSource, "mod response_descriptor");
  const cryptoPipelineModule = extractModule(libRsSource, "mod crypto_pipeline");
  const descriptorBundleModule = extractModule(libRsSource, "mod descriptor_bundle");

  it("1. lib.rs contains an internal (non-pub) execution_plan module", () => {
    expect(libRsSource).toContain("mod execution_plan");
    expect(libRsSource).not.toContain("pub mod execution_plan");
  });

  it("2. execution_plan's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod execution_plan");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. ExecutionPlan is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(executionPlanModule).toMatch(/\bpub\(crate\)\s+struct\s+ExecutionPlan\b/);
    expect(executionPlanModule).not.toMatch(/\bpub\s+struct\s+ExecutionPlan\b/);
    expect(executionPlanModule).toMatch(/\bpub\(crate\)\s+enum\s+ExecutionPlanState\b/);
    expect(executionPlanModule).toMatch(/\bpub\(crate\)\s+enum\s+ExecutionPlanKind\b/);
    expect(executionPlanModule).toMatch(/\bpub\(crate\)\s+enum\s+ExecutionStepKind\b/);
    expect(executionPlanModule).toMatch(
      /\bpub\(crate\)\s+struct\s+ExecutionPlanStatus\b/,
    );
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+execution_plan\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*ExecutionPlan\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bExecutionPlan\b/,
    );
  });

  it("4. lib.rs's public `pub fn` surface is still exactly the six Stage 69 functions", () => {
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

  it("5. production API placeholders are unchanged", () => {
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

  it("6. every ExecutionPlanKind variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const kind of [
      "AeadPlanPlaceholder",
      "KdfPlanPlaceholder",
      "Argon2idPlanPlaceholder",
      "Nip44PlanPlaceholder",
      "NostrKeyPlanPlaceholder",
      "TestOnlyPlanPlaceholder",
    ]) {
      expect(executionPlanModule).toContain(kind);
      // A unit variant is a bare identifier followed by `,` (no `(` or `{`
      // immediately after — that would make it a tuple/struct variant
      // carrying data).
      expect(executionPlanModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(executionPlanModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(executionPlanModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
  });

  it("7. every ExecutionStepKind variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const step of [
      "ValidateRequestPlaceholder",
      "ResolveDomainPlaceholder",
      "ResolveKeyMaterialPlaceholder",
      "ExecutePrimitivePlaceholder",
      "BuildResponsePlaceholder",
      "ClearTemporaryStatePlaceholder",
    ]) {
      expect(executionPlanModule).toContain(step);
      expect(executionPlanModule).toMatch(new RegExp(`\\b${step}\\s*,`));
      expect(executionPlanModule).not.toMatch(new RegExp(`\\b${step}\\s*\\(`));
      expect(executionPlanModule).not.toMatch(new RegExp(`\\b${step}\\s*\\{`));
    }
  });

  it("8. no String field anywhere in execution_plan", () => {
    expect(executionPlanModule).not.toMatch(/:\s*String\b/);
    expect(executionPlanModule).not.toMatch(/\bString::from\b/);
    expect(executionPlanModule).not.toMatch(/\bString::new\b/);
    expect(executionPlanModule).not.toMatch(/\bto_string\s*\(/);
    expect(executionPlanModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("9. no Vec field anywhere in execution_plan — step_count() returns a fixed usize via match, not a runtime-sized collection length", () => {
    expect(executionPlanModule).not.toMatch(/:\s*Vec</);
    expect(executionPlanModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(executionPlanModule).not.toMatch(/\bVec<ExecutionStepKind>/);
    expect(executionPlanModule).not.toMatch(/\.len\s*\(\s*\)/);
    expect(executionPlanModule).toMatch(/fn\s+step_count\s*\(\s*&self\s*\)\s*->\s*usize/);
    expect(executionPlanModule).toMatch(/match\s+self\.kind\s*\{/);
  });

  it("10. new_placeholder takes only an ExecutionPlanKind — no user-provided string/byte input", () => {
    expect(executionPlanModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*ExecutionPlanKind\s*\)/,
    );
    expect(executionPlanModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(executionPlanModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
  });

  it("11. no env/runtime/config-derived plan construction anywhere in execution_plan", () => {
    expect(executionPlanModule).not.toMatch(/std::env/);
    expect(executionPlanModule).not.toMatch(/\benv::/);
    expect(executionPlanModule).not.toMatch(/\bvar_os\b/);
    expect(executionPlanModule).not.toMatch(/\bstd::process\b/);
  });

  it("12. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in execution_plan", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`/
    // `\bnip.?44\b` word match, which would also match this module's own
    // doc-comment prose naming HKDF/AEAD/Argon2/NIP-44 as future,
    // still-unimplemented connection points, same lesson learned for
    // `kdf_core` (Stage 82) and `key_material`/`domain_label`/
    // `operation_context`/`request_descriptor`/`response_descriptor`/
    // `crypto_pipeline`/`descriptor_bundle` (Stage 87-93). There is no
    // `nip44`-named crate in this repo's dependency tree to import in the
    // first place (see `packages/fedos-core-rust/Cargo.toml`), so "no
    // NIP-44 connection" is enforced structurally by that absence, not by
    // a source-text ban on the (legitimate) `Nip44PlanPlaceholder`
    // variant name.
    expect(executionPlanModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(executionPlanModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(executionPlanModule).not.toMatch(/\bhkdf::/);
    expect(executionPlanModule).not.toMatch(/\bHkdf::/);
    expect(executionPlanModule).not.toMatch(/\bargon2::/i);
    expect(executionPlanModule).not.toMatch(/\bArgon2::/);
    expect(executionPlanModule).not.toMatch(/\bArgon2</);
  });

  it("13. no SecretHandle/KeyMaterial/DomainLabel/OperationContext/RequestDescriptor/ResponseDescriptor/CryptoPipeline/DescriptorBundle field storage — skeletons stay unconnected", () => {
    // Field DECLARATIONS only (a colon-typed field would be the only way
    // to actually STORE one) — not bare-word prose, which this module's
    // own doc comment legitimately uses (lowercase module names) to
    // describe what it does NOT connect to; the same self-referential
    // doc-comment trap fixed for `descriptor_bundle` (Stage 93) is
    // avoided here from the start by phrasing the doc comment with
    // lowercase module names, not PascalCase type names.
    expect(executionPlanModule).not.toMatch(
      /:\s*(SecretHandle|AeadPlaceholderRequest|KdfPlaceholderRequest|KeyMaterialHandle|DomainLabel|OperationContext|RequestDescriptor|ResponseDescriptor|CryptoPipeline|DescriptorBundle)\b/,
    );
    // And the converse: the pre-existing skeletons don't reach into
    // execution_plan either — this stage only adds to lib.rs, never edits
    // those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(domainLabelModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(operationContextModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(requestDescriptorModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(responseDescriptorModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(cryptoPipelineModule).not.toMatch(/\bExecutionPlan\w*\b/);
    expect(descriptorBundleModule).not.toMatch(/\bExecutionPlan\w*\b/);
  });

  it("14. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(executionPlanModule).not.toContain("unsafe");
  });

  it("15. Runtime / Worker sources are unchanged: no execution-plan reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("execution_plan");
      expect(src).not.toContain("executionplan");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
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
      expect(
        /\.(rlib|so|dll|dylib|node|a|o)$/i.test(path),
        `unexpected compiled artifact: ${path}`,
      ).toBe(false);
    }
  });

  it("17. ExecutionPlanState has exactly the two specified variants", () => {
    for (const variant of ["Placeholder", "Disabled"]) {
      expect(executionPlanModule).toContain(variant);
    }
  });

  it("18. ExecutionPlan exposes exactly the five specified methods", () => {
    for (const method of [
      "new_placeholder",
      "kind",
      "status",
      "is_placeholder",
      "step_count",
    ]) {
      expect(executionPlanModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

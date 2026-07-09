import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 98 — internal lifecycle-state skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a fifteenth crate-private
 * module, `lifecycle_state`: `LifecycleState` (`Disabled` / `Placeholder`
 * / `PreparedPlaceholder` / `ActivePlaceholder` / `ClearedPlaceholder` /
 * `ErrorPlaceholder`), `LifecycleKind`
 * (`CryptoProviderLifecyclePlaceholder` / `RequestLifecyclePlaceholder` /
 * `SecretLifecyclePlaceholder` / `AuditLifecyclePlaceholder` /
 * `PipelineLifecyclePlaceholder` / `TestOnlyLifecyclePlaceholder` — a
 * label only), a non-sensitive `LifecycleStatus`, and `LifecycleMarker`
 * itself (`new_placeholder(kind)`/`kind()`/`status()`/`is_placeholder()`/
 * `mark_prepared_placeholder()`/`mark_active_placeholder()`/
 * `mark_cleared_placeholder()`/`mark_error_placeholder()`). It exists as
 * a fully independent, label-only type basis for a future
 * crypto-provider/request/secret/audit/pipeline lifecycle — no timestamp,
 * no counter, no payload, and no log output anywhere. Each `mark_*`
 * method takes nothing beyond `&mut self` and only ever transitions the
 * fixed `state` label.
 *
 * `LifecycleMarker` is an INTERNAL skeleton, not a public API: every item
 * in `lifecycle_state` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn`
 * surface is still exactly the same six placeholder functions from Stage
 * 69. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
 * no Nostr key is derived. `lifecycle_state` holds NO field of any other
 * skeleton type in this crate. Nothing is wired into the Runtime, the
 * Worker, or `CryptoProvider`, and nothing writes to stdout/stderr/any
 * log sink.
 *
 * `cargo test` (green as of this stage, including `lifecycle_state`'s
 * own `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests`
 * are verified as their own separate commands outside `npm test`,
 * consistent with how this repo has always kept the Rust toolchain check
 * independent of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal lifecycle state skeleton", () => {
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

  const lifecycleStateModule = extractModule(libRsSource, "mod lifecycle_state");
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
  const executionPlanModule = extractModule(libRsSource, "mod execution_plan");
  const errorTaxonomyModule = extractModule(libRsSource, "mod error_taxonomy");
  const auditEventModule = extractModule(libRsSource, "mod audit_event");
  const auditPolicyModule = extractModule(libRsSource, "mod audit_policy");

  it("1. lib.rs contains an internal (non-pub) lifecycle_state module", () => {
    expect(libRsSource).toContain("mod lifecycle_state");
    expect(libRsSource).not.toContain("pub mod lifecycle_state");
  });

  it("2. lifecycle_state's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod lifecycle_state");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. LifecycleMarker is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(lifecycleStateModule).toMatch(/\bpub\(crate\)\s+struct\s+LifecycleMarker\b/);
    expect(lifecycleStateModule).not.toMatch(/\bpub\s+struct\s+LifecycleMarker\b/);
    expect(lifecycleStateModule).toMatch(/\bpub\(crate\)\s+enum\s+LifecycleState\b/);
    expect(lifecycleStateModule).toMatch(/\bpub\(crate\)\s+enum\s+LifecycleKind\b/);
    expect(lifecycleStateModule).toMatch(/\bpub\(crate\)\s+struct\s+LifecycleStatus\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+lifecycle_state\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*LifecycleMarker\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bLifecycleMarker\b/,
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
    ];
    expect(pubFnNames.length).toBe(28);
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

  it("6. every LifecycleKind variant, and every LifecycleState variant, is a label only — no associated data, no tuple/struct variant", () => {
    for (const kind of [
      "CryptoProviderLifecyclePlaceholder",
      "RequestLifecyclePlaceholder",
      "SecretLifecyclePlaceholder",
      "AuditLifecyclePlaceholder",
      "PipelineLifecyclePlaceholder",
      "TestOnlyLifecyclePlaceholder",
    ]) {
      expect(lifecycleStateModule).toContain(kind);
      expect(lifecycleStateModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(lifecycleStateModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(lifecycleStateModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
    for (const state of [
      "Disabled",
      "Placeholder",
      "PreparedPlaceholder",
      "ActivePlaceholder",
      "ClearedPlaceholder",
      "ErrorPlaceholder",
    ]) {
      expect(lifecycleStateModule).toContain(state);
      expect(lifecycleStateModule).toMatch(new RegExp(`\\b${state}\\s*,`));
      expect(lifecycleStateModule).not.toMatch(new RegExp(`\\b${state}\\s*\\(`));
      expect(lifecycleStateModule).not.toMatch(new RegExp(`\\b${state}\\s*\\{`));
    }
  });

  it("7. no String field anywhere in lifecycle_state", () => {
    expect(lifecycleStateModule).not.toMatch(/:\s*String\b/);
    expect(lifecycleStateModule).not.toMatch(/\bString::from\b/);
    expect(lifecycleStateModule).not.toMatch(/\bString::new\b/);
    expect(lifecycleStateModule).not.toMatch(/\bto_string\s*\(/);
    expect(lifecycleStateModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("8. no Vec field anywhere in lifecycle_state", () => {
    expect(lifecycleStateModule).not.toMatch(/:\s*Vec</);
    expect(lifecycleStateModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("9. no payload field anywhere in lifecycle_state", () => {
    // Field DECLARATIONS only (name immediately followed by a colon-typed
    // annotation) — not prose in a doc comment that merely NAMES the
    // concept.
    expect(lifecycleStateModule).not.toMatch(/\bpayload\s*:\s*\w/i);
    expect(lifecycleStateModule).not.toMatch(/\bdata\s*:\s*\w/i);
    expect(lifecycleStateModule).not.toMatch(/\bdetails\s*:\s*\w/i);
  });

  it("10. no timestamp/counter field anywhere in lifecycle_state", () => {
    expect(lifecycleStateModule).not.toMatch(/\btimestamp\s*:\s*\w/i);
    expect(lifecycleStateModule).not.toMatch(/\btime\s*:\s*\w/i);
    expect(lifecycleStateModule).not.toMatch(/\bcounter\s*:\s*\w/i);
    expect(lifecycleStateModule).not.toMatch(/\bcount\s*:\s*\w/i);
    expect(lifecycleStateModule).not.toMatch(/\bSystemTime\b/);
    expect(lifecycleStateModule).not.toMatch(/\bInstant\b/);
    expect(lifecycleStateModule).not.toMatch(/\bu64\b/);
    expect(lifecycleStateModule).not.toMatch(/\bu32\b/i);
  });

  it("11. no println/eprintln/dbg!/log/tracing usage anywhere in lifecycle_state", () => {
    expect(lifecycleStateModule).not.toMatch(/\bprintln!\s*\(/);
    expect(lifecycleStateModule).not.toMatch(/\beprintln!\s*\(/);
    expect(lifecycleStateModule).not.toMatch(/\bprint!\s*\(/);
    expect(lifecycleStateModule).not.toMatch(/\beprint!\s*\(/);
    expect(lifecycleStateModule).not.toMatch(/\btracing::/);
    expect(lifecycleStateModule).not.toMatch(/\buse\s+tracing\b/);
    expect(lifecycleStateModule).not.toMatch(/\blog::/);
    expect(lifecycleStateModule).not.toMatch(/\buse\s+log\b/);
    expect(lifecycleStateModule).not.toMatch(/\bdbg!\s*\(/);
  });

  it("12. new_placeholder takes only a LifecycleKind, and every mark_*_placeholder method takes nothing beyond &mut self — no user-provided input", () => {
    expect(lifecycleStateModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*LifecycleKind\s*\)/,
    );
    expect(lifecycleStateModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(lifecycleStateModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
    for (const method of [
      "mark_prepared_placeholder",
      "mark_active_placeholder",
      "mark_cleared_placeholder",
      "mark_error_placeholder",
    ]) {
      expect(lifecycleStateModule).toMatch(new RegExp(`fn\\s+${method}\\s*\\(\\s*&mut\\s+self\\s*\\)`));
    }
  });

  it("13. no env/runtime/config-derived lifecycle construction anywhere in lifecycle_state", () => {
    expect(lifecycleStateModule).not.toMatch(/std::env/);
    expect(lifecycleStateModule).not.toMatch(/\benv::/);
    expect(lifecycleStateModule).not.toMatch(/\bvar_os\b/);
    expect(lifecycleStateModule).not.toMatch(/\bstd::process\b/);
  });

  it("14. no existing module field storage or connection — skeletons stay unconnected", () => {
    // Field DECLARATIONS only (a colon-typed field would be the only way
    // to actually STORE one) — not bare-word prose.
    expect(lifecycleStateModule).not.toMatch(
      /:\s*(SecretHandle|AeadPlaceholderRequest|KdfPlaceholderRequest|KeyMaterialHandle|DomainLabel|OperationContext|RequestDescriptor|ResponseDescriptor|CryptoPipeline|DescriptorBundle|ExecutionPlan|CryptoErrorDescriptor|AuditEventLabel|AuditPolicy)\b/,
    );
    // And the converse: the pre-existing skeletons don't reach into
    // lifecycle_state either — this stage only adds to lib.rs, never
    // edits those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(aeadCoreModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(kdfCoreModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(keyMaterialModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(domainLabelModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(operationContextModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(requestDescriptorModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(responseDescriptorModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(cryptoPipelineModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(descriptorBundleModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(executionPlanModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(errorTaxonomyModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(auditEventModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
    expect(auditPolicyModule).not.toMatch(/\bLifecycle(Marker|State|Kind|Status)\b/);
  });

  it("15. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in lifecycle_state", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`
    // word match, same lesson learned for `kdf_core` (Stage 82) and the
    // later skeleton stages.
    expect(lifecycleStateModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(lifecycleStateModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(lifecycleStateModule).not.toMatch(/\bhkdf::/);
    expect(lifecycleStateModule).not.toMatch(/\bHkdf::/);
    expect(lifecycleStateModule).not.toMatch(/\bargon2::/i);
    expect(lifecycleStateModule).not.toMatch(/\bArgon2::/);
    expect(lifecycleStateModule).not.toMatch(/\bArgon2</);
  });

  it("16. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(lifecycleStateModule).not.toContain("unsafe");
  });

  it("17. Runtime / Worker sources are unchanged: no lifecycle-state reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("lifecycle_state");
      expect(src).not.toContain("lifecyclestate");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("18. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("19. LifecycleMarker exposes exactly the eight specified methods", () => {
    for (const method of [
      "new_placeholder",
      "kind",
      "status",
      "is_placeholder",
      "mark_prepared_placeholder",
      "mark_active_placeholder",
      "mark_cleared_placeholder",
      "mark_error_placeholder",
    ]) {
      expect(lifecycleStateModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

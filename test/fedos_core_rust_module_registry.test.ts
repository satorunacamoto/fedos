import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 99 — internal module-registry skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a sixteenth crate-private
 * module, `module_registry`: `ModuleRegistryState` (`Disabled` /
 * `Placeholder`), `ModuleRegistryKind` (one enumeration label per
 * crate-private skeleton module added since Stage 79 — `SecretHandlePlaceholder`
 * / `AeadCorePlaceholder` / `KdfCorePlaceholder` / `KeyMaterialPlaceholder`
 * / `DomainLabelPlaceholder` / `OperationContextPlaceholder` /
 * `RequestDescriptorPlaceholder` / `ResponseDescriptorPlaceholder` /
 * `CryptoPipelinePlaceholder` / `DescriptorBundlePlaceholder` /
 * `ExecutionPlanPlaceholder` / `ErrorTaxonomyPlaceholder` /
 * `AuditEventPlaceholder` / `AuditPolicyPlaceholder` /
 * `LifecycleStatePlaceholder` / `TestOnlyPlaceholder`), a non-sensitive
 * `ModuleRegistryStatus`, and `ModuleRegistry` itself
 * (`new_placeholder(kind)`/`kind()`/`status()`/`is_placeholder()`/
 * `registered_module_count()`). It exists purely to document and fix, by
 * fixed label only, which internal skeleton modules exist today — it
 * never constructs, holds, or references an instance of any of them, and
 * `registered_module_count()` always returns the hardcoded literal `15`
 * (the real skeleton count, excluding `TestOnlyPlaceholder`) — never a
 * `.len()` call, never a `Vec`/`HashMap`/`BTreeMap`/static-array-derived
 * count.
 *
 * `ModuleRegistry` is an INTERNAL skeleton, not a public API: every item
 * in `module_registry` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn`
 * surface is still exactly the same six placeholder functions from Stage
 * 69. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
 * no Nostr key is derived. `module_registry` holds NO field of any other
 * skeleton type in this crate. Nothing is wired into the Runtime, the
 * Worker, or `CryptoProvider`, and nothing writes to stdout/stderr/any
 * log sink.
 *
 * `cargo test` (green as of this stage, including `module_registry`'s
 * own `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests`
 * are verified as their own separate commands outside `npm test`,
 * consistent with how this repo has always kept the Rust toolchain check
 * independent of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal module registry skeleton", () => {
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

  const moduleRegistryModule = extractModule(libRsSource, "mod module_registry");
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
  const lifecycleStateModule = extractModule(libRsSource, "mod lifecycle_state");

  it("1. lib.rs contains an internal (non-pub) module_registry module", () => {
    expect(libRsSource).toContain("mod module_registry");
    expect(libRsSource).not.toContain("pub mod module_registry");
  });

  it("2. module_registry's own module declaration is not pub (crate-private)", () => {
    const idx = libRsSource.indexOf("mod module_registry");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. ModuleRegistry is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(moduleRegistryModule).toMatch(/\bpub\(crate\)\s+struct\s+ModuleRegistry\b/);
    expect(moduleRegistryModule).not.toMatch(/\bpub\s+struct\s+ModuleRegistry\b/);
    expect(moduleRegistryModule).toMatch(/\bpub\(crate\)\s+enum\s+ModuleRegistryState\b/);
    expect(moduleRegistryModule).toMatch(/\bpub\(crate\)\s+enum\s+ModuleRegistryKind\b/);
    expect(moduleRegistryModule).toMatch(
      /\bpub\(crate\)\s+struct\s+ModuleRegistryStatus\b/,
    );
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+module_registry\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*ModuleRegistry\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bModuleRegistry\b/,
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
    ];
    expect(pubFnNames.length).toBe(22);
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

  it("5b. ModuleRegistry holds only kind and state fields — no other data", () => {
    expect(moduleRegistryModule).toMatch(
      /struct\s+ModuleRegistry\s*\{\s*kind\s*:\s*ModuleRegistryKind\s*,\s*state\s*:\s*ModuleRegistryState\s*,?\s*\}/,
    );
  });

  it("6. registered_module_count() exists, takes no extra input, and returns the fixed literal 15", () => {
    expect(moduleRegistryModule).toMatch(/fn\s+registered_module_count\s*\(\s*&self\s*\)/);
    expect(moduleRegistryModule).toMatch(
      /fn\s+registered_module_count\s*\(\s*&self\s*\)\s*->\s*usize\s*\{\s*15\s*\}/,
    );
  });

  it("7. registered_module_count() is not computed dynamically — no .len(), no Vec, no HashMap, no BTreeMap, no static array", () => {
    expect(moduleRegistryModule).not.toMatch(/:\s*Vec</);
    expect(moduleRegistryModule).not.toMatch(/\bVec::new\b/);
    expect(moduleRegistryModule).not.toMatch(/\bvec!\s*\[/);
    expect(moduleRegistryModule).not.toMatch(/\bHashMap\b/);
    expect(moduleRegistryModule).not.toMatch(/\bBTreeMap\b/);
    expect(moduleRegistryModule).not.toMatch(/\bHashSet\b/);
    expect(moduleRegistryModule).not.toMatch(/\bBTreeSet\b/);
    expect(moduleRegistryModule).not.toMatch(/\.len\(\s*\)/);
    expect(moduleRegistryModule).not.toMatch(/&\s*\[[^\]]*ModuleRegistryKind[^\]]*\]/);
    expect(moduleRegistryModule).not.toMatch(/\blazy_static\b/);
    expect(moduleRegistryModule).not.toMatch(/\bonce_cell\b/);
    expect(moduleRegistryModule).not.toMatch(/\binventory::/);
  });

  it("8. no String field anywhere in module_registry", () => {
    expect(moduleRegistryModule).not.toMatch(/:\s*String\b/);
    expect(moduleRegistryModule).not.toMatch(/\bString::from\b/);
    expect(moduleRegistryModule).not.toMatch(/\bString::new\b/);
    expect(moduleRegistryModule).not.toMatch(/\bto_string\s*\(/);
    expect(moduleRegistryModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("9. no payload/timestamp/counter field anywhere in module_registry", () => {
    // Field DECLARATIONS only (name immediately followed by a colon-typed
    // annotation) — not prose in a doc comment that merely NAMES the
    // concept.
    expect(moduleRegistryModule).not.toMatch(/\bpayload\s*:\s*\w/i);
    expect(moduleRegistryModule).not.toMatch(/\bdata\s*:\s*\w/i);
    expect(moduleRegistryModule).not.toMatch(/\btimestamp\s*:\s*\w/i);
    expect(moduleRegistryModule).not.toMatch(/\bcounter\s*:\s*\w/i);
    expect(moduleRegistryModule).not.toMatch(/\bSystemTime\b/);
    expect(moduleRegistryModule).not.toMatch(/\bInstant\b/);
  });

  it("10. no println/eprintln/dbg!/log/tracing usage anywhere in module_registry", () => {
    expect(moduleRegistryModule).not.toMatch(/\bprintln!\s*\(/);
    expect(moduleRegistryModule).not.toMatch(/\beprintln!\s*\(/);
    expect(moduleRegistryModule).not.toMatch(/\bprint!\s*\(/);
    expect(moduleRegistryModule).not.toMatch(/\beprint!\s*\(/);
    expect(moduleRegistryModule).not.toMatch(/\btracing::/);
    expect(moduleRegistryModule).not.toMatch(/\buse\s+tracing\b/);
    expect(moduleRegistryModule).not.toMatch(/\blog::/);
    expect(moduleRegistryModule).not.toMatch(/\buse\s+log\b/);
    expect(moduleRegistryModule).not.toMatch(/\bdbg!\s*\(/);
  });

  it("11. no Runtime / Worker / CryptoProvider connection anywhere in module_registry", () => {
    expect(moduleRegistryModule).not.toMatch(/\bCryptoProvider\b/);
    expect(moduleRegistryModule).not.toMatch(/\bRuntime\b/);
    expect(moduleRegistryModule).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("module_registry");
      expect(src).not.toContain("moduleregistry");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
  });

  it("12. no user input constructor — new_placeholder takes only a ModuleRegistryKind", () => {
    expect(moduleRegistryModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*ModuleRegistryKind\s*\)/,
    );
    expect(moduleRegistryModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(moduleRegistryModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
  });

  it("13. no env/runtime/config-derived registry construction anywhere in module_registry", () => {
    expect(moduleRegistryModule).not.toMatch(/std::env/);
    expect(moduleRegistryModule).not.toMatch(/\benv::/);
    expect(moduleRegistryModule).not.toMatch(/\bvar_os\b/);
    expect(moduleRegistryModule).not.toMatch(/\bstd::process\b/);
  });

  it("14. no field storage of, or connection to, any other skeleton module — skeletons stay unconnected", () => {
    // Field DECLARATIONS only (a colon-typed field would be the only way
    // to actually STORE one) — not the ModuleRegistryKind enumeration
    // labels, which deliberately NAME the modules (e.g.
    // `SecretHandlePlaceholder`) without ever constructing them.
    expect(moduleRegistryModule).not.toMatch(
      /:\s*(SecretHandle|AeadPlaceholderRequest|KdfPlaceholderRequest|KeyMaterialHandle|DomainLabel|OperationContext|RequestDescriptor|ResponseDescriptor|CryptoPipeline|DescriptorBundle|ExecutionPlan|CryptoErrorDescriptor|AuditEventLabel|AuditPolicy|LifecycleMarker)\b/,
    );
    // And the converse: the pre-existing skeletons don't reach into
    // module_registry either — this stage only adds to lib.rs, never
    // edits those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(domainLabelModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(operationContextModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(requestDescriptorModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(responseDescriptorModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(cryptoPipelineModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(descriptorBundleModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(executionPlanModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(errorTaxonomyModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(auditEventModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(auditPolicyModule).not.toMatch(/\bModuleRegistry\w*\b/);
    expect(lifecycleStateModule).not.toMatch(/\bModuleRegistry\w*\b/);
  });

  it("15. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in module_registry", () => {
    // Specific Rust-usage patterns only — NOT a bare word match, same
    // lesson learned for `kdf_core` (Stage 82) and the later skeleton
    // stages.
    expect(moduleRegistryModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(moduleRegistryModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(moduleRegistryModule).not.toMatch(/\bhkdf::/);
    expect(moduleRegistryModule).not.toMatch(/\bHkdf::/);
    expect(moduleRegistryModule).not.toMatch(/\bargon2::/i);
    expect(moduleRegistryModule).not.toMatch(/\bArgon2::/);
    expect(moduleRegistryModule).not.toMatch(/\bArgon2</);
  });

  it("16. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(moduleRegistryModule).not.toContain("unsafe");
  });

  it("17. no .wasm / target / Cargo.lock artifact is committed to the package", () => {
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

  it("18. ModuleRegistryKind has exactly the sixteen specified enumeration labels", () => {
    for (const kind of [
      "SecretHandlePlaceholder",
      "AeadCorePlaceholder",
      "KdfCorePlaceholder",
      "KeyMaterialPlaceholder",
      "DomainLabelPlaceholder",
      "OperationContextPlaceholder",
      "RequestDescriptorPlaceholder",
      "ResponseDescriptorPlaceholder",
      "CryptoPipelinePlaceholder",
      "DescriptorBundlePlaceholder",
      "ExecutionPlanPlaceholder",
      "ErrorTaxonomyPlaceholder",
      "AuditEventPlaceholder",
      "AuditPolicyPlaceholder",
      "LifecycleStatePlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(moduleRegistryModule).toContain(kind);
      expect(moduleRegistryModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(moduleRegistryModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(moduleRegistryModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
  });

  it("19. ModuleRegistryState has exactly the two specified variants", () => {
    for (const variant of ["Disabled", "Placeholder"]) {
      expect(moduleRegistryModule).toContain(variant);
    }
  });

  it("20. ModuleRegistry exposes exactly the five specified methods", () => {
    for (const method of [
      "new_placeholder",
      "kind",
      "status",
      "is_placeholder",
      "registered_module_count",
    ]) {
      expect(moduleRegistryModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

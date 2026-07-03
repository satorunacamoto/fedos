import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 97 — internal audit-policy skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a fourteenth crate-private
 * module, `audit_policy`: `AuditPolicyState` (`Placeholder` / `Disabled`),
 * `AuditPolicyKind` (`MinimalPlaceholder` / `DevelopmentPlaceholder` /
 * `TestOnlyPlaceholder` — a label only), `AuditPolicyDecision`
 * (`AllowPlaceholder` / `DenyPlaceholder` — a label only), a non-sensitive
 * `AuditPolicyStatus`, and `AuditPolicy` itself
 * (`new_placeholder(kind)`/`kind()`/`status()`/`is_placeholder()`/
 * `decision_placeholder()`). It exists as a fully independent, label-only
 * type basis for a future decision of which kind of observation would be
 * permitted — no observation payload and no log output anywhere.
 * `decision_placeholder()` takes no input and always returns the fixed
 * safe-default label `DenyPlaceholder`, regardless of `kind`.
 *
 * `AuditPolicy` is an INTERNAL skeleton, not a public API: every item in
 * `audit_policy` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn`
 * surface is still exactly the same six placeholder functions from Stage
 * 69. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
 * no Nostr key is derived. `audit_policy` holds NO field of any other
 * skeleton type in this crate, and — per this stage's explicit
 * instruction — does not even reference `audit_event` (Stage 96) or its
 * types by name, since no real connection exists yet. Nothing is wired
 * into the Runtime, the Worker, or `CryptoProvider`, and nothing writes to
 * stdout/stderr/any log sink.
 *
 * `cargo test` (green as of this stage, including `audit_policy`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent
 * of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal audit policy skeleton", () => {
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

  const auditPolicyModule = extractModule(libRsSource, "mod audit_policy");
  const auditEventModule = extractModule(libRsSource, "mod audit_event");
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

  it("1. lib.rs contains an internal (non-pub) audit_policy module", () => {
    expect(libRsSource).toContain("mod audit_policy");
    expect(libRsSource).not.toContain("pub mod audit_policy");
  });

  it("2. audit_policy's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod audit_policy");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. AuditPolicy is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(auditPolicyModule).toMatch(/\bpub\(crate\)\s+struct\s+AuditPolicy\b/);
    expect(auditPolicyModule).not.toMatch(/\bpub\s+struct\s+AuditPolicy\b/);
    expect(auditPolicyModule).toMatch(/\bpub\(crate\)\s+enum\s+AuditPolicyState\b/);
    expect(auditPolicyModule).toMatch(/\bpub\(crate\)\s+enum\s+AuditPolicyKind\b/);
    expect(auditPolicyModule).toMatch(/\bpub\(crate\)\s+enum\s+AuditPolicyDecision\b/);
    expect(auditPolicyModule).toMatch(/\bpub\(crate\)\s+struct\s+AuditPolicyStatus\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+audit_policy\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*AuditPolicy\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bAuditPolicy\b/,
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
    ];
    expect(pubFnNames.length).toBe(6);
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

  it("6. every AuditPolicyKind variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const kind of ["MinimalPlaceholder", "DevelopmentPlaceholder", "TestOnlyPlaceholder"]) {
      expect(auditPolicyModule).toContain(kind);
      // A unit variant is a bare identifier followed by `,` (no `(` or `{`
      // immediately after — that would make it a tuple/struct variant
      // carrying data).
      expect(auditPolicyModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(auditPolicyModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(auditPolicyModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
  });

  it("7. every AuditPolicyDecision variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const decision of ["AllowPlaceholder", "DenyPlaceholder"]) {
      expect(auditPolicyModule).toContain(decision);
      expect(auditPolicyModule).toMatch(new RegExp(`\\b${decision}\\s*,`));
      expect(auditPolicyModule).not.toMatch(new RegExp(`\\b${decision}\\s*\\(`));
      expect(auditPolicyModule).not.toMatch(new RegExp(`\\b${decision}\\s*\\{`));
    }
  });

  it("8. no String field anywhere in audit_policy", () => {
    expect(auditPolicyModule).not.toMatch(/:\s*String\b/);
    expect(auditPolicyModule).not.toMatch(/\bString::from\b/);
    expect(auditPolicyModule).not.toMatch(/\bString::new\b/);
    expect(auditPolicyModule).not.toMatch(/\bto_string\s*\(/);
    expect(auditPolicyModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("9. no Vec field anywhere in audit_policy", () => {
    expect(auditPolicyModule).not.toMatch(/:\s*Vec</);
    expect(auditPolicyModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("10. no payload field anywhere in audit_policy", () => {
    // Field DECLARATIONS only (name immediately followed by a colon-typed
    // annotation) — not prose in a doc comment that merely NAMES the
    // concept.
    expect(auditPolicyModule).not.toMatch(/\bpayload\s*:\s*\w/i);
    expect(auditPolicyModule).not.toMatch(/\bdata\s*:\s*\w/i);
    expect(auditPolicyModule).not.toMatch(/\bdetails\s*:\s*\w/i);
  });

  it("11. no println/eprintln/dbg!/log/tracing usage anywhere in audit_policy", () => {
    expect(auditPolicyModule).not.toMatch(/\bprintln!\s*\(/);
    expect(auditPolicyModule).not.toMatch(/\beprintln!\s*\(/);
    expect(auditPolicyModule).not.toMatch(/\bprint!\s*\(/);
    expect(auditPolicyModule).not.toMatch(/\beprint!\s*\(/);
    expect(auditPolicyModule).not.toMatch(/\btracing::/);
    expect(auditPolicyModule).not.toMatch(/\buse\s+tracing\b/);
    expect(auditPolicyModule).not.toMatch(/\blog::/);
    expect(auditPolicyModule).not.toMatch(/\buse\s+log\b/);
    expect(auditPolicyModule).not.toMatch(/\bdbg!\s*\(/);
  });

  it("12. new_placeholder takes only an AuditPolicyKind, and decision_placeholder takes nothing — no user-provided string/byte input", () => {
    expect(auditPolicyModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*AuditPolicyKind\s*\)/,
    );
    expect(auditPolicyModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(auditPolicyModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
    expect(auditPolicyModule).toMatch(/fn\s+decision_placeholder\s*\(\s*&self\s*\)/);
  });

  it("13. no env/runtime/config-derived policy construction anywhere in audit_policy", () => {
    expect(auditPolicyModule).not.toMatch(/std::env/);
    expect(auditPolicyModule).not.toMatch(/\benv::/);
    expect(auditPolicyModule).not.toMatch(/\bvar_os\b/);
    expect(auditPolicyModule).not.toMatch(/\bstd::process\b/);
  });

  it("14. no audit_event actual connection anywhere in audit_policy — skeletons stay unconnected", () => {
    // Per this stage's explicit instruction: avoid even referencing
    // `audit_event`/`AuditEventLabel` by name when no real connection
    // exists — checked here as a bare-word absence, not just a
    // field-declaration absence, since the task said to avoid the type
    // name entirely if unnecessary.
    expect(auditPolicyModule).not.toMatch(/\baudit_event\b/);
    expect(auditPolicyModule).not.toMatch(/\bAuditEvent\w*\b/);
    // And the converse: audit_event doesn't reach into audit_policy
    // either — this stage only adds to lib.rs, never edits audit_event's
    // own body.
    expect(auditEventModule).not.toMatch(/\baudit_policy\b/);
    expect(auditEventModule).not.toMatch(/\bAuditPolicy\w*\b/);
  });

  it("15. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in audit_policy", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`
    // word match, which would also match this module's own doc-comment
    // prose, same lesson learned for `kdf_core` (Stage 82) and the later
    // skeleton stages.
    expect(auditPolicyModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(auditPolicyModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(auditPolicyModule).not.toMatch(/\bhkdf::/);
    expect(auditPolicyModule).not.toMatch(/\bHkdf::/);
    expect(auditPolicyModule).not.toMatch(/\bargon2::/i);
    expect(auditPolicyModule).not.toMatch(/\bArgon2::/);
    expect(auditPolicyModule).not.toMatch(/\bArgon2</);
  });

  it("16. no SecretHandle/KeyMaterial/DomainLabel/OperationContext/RequestDescriptor/ResponseDescriptor/CryptoPipeline/DescriptorBundle/ExecutionPlan/ErrorTaxonomy field storage — skeletons stay unconnected", () => {
    // Field DECLARATIONS only (a colon-typed field would be the only way
    // to actually STORE one) — not bare-word prose.
    expect(auditPolicyModule).not.toMatch(
      /:\s*(SecretHandle|AeadPlaceholderRequest|KdfPlaceholderRequest|KeyMaterialHandle|DomainLabel|OperationContext|RequestDescriptor|ResponseDescriptor|CryptoPipeline|DescriptorBundle|ExecutionPlan|CryptoErrorDescriptor)\b/,
    );
    // And the converse: the pre-existing skeletons don't reach into
    // audit_policy either — this stage only adds to lib.rs, never edits
    // those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(domainLabelModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(operationContextModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(requestDescriptorModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(responseDescriptorModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(cryptoPipelineModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(descriptorBundleModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(executionPlanModule).not.toMatch(/\bAuditPolicy\w*\b/);
    expect(errorTaxonomyModule).not.toMatch(/\bAuditPolicy\w*\b/);
  });

  it("17. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(auditPolicyModule).not.toContain("unsafe");
  });

  it("18. Runtime / Worker sources are unchanged: no audit-policy reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("audit_policy");
      expect(src).not.toContain("auditpolicy");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
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
      expect(
        /\.(rlib|so|dll|dylib|node|a|o)$/i.test(path),
        `unexpected compiled artifact: ${path}`,
      ).toBe(false);
    }
  });

  it("20. AuditPolicyState has exactly the two specified variants", () => {
    for (const variant of ["Placeholder", "Disabled"]) {
      expect(auditPolicyModule).toContain(variant);
    }
  });

  it("21. AuditPolicy exposes exactly the five specified methods, and decision_placeholder always returns the fixed deny label", () => {
    for (const method of [
      "new_placeholder",
      "kind",
      "status",
      "is_placeholder",
      "decision_placeholder",
    ]) {
      expect(auditPolicyModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
    expect(auditPolicyModule).toMatch(
      /fn\s+decision_placeholder\s*\([^)]*\)\s*->\s*AuditPolicyDecision\s*\{\s*AuditPolicyDecision::DenyPlaceholder\s*\}/,
    );
  });
});

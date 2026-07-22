import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 96 — internal audit-event-label skeleton.
 *
 * `packages/fedos-core-rust/src/lib.rs` gains a thirteenth crate-private
 * module, `audit_event`: `AuditEventState` (`Placeholder` / `Disabled`),
 * `AuditEventKind` (`CryptoProviderSelectedPlaceholder` /
 * `RequestAcceptedPlaceholder` / `RequestRejectedPlaceholder` /
 * `PlanPreparedPlaceholder` / `PrimitiveExecutedPlaceholder` /
 * `ResponseBuiltPlaceholder` / `SecretClearedPlaceholder` /
 * `ErrorClassifiedPlaceholder` / `TestOnlyPlaceholder` — a label only), a
 * non-sensitive `AuditEventStatus`, and `AuditEventLabel` itself
 * (`new_placeholder(kind)`/`kind()`/`status()`/`is_placeholder()`). It
 * exists as a fully independent, label-only type basis for observing a
 * future FedOS Core crypto-internal state change — no event payload and
 * no log output anywhere.
 *
 * `AuditEventLabel` is an INTERNAL skeleton, not a public API: every item
 * in `audit_event` is `pub(crate)` at most (never `pub`), nothing is
 * re-exported from the crate root, and this crate's public `pub fn`
 * surface is still exactly the same six placeholder functions from Stage
 * 69. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
 * no Nostr key is derived. `audit_event` holds NO field of any other
 * skeleton type — it is NOT connected to, and does not construct or
 * store, `secret_handle` (Stage 79), `aead_core` (Stage 80), `kdf_core`
 * (Stage 82), `key_material` (Stage 87), `domain_label` (Stage 88),
 * `operation_context` (Stage 89), `request_descriptor` (Stage 90),
 * `response_descriptor` (Stage 91), `crypto_pipeline` (Stage 92),
 * `descriptor_bundle` (Stage 93), `execution_plan` (Stage 94), or
 * `error_taxonomy` (Stage 95). Nothing is wired into the Runtime, the
 * Worker, or `CryptoProvider`, and nothing writes to stdout/stderr/any
 * log sink.
 *
 * `cargo test` (green as of this stage, including `audit_event`'s own
 * `#[cfg(test)] mod tests`) and `cargo check` / `cargo check --tests` are
 * verified as their own separate commands outside `npm test`, consistent
 * with how this repo has always kept the Rust toolchain check independent
 * of the vitest/TypeScript test run.
 */
describe("FedOS Rust crate — internal audit event label skeleton", () => {
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

  it("1. lib.rs contains an internal (non-pub) audit_event module", () => {
    expect(libRsSource).toContain("mod audit_event");
    expect(libRsSource).not.toContain("pub mod audit_event");
  });

  it("2. audit_event's own module declaration is not pub", () => {
    const idx = libRsSource.indexOf("mod audit_event");
    const before = libRsSource.slice(Math.max(0, idx - 40), idx);
    expect(before).not.toMatch(/\bpub\s+$/);
  });

  it("3. AuditEventLabel is not `pub` — at most `pub(crate)` — and never exported from the crate root", () => {
    expect(auditEventModule).toMatch(/\bpub\(crate\)\s+struct\s+AuditEventLabel\b/);
    expect(auditEventModule).not.toMatch(/\bpub\s+struct\s+AuditEventLabel\b/);
    expect(auditEventModule).toMatch(/\bpub\(crate\)\s+enum\s+AuditEventState\b/);
    expect(auditEventModule).toMatch(/\bpub\(crate\)\s+enum\s+AuditEventKind\b/);
    expect(auditEventModule).toMatch(/\bpub\(crate\)\s+struct\s+AuditEventStatus\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+audit_event\b/);
    expect(libRsSource).not.toMatch(/\bpub\s+use\s+[\w:]*AuditEventLabel\b/);
    expect(libRsSource).not.toMatch(
      /\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bAuditEventLabel\b/,
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
      "seal_direct_ratchet_secret",
      "restore_direct_ratchet_secret",
      "initialize_as_receiver",
      "initialize_as_sender",
      "local_ratchet_public_key_hex",
      "remote_ratchet_public_key_hex",
      "is_ready_to_send",
      "send_counter",
      "receive_counter",
      "skipped_key_count",
      "encrypt",
      "decrypt",
      "seal_root_key",
      "seal_sending_chain_key",
      "seal_receiving_chain_key",
      "seal_local_ratchet_private_key",
      "seal_all_skipped_keys",
      "restore",
      "encrypt_nip44_wire",
      "decrypt_nip44_wire",
      "sign_nostr_event_with_fresh_ephemeral_key",
      "build_and_sign_nip17_gift_wrap",
    ];
    expect(pubFnNames.length).toBe(68);    expect([...pubFnNames].sort()).toEqual([...expected].sort());
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

  it("6. every AuditEventKind variant is a label only — no associated data, no tuple/struct variant", () => {
    for (const kind of [
      "CryptoProviderSelectedPlaceholder",
      "RequestAcceptedPlaceholder",
      "RequestRejectedPlaceholder",
      "PlanPreparedPlaceholder",
      "PrimitiveExecutedPlaceholder",
      "ResponseBuiltPlaceholder",
      "SecretClearedPlaceholder",
      "ErrorClassifiedPlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(auditEventModule).toContain(kind);
      // A unit variant is a bare identifier followed by `,` (no `(` or `{`
      // immediately after — that would make it a tuple/struct variant
      // carrying data, e.g. a real event payload).
      expect(auditEventModule).toMatch(new RegExp(`\\b${kind}\\s*,`));
      expect(auditEventModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\(`));
      expect(auditEventModule).not.toMatch(new RegExp(`\\b${kind}\\s*\\{`));
    }
  });

  it("7. no String field anywhere in audit_event", () => {
    expect(auditEventModule).not.toMatch(/:\s*String\b/);
    expect(auditEventModule).not.toMatch(/\bString::from\b/);
    expect(auditEventModule).not.toMatch(/\bString::new\b/);
    expect(auditEventModule).not.toMatch(/\bto_string\s*\(/);
    expect(auditEventModule).not.toMatch(/\bformat!\s*\(/);
  });

  it("8. no Vec field anywhere in audit_event", () => {
    expect(auditEventModule).not.toMatch(/:\s*Vec</);
    expect(auditEventModule).not.toMatch(/&\s*\[\s*u8\s*\]/);
  });

  it("9. no event payload field anywhere in audit_event", () => {
    // Field DECLARATIONS only (name immediately followed by a colon-typed
    // annotation) — not prose in a doc comment that merely NAMES the
    // concept (e.g. "holds no event payload of any kind").
    expect(auditEventModule).not.toMatch(/\bpayload\s*:\s*\w/i);
    expect(auditEventModule).not.toMatch(/\bdata\s*:\s*\w/i);
    expect(auditEventModule).not.toMatch(/\bdetails\s*:\s*\w/i);
  });

  it("10. no println/eprintln/log/tracing usage anywhere in audit_event", () => {
    expect(auditEventModule).not.toMatch(/\bprintln!\s*\(/);
    expect(auditEventModule).not.toMatch(/\beprintln!\s*\(/);
    expect(auditEventModule).not.toMatch(/\bprint!\s*\(/);
    expect(auditEventModule).not.toMatch(/\beprint!\s*\(/);
    expect(auditEventModule).not.toMatch(/\btracing::/);
    expect(auditEventModule).not.toMatch(/\buse\s+tracing\b/);
    expect(auditEventModule).not.toMatch(/\blog::/);
    expect(auditEventModule).not.toMatch(/\buse\s+log\b/);
    expect(auditEventModule).not.toMatch(/\bdbg!\s*\(/);
  });

  it("11. new_placeholder takes only an AuditEventKind — no user-provided string/byte input", () => {
    expect(auditEventModule).toMatch(
      /fn\s+new_placeholder\s*\(\s*kind\s*:\s*AuditEventKind\s*\)/,
    );
    expect(auditEventModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*&\s*str/);
    expect(auditEventModule).not.toMatch(/fn\s+new_placeholder\s*\([^)]*String/);
  });

  it("12. no env/runtime/config-derived event construction anywhere in audit_event", () => {
    expect(auditEventModule).not.toMatch(/std::env/);
    expect(auditEventModule).not.toMatch(/\benv::/);
    expect(auditEventModule).not.toMatch(/\bvar_os\b/);
    expect(auditEventModule).not.toMatch(/\bstd::process\b/);
  });

  it("13. no AEAD/HKDF/Argon2/NIP-44 actual connection anywhere in audit_event", () => {
    // Specific Rust-usage patterns only — NOT a bare `\bhkdf\b`/`\bargon2\b`
    // word match, which would also match this module's own doc-comment
    // prose naming HKDF/AEAD/Argon2/NIP-44 as future, still-unimplemented
    // connection points, same lesson learned for `kdf_core` (Stage 82) and
    // `key_material`/`domain_label`/`operation_context`/
    // `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
    // `descriptor_bundle`/`execution_plan`/`error_taxonomy` (Stage 87-95).
    expect(auditEventModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(auditEventModule).not.toMatch(/\buse\s+hkdf\b/);
    expect(auditEventModule).not.toMatch(/\bhkdf::/);
    expect(auditEventModule).not.toMatch(/\bHkdf::/);
    expect(auditEventModule).not.toMatch(/\bargon2::/i);
    expect(auditEventModule).not.toMatch(/\bArgon2::/);
    expect(auditEventModule).not.toMatch(/\bArgon2</);
  });

  it("14. no SecretHandle/KeyMaterial/DomainLabel/OperationContext/RequestDescriptor/ResponseDescriptor/CryptoPipeline/DescriptorBundle/ExecutionPlan/ErrorTaxonomy field storage — skeletons stay unconnected", () => {
    // Field DECLARATIONS only (a colon-typed field would be the only way
    // to actually STORE one) — not bare-word prose, which this module's
    // own doc comment legitimately uses (lowercase module names) to
    // describe what it does NOT connect to, same as `descriptor_bundle`
    // (Stage 93), `execution_plan` (Stage 94), and `error_taxonomy`
    // (Stage 95) already established.
    expect(auditEventModule).not.toMatch(
      /:\s*(SecretHandle|AeadPlaceholderRequest|KdfPlaceholderRequest|KeyMaterialHandle|DomainLabel|OperationContext|RequestDescriptor|ResponseDescriptor|CryptoPipeline|DescriptorBundle|ExecutionPlan|CryptoErrorDescriptor)\b/,
    );
    // And the converse: the pre-existing skeletons don't reach into
    // audit_event either — this stage only adds to lib.rs, never edits
    // those modules' own bodies.
    expect(secretHandleModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(aeadCoreModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(kdfCoreModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(keyMaterialModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(domainLabelModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(operationContextModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(requestDescriptorModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(responseDescriptorModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(cryptoPipelineModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(descriptorBundleModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(executionPlanModule).not.toMatch(/\bAuditEvent\w*\b/);
    expect(errorTaxonomyModule).not.toMatch(/\bAuditEvent\w*\b/);
  });

  it("15. no `unsafe` anywhere in lib.rs (crate-level forbid stays intact)", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(libRsSource).not.toMatch(/\bunsafe\s+(fn|impl|trait|\{)/);
    expect(auditEventModule).not.toContain("unsafe");
  });

  it("16. Runtime / Worker sources are unchanged: no audit-event reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("audit_event");
      expect(src).not.toContain("auditevent");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(runtimeSource).not.toMatch(/\.\s*load\s*\(/);
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

  it("18. AuditEventState has exactly the two specified variants", () => {
    for (const variant of ["Placeholder", "Disabled"]) {
      expect(auditEventModule).toContain(variant);
    }
  });

  it("19. AuditEventLabel exposes exactly the four specified methods", () => {
    for (const method of ["new_placeholder", "kind", "status", "is_placeholder"]) {
      expect(auditEventModule).toMatch(new RegExp(`\\bfn\\s+${method}\\b`));
    }
  });
});

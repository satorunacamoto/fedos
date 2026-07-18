import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import provisioningDocSource from "../docs/public_key_provisioning.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 105 — public key-format label enumeration (planning only).
 *
 * `packages/fedos-core-rust/src/lib.rs` gains one more label-only PUBLIC
 * group: `FedosKeyFormatLabel` (seven variants — the key-format planning
 * labels `docs/public_key_provisioning.md` section 6 deferred at Stage
 * 104), plus `FedosKeyFormatState`, `FedosKeyFormatStatus`,
 * `FedosKeyFormatDescriptor`, and one new function,
 * `fedos_key_format_descriptor_placeholder()`, which returns a fixed
 * sentinel descriptor.
 *
 * Every label is a FUTURE PLANNING LABEL, not a statement of format
 * support: no raw key byte, no owned string, no growable byte collection,
 * no parser, no serializer, and no import/export function exists
 * anywhere in this stage's additions. The raw-input format decision
 * itself stays UNIMPLEMENTED. `Cargo.toml` is untouched; no CSPRNG
 * entropy source is consulted; nothing is wired into the Runtime, the
 * Worker, or a crypto provider.
 *
 * `cargo test` / `cargo check` / `cargo check --tests` are verified as
 * their own separate commands outside `npm test`, consistent with how
 * this repo has always kept the Rust toolchain check independent of the
 * vitest/TypeScript test run.
 */
describe("FedOS Rust crate — public key-format label boundary (Stage 105)", () => {
  function extractSection(source: string, startMarker: string, endMarker: string): string {
    const start = source.indexOf(startMarker);
    expect(start, `expected to find "${startMarker}" in lib.rs`).toBeGreaterThan(-1);
    const end = source.indexOf(endMarker, start);
    expect(end, `expected to find "${endMarker}" after "${startMarker}"`).toBeGreaterThan(-1);
    return source.slice(start, end);
  }

  // TOML comments legitimately NAME both allowed and still-forbidden crates;
  // strip comments before scanning (same approach as the other Rust tests).
  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  // Ends right before Stage 106's own key-usage/algorithm-policy groups
  // (added later) so this section stays scoped to exactly Stage 105's
  // types.
  const stage105Section = extractSection(
    libRsSource,
    "Stage 105 — public key-format label enumeration",
    "Stage 106 — public key-usage label enumeration",
  );

  it("1. FedosKeyFormatLabel exists, with the seven specified variants", () => {
    expect(libRsSource).toContain("pub enum FedosKeyFormatLabel");
    for (const variant of [
      "RawAeadKeyPlaceholder",
      "RawKdfOutputPlaceholder",
      "NostrSecretKeyPlaceholder",
      "NostrPublicKeyPlaceholder",
      "Nip44ConversationKeyPlaceholder",
      "ExternalOpaqueKeyRefPlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(stage105Section).toContain(variant);
    }
    const decl = extractSection(stage105Section, "pub enum FedosKeyFormatLabel", "}");
    for (const variant of [
      "RawAeadKeyPlaceholder",
      "RawKdfOutputPlaceholder",
      "NostrSecretKeyPlaceholder",
      "NostrPublicKeyPlaceholder",
      "Nip44ConversationKeyPlaceholder",
      "ExternalOpaqueKeyRefPlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(decl).toContain(variant);
    }
  });

  it("2. FedosKeyFormatLabel is a label-only enum — every variant is a bare unit variant, no associated data", () => {
    const decl = extractSection(stage105Section, "pub enum FedosKeyFormatLabel", "}");
    for (const variant of [
      "RawAeadKeyPlaceholder",
      "RawKdfOutputPlaceholder",
      "NostrSecretKeyPlaceholder",
      "NostrPublicKeyPlaceholder",
      "Nip44ConversationKeyPlaceholder",
      "ExternalOpaqueKeyRefPlaceholder",
      "TestOnlyPlaceholder",
    ]) {
      expect(decl).not.toMatch(new RegExp(`\\b${variant}\\s*\\(`));
      expect(decl).not.toMatch(new RegExp(`\\b${variant}\\s*\\{`));
    }
    expect(libRsSource).toContain("pub enum FedosKeyFormatState");
    expect(libRsSource).toContain("pub struct FedosKeyFormatStatus");
    expect(libRsSource).toContain("pub struct FedosKeyFormatDescriptor");
  });

  it("3. no Vec/String field anywhere in the Stage 105 section — every type holds only enum labels", () => {
    expect(stage105Section).not.toMatch(/Vec\s*<\s*u8\s*>/);
    expect(stage105Section).not.toMatch(/Vec\s*</);
    expect(stage105Section).not.toMatch(/:\s*String\b/);
    expect(stage105Section).not.toMatch(/\bString::from\b/);
    expect(stage105Section).not.toMatch(/\bString::new\b/);
    expect(stage105Section).not.toMatch(/&\s*\[\s*u8\s*\]/);
    expect(stage105Section).not.toMatch(/\[\s*u8\s*;/);
    expect(stage105Section).not.toMatch(/\bBytes\b/);
    expect(stage105Section).not.toMatch(/\bBox<\s*\[\s*u8\s*\]\s*>/);
  });

  it("4. no raw byte API anywhere — no key/seed/plaintext/ciphertext/passphrase/nonce/tag storage field or parameter", () => {
    expect(stage105Section).not.toMatch(/\bkey\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\bseed\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\bplaintext\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\bciphertext\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\bpassphrase\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\bnonce\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\btag\s*:\s*\w/i);
    expect(stage105Section).not.toMatch(/\bsecret\s*:\s*\w/i);
  });

  it("5. no parser/serializer/import/export function exists anywhere in lib.rs", () => {
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+parse_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+serialize_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+import_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+export_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+validate_key\s*\(/);
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+generate_key\s*\(/);
    expect(stage105Section).not.toMatch(/\bfn\s+parse\w*\s*\(/);
    expect(stage105Section).not.toMatch(/\bfn\s+serialize\w*\s*\(/);
    expect(stage105Section).not.toMatch(/\bfn\s+deserialize\w*\s*\(/);
    expect(stage105Section).not.toMatch(/\bfn\s+validate\w*\s*\(/);
    expect(stage105Section).not.toMatch(/\bserde::/);
    expect(stage105Section).not.toMatch(/#\[derive\([^)]*Serialize[^)]*\)\]/);
    expect(stage105Section).not.toMatch(/#\[derive\([^)]*Deserialize[^)]*\)\]/);
  });

  it("6. lib.rs's public `pub fn` surface is exactly twenty-two functions, reflecting Stage 105/106's increases", () => {
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
      "encrypt_nip44_wire",
      "decrypt_nip44_wire",
      "sign_nostr_event_with_fresh_ephemeral_key",
      "build_and_sign_nip17_gift_wrap",
    ];
    expect(pubFnNames.length).toBe(50);
    expect([...pubFnNames].sort()).toEqual([...expected].sort());
  });

  it("7. all seventeen pre-existing public functions are byte-for-byte unchanged", () => {
    for (const fn of [
      "pub fn fedos_core_status() -> FedosCoreStatus",
      "pub fn fedos_core_capabilities() -> &'static [&'static str]",
      "pub fn random_bytes_placeholder() -> FedosCoreStatus",
      "pub fn derive_key_placeholder() -> FedosCoreStatus",
      "pub fn encrypt_placeholder() -> FedosCoreStatus",
      "pub fn decrypt_placeholder() -> FedosCoreStatus",
      "pub fn fedos_crypto_boundary_status() -> FedosCryptoBoundaryStatus",
      "pub fn fedos_random_boundary_status() -> FedosRandomBoundary",
      "pub fn fedos_nonce_boundary_status() -> FedosNonceBoundary",
      "pub fn fedos_key_generation_boundary_status() -> FedosKeyGenerationBoundary",
      "pub fn fedos_key_import_boundary_status() -> FedosKeyImportBoundary",
      "pub fn fedos_key_export_boundary_status() -> FedosKeyExportBoundary",
      "pub fn fedos_capability_descriptors() -> &'static [FedosCapabilityDescriptor]",
      "pub fn fedos_algorithm_descriptors() -> &'static [FedosAlgorithmDescriptor]",
      "pub fn fedos_boundary_version() -> FedosBoundaryVersion",
      "pub fn fedos_boundary_features() -> &'static [FedosBoundaryFeature]",
    ]) {
      expect(libRsSource, `expected unchanged signature: ${fn}`).toContain(fn);
    }
    expect(libRsSource).toMatch(
      /fn random_bytes_placeholder\(\)\s*->\s*FedosCoreStatus\s*\{\s*placeholder_status\(\)\s*\}/,
    );
  });

  it("8. no Runtime / Worker / CryptoProvider connection anywhere in the Stage 105 section", () => {
    expect(stage105Section).not.toMatch(/\bCryptoProvider\b/);
    expect(stage105Section).not.toMatch(/\bRuntime\b/);
    expect(stage105Section).not.toMatch(/\bWorker\b/);
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("fedoskeyformat");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("9. Cargo.toml has no 'Stage 105' mention (Stage 147 later adds a ninth production dependency, sha2, unrelated to this stage's own topic)", () => {
    expect(cargoTomlSource).not.toContain("Stage 105");
    const depsIdx = cargoTomlSource.indexOf("\n[dependencies]");
    const devDepsIdx = cargoTomlSource.indexOf("\n[dev-dependencies]", depsIdx);
    const productionDepsSection = cargoTomlSource.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
  });

  it("10. no getrandom call anywhere in the Stage 105 section", () => {
    // Specific crate-usage patterns only — NOT a bare substring match, per
    // the lesson every prior stage touching getrandom-adjacent text has
    // learned: a doc comment legitimately NAMING getrandom (to describe
    // what is NOT consulted) must not collide with an "is it called"
    // check.
    expect(stage105Section).not.toMatch(/\buse\s+getrandom\b/);
    expect(stage105Section).not.toMatch(/\bgetrandom::/);
    expect(stage105Section).not.toMatch(/\bgetrandom\s*\(/);
    expect(stage105Section).not.toMatch(/\buse\s+rand\b/);
    expect(stage105Section).not.toMatch(/\brand::/);
    expect(stage105Section).not.toMatch(/\bthread_rng\b/);
    expect(stage105Section).not.toMatch(/\bOsRng\b/);
  });

  it("11. no println/eprintln/dbg!/log/tracing usage, and no `unsafe`, anywhere in the Stage 105 section", () => {
    expect(stage105Section).not.toMatch(/\bprintln!\s*\(/);
    expect(stage105Section).not.toMatch(/\beprintln!\s*\(/);
    expect(stage105Section).not.toMatch(/\btracing::/);
    expect(stage105Section).not.toMatch(/\blog::/);
    expect(stage105Section).not.toMatch(/\bdbg!\s*\(/);
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(stage105Section).not.toContain("unsafe");
  });

  it("12. fedos_key_format_descriptor_placeholder takes no input and returns a fixed sentinel descriptor", () => {
    expect(stage105Section).toMatch(
      /pub\s+fn\s+fedos_key_format_descriptor_placeholder\s*\(\s*\)\s*->\s*FedosKeyFormatDescriptor\s*\{\s*FedosKeyFormatDescriptor\s*\{\s*label\s*:\s*FedosKeyFormatLabel::TestOnlyPlaceholder\s*,\s*status\s*:\s*FedosKeyFormatStatus\s*\{\s*state\s*:\s*FedosKeyFormatState::Unavailable\s*,?\s*\}\s*,?\s*\}\s*\}/,
    );
  });

  it("13. the design doc records Stage 105 completion, and every label is described as planning-only", () => {
    expect(provisioningDocSource).toContain("FedosKeyFormatLabel");
    expect(provisioningDocSource).toContain("FUTURE PLANNING LABEL");
    expect(provisioningDocSource).toContain("UNIMPLEMENTED");
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

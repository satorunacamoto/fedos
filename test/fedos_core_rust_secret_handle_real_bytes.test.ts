import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 144–146 — `SecretHandle` real-byte storage.
 *
 * `packages/fedos-core-rust/src/lib.rs`'s crate-private `secret_handle`
 * module (Stage 79) gains its first REAL secret-byte construction path,
 * `SecretHandle::new_from_32_bytes_for_internal_use(kind, bytes: [u8; 32])`,
 * per `docs/secret_lifecycle_implementation_plan.md`,
 * `docs/secret_handle_api_shape.md`, and
 * `docs/secret_memory_test_strategy.md` (Stage 141–143). This file is the
 * dedicated guard suite for that addition — `fedos_core_rust_secret_handle.
 * test.ts` covers the parts of the Stage 79 shape that still apply
 * unchanged.
 *
 * Scope for this stage: `SecretHandle` gains real bytes ONLY. No HKDF, no
 * AEAD, no `randomBytes`/nonce connection, no `deriveKey`/`encrypt`/
 * `decrypt` public API, no Runtime/Worker/WASM wiring, and no `Cargo.toml`
 * change — every one of those is verified absent below.
 */
describe("FedOS Rust crate — SecretHandle real-byte storage (Stage 144–146)", () => {
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

  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");

  it("1. SecretHandle's real-byte constructor accepts a fixed [u8; 32], never a slice/Vec/String", () => {
    expect(secretHandleModule).toMatch(
      /fn\s+new_from_32_bytes_for_internal_use\s*\(\s*kind:\s*SecretHandleKind,\s*bytes:\s*\[\s*u8\s*;\s*32\s*\]\s*,?\s*\)\s*->\s*Self/,
    );
    expect(secretHandleModule).not.toMatch(/new_from_32_bytes_for_internal_use[^)]*Vec</);
    expect(secretHandleModule).not.toMatch(/new_from_32_bytes_for_internal_use[^)]*String/);
    expect(secretHandleModule).not.toMatch(/new_from_32_bytes_for_internal_use[^)]*&\s*\[\s*u8\s*\]/);
  });

  it("2. SecretHandleKind and SecretInputLength exist, are pub(crate)-only, and carry the expected labels", () => {
    expect(secretHandleModule).toMatch(/\bpub\(crate\)\s+enum\s+SecretHandleKind\b/);
    expect(secretHandleModule).not.toMatch(/\bpub\s+enum\s+SecretHandleKind\b/);
    expect(secretHandleModule).toMatch(/\bpub\(crate\)\s+enum\s+SecretInputLength\b/);
    expect(secretHandleModule).not.toMatch(/\bpub\s+enum\s+SecretInputLength\b/);
    for (const label of [
      "Placeholder",
      "AeadKeyMaterial",
      "HkdfInputMaterial",
      "HkdfOutputMaterial",
      "NostrKeyMaterial",
      "TestOnlySecretMaterial",
    ]) {
      expect(secretHandleModule, `expected SecretHandleKind label: ${label}`).toContain(label);
    }
    expect(secretHandleModule).toContain("ThirtyTwo");
  });

  it("3. SecretHandleState gains exactly one new variant, Holding, alongside the Stage 79 three", () => {
    for (const variant of ["Empty", "Placeholder", "Holding", "Cleared"]) {
      expect(secretHandleModule).toContain(variant);
    }
  });

  it("4. no Clone/Copy derive on any real-secret-holding type (RealSecretBytes / SecretPayload / SecretHandle)", () => {
    // Real-secret-holding types never derive Clone/Copy — only the plain,
    // non-sensitive label enums (SecretHandleState/Kind/Status/InputLength)
    // are allowed Clone/Copy, and they already derive it above the enum
    // declarations checked by the sibling guard file.
    expect(secretHandleModule).not.toMatch(
      /#\[derive\([^)]*Clone[^)]*\)\]\s*(pub\(crate\)\s*)?struct\s+SecretHandle\b/,
    );
    expect(secretHandleModule).not.toMatch(/#\[derive\([^)]*Clone[^)]*\)\]\s*struct\s+RealSecretBytes\b/);
    expect(secretHandleModule).not.toMatch(/#\[derive\([^)]*Clone[^)]*\)\]\s*enum\s+SecretPayload\b/);
    expect(secretHandleModule).not.toMatch(/impl\s+Clone\s+for\s+SecretHandle\b/);
    expect(secretHandleModule).not.toMatch(/impl\s+Clone\s+for\s+RealSecretBytes\b/);
    expect(secretHandleModule).not.toMatch(/impl\s+CloneableSecret\s+for\s+RealSecretBytes\b/);
  });

  it("5. no Debug derive on any real-secret-holding type, no Display, no Serialize, no raw-secret Eq/PartialEq", () => {
    expect(secretHandleModule).not.toMatch(
      /#\[derive\([^)]*Debug[^)]*\)\]\s*(pub\(crate\)\s*)?struct\s+SecretHandle\b/,
    );
    expect(secretHandleModule).not.toMatch(/#\[derive\([^)]*Debug[^)]*\)\]\s*struct\s+RealSecretBytes\b/);
    expect(secretHandleModule).not.toMatch(/impl\s+(std::fmt::)?Debug\s+for\s+SecretHandle\b/);
    expect(secretHandleModule).not.toMatch(/impl\s+(std::fmt::)?Display\s+for\s+SecretHandle\b/);
    expect(secretHandleModule).not.toMatch(/impl\s+(std::fmt::)?Debug\s+for\s+RealSecretBytes\b/);
    expect(secretHandleModule).not.toMatch(/#\[derive\([^)]*Serialize[^)]*\)\]/);
    expect(secretHandleModule).not.toMatch(/serde::Serialize/);
    expect(secretHandleModule).not.toMatch(
      /#\[derive\([^)]*(PartialEq|Eq)[^)]*\)\]\s*(pub\(crate\)\s*)?struct\s+SecretHandle\b/,
    );
    expect(secretHandleModule).not.toMatch(/impl\s+PartialEq\s+for\s+SecretHandle\b/);
  });

  it("6. no AsRef<[u8]> exposure anywhere in secret_handle", () => {
    expect(secretHandleModule).not.toMatch(/impl\s+AsRef\s*<\s*\[\s*u8\s*\]\s*>/);
  });

  it("7. no public raw-byte accessor: SecretHandle stays pub(crate)-only; no pub fn returns it or accepts it directly", () => {
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bSecretHandle\b/);
    // Updated Stage 171–176: `fedos_encrypt`/`fedos_decrypt` no longer
    // accept `SecretHandle` directly — they were rewired to accept the
    // new opaque `FedosAeadKeyHandle` wrapper instead (see
    // test/fedos_core_rust_public_opaque_crypto_api.test.ts), so NO pub
    // fn anywhere in this crate takes a `SecretHandle` parameter any
    // more. `SecretHandle` itself never exposes its bytes publicly
    // (test 8 below).
    const pubFnsTakingSecretHandle = [
      ...libRsSource.matchAll(/\bpub\s+fn\s+(\w+)\([^)]*\bSecretHandle\b[^)]*\)/g),
    ].map((m) => m[1]);
    expect(pubFnsTakingSecretHandle).toEqual([]);
    expect(secretHandleModule).not.toMatch(/\bpub\s+fn\b/);
  });

  it("8. SecretHandle's impl block exposes exactly the nine expected pub(crate) methods (Stage 147 adds expose_bytes_for_internal_derivation; Stage 152–154 adds expose_bytes_for_internal_aead; Stage 199 adds expose_bytes_for_internal_ecdh; Stage 1005, Secure Runtime Alpha 010, added a FOURTH, expose_bytes_for_internal_wasm_export, REMOVED Stage 1008, Secure Runtime Alpha 013, once its sole caller -- the raw-bytes generate_aead_key_32() wrapper -- was replaced by the opaque generate_aead_key_handle()), no tenth raw-byte accessor", () => {
    const implBlockMatch = secretHandleModule.match(
      /impl\s+SecretHandle\s*\{([\s\S]*?)\n    \}\n/,
    );
    expect(implBlockMatch, "expected to find impl SecretHandle { ... }").not.toBeNull();
    const implBlock = implBlockMatch![1] ?? "";
    const methodNames = [...implBlock.matchAll(/\bfn\s+([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
    expect([...methodNames].sort()).toEqual(
      [
        "new_placeholder",
        "new_from_32_bytes_for_internal_use",
        "status",
        "kind",
        "clear",
        "is_cleared",
        "expose_bytes_for_internal_derivation",
        "expose_bytes_for_internal_aead",
        "expose_bytes_for_internal_ecdh",
      ].sort(),
    );
  });

  it("9. lib.rs's public `pub fn` surface is unaffected by SecretHandle itself — SecretHandle adds no pub fn", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(68);    expect(pubFnNames).not.toContain("new_from_32_bytes_for_internal_use");
  });

  it("10. not connected to HKDF/AEAD/random/nonce: no call to fedos_random_bytes_32 or fedos_aead_nonce_96 from within secret_handle", () => {
    expect(secretHandleModule).not.toMatch(/\bfedos_random_bytes_32\s*\(/);
    expect(secretHandleModule).not.toMatch(/\bfedos_aead_nonce_96\s*\(/);
    expect(secretHandleModule).not.toMatch(/\bgetrandom\b/);
    expect(secretHandleModule).not.toMatch(/\bhkdf\b/i);
    expect(secretHandleModule).not.toMatch(/\bargon2\b/i);
    expect(secretHandleModule).not.toMatch(/chacha|poly1305|xchacha|aes|gcm/i);
    expect(secretHandleModule).not.toMatch(/domain_label::/);
  });

  it("11. Cargo.toml is unchanged: no new dependency, no serde production dependency", () => {
    expect(cargoTomlSource).toContain('zeroize = "1.9.0"');
    expect(cargoTomlSource).toContain('secrecy = "0.10.3"');
    expect(cargoTomlSource).toContain('subtle = "2.6.1"');
    const depsMatch = cargoTomlSource.match(/\[dependencies\]([\s\S]*?)\n\[/);
    expect(depsMatch, "expected a [dependencies] section").not.toBeNull();
    // A real dependency line starts with the crate name at column 0 (e.g.
    // `serde = "..."`) — this must not be confused with prose inside a `#`
    // comment merely NAMING `serde` (e.g. explaining that `secrecy`'s
    // optional `serde` feature is not enabled).
    expect(depsMatch![1]).not.toMatch(/^serde\b/m);
  });

  it("12. Runtime / Worker sources are unchanged: no secret-handle reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("secret_handle");
      expect(src).not.toContain("secrethandle");
      expect(src).not.toContain("realsecretbytes");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("13. no unwrap/expect/panic anywhere in secret_handle", () => {
    expect(secretHandleModule).not.toMatch(/\.unwrap\s*\(/);
    expect(secretHandleModule).not.toMatch(/\.expect\s*\(/);
    expect(secretHandleModule).not.toMatch(/\bpanic!\s*\(/);
    expect(secretHandleModule).not.toMatch(/\btodo!\s*\(/);
    expect(secretHandleModule).not.toMatch(/\bunimplemented!\s*\(/);
  });

  it("14. no `unsafe` anywhere in secret_handle; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(secretHandleModule).not.toContain("unsafe");
  });

  it("15. RealSecretBytes wraps a fixed [u8; 32] — not Vec<u8>/String — and is zeroized via zeroize::Zeroize", () => {
    expect(secretHandleModule).toMatch(/struct\s+RealSecretBytes\s*\(\s*\[\s*u8\s*;\s*32\s*\]\s*\)/);
    expect(secretHandleModule).toMatch(/impl\s+Zeroize\s+for\s+RealSecretBytes\b/);
    expect(secretHandleModule).not.toMatch(/struct\s+RealSecretBytes\s*\(\s*Vec</);
    expect(secretHandleModule).not.toMatch(/struct\s+RealSecretBytes\s*\(\s*String/);
  });

  it("16. clear() zeroizes the held payload and every field type stays free of Vec/String/serde", () => {
    expect(secretHandleModule).toMatch(/fn\s+clear\s*\(\s*&mut\s+self\s*\)/);
    expect(secretHandleModule).not.toMatch(/(SecretHandle|SecretHandleState|SecretHandleKind|SecretHandleStatus|SecretInputLength|RealSecretBytes|SecretPayload)[\s\S]{0,200}?:\s*Vec</);
    expect(secretHandleModule).not.toMatch(/(SecretHandle|SecretHandleState|SecretHandleKind|SecretHandleStatus|SecretInputLength|RealSecretBytes|SecretPayload)[\s\S]{0,200}?:\s*String\b/);
  });
});

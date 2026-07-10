import { describe, it, expect } from "vitest";
// The Rust crate / repo files as strings (Vite `?raw` works on any file type).
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Stage 147 — internal HKDF-SHA256 implementation using `SecretHandle`.
 *
 * `packages/fedos-core-rust/src/lib.rs`'s crate-private `kdf_core` module
 * (Stage 82) gains this crate's first REAL implementation:
 * `derive_secret_handle_internal(input: &SecretHandle, domain: HkdfDomain)`
 * derives a NEW `SecretHandle(HkdfOutputMaterial)` from an existing
 * `SecretHandle(HkdfInputMaterial)` via HKDF-SHA256 (RFC 5869, the `hkdf`
 * dependency adopted Stage 76), using a fixed, `HkdfDomain`-selected
 * salt/info — never a caller-supplied or randomly-drawn byte. `sha2` is
 * PROMOTED from `[dev-dependencies]` to `[dependencies]` (the only
 * `Cargo.toml` change). `SecretHandle` gains one new, narrowly-scoped
 * `pub(crate)` accessor, `expose_bytes_for_internal_derivation` — see
 * `docs/hkdf_internal_plan.md`.
 *
 * Scope for this stage: HKDF only. No AEAD execution, no `encrypt`/
 * `decrypt`, no NIP-44, no public `deriveKey` API, no Runtime/Worker/WASM
 * wiring — every one of those is verified absent below.
 */
describe("FedOS Rust crate — internal HKDF-SHA256 implementation (Stage 147)", () => {
  /** Extracts a `mod name { ... }` block via brace matching. */
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

  const kdfCoreModule = extractModule(libRsSource, "mod kdf_core");
  const secretHandleModule = extractModule(libRsSource, "mod secret_handle");
  // kdf_core's own nested `#[cfg(test)] mod tests` legitimately uses
  // `.expect(...)` on an `Option` (a normal, non-production test idiom) —
  // scope the "no unwrap/expect/panic" check to PRODUCTION code only.
  const kdfCoreFirstCfgTestIdx = kdfCoreModule.indexOf("#[cfg(test)]");
  const kdfCoreProductionOnly =
    kdfCoreFirstCfgTestIdx === -1 ? kdfCoreModule : kdfCoreModule.slice(0, kdfCoreFirstCfgTestIdx);

  const cargoCode: string = cargoTomlSource
    .split("\n")
    .map((line: string) => line.replace(/#.*$/, ""))
    .join("\n")
    .toLowerCase();

  it("1. kdf_core imports hkdf/sha2 and calls Hkdf::<Sha256>::new(...).expand(...)", () => {
    expect(kdfCoreModule).toMatch(/\buse\s+hkdf::Hkdf\b/);
    expect(kdfCoreModule).toMatch(/\buse\s+sha2::Sha256\b/);
    expect(kdfCoreModule).toContain("Hkdf::<Sha256>::new(");
    expect(kdfCoreModule).toMatch(/\.expand\s*\(/);
  });

  it("2. HkdfDomain/HkdfStatus/HkdfDecision exist, are pub(crate)-only, and carry the expected labels", () => {
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+enum\s+HkdfDomain\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+enum\s+HkdfDomain\b/);
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+enum\s+HkdfStatus\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+enum\s+HkdfStatus\b/);
    expect(kdfCoreModule).toMatch(/\bpub\(crate\)\s+struct\s+HkdfDecision\b/);
    expect(kdfCoreModule).not.toMatch(/\bpub\s+struct\s+HkdfDecision\b/);
    for (const domain of ["RootKey", "Identity", "Storage", "Conversation", "TestOnly"]) {
      expect(kdfCoreModule, `expected HkdfDomain variant: ${domain}`).toContain(domain);
    }
    for (const status of ["Ready", "InvalidInput", "InternalFailure"]) {
      expect(kdfCoreModule, `expected HkdfStatus variant: ${status}`).toContain(status);
    }
  });

  it("3. derive_secret_handle_internal is pub(crate)-only, takes exactly (&SecretHandle, HkdfDomain), and returns HkdfDecision", () => {
    expect(kdfCoreModule).toMatch(
      /\bpub\(crate\)\s+fn\s+derive_secret_handle_internal\s*\(\s*input:\s*&SecretHandle,\s*domain:\s*HkdfDomain,?\s*\)\s*->\s*HkdfDecision/,
    );
    expect(kdfCoreModule).not.toMatch(/\bpub\s+fn\s+derive_secret_handle_internal\b/);
  });

  it("4. the fixed salt/info are compile-time &'static [u8] literals — no caller-supplied or borrowed salt/info parameter", () => {
    expect(kdfCoreModule).toMatch(/const\s+fn\s+salt\s*\(\s*self\s*\)\s*->\s*&'static\s*\[\s*u8\s*\]/);
    expect(kdfCoreModule).toMatch(/const\s+fn\s+info\s*\(\s*self\s*\)\s*->\s*&'static\s*\[\s*u8\s*\]/);
    expect(kdfCoreModule).not.toMatch(
      /fn\s+derive_secret_handle_internal[^)]*\bsalt\s*:/,
    );
    expect(kdfCoreModule).not.toMatch(
      /fn\s+derive_secret_handle_internal[^)]*\binfo\s*:/,
    );
  });

  it("5. SecretHandle gains exactly one new pub(crate) accessor, expose_bytes_for_internal_derivation, and it is used by kdf_core", () => {
    expect(secretHandleModule).toMatch(
      /\bpub\(crate\)\s+fn\s+expose_bytes_for_internal_derivation\s*\(\s*&self\s*\)\s*->\s*Option<\s*\[\s*u8\s*;\s*32\s*\]\s*>/,
    );
    expect(secretHandleModule).not.toMatch(/\bpub\s+fn\s+expose_bytes_for_internal_derivation\b/);
    expect(kdfCoreModule).toContain("expose_bytes_for_internal_derivation()");
  });

  it("6. no public deriveKey / HKDF API anywhere in lib.rs; lib.rs's public pub fn surface is unchanged (still 24 functions)", () => {
    const pubFnNames = [...libRsSource.matchAll(/\bpub\s+fn\s+([a-zA-Z0-9_]+)/g)].map(
      (m) => m[1],
    );
    expect(pubFnNames.length).toBe(34);
    expect(pubFnNames).not.toContain("derive_secret_handle_internal");
    expect(pubFnNames.map((n) => n.toLowerCase())).not.toContain("derivekey");
    expect(libRsSource).not.toMatch(/\bpub\s+fn\s+\w+\([^)]*\)\s*->\s*[^{;]*\bHkdfDecision\b/);
  });

  it("7. not connected to AEAD/encrypt/decrypt/NIP-44: kdf_core never constructs AeadPlaceholderRequest or calls an AEAD crate", () => {
    expect(kdfCoreModule).not.toMatch(/\bAeadPlaceholderRequest\b/);
    expect(kdfCoreModule).not.toMatch(/\baead_core::/);
    expect(kdfCoreModule).not.toMatch(/chacha20poly1305|xchacha|aes[-_]?gcm/i);
    expect(kdfCoreModule).not.toMatch(/\bnip.?44\b/i);
    expect(kdfCoreModule).not.toMatch(/\bencrypt\s*\(/);
    expect(kdfCoreModule).not.toMatch(/\bdecrypt\s*\(/);
  });

  it("8. not connected to randomBytes/nonce: kdf_core never calls fedos_random_bytes_32 or fedos_aead_nonce_96, and never imports getrandom", () => {
    expect(kdfCoreModule).not.toMatch(/\bfedos_random_bytes_32\s*\(/);
    expect(kdfCoreModule).not.toMatch(/\bfedos_aead_nonce_96\s*\(/);
    expect(kdfCoreModule).not.toMatch(/\bgetrandom\b/);
    expect(kdfCoreModule).not.toMatch(/\brand::/);
    expect(kdfCoreModule).not.toMatch(/\bthread_rng\b/);
  });

  it("9. Cargo.toml's only change is sha2 promoted to production; no other new dependency", () => {
    expect(cargoCode).toContain('sha2 = "0.11.0"');
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const devDepsSection = cargoCode.slice(devDepsIdx);
    expect(devDepsSection).not.toMatch(/^sha2\s*=/m);
    const depsSection = cargoCode.slice(cargoCode.indexOf("[dependencies]"), devDepsIdx);
    const depLines = depsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);
  });

  it("10. Runtime / Worker sources are unchanged: no kdf_core/HKDF reference and no crypto-op auto-call", () => {
    const runtime = runtimeSource.toLowerCase();
    const worker = workerSource.toLowerCase();
    for (const src of [runtime, worker]) {
      expect(src).not.toContain("kdf_core");
      expect(src).not.toContain("hkdfdomain");
      expect(src).not.toContain("hkdfdecision");
      expect(src).not.toContain("derive_secret_handle_internal");
      expect(src).not.toContain("cargo");
      expect(src).not.toContain("lib.rs");
      expect(src).not.toContain("wasm_loader");
    }
    expect(runtimeSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
    expect(workerSource).not.toMatch(/\.\s*(randomBytes|deriveKey|encrypt|decrypt)\s*\(/);
  });

  it("11. no unwrap/expect/panic anywhere in kdf_core's PRODUCTION code (the Hkdf::expand Result is matched exhaustively; its own #[cfg(test)] tests may legitimately use .expect() on an Option)", () => {
    expect(kdfCoreProductionOnly).not.toMatch(/\.unwrap\s*\(/);
    expect(kdfCoreProductionOnly).not.toMatch(/\.expect\s*\(/);
    expect(kdfCoreProductionOnly).not.toMatch(/\bpanic!\s*\(/);
    expect(kdfCoreProductionOnly).not.toMatch(/\btodo!\s*\(/);
    expect(kdfCoreProductionOnly).not.toMatch(/\bunimplemented!\s*\(/);
    expect(kdfCoreProductionOnly).toMatch(/match\s+hk\.expand\s*\(/);
  });

  it("12. no `unsafe` anywhere in kdf_core; crate-level forbid stays intact", () => {
    expect(libRsSource).toContain("#![forbid(unsafe_code)]");
    expect(kdfCoreModule).not.toContain("unsafe");
  });

  it("13. no Vec<u8>/String secret-shaped field in kdf_core, and no IKM/salt/info/PRK/OKM storage field", () => {
    expect(kdfCoreModule).not.toMatch(/:\s*Vec<u8>/);
    expect(kdfCoreModule).not.toMatch(/:\s*String\b/);
    expect(kdfCoreModule).not.toMatch(/\b(ikm|salt|info|prk|okm|secret)\s*:\s*\w/i);
  });

  it("14. does not mutate the input SecretHandle: derive_secret_handle_internal takes input by shared reference only", () => {
    expect(kdfCoreModule).toMatch(
      /fn\s+derive_secret_handle_internal\s*\(\s*input:\s*&SecretHandle\b/,
    );
    expect(kdfCoreModule).not.toMatch(/input:\s*&mut\s+SecretHandle\b/);
  });
});

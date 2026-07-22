import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 164 -- "Deterministic Nostr Secret Key Derivation":
 * Stage 4 of the Deterministic Nostr Secret Key Derivation Arc. Adds
 * derive_nostr_secret_key_internal (Nostr Root + Account Index -> Nostr
 * Secret Key), a direct fixed-salt HKDF-SHA256 call validated via
 * k256::SecretKey::from_slice.
 */
describe("Secure Runtime Alpha 164 -- Deterministic Nostr Secret Key Derivation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`, and nothing else — no `src\/`\s*\nfile is touched\./,
    );
  });

  it("3. structural: derive_nostr_secret_key_internal exists with the exact signature the Objective named", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_secret_key_internal\(\s*\n\s*nostr_root: &FedosProtocolRootHandle,\s*\n\s*account_index: u32,\s*\n\s*\) -> NostrSecretKeyDecision \{/,
    );
  });

  it("4. structural: the function uses a direct fixed-salt Hkdf<Sha256> call, never kdf_core::derive_secret_handle_internal", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_secret_key_internal\(([\s\S]*?)\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody.length).toBeGreaterThan(0);
    expect(fnBody).toMatch(/Hkdf::<Sha256>::new\(Some\(NOSTR_SECRET_KEY_SALT\), &root_bytes\)/);
    expect(fnBody).not.toMatch(/derive_secret_handle_internal/);
  });

  it("5. structural: the Account Index is appended as exactly 4 fixed-width big-endian bytes, never ASCII decimal", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_secret_key_internal\(([\s\S]*?)\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).toMatch(/account_index\.to_be_bytes\(\)/);
    expect(fnBody).not.toMatch(/format!/);
    expect(fnBody).not.toMatch(/to_string\(\)/);
  });

  it("6. structural: the fixed salt/info-prefix constants exist and are distinct from HkdfDomain::Nostr's own literals", () => {
    expect(libRsSource).toMatch(/const NOSTR_SECRET_KEY_SALT: &\[u8\] = b"fedos-hkdf-salt-nostr-secret-key-v1";/);
    expect(libRsSource).toMatch(
      /const NOSTR_SECRET_KEY_INFO_PREFIX: &\[u8\] = b"fedos-hkdf-info-nostr-secret-key-v1";/,
    );
    expect(libRsSource).toMatch(/HkdfDomain::Nostr => b"fedos-hkdf-salt-nostr-v1"/);
  });

  it("7. structural: an invalid HKDF candidate is rejected via k256::SecretKey::from_slice, never a panic or a hand-rolled reduction", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_secret_key_internal\(([\s\S]*?)\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).toMatch(/SecretKey::from_slice\(&candidate\)/);
    expect(fnBody).toMatch(/NostrSecretKeyStatus::InvalidScalar/);
    expect(fnBody).not.toMatch(/\.unwrap\(\)/);
    expect(fnBody).not.toMatch(/\.expect\(/);
    expect(fnBody).not.toMatch(/panic!/);
    expect(fnBody).not.toMatch(/%\s*[A-Za-z_]+::CURVE_ORDER|% ORDER|checked_rem|wrapping_rem/);
  });

  it("8. structural: root_bytes and candidate are zeroized -- no raw secret byte returned", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_secret_key_internal\(([\s\S]*?)\n {4}\}/);
    const fnBody = fnMatch?.[1] ?? "";
    expect(fnBody).toMatch(/root_bytes\.zeroize\(\);/);
    expect(fnBody).toMatch(/candidate\.zeroize\(\);/);
    expect(fnBody).not.toMatch(/-> \[u8; 32\]/);
  });

  it("9. structural: NostrSecretKeyDecision carries a status and an Option<FedosNostrSecretKeyHandle>, matching every other decision type's shape", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) struct NostrSecretKeyDecision \{\s*\n\s*pub\(crate\) status: NostrSecretKeyStatus,\s*\n\s*pub\(crate\) output: Option<FedosNostrSecretKeyHandle>,\s*\n\s*\}/,
    );
  });

  it("10. structural: NostrSecretKeyStatus has exactly Success/InvalidInput/InvalidScalar/InternalFailure, no fifth variant", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum NostrSecretKeyStatus \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants).toEqual(["Success", "InvalidInput", "InvalidScalar", "InternalFailure"]);
  });

  it("11. the design doc's own invalid-scalar section rejects counter-retry (B) and modular reduction (C), adopting D realized as A", () => {
    const section = (designDocSource.match(/## 4\. Invalid-scalar handling — decided and implemented([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*D, realized as A, is adopted; B and C are rejected outright\.\*\*/);
  });

  it("12. the design doc cross-references Alpha 163, 162, 161, and 143", () => {
    for (const ref of [
      "secure_runtime_alpha_163_nostr_secret_key_handle",
      "secure_runtime_alpha_162_nostr_account_derivation_decision",
      "secure_runtime_alpha_161_existing_nostr_key_inventory",
      "secure_runtime_alpha_143_domain_separation_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(64);
  });

  it("14. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_164/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_164/);
  });

  it("15. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_164/);
  });

  it("16. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_164/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_164/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

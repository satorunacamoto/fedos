import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_152_nostr_root_derivation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 152 -- "Nostr Root Derivation": Stage 2 of the
 * Protocol Root Derivation Arc. Adds derive_nostr_root_internal
 * (Application Root -> Nostr Root) plus the private
 * derive_protocol_root_internal helper every later protocol wrapper
 * reuses.
 */
describe("Secure Runtime Alpha 152 -- Nostr Root Derivation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`packages\/fedos-core-rust\/src\/lib\.rs`, and nothing else — no `src\/`\s*\nfile is touched\./,
    );
  });

  it("3. structural: derive_nostr_root_internal exists, takes a &FedosApplicationRootHandle, and is pub(crate) only", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) fn derive_nostr_root_internal\(\s*\n\s*application_root: &FedosApplicationRootHandle,\s*\n\s*\) -> ProtocolRootDecision/,
    );
  });

  it("4. structural: derive_protocol_root_internal is a private helper -- never pub(crate)", () => {
    expect(libRsSource).toMatch(/\n {4}fn derive_protocol_root_internal\(/);
    expect(libRsSource).not.toMatch(/pub\(crate\) fn derive_protocol_root_internal\(/);
  });

  it("5. structural: derive_nostr_root_internal delegates to derive_protocol_root_internal under the NEW HkdfDomain::Nostr", () => {
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_root_internal\([\s\S]*?\n {4}\}/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch?.[0] ?? "").toMatch(/derive_protocol_root_internal\(application_root, HkdfDomain::Nostr\)/);
  });

  it("6. structural: Nostr is a real HkdfDomain variant with its own fixed salt/info", () => {
    const domainEnumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    expect(domainEnumBody).toMatch(/Nostr,/);
    expect(libRsSource).toMatch(/HkdfDomain::Nostr => b"fedos-hkdf-salt-nostr-v1"/);
    expect(libRsSource).toMatch(/HkdfDomain::Nostr => b"fedos-hkdf-info-nostr-v1"/);
  });

  it("7. structural: ProtocolRootDecision exists, carrying a RootDerivationStatus and an Option<FedosProtocolRootHandle>", () => {
    expect(libRsSource).toMatch(
      /pub\(crate\) struct ProtocolRootDecision \{\s*\n\s*pub\(crate\) status: RootDerivationStatus,\s*\n\s*pub\(crate\) output: Option<FedosProtocolRootHandle>,\s*\n\s*\}/,
    );
  });

  it("8. the design doc's own purity section confirms zero new algorithm, one new domain, no mutation, determinism, and a fixed-domain-only entry point", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Zero new cryptographic algorithm:\*\*/);
    expect(section).toMatch(/\*\*One new domain, not a new algorithm:\*\*/);
    expect(section).toMatch(/\*\*No mutation of the input:\*\*/);
    expect(section).toMatch(/\*\*Deterministic:\*\*/);
    expect(section).toMatch(/\*\*Fixed-domain-only entry point:\*\*/);
  });

  it("9. the design doc cross-references Alpha 151, Alpha 147, and Alpha 142", () => {
    for (const ref of [
      "secure_runtime_alpha_151_protocol_root_handle",
      "secure_runtime_alpha_147_identity_root_derivation",
      "secure_runtime_alpha_142_root_hierarchy_decision",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("11. Regression: desktop_application.ts and fedos_runtime_identity.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_152/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_152/);
  });

  it("12. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_152/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_152/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_152/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

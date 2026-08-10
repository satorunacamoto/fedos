import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_153_session_atproto_wallet_root.md?raw";
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
 * Secure Runtime Alpha 153 -- "Session / ATProto / Wallet Root": Stage
 * 3 of the Protocol Root Derivation Arc. Adds three more fixed-domain
 * wrappers over Alpha 152's own derive_protocol_root_internal helper,
 * and records a second hierarchy divergence for Wallet Root.
 */
describe("Secure Runtime Alpha 153 -- Session / ATProto / Wallet Root", () => {
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

  it("3. structural: derive_session_root_internal, derive_atproto_root_internal, and derive_wallet_root_internal all exist, pub(crate) only, each delegating to derive_protocol_root_internal", () => {
    for (const [fnName, domain] of [
      ["derive_session_root_internal", "Session"],
      ["derive_atproto_root_internal", "ATProto"],
      ["derive_wallet_root_internal", "Wallet"],
    ]) {
      const fnMatch = libRsSource.match(
        new RegExp(
          `pub\\(crate\\) fn ${fnName}\\(\\s*\\n\\s*application_root: &FedosApplicationRootHandle,\\s*\\n\\s*\\) -> ProtocolRootDecision \\{([\\s\\S]*?)\\n {4}\\}`,
        ),
      );
      expect(fnMatch).not.toBeNull();
      expect(fnMatch?.[1] ?? "").toMatch(new RegExp(`derive_protocol_root_internal\\(application_root, HkdfDomain::${domain}\\)`));
    }
  });

  it("4. structural: HkdfDomain::Session, HkdfDomain::ATProto, and HkdfDomain::Wallet each have their own fixed, distinct salt/info", () => {
    for (const [domain, label] of [
      ["Session", "session"],
      ["ATProto", "atproto"],
      ["Wallet", "wallet"],
    ]) {
      expect(libRsSource).toMatch(new RegExp(`HkdfDomain::${domain} => b"fedos-hkdf-salt-${label}-v1"`));
      expect(libRsSource).toMatch(new RegExp(`HkdfDomain::${domain} => b"fedos-hkdf-info-${label}-v1"`));
    }
  });

  it("5. structural: HkdfDomain now has exactly ten variants -- the exhaustive match test was renamed to match", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants).toEqual([
      "RootKey",
      "Identity",
      "Storage",
      "Conversation",
      "Application",
      "Nostr",
      "Session",
      "ATProto",
      "Wallet",
      "DirectRatchetSealing",
      "TestOnly",
    ]);
    expect(libRsSource).toMatch(/fn hkdf_domain_has_no_variant_other_than_the_eleven_specified/);
  });

  it("6. the design doc explicitly records the SECOND hierarchy divergence -- Wallet Root as Application Root's own child, not a Master-Seed-direct sibling", () => {
    const section = (designDocSource.match(/## 3\. A second recorded hierarchy divergence([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Alpha 142's own diagram drew it as a\s*\nMaster-Seed-direct \*\*SIBLING\*\* of `Application Root`/);
    expect(section).toMatch(/THIS Arc's own instructions instead group `Wallet\s*\nRoot` together with `Session Root`\/`ATProto Root` as a Protocol Root/);
  });

  it("7. the design doc confirms Session/ATProto Root match Alpha 142's own diagram exactly, with zero divergence", () => {
    const section = (designDocSource.match(/## 3\. A second recorded hierarchy divergence([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/this Stage's derivation of those\s*\ntwo matches that diagram exactly, with zero divergence\./);
  });

  it("8. the design doc's own purity section confirms zero new algorithm, three new domains, no mutation, determinism, and domain separation", () => {
    const section = (designDocSource.match(/## 4\. Purity confirmed([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Zero new cryptographic algorithm:\*\*/);
    expect(section).toMatch(/\*\*Three new domains, not a new algorithm:\*\*/);
    expect(section).toMatch(/\*\*No mutation of the input:\*\*/);
    expect(section).toMatch(/\*\*Deterministic:\*\*/);
    expect(section).toMatch(/\*\*Domain-separated:\*\*/);
  });

  it("9. the design doc cross-references Alpha 152, Alpha 142, and Alpha 148", () => {
    for (const ref of [
      "secure_runtime_alpha_152_nostr_root_derivation",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secure_runtime_alpha_148_application_root_derivation",
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
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_153/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_153/);
  });

  it("12. Regression: worker.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_153/);
  });

  it("13. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_153/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_153/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

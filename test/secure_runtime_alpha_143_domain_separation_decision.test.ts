import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_143_domain_separation_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cryptoTestVectorsSource from "../docs/crypto_test_vectors.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 143 -- "Domain Separation & Derivation Context
 * Decision": Stage 3 of the Deterministic Identity Root Derivation
 * Design Arc. A DESIGN / DECISION ONLY Stage -- zero code change.
 * Fixes the domain-separation context composition rule, extending the
 * existing HkdfDomain convention.
 */
describe("Secure Runtime Alpha 143 -- Domain Separation Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. structural: the doc's own cited existing salt/info literals are confirmed verbatim against the actual Rust source", () => {
    expect(libRsSource).toMatch(/b"fedos-hkdf-salt-root-key-v1"/);
    expect(designDocSource).toContain('b"fedos-hkdf-salt-root-key-v1"');
  });

  it("4. the design doc's own context table covers all eight contexts named in the Objective", () => {
    const section = (designDocSource.match(/## 2\. Contexts considered, and their decision([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const context of [
      "FedOS derivation schema version",
      "Root category",
      "Protocol identifier",
      "Network / environment",
      "Account index",
      "Device index",
      "Key purpose",
      "Key algorithm version",
    ]) {
      expect(section).toContain(context);
    }
  });

  it("5. the design doc fixes index encoding as fixed-width big-endian, never ASCII decimal", () => {
    const section = (designDocSource.match(/## 3\. Binary format — fixed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`index encoding`\*\*: fixed-width big-endian `u32`, NEVER ASCII/);
  });

  it("6. the design doc forbids Unicode and mandates lowercase-ASCII-only", () => {
    const section = (designDocSource.match(/## 3\. Binary format — fixed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Unicode\*\*: FORBIDDEN in any salt\/info\/context component\./);
    expect(section).toMatch(/\*\*Case\*\*: lowercase-ASCII-only/);
  });

  it("7. the design doc declares a Free-String Prohibition -- every segment must be a closed enum variant", () => {
    const section = (designDocSource.match(/## 4\. Free-string prohibition([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*No free-form string may be used directly as a salt, info, or context\s*\nvalue anywhere in this hierarchy\.\*\*/,
    );
  });

  it("8. the design doc declares Development and Production must never share a derived Identity", () => {
    const section = (designDocSource.match(/## 5\. Development vs\. Production identity([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Development and Production MUST NOT share the same derived Identity\s*\nfor the same Master Seed\.\*\*/,
    );
  });

  it("9. the design doc's own network-separation decision matches crypto_test_vectors.md's own domain-separation mandate", () => {
    expect(cryptoTestVectorsSource).toMatch(/\*\*Domain separation is mandatory\.\*\*/);
    expect(designDocSource).toMatch(/"Domain separation is mandatory\. Every derivation/);
  });

  it("10. the design doc explicitly does NOT extend HkdfDomain with new variants -- confirmed it names this as future implementation work", () => {
    expect(designDocSource).toMatch(
      /`HkdfDomain` \(Alpha 141 §2\.3\) is NOT extended\s*\n\s*with new variants by this Stage/,
    );
  });

  it("11. the design doc cross-references Alpha 141, Alpha 142, and crypto_test_vectors.md", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "crypto_test_vectors.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: zero code change anywhere, including zero HkdfDomain change
  // ---------------------------------------------------------------------

  it("12. Regression: HkdfDomain remains the exact same five variants -- confirmed no new variant was added to the actual Rust source", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n\s{4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants).toEqual(["RootKey", "Identity", "Storage", "Conversation", "TestOnly"]);
  });

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_143/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_143/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_143/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_143/);
    }
  });

  it("16. Regression: Rust/Cargo/package sources carry no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_143/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_143/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_143/);
  });
});

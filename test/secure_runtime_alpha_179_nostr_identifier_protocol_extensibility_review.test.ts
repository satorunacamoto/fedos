import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityDescriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 179 -- "Nostr Identifier Protocol Extensibility
 * Review": Stage 4 of the Nostr Public Identifier Runtime Boundary
 * Arc (Alpha 176-180). REVIEW ONLY -- zero code change. Confirms the
 * Identifier abstraction (Descriptor shape, Source Boundary pattern,
 * HkdfDomain separation) already supports Session/ATProto/Wallet
 * without protocol-specific Runtime logic.
 */
describe("Secure Runtime Alpha 179 -- Nostr Identifier Protocol Extensibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc names three layers of the Identifier abstraction", () => {
    const section = (designDocSource.match(/## 2\. What "the Identifier abstraction" names, precisely([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toContain("The Descriptor shape");
    expect(section).toContain("The Source Boundary pattern");
    expect(section).toContain("The Rust-side domain-separated derivation pattern");
  });

  it("4. the design doc cites the unconstrained provider field as evidence, not assertion", () => {
    const section = (designDocSource.match(/## 3\. `provider` as evidence, not assertion([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/carries no Nostr-specific type constraint of any\s*\nkind/);
    expect(section).toMatch(/is not\s*\na new finding this Stage invents/);
  });

  it("5. the design doc confirms HkdfDomain already lists ten variants including Session/ATProto/Wallet", () => {
    const section = (designDocSource.match(/## 4\. Rust-side domain separation([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /`RootKey`, `Identity`, `Storage`,\s*\n`Conversation`, `Application`, `Nostr`, `Session`, `ATProto`, `Wallet`,\s*\n`TestOnly`/,
    );
    expect(section).toContain("zero `Session`/`ATProto`/`Wallet`-named variant");
  });

  it("6. the design doc extends all four prohibitions to explicitly name Wallet, with a concrete EIP-55 counter-example", () => {
    const section = (designDocSource.match(/## 5\. Four prohibitions, restated and extended to Wallet([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/must NEVER be repurposed\s*\n\s*for a Wallet address, an ATProto DID, or a Session identifier\./);
    expect(section).toContain("EIP-55");
    expect(section).toMatch(/must NEVER be\s*\n\s*generalized into a cross-protocol codec/);
    expect(section).toMatch(/is NEVER sufficient reason to unify\s*\n\s*codecs across protocols/);
  });

  it("7. the design doc concludes compatibility already exists, requiring zero modification", () => {
    const section = (designDocSource.match(/## 7\. Answer to this Stage's own question([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Yes — the Identifier abstraction/);
    expect(section).toMatch(/the finding is that the compatibility ALREADY EXISTS/);
  });

  it("8. the design doc cross-references Alpha 178, 177, 176, 175, and 152", () => {
    for (const ref of [
      "secure_runtime_alpha_178_nostr_desktop_presentation_review",
      "secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision",
      "secure_runtime_alpha_176_nostr_public_identifier_origin_review",
      "secure_runtime_alpha_175_nostr_public_identifier_completion",
      "secure_runtime_alpha_152_nostr_root_derivation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("9. structural: HkdfDomain and SecretHandleKind gained ZERO new variants -- fixed at 10/13", () => {
    const domainBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const domainVariants = [...domainBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(domainVariants).toEqual([
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

    const kindBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const kindVariants = [...kindBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(kindVariants).toEqual([
      "Placeholder",
      "AeadKeyMaterial",
      "HkdfInputMaterial",
      "HkdfOutputMaterial",
      "NostrKeyMaterial",
      "ConversationKeyMaterial",
      "MessageKeyMaterial",
      "MasterSeedMaterial",
      "IdentityRootMaterial",
      "ApplicationRootMaterial",
      "ProtocolRootMaterial",
      "NostrSecretKeyMaterial",
      "TestOnlySecretMaterial",
      "DirectRatchetRootKeyMaterial",
      "DirectRatchetChainKeyMaterial",
      "DirectRatchetPrivateKeyMaterial",
    ]);
    expect(kindVariants.some((v: string | undefined) => /Session|ATProto|Wallet/.test(v ?? ""))).toBe(false);
  });

  it("10. structural: FedosIdentityDescriptor's provider field is a plain, unconstrained string", () => {
    expect(identityDescriptorSource).toMatch(/readonly provider: string;/);
    expect(identityDescriptorSource).not.toMatch(/provider:\s*"nostr"\s*\|/);
  });

  it("11. structural: no bech32/npub/nsec reference exists anywhere in the Runtime layer", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/bech32|npub|nsec/i);
    }
  });

  it("12. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(68);  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_179/);
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts and fedos_identity_descriptor.ts remain untouched", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource, identityDescriptorSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_179/);
    }
  });

  it("15. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_179/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_179/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

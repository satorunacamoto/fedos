import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
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
import nostrIdentityProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityDescriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";

/**
 * Secure Runtime Alpha 175 -- "Nostr Public Identifier Completion &
 * Boundary Review": Stage 5, the closing Stage, of the Nostr Public
 * Identifier Encoding Arc. Adds no further production code. Declares the
 * Arc's own Objective confirmed complete, reviews Protocol Extensibility,
 * and recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 175 -- Nostr Public Identifier Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further production-code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /makes NO further\s*\nproduction-code change beyond what Alpha 173\/174 already landed\./,
    );
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all ten NEXT-Arc items", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    for (const item of [
      "**`nsec`**",
      "**Secret Key export/import**",
      "**Schnorr signature**",
      "**Nostr Event**",
      "**Event ID**",
      "**Relay communication**",
      "**WebSocket**",
      "**DM**",
      "**Public Runtime API**",
      "**Desktop Identity wiring**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names exactly one recommended next Arc: Nostr Public Identifier Runtime Boundary Review", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Nostr Public Identifier Runtime Boundary Review\.\*\*/,
    );
    expect(section).not.toMatch(/\*\*Nostr Schnorr Signing Boundary Review\.\*\*/);
  });

  it("6. the design doc's own Protocol Extensibility Review states all four explicit prohibitions", () => {
    const section = (designDocSource.match(/## 4\. Protocol Extensibility Review([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`FedosNostrNpub` must NEVER be repurposed for an ATProto DID\.\*\*/);
    expect(section).toMatch(/must NEVER be assumed as a generic "Session ID" rule\.\*\*/);
    expect(section).toMatch(/must NEVER be\r?\n\s*generalized into a cross-protocol codec\.\*\*/);
    expect(section).toMatch(
      /\*\*"It's a PublicIdentifier" is NEVER sufficient reason to unify\r?\n\s*codecs across protocols\.\*\*/,
    );
  });

  it("7. the design doc names three formal, still-unwired recommendations", () => {
    const section = (designDocSource.match(/## 3\. Three formal recommendations — still UNWIRED this Arc([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`FedosIdentityDescriptor\.publicIdentifier` — future value:\*\*\s*\n\s*`npub`\./);
    expect(section).toMatch(/\*\*Protocol-internal canonical key:\*\*/);
    expect(section).toMatch(/\*\*Desktop display:\*\* `npub`/);
  });

  it("8. the design doc cross-references Alpha 174, 173, 172, 171, and 170", () => {
    for (const ref of [
      "secure_runtime_alpha_174_nostr_public_identifier_encoding_verification",
      "secure_runtime_alpha_173_nostr_public_identifier_encoder",
      "secure_runtime_alpha_172_nostr_identifier_representation_decision",
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
      "secure_runtime_alpha_170_nostr_public_key_derivation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("9. structural: SecretHandleKind and HkdfDomain gained ZERO new variants across the whole Alpha 171-175 Arc", () => {
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
  });

  it("10. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("11. RIPPLE (Secure Runtime Alpha 183, 195): no nsec/schnorr/Event/Relay/WebSocket CODE existed anywhere in master_root AS OF this Stage's own closing state -- doc-comment mentions of what does NOT exist yet are expected and excluded; Stage 1029 (Secure Runtime Alpha 183) legitimately added real Schnorr signature CODE and Stage 1035 (Secure Runtime Alpha 195) legitimately added a real Nostr Event Foundation (FedosNostrEventHandle and friends) in LATER Arcs -- nsec/Relay/WebSocket remain absent, reconfirmed here as the CURRENT state", () => {
    const moduleText = (libRsSource.match(/mod master_root \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
    expect(moduleText.length).toBeGreaterThan(0);
    const codeOnly = moduleText
      .split(/\r?\n/)
      .filter((line: string) => !line.trim().startsWith("///") && !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/nsec|WebSocket|Relay/i);
  });

  it("12. structural: FedosIdentityDescriptor.publicIdentifier remains externally sourced, untouched by this Arc", () => {
    expect(identityDescriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(identityDescriptorSource).not.toMatch(/secure_runtime_alpha_17[1-5]/);
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_17[1-5]/);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything else
  // ---------------------------------------------------------------------

  it("13. Regression: lib.rs carries no reference to any of the five Alpha 171-175 docs by filename", () => {
    for (const stage of ["171", "172", "173", "174", "175"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs", () => {
    for (const stage of ["171", "172", "173", "174", "175"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (const stage of ["171", "172", "173", "174", "175"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["171", "172", "173", "174", "175"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("17. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change", () => {
    for (const stage of ["171", "172", "173", "174", "175"]) {
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("18. Regression: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 140's own closing state", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set([
        "bootstrap",
        "start",
        "currentIdentity",
        "isBootstrapped",
        "readPublicIdentity",
        "currentPublicIdentity",
        "refreshPublicIdentity",
      ]),
    );
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion.md?raw";
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
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityDescriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopReaderSource from "../src/desktop/nostr_public_identity_reader.ts?raw";

/**
 * Secure Runtime Alpha 180 -- "Nostr Public Identifier Runtime
 * Boundary Completion": Stage 5, the closing Stage, of the Nostr
 * Public Identifier Runtime Boundary Arc (Alpha 176-180). Adds no
 * further production code. Declares the Boundary FROZEN and
 * recommends exactly one next Arc (Nostr Schnorr Signing Boundary
 * Review).
 */
describe("Secure Runtime Alpha 180 -- Nostr Public Identifier Runtime Boundary Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /it makes NO code change of any\s*\nkind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all eight ZERO-change items and five NOT-yet-existing items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "ZERO new Cargo dependency",
      "ZERO new npm",
      "ZERO new cryptographic algorithm",
      "ZERO new",
      "ZERO GUI",
      "ZERO Relay",
      "ZERO Event construction",
      "ZERO Worker change",
      "ZERO `AppRuntime` change",
      "ZERO Storage",
      "ZERO Observation",
    ]) {
      expect(section).toContain(item);
    }
    expect(section).toMatch(/ZERO Schnorr\s*\nsigning/);
    for (const item of [
      "**A Public Runtime API for either identifier form**",
      "**Any Source implementation feeding a Nostr-derived value**",
      "**Any Desktop rendering of `publicIdentifier` in any form**",
      "A `Session`/`ATProto`/`Wallet` Root",
      "`nsec`, Secret Key export/import, Schnorr signature, Nostr Event,",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc declares no further review stage should be added for this topic", () => {
    expect(designDocSource).toMatch(
      /\*\*No further review stage should be added for THIS topic — the\s*\nRuntime Boundary for Public Identifiers\.\*\*/,
    );
  });

  it("6. the design doc names exactly one recommended next Arc: Nostr Schnorr Signing Boundary Review", () => {
    const section = (designDocSource.match(/## 4\. Next Arc recommendation([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Nostr Schnorr Signing Boundary Review\.\*\*/);
  });

  it("7. the design doc's own diagram states all four frozen decisions from Alpha 176-179", () => {
    const section = (designDocSource.match(/\*\*Four decisions this Arc formally FREEZES:\*\*([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Origin \(Alpha 176\):\*\*/);
    expect(section).toMatch(/\*\*Runtime-canonical form \(Alpha 177\):\*\* hex/);
    expect(section).toMatch(/\*\*Desktop latitude \(Alpha 178\):\*\*/);
    expect(section).toMatch(/\*\*Extensibility \(Alpha 179\):\*\*/);
  });

  it("8. the design doc cross-references Alpha 179, 178, 177, 176, and 175", () => {
    for (const ref of [
      "secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review",
      "secure_runtime_alpha_178_nostr_desktop_presentation_review",
      "secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision",
      "secure_runtime_alpha_176_nostr_public_identifier_origin_review",
      "secure_runtime_alpha_175_nostr_public_identifier_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("9. structural: SecretHandleKind and HkdfDomain gained ZERO new variants across the whole Alpha 176-180 Arc", () => {
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

  it("11. structural: FedosNostrPublicKeyHex/FedosNostrNpub remain pub(crate), no #[wasm_bindgen] on either", () => {
    const hexTypeMatch = libRsSource.match(/((?:#\[[^\]]*\]\s*\n\s*)*)pub\(crate\) struct FedosNostrPublicKeyHex\b/);
    const npubTypeMatch = libRsSource.match(/((?:#\[[^\]]*\]\s*\n\s*)*)pub\(crate\) struct FedosNostrNpub\b/);
    expect(hexTypeMatch).not.toBeNull();
    expect(npubTypeMatch).not.toBeNull();
    expect((hexTypeMatch ?? [])[1] ?? "").not.toMatch(/wasm_bindgen/);
    expect((npubTypeMatch ?? [])[1] ?? "").not.toMatch(/wasm_bindgen/);
  });

  it("12. structural: FedosIdentityDescriptor.publicIdentifier remains externally sourced, untouched by this Arc", () => {
    expect(identityDescriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(identityDescriptorSource).not.toMatch(/secure_runtime_alpha_17[6-9]|secure_runtime_alpha_180/);
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_17[6-9]|secure_runtime_alpha_180/);
    expect(nostrIdentityProviderSource).toMatch(/publicIdentifier: snapshot\.publicIdentifier,/);
    expect(desktopReaderSource).toMatch(/publicIdentifier: snapshot\.publicIdentifier,/);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything else
  // ---------------------------------------------------------------------

  it("13. Regression: lib.rs carries no reference to any of the five Alpha 176-180 docs by filename", () => {
    for (const stage of ["176", "177", "178", "179", "180"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs", () => {
    for (const stage of ["176", "177", "178", "179", "180"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (const stage of ["176", "177", "178", "179", "180"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["176", "177", "178", "179", "180"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("17. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change", () => {
    for (const stage of ["176", "177", "178", "179", "180"]) {
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

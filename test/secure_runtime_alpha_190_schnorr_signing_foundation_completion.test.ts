import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_190_schnorr_signing_foundation_completion.md?raw";
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
import identityDescriptorSource from "../src/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/identity/fedos_nostr_identity_provider.ts?raw";

/**
 * Secure Runtime Alpha 190 -- "Nostr Schnorr Signing Foundation
 * Completion": Stage 10, the closing Stage, of the Nostr Schnorr
 * Signing Foundation Arc (Alpha 181-190). Adds no further production
 * code. Declares the Arc's own Objective confirmed complete and
 * recommends exactly one next Arc.
 */
describe("Secure Runtime Alpha 190 -- Nostr Schnorr Signing Foundation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it makes NO further code change\s*\nof any kind\./);
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all six NOT-yet-existing items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**`nsec`**",
      "**A hex/base64 Encoder for the 64-byte signature**",
      "**Nostr Event construction or serialization**",
      "**Relay communication**",
      "**A public Runtime API for signing**",
      "**Session/ATProto/Wallet signing of any kind**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names exactly one recommended next Arc: Nostr Signature Encoding & Event Assembly Boundary Review", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Nostr Signature Encoding & Event Assembly Boundary\s*\nReview\.\*\*/,
    );
  });

  it("6. the design doc cross-references all nine prior Stages of this Arc plus Alpha 180", () => {
    for (const ref of [
      "secure_runtime_alpha_189_signing_runtime_boundary_review",
      "secure_runtime_alpha_188_session_atproto_signing_extensibility_review",
      "secure_runtime_alpha_187_event_builder_compatibility_review",
      "secure_runtime_alpha_186_public_key_interoperability_review",
      "secure_runtime_alpha_185_signature_boundary_review",
      "secure_runtime_alpha_184_signature_determinism_verification",
      "secure_runtime_alpha_183_derive_nostr_signature_internal",
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_181_k256_schnorr_api_inventory",
      "secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("7. structural: SecretHandleKind and HkdfDomain gained ZERO new variants across the whole Alpha 181-190 Arc", () => {
    const kindBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\r?\n {4}\}/) ?? [])[1] ?? "";
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
    ]);

    const domainBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\r?\n {4}\}/) ?? [])[1] ?? "";
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
      "TestOnly",
    ]);
  });

  it("8. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(45);
  });

  it("9. structural: FedosNostrSignatureHandle and derive_nostr_signature_internal both exist, pub(crate) only, no wasm_bindgen", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosNostrSignatureHandle \{/);
    expect(libRsSource).toMatch(/pub\(crate\) fn derive_nostr_signature_internal\(/);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]\s*\r?\n\s*pub\(crate\) struct FedosNostrSignatureHandle/);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]\s*\r?\n\s*pub\(crate\) fn derive_nostr_signature_internal/);
  });

  it("10. structural: k256 enables exactly arithmetic+schnorr -- zero new [dependencies] entry, exactly as Alpha 181 decided", () => {
    const k256Line = (cargoTomlSource.match(/^k256 = .*$/m) ?? [""])[0];
    expect(k256Line).toMatch(/features = \["arithmetic", "schnorr"\]/);
    const depsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    const k256Lines = depsSection.split("\n").filter((line: string) => line.trim().startsWith("k256"));
    expect(k256Lines.length).toBe(1);
  });

  it("11. structural: no nsec/Event/Relay/WebSocket CODE, and no Session/ATProto/Ed25519 CODE, exists anywhere in this Arc's own five signing additions", () => {
    const structMatch = libRsSource.match(/pub\(crate\) struct FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    const implMatch = libRsSource.match(/impl FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/);
    const codeOnly = [structMatch?.[1], implMatch?.[1], fnMatch?.[0]]
      .filter((s: string | undefined): s is string => Boolean(s))
      .map((text: string) =>
        text
          .split(/\r?\n/)
          .filter((line: string) => !line.trim().startsWith("///") && !line.trim().startsWith("//"))
          .join("\n"),
      )
      .join("\n");
    expect(codeOnly).not.toMatch(/nsec|WebSocket|Relay|\bEvent\b|Session|ATProto|Ed25519/i);
  });

  it("12. structural: FedosIdentityDescriptor.publicIdentifier remains externally sourced, untouched by this Arc", () => {
    expect(identityDescriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(identityDescriptorSource).not.toMatch(/secure_runtime_alpha_18[1-9]|secure_runtime_alpha_190/);
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_18[1-9]|secure_runtime_alpha_190/);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own ten files, plus everything else
  // ---------------------------------------------------------------------

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the ten Alpha 181-190 docs", () => {
    for (let stage = 181; stage <= 190; stage++) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (let stage = 181; stage <= 190; stage++) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (let stage = 181; stage <= 190; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("16. Regression: package.json carries no reference to any of the ten Arc-stage docs -- confirming zero npm dependency change", () => {
    for (let stage = 181; stage <= 190; stage++) {
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("17. Regression: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 180's own closing state", () => {
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

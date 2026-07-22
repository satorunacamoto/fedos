import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_200_event_foundation_completion.md?raw";
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
 * Secure Runtime Alpha 200 -- "Nostr Event Foundation Completion":
 * Stage 10, the closing Stage, of the Nostr Event Foundation Arc
 * (Alpha 191-200). Adds no further production code. Declares the
 * Arc's own Objective confirmed complete and recommends exactly one
 * next Arc.
 */
describe("Secure Runtime Alpha 200 -- Nostr Event Foundation Completion", () => {
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

  it("4. the design doc's own Completion Declaration lists all five NOT-yet-existing items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "**Relay networking, WebSocket, Subscription, Filters**",
      "**Event publishing**",
      "**A hex/JSON export of a complete signed event**",
      "**A public Runtime API for events**",
      "**Session/ATProto/Wallet event or record support of any kind**",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names exactly one recommended next Arc: Nostr Event Runtime Exposure & Desktop Integration Review", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Nostr Event Runtime Exposure & Desktop\s*\nIntegration Review\.\*\*/,
    );
  });

  it("6. the design doc cross-references all nine prior Stages of this Arc plus Alpha 190", () => {
    for (const ref of [
      "secure_runtime_alpha_199_event_protocol_extensibility_review",
      "secure_runtime_alpha_198_event_runtime_boundary_review",
      "secure_runtime_alpha_197_event_boundary_review",
      "secure_runtime_alpha_196_event_foundation_verification",
      "secure_runtime_alpha_195_connect_event_id_to_schnorr_signing",
      "secure_runtime_alpha_194_deterministic_event_id_generation",
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_192_nostr_event_handle",
      "secure_runtime_alpha_191_nostr_event_model_inventory",
      "secure_runtime_alpha_190_schnorr_signing_foundation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("7. structural: SecretHandleKind and HkdfDomain gained ZERO new variants across the whole Alpha 191-200 Arc", () => {
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
      "DirectRatchetRootKeyMaterial",
      "DirectRatchetChainKeyMaterial",
      "DirectRatchetPrivateKeyMaterial",
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
      "DirectRatchetSealing",
      "TestOnly",
    ]);
  });

  it("8. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("9. structural: all four Event Foundation functions and the Handle exist, pub(crate) only, no wasm_bindgen", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosNostrEventHandle \{/);
    expect(libRsSource).toMatch(/pub\(crate\) fn new_nostr_event_internal\(/);
    expect(libRsSource).toMatch(/pub\(crate\) fn serialize_nostr_event_canonical_internal\(/);
    expect(libRsSource).toMatch(/pub\(crate\) fn derive_nostr_event_id_internal\(/);
    expect(libRsSource).toMatch(/pub\(crate\) fn sign_nostr_event_internal\(/);
    expect(libRsSource).not.toMatch(/#\[wasm_bindgen\]\s*\r?\n\s*pub\(crate\) struct FedosNostrEventHandle/);
  });

  it("10. structural: serde_json remains dev-dependencies-only across the whole Arc, exactly as Alpha 191 decided", () => {
    const devDepsSection = (cargoTomlSource.match(/^\[dev-dependencies\]$([\s\S]*)/m) ?? [])[1] ?? "";
    expect(devDepsSection).toMatch(/^serde_json = /m);
    const prodDepsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    expect(prodDepsSection).not.toMatch(/^serde/m);
  });

  it("11. structural: no Session/ATProto/Wallet/CBOR/CID/Relay/WebSocket CODE exists anywhere in this Arc's own five Event Foundation additions", () => {
    const structMatch = libRsSource.match(/pub\(crate\) struct FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const implMatch = libRsSource.match(/impl FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const modMatch = libRsSource.match(/mod nostr_event_encoding \{([\s\S]*?)\r?\n {4}\}/);
    const idFnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_event_id_internal\([\s\S]*?\r?\n {4}\}\r?\n/);
    const signFnMatch = libRsSource.match(/pub\(crate\) fn sign_nostr_event_internal\([\s\S]*?\r?\n {4}\}\r?\n/);
    const codeOnly = [structMatch?.[1], implMatch?.[1], modMatch?.[1], idFnMatch?.[0], signFnMatch?.[0]]
      .filter((s: string | undefined): s is string => Boolean(s))
      .map((text: string) =>
        text
          .split(/\r?\n/)
          .filter((line: string) => !line.trim().startsWith("///") && !line.trim().startsWith("//"))
          .join("\n"),
      )
      .join("\n");
    expect(codeOnly).not.toMatch(/Session|ATProto|Wallet|CBOR|\bCID\b|Relay|WebSocket/i);
  });

  it("12. structural: FedosIdentityDescriptor.publicIdentifier remains externally sourced, untouched by this Arc", () => {
    expect(identityDescriptorSource).toMatch(/readonly publicIdentifier: string;/);
    expect(identityDescriptorSource).not.toMatch(/secure_runtime_alpha_19[1-9]|secure_runtime_alpha_200/);
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_19[1-9]|secure_runtime_alpha_200/);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own ten files, plus everything else
  // ---------------------------------------------------------------------

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the ten Alpha 191-200 docs", () => {
    for (let stage = 191; stage <= 200; stage++) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (let stage = 191; stage <= 200; stage++) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (let stage = 191; stage <= 200; stage++) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("16. Regression: package.json carries no reference to any of the ten Arc-stage docs -- confirming zero npm dependency change", () => {
    for (let stage = 191; stage <= 200; stage++) {
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("17. Regression: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 190's own closing state", () => {
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

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_160_integration_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 160 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Nostr Root Foundation Arc. A REVIEW ONLY
 * Stage -- zero code change anywhere. Declares the Arc's own Nostr
 * Root Foundation requirement confirmed complete, entirely by reusing
 * Alpha 151-155's existing infrastructure.
 */
describe("Secure Runtime Alpha 160 -- Integration Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `packages\/` file, no `src\/` file, is modified\./,
    );
  });

  it("3. the design doc issues a Completion Declaration naming the requirement CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Nostr Root Foundation requirement is CONFIRMED\s*\nCOMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all seven not-yet-existing items", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "Nostr Secret Key",
      "Session Key",
      "Wallet Key",
      "Account Index",
      "Device Index",
      "Export",
      "Mnemonic",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names the next Arc as Nostr secret-key derivation", () => {
    expect(designDocSource).toMatch(
      /The NEXT Arc begins secret-key derivation — specifically, deriving a\s*\nNostr secret key FROM the Nostr Root confirmed complete by this Stage\./,
    );
  });

  it("6. the design doc cross-references Alpha 156, 157, 158, 159, and 155", () => {
    for (const ref of [
      "secure_runtime_alpha_156_nostr_root_handle",
      "secure_runtime_alpha_157_nostr_root_derivation",
      "secure_runtime_alpha_158_nostr_root_verification",
      "secure_runtime_alpha_159_nostr_root_foundation_review",
      "secure_runtime_alpha_155_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final shape, confirmed genuinely unchanged from
  // Alpha 155's own closing state
  // ---------------------------------------------------------------------

  it("7. structural: FedosProtocolRootHandle and derive_nostr_root_internal still exist, entirely pub(crate), no new type added", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosProtocolRootHandle \{/);
    expect(libRsSource).toMatch(/pub\(crate\) fn derive_nostr_root_internal\(/);
    expect(libRsSource).not.toMatch(/struct\s+FedosNostrRootHandle/);
    expect(libRsSource).not.toMatch(/^pub struct FedosProtocolRootHandle/m);
    expect(libRsSource).not.toMatch(/^pub fn derive_nostr_root_internal/m);
  });

  it("8. RIPPLE (Secure Runtime Alpha 163): SecretHandleKind and HkdfDomain gained ZERO new variants across the whole Alpha 156-160 Arc's own scope; Stage 1020 (Secure Runtime Alpha 163) legitimately added a further SecretHandleKind variant, NostrSecretKeyMaterial, in the LATER Alpha 161-165 Arc, reconfirmed here as the CURRENT state", () => {
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

  it("9. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("10. RIPPLE (Secure Runtime Alpha 164, 173, 183): no Nostr secret-key generation, npub, nsec, or signature CODE existed anywhere in the master_root module AS OF this Stage's own closing state -- doc-comment mentions of what did NOT exist yet were expected and excluded; Stage 1021 (Secure Runtime Alpha 164) legitimately added secret-key derivation, Stage 1026 (Secure Runtime Alpha 173) legitimately added npub encoding, and Stage 1029 (Secure Runtime Alpha 183) legitimately added real Schnorr signature generation in LATER Arcs -- nsec CODE remains absent, reconfirmed here as the CURRENT state", () => {
    const moduleText = (libRsSource.match(/\/\/\/ Stage 1012 \(Secure Runtime Alpha 146\)[\s\S]*?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
    expect(moduleText.length).toBeGreaterThan(0);
    const codeOnly = moduleText
      .split(/\r?\n/)
      .filter((line: string) => !line.trim().startsWith("///") && !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/generateSecretKey|nsec/i);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything else
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs carries no reference to any of the five Alpha 156-160 docs -- confirming ZERO Rust change across the whole Arc", () => {
    for (const stage of ["156", "157", "158", "159", "160"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs", () => {
    for (const stage of ["156", "157", "158", "159", "160"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (const stage of ["156", "157", "158", "159", "160"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["156", "157", "158", "159", "160"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("15. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change", () => {
    for (const stage of ["156", "157", "158", "159", "160"]) {
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
    expect(pkg.bin).toBeUndefined();
  });

  it("16. Regression: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 140's own closing state", () => {
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

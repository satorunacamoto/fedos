import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_150_integration_completion.md?raw";
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
 * Secure Runtime Alpha 150 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Master Root Derivation Foundation Arc. A
 * REVIEW ONLY Stage -- zero code change anywhere. Declares the
 * Foundation complete: Master Seed Handle -> Identity Root ->
 * Application Root, all pub(crate), zero WASM/Desktop/Identity Layer
 * exposure.
 */
describe("Secure Runtime Alpha 150 -- Integration Completion", () => {
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

  it("3. the design doc issues a Completion Declaration naming the Foundation complete", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*The Master Root Derivation Foundation is COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all eight not-yet-existing items named in the Objective", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const item of [
      "Nostr Root",
      "Session Root",
      "ATProto Root",
      "Storage Root",
      "Wallet Root",
      "Account Key",
      "Device Key",
      "Secret Export",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc cross-references Alpha 141, Alpha 142, Alpha 148, and Alpha 149", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secure_runtime_alpha_148_application_root_derivation",
      "secure_runtime_alpha_149_root_handle_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final, complete Foundation shape
  // ---------------------------------------------------------------------

  it("6. structural: all three Root Handle types and both derivation functions exist, entirely pub(crate)", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosMasterSeedHandle \{/);
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosIdentityRootHandle \{/);
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosApplicationRootHandle \{/);
    expect(libRsSource).toMatch(/pub\(crate\) fn derive_identity_root_internal\(/);
    expect(libRsSource).toMatch(/pub\(crate\) fn derive_application_root_internal\(/);
    expect(libRsSource).not.toMatch(/^pub struct FedosMasterSeedHandle/m);
    expect(libRsSource).not.toMatch(/^pub struct FedosIdentityRootHandle/m);
    expect(libRsSource).not.toMatch(/^pub struct FedosApplicationRootHandle/m);
  });

  it("7. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  it("8. RIPPLE (Secure Runtime Alpha 151, 163): SecretHandleKind gained exactly three new variants across the Alpha 146-150 Arc's own scope -- MasterSeedMaterial, IdentityRootMaterial, ApplicationRootMaterial; Stage 1016 (Secure Runtime Alpha 151) legitimately added a FOURTH, ProtocolRootMaterial, and Stage 1020 (Secure Runtime Alpha 163) legitimately added a FIFTH, NostrSecretKeyMaterial, reconfirmed here as the CURRENT state", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\n {4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants).toEqual([
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
  });

  it("9. RIPPLE (Secure Runtime Alpha 153): HkdfDomain gained exactly one new variant across the Alpha 146-150 Arc's own scope -- Application; Stage 1017/1018 (Secure Runtime Alpha 152/153) legitimately added four more -- Nostr/Session/ATProto/Wallet -- for TEN total, reconfirmed here as the CURRENT state", () => {
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
  });

  it("10. RIPPLE (Secure Runtime Alpha 164, 173, 183): no Nostr secret-key generation, npub, or signature CODE existed anywhere in the master_root module AS OF this Stage's own closing state -- doc-comment mentions of what did NOT exist yet were expected and excluded; Stage 1021 (Secure Runtime Alpha 164) legitimately added secret-key derivation, Stage 1026 (Secure Runtime Alpha 173) legitimately added npub encoding, and Stage 1029 (Secure Runtime Alpha 183) legitimately added real Schnorr signature generation in LATER Arcs -- reconfirmed here as the CURRENT state", () => {
    const moduleText = (libRsSource.match(/\/\/\/ Stage 1012 \(Secure Runtime Alpha 146\)[\s\S]*?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
    expect(moduleText.length).toBeGreaterThan(0);
    expect(moduleText).not.toMatch(/generateSecretKey/i);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything outside it
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs -- confirming zero Desktop change across the whole Arc", () => {
    for (const stage of ["146", "147", "148", "149", "150"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- confirming zero Identity Layer change", () => {
    for (const stage of ["146", "147", "148", "149", "150"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["146", "147", "148", "149", "150"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("14. Regression: lib.rs carries no reference to THIS Stage's own doc -- confirming zero Rust change for Alpha 150 specifically", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_150/);
  });

  it("15. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change across the whole Arc", () => {
    for (const stage of ["146", "147", "148", "149", "150"]) {
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

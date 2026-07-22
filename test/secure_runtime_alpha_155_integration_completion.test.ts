import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_155_integration_completion.md?raw";
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

/**
 * Secure Runtime Alpha 155 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Protocol Root Derivation Arc. A REVIEW ONLY
 * Stage -- zero code change anywhere. Declares the Protocol Root
 * Derivation Foundation complete.
 */
describe("Secure Runtime Alpha 155 -- Integration Completion", () => {
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
    expect(section).toMatch(/\*\*The Protocol Root Derivation Foundation is COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all seven not-yet-existing items named in the Objective", () => {
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

  it("5. the design doc cross-references Alpha 151, Alpha 153, Alpha 154, and Alpha 150", () => {
    for (const ref of [
      "secure_runtime_alpha_151_protocol_root_handle",
      "secure_runtime_alpha_153_session_atproto_wallet_root",
      "secure_runtime_alpha_154_protocol_separation_verification",
      "secure_runtime_alpha_150_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final, complete Protocol Root shape
  // ---------------------------------------------------------------------

  it("6. structural: FedosProtocolRootHandle and all four derivation functions exist, entirely pub(crate)", () => {
    expect(libRsSource).toMatch(/pub\(crate\) struct FedosProtocolRootHandle \{/);
    for (const fnName of [
      "derive_nostr_root_internal",
      "derive_session_root_internal",
      "derive_atproto_root_internal",
      "derive_wallet_root_internal",
    ]) {
      expect(libRsSource).toMatch(new RegExp(`pub\\(crate\\) fn ${fnName}\\(`));
    }
    expect(libRsSource).not.toMatch(/^pub struct FedosProtocolRootHandle/m);
    expect(libRsSource).not.toMatch(/^pub fn derive_nostr_root_internal/m);
  });

  it("7. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(64);
  });

  it("8. structural: SecretHandleKind gained exactly one new variant across the whole Arc -- ProtocolRootMaterial", () => {
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
      "TestOnlySecretMaterial",
      "DirectRatchetRootKeyMaterial",
      "DirectRatchetChainKeyMaterial",
      "DirectRatchetPrivateKeyMaterial",
    ]);
  });

  it("9. structural: HkdfDomain gained exactly four new variants across the whole Arc -- Nostr, Session, ATProto, Wallet", () => {
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

  it("10. structural: no Nostr/wallet secret-key generation, npub, or signature reference exists anywhere in the master_root module", () => {
    const moduleText = (libRsSource.match(/\/\/\/ Stage 1012 \(Secure Runtime Alpha 146\)[\s\S]*?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
    expect(moduleText.length).toBeGreaterThan(0);
    expect(moduleText).not.toMatch(/generateSecretKey|npub|signature|sign\(/i);
  });

  it("11. structural: FedosProtocolRootHandle carries three protocol-separation guarantees confirmed by Alpha 154's own tests -- matches_for_internal_verification is present, and no PartialEq/Eq is derived", () => {
    const implMatch = libRsSource.match(/impl FedosProtocolRootHandle \{([\s\S]*?)\n {4}\}\n\n {4}\/\/\/ The result of a \[`derive_protocol_root_internal`\]/);
    expect(implMatch?.[1] ?? "").toMatch(/pub\(crate\) fn matches_for_internal_verification\(&self, other: &Self\) -> bool \{/);
    expect(libRsSource).not.toMatch(/#\[derive\([^)]*PartialEq[^)]*\)\]\s*\n\s*pub\(crate\) struct FedosProtocolRootHandle/);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything outside it
  // ---------------------------------------------------------------------

  it("12. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs -- confirming zero Desktop change across the whole Arc", () => {
    for (const stage of ["151", "152", "153", "154", "155"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- confirming zero Identity Layer change", () => {
    for (const stage of ["151", "152", "153", "154", "155"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["151", "152", "153", "154", "155"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("15. Regression: lib.rs carries no reference to THIS Stage's own doc -- confirming zero Rust change for Alpha 155 specifically", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_155/);
  });

  it("16. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change across the whole Arc", () => {
    for (const stage of ["151", "152", "153", "154", "155"]) {
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("17. Regression: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 140's own closing state", () => {
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

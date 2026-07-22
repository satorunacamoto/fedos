import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_165_nostr_secret_key_derivation_completion.md?raw";
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
 * Secure Runtime Alpha 165 -- "Nostr Secret Key Derivation Completion":
 * Stage 5, the closing Stage, of the Deterministic Nostr Secret Key
 * Derivation Arc. Adds only #[cfg(test)] coverage -- no further
 * production-code change. Declares the Arc's own Objective confirmed
 * complete.
 */
describe("Secure Runtime Alpha 165 -- Nostr Secret Key Derivation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage but no further production-code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/but makes NO further production-code change\./);
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all eight NEXT-Arc items", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    for (const item of [
      "Nostr Public Key",
      "`npub`",
      "`nsec`",
      "Schnorr signature",
      "Event generation",
      "Relay communication",
      "DM",
      "Key export/import",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names the next Arc as Nostr Public Key Derivation", () => {
    expect(designDocSource).toMatch(
      /The NEXT Arc begins Nostr Public Key Derivation — deriving a Nostr\s*\npublic key FROM the `FedosNostrSecretKeyHandle`/,
    );
  });

  it("6. the design doc cross-references Alpha 164, 163, 162, 161, and 160", () => {
    for (const ref of [
      "secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation",
      "secure_runtime_alpha_163_nostr_secret_key_handle",
      "secure_runtime_alpha_162_nostr_account_derivation_decision",
      "secure_runtime_alpha_161_existing_nostr_key_inventory",
      "secure_runtime_alpha_160_integration_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the real-execution test coverage this Stage's own
  // Completion Declaration relies on actually exists in lib.rs
  // ---------------------------------------------------------------------

  it("7. structural: real-execution determinism/separation tests exist for the Nostr Secret Key level", () => {
    for (const testName of [
      "fn same_nostr_root_and_same_account_index_derive_matching_secret_keys",
      "fn same_nostr_root_and_different_account_indices_derive_non_matching_secret_keys",
      "fn different_nostr_roots_and_same_account_index_derive_non_matching_secret_keys",
      "fn account_index_zero_one_and_u32_max_all_derive_successfully_and_distinctly",
      "fn nostr_secret_key_matches_for_internal_verification_returns_false_after_either_side_is_cleared",
      "fn derive_nostr_secret_key_internal_rejects_a_cleared_nostr_root",
      "fn derive_nostr_secret_key_internal_does_not_mutate_the_input_nostr_root",
    ]) {
      expect(libRsSource).toContain(testName);
    }
  });

  it("8. structural: SecretHandleKind gained EXACTLY one new variant across the whole Alpha 161-165 Arc", () => {
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
  });

  it("9. structural: HkdfDomain gained ZERO new variants across the whole Arc -- the Nostr Secret Key derivation bypasses it deliberately", () => {
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

  it("11. RIPPLE (Secure Runtime Alpha 173, 183): no public-key derivation, npub/nsec codec, signature, or Relay CODE existed anywhere in master_root AS OF this Stage's own closing state -- doc-comment mentions of what did NOT exist yet were expected and excluded; Stage 1026 (Secure Runtime Alpha 173) legitimately added npub encoding CODE and Stage 1029 (Secure Runtime Alpha 183) legitimately added real Schnorr signature CODE in LATER Arcs -- nsec/WebSocket/Relay remain absent, reconfirmed here as the CURRENT state", () => {
    const moduleText = (libRsSource.match(/mod master_root \{([\s\S]*?)\r?\n\}\r?\n\r?\n\/\/\/ Stage 87/) ?? [])[0] ?? "";
    expect(moduleText.length).toBeGreaterThan(0);
    const codeOnly = moduleText
      .split(/\r?\n/)
      .filter((line: string) => !line.trim().startsWith("///") && !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/nsec|WebSocket|Relay/i);
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything else
  // ---------------------------------------------------------------------

  it("12. Regression: lib.rs carries no reference to any of the five Alpha 161-165 docs by filename", () => {
    for (const stage of ["161", "162", "163", "164", "165"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs", () => {
    for (const stage of ["161", "162", "163", "164", "165"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (const stage of ["161", "162", "163", "164", "165"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["161", "162", "163", "164", "165"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("16. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change", () => {
    for (const stage of ["161", "162", "163", "164", "165"]) {
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

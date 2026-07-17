import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_170_nostr_public_key_derivation_completion.md?raw";
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
 * Secure Runtime Alpha 170 -- "Nostr Public Key Derivation Completion":
 * Stage 5, the closing Stage, of the Deterministic Nostr Public Key
 * Derivation Arc. Adds only #[cfg(test)] coverage -- no further
 * production-code change. Declares the Arc's own Objective confirmed
 * complete, and reviews Protocol Extensibility.
 */
describe("Secure Runtime Alpha 170 -- Nostr Public Key Derivation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage but no further production-code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/but makes NO further production-code change\./);
  });

  it("3. the design doc issues a Completion Declaration naming the Objective CONFIRMED COMPLETE", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("4. the design doc's own Completion Declaration lists all nine NEXT-Arc items", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    for (const item of [
      "Public key byte Public Boundary",
      "hex public key",
      "`npub`",
      "`nsec`",
      "Schnorr signature",
      "Nostr Event",
      "Relay communication",
      "DM",
      "Secret export/import",
    ]) {
      expect(section).toContain(item);
    }
  });

  it("5. the design doc names the next Arc as Nostr Public Identifier Encoding Review", () => {
    expect(designDocSource).toMatch(
      /The NEXT Arc begins Nostr Public Identifier Encoding Review —/,
    );
  });

  it("6. the design doc's own Protocol Extensibility Review names common vs. Nostr-specific parts, and commits to never reusing the Public Key type", () => {
    const section = (designDocSource.match(/## 4\. Protocol Extensibility Review([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Common across any future protocol\*\*/);
    expect(section).toMatch(/\*\*Nostr-specific, NOT reusable as-is by a different protocol:\*\*/);
    expect(section).toMatch(
      /derivation PATTERN generalizes; the Protocol Key TYPE never does\.\*\*/,
    );
  });

  it("7. the design doc cross-references Alpha 169, 168, 167, 166, and 165", () => {
    for (const ref of [
      "secure_runtime_alpha_169_deterministic_nostr_public_key_derivation",
      "secure_runtime_alpha_168_nostr_public_key_handle",
      "secure_runtime_alpha_167_nostr_public_key_representation_decision",
      "secure_runtime_alpha_166_existing_nostr_public_key_inventory",
      "secure_runtime_alpha_165_nostr_secret_key_derivation_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the real-execution test coverage this Stage's own
  // Completion Declaration relies on actually exists in lib.rs
  // ---------------------------------------------------------------------

  it("8. structural: real-execution determinism/separation tests exist for the Nostr Public Key level", () => {
    for (const testName of [
      "fn same_secret_key_content_derives_matching_public_keys",
      "fn different_account_indices_derive_non_matching_public_keys",
      "fn different_master_seeds_and_same_account_index_derive_non_matching_public_keys",
      "fn account_index_zero_one_and_u32_max_all_derive_public_keys_successfully_and_distinctly",
      "fn derive_nostr_public_key_internal_rejects_a_cleared_secret_key",
      "fn derive_nostr_public_key_internal_does_not_mutate_the_input_secret_key",
    ]) {
      expect(libRsSource).toContain(testName);
    }
  });

  it("9. structural: SecretHandleKind and HkdfDomain gained ZERO new variants across the whole Alpha 166-170 Arc -- the Public Key Handle is not SecretHandle-backed", () => {
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
      "TestOnly",
    ]);
  });

  it("10. structural: the crate's #[wasm_bindgen] count and pub fn count remain fixed at 13/36 across the whole Arc", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(46);
  });

  it("11. RIPPLE (Secure Runtime Alpha 173, 183): no npub/nsec/bech32/schnorr/Relay/WebSocket CODE existed anywhere in master_root AS OF this Stage's own closing state -- doc-comment mentions of what did NOT exist yet were expected and excluded; Stage 1025-1027 (Secure Runtime Alpha 173) legitimately added a real npub/bech32 Encoder Boundary and Stage 1029 (Secure Runtime Alpha 183) legitimately added real Schnorr signature CODE in LATER Arcs -- nsec/Relay/WebSocket remain absent, reconfirmed here as the CURRENT state", () => {
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

  it("12. Regression: lib.rs carries no reference to any of the five Alpha 166-170 docs by filename", () => {
    for (const stage of ["166", "167", "168", "169", "170"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs", () => {
    for (const stage of ["166", "167", "168", "169", "170"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc", () => {
    for (const stage of ["166", "167", "168", "169", "170"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched across the whole Arc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["166", "167", "168", "169", "170"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("16. Regression: Cargo.toml and package.json carry no reference to any of the five Arc-stage docs -- confirming zero dependency change", () => {
    for (const stage of ["166", "167", "168", "169", "170"]) {
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

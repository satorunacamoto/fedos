import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_188_session_atproto_signing_extensibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 188 -- "Session/ATProto Signing Extensibility
 * Review": Stage 8 of the Nostr Schnorr Signing Foundation Arc (Alpha
 * 181-190). REVIEW ONLY -- zero code change. Confirms Session
 * (Ed25519) and ATProto (ECDSA) do not share this Arc's own BIP-340
 * Schnorr code, while the Handle/derive_*_internal PATTERN generalizes.
 */
describe("Secure Runtime Alpha 188 -- Session/ATProto Signing Extensibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc reviews Session (Ed25519) and ATProto (ECDSA) as NOT BIP-340 Schnorr", () => {
    const section = (designDocSource.match(/## 2\. Do Session and ATProto even use BIP-340 Schnorr\?([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Session\*\*/);
    expect(section).toContain("Ed25519");
    expect(section).toMatch(/\*\*ATProto\*\*/);
    expect(section).toContain("ECDSA");
    expect(section).toMatch(/Neither Session nor ATProto's own real-world signing convention is\s*\nBIP-340 Schnorr\./);
  });

  it("4. the design doc states all four explicit prohibitions extended to signing", () => {
    const section = (designDocSource.match(/## 3\. Four explicit prohibitions, extended to Signing specifically([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/must NEVER be repurposed for an Ed25519\s*\n\s*Session signature or an ECDSA ATProto signature\./);
    expect(section).toMatch(/must NEVER be assumed reusable for Session's own\s*\n\s*Ed25519 signing\./);
    expect(section).toMatch(/must NEVER be assumed reusable for ATProto's own\s*\n\s*ECDSA signing/);
    expect(section).toMatch(/own PATTERN generalizes; its\s*\n\s*own CODE does not\./);
  });

  it("5. the design doc names the one generalizable pattern precisely", () => {
    const section = (designDocSource.match(/## 4\. What generalizes([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Opaque output Handle/);
    expect(section).toContain("Fail Closed on every invalid input");
  });

  it("6. the design doc cross-references Alpha 187, 182, 181, and 179", () => {
    for (const ref of [
      "secure_runtime_alpha_187_event_builder_compatibility_review",
      "secure_runtime_alpha_182_nostr_signature_handle",
      "secure_runtime_alpha_181_k256_schnorr_api_inventory",
      "secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: HkdfDomain (10) and SecretHandleKind (13) variants remain unchanged, no Session/ATProto/Wallet secret kind exists", () => {
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

    const kindBody = (libRsSource.match(/pub\(crate\) enum SecretHandleKind \{([\s\S]*?)\r?\n {4}\}/) ?? [])[1] ?? "";
    const kindVariants = [...kindBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(kindVariants.length).toBe(13);
    expect(kindVariants.some((v: string | undefined) => /Session|ATProto|Wallet/.test(v ?? ""))).toBe(false);
  });

  it("8. structural: no ed25519/p256/second elliptic-curve crate was added, and k256's ecdsa feature stays excluded", () => {
    const k256Line = (cargoTomlSource.match(/^k256 = .*$/m) ?? [""])[0];
    expect(k256Line).toMatch(/features = \["arithmetic", "schnorr"\]/);
    expect(k256Line).not.toContain("ecdsa");
    const depsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    expect(depsSection).not.toMatch(/^ed25519/m);
    expect(depsSection).not.toMatch(/^p256/m);
    expect(depsSection).not.toMatch(/^curve25519/m);
  });

  it("9. structural: no Session/ATProto/Ed25519 code reference exists in FedosNostrSignatureHandle's or derive_nostr_signature_internal's own bodies", () => {
    const structMatch = libRsSource.match(/pub\(crate\) struct FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    const implMatch = libRsSource.match(/impl FedosNostrSignatureHandle \{([\s\S]*?)\r?\n {4}\}/);
    const fnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_signature_internal\([\s\S]*?\r?\n {4}\}\r?\n/);
    const combined = (structMatch?.[1] ?? "") + (implMatch?.[1] ?? "") + (fnMatch?.[0] ?? "");
    expect(combined).not.toMatch(/Session|ATProto|Ed25519|ed25519/);
  });

  it("10. structural: wasm_bindgen count remains fixed at 13, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs and Cargo.toml carry no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_188/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_188/);
  });

  it("12. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_188/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

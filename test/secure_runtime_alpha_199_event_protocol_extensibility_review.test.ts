import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_199_event_protocol_extensibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 199 -- "Nostr Event Protocol Extensibility
 * Review": Stage 9 of the Nostr Event Foundation Arc (Alpha 191-200).
 * REVIEW ONLY -- zero code change. Confirms Session (no event
 * concept), ATProto (CBOR/CID records), and Wallet (transactions) do
 * not share this Arc's own NIP-01-shaped code, while the
 * Handle/canonicalize/hash/sign PROCESS generalizes.
 */
describe("Secure Runtime Alpha 199 -- Nostr Event Protocol Extensibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc reviews Session, ATProto, and Wallet as NOT NIP-01-shaped", () => {
    const section = (designDocSource.match(/## 2\. Do Session, ATProto, or Wallet even have a NIP-01-shaped([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Session\*\*/);
    expect(section).toMatch(/\*\*ATProto\*\*/);
    expect(section).toContain("CID");
    expect(section).toMatch(/\*\*Wallet\*\*/);
    expect(designDocSource).toMatch(/None of the three shares NIP-01's own exact shape\./);
  });

  it("4. the design doc states all four explicit prohibitions extended to events", () => {
    const section = (designDocSource.match(/## 3\. Four explicit prohibitions, extended to the Event layer([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/must NEVER be repurposed for a Session\s*\n\s*message, an ATProto record, or a Wallet transaction\./);
    expect(section).toMatch(/must NEVER be\s*\n\s*generalized into a cross-protocol event\/record codec\./);
    expect(section).toMatch(/must NEVER be assumed to work for\s*\n\s*Session\/ATProto\/Wallet signing/);
    expect(section).toMatch(/is NEVER sufficient reason to unify event models\s*\n\s*across protocols\./);
  });

  it("5. the design doc names the four-step process that generalizes", () => {
    const section = (designDocSource.match(/## 4\. What generalizes([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Opaque, immutable input Handle/);
    expect(section).toMatch(/Alpha 192/);
    expect(section).toMatch(/Alpha 193/);
    expect(section).toMatch(/Alpha 194/);
    expect(section).toMatch(/Alpha\s*\n195/);
  });

  it("6. the design doc cross-references Alpha 198, 193, 188, and 179", () => {
    for (const ref of [
      "secure_runtime_alpha_198_event_runtime_boundary_review",
      "secure_runtime_alpha_193_canonical_event_serialization",
      "secure_runtime_alpha_188_session_atproto_signing_extensibility_review",
      "secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("7. structural: HkdfDomain (10) and SecretHandleKind (13) variants remain unchanged, no Session/ATProto/Wallet event kind exists", () => {
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
  });

  it("8. structural: no CBOR/IPLD/CID library was added, Cargo.toml's own dependency count is unchanged by this Arc", () => {
    const depsSection = (cargoTomlSource.match(/^\[dependencies\]$([\s\S]*?)^\[dev-dependencies\]$/m) ?? [])[1] ?? "";
    expect(depsSection).not.toMatch(/cbor/i);
    expect(depsSection).not.toMatch(/multiformats|ipld|\bcid\b/i);
    const k256Lines = depsSection.split("\n").filter((line: string) => line.trim().startsWith("k256"));
    expect(k256Lines.length).toBe(1);
  });

  it("9. structural: no Session/ATProto/Wallet/CBOR/CID code reference exists in the Event Foundation's own four function/type definitions", () => {
    const structMatch = libRsSource.match(/pub\(crate\) struct FedosNostrEventHandle \{([\s\S]*?)\r?\n {4}\}/);
    const modMatch = libRsSource.match(/mod nostr_event_encoding \{([\s\S]*?)\r?\n {4}\}/);
    const idFnMatch = libRsSource.match(/pub\(crate\) fn derive_nostr_event_id_internal\([\s\S]*?\r?\n {4}\}\r?\n/);
    const signFnMatch = libRsSource.match(/pub\(crate\) fn sign_nostr_event_internal\([\s\S]*?\r?\n {4}\}\r?\n/);
    const combined =
      (structMatch?.[1] ?? "") + (modMatch?.[1] ?? "") + (idFnMatch?.[0] ?? "") + (signFnMatch?.[0] ?? "");
    expect(combined).not.toMatch(/Session|ATProto|Wallet|CBOR|IPLD|\bCID\b/);
  });

  it("10. structural: wasm_bindgen count remains fixed at 13, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(13);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs and Cargo.toml carry no reference to this Stage's own doc", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_199/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_199/);
  });

  it("12. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_199/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

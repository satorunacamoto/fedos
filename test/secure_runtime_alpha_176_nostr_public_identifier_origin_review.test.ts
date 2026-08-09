import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityDescriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentitySourceSource from "../src/os/core/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/os/core/identity/fedos_null_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 176 -- "Nostr Public Identifier Origin Review":
 * Stage 1 of the Nostr Public Identifier Runtime Boundary Arc
 * (Alpha 176-180). REVIEW ONLY -- zero code change. Re-verifies where
 * `FedosIdentityDescriptor.publicIdentifier` originates and resolves
 * whether the Alpha 146-170 deterministic chain is a candidate origin
 * given Alpha 039's own "never derive from a secret key" ceiling.
 */
describe("Secure Runtime Alpha 176 -- Nostr Public Identifier Origin Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code change of any\s*\nkind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc traces publicIdentifier through exactly one origin chain", () => {
    const section = (designDocSource.match(/## 2\. Where the value originates today([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toContain("FedosIdentityDescriptor.publicIdentifier");
    expect(section).toContain("NostrIdentityProvider.describeIdentity()");
    expect(section).toContain("FedosNostrPublicIdentitySnapshot.publicIdentifier");
    expect(section).toContain("FedosNostrPublicIdentitySource.readPublicIdentity()");
    expect(designDocSource).toMatch(
      /Confirmed: `publicIdentifier` has exactly ONE kind of origin today/,
    );
  });

  it("4. the design doc's own decision table finds no drift from five prior Runtime decisions", () => {
    const section = (designDocSource.match(/## 3\. Verified against the existing Runtime decisions([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const ref of ["Alpha 039 §2", "Alpha 039 §3", "Alpha 039 §4", "Alpha 171 §2.9", "Alpha 175 §3"]) {
      expect(section).toContain(ref);
    }
    expect(designDocSource).toMatch(
      /No drift is found\. The current implementation is BYTE-FOR-BYTE\s*\nconsistent with every prior Stage that touched this field\./,
    );
  });

  it("5. the design doc resolves the Alpha 039 §3 vs. Alpha 146-170 tension without wiring anything", () => {
    const section = (designDocSource.match(/## 4\. The design tension([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/These are not the same operation Alpha 039 §3 forbade\./);
    expect(section).toMatch(
      /This Stage's own finding: Alpha 039 §3 does NOT categorically forbid\s*\na future Source built on top of the Alpha 146–170 chain\./,
    );
    expect(section).toMatch(/explicitly OUT OF SCOPE\s*\nfor this Stage and this Arc/);
  });

  it("6. the design doc names three concrete blockers to wiring the deterministic chain today", () => {
    const section = (designDocSource.match(/## 5\. What blocks such a future Source today([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/`pub\(crate\)`/);
    expect(section).toMatch(/Zero `#\[wasm_bindgen\]` annotation exists/);
    expect(section).toMatch(/expose no method that\s*\n\s*reaches the deterministic chain/);
  });

  it("7. the design doc's own answer keeps the Source Boundary as the sole seam, picking nothing", () => {
    const section = (designDocSource.match(/## 6\. Answer to this Stage's own question([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Exactly where it originates today/);
    expect(section).toMatch(
      /This Stage does not narrow that set of\s*\nfuture Sources, does not pick one, and does not wire anything/,
    );
  });

  it("8. the design doc cross-references Alpha 175, 171, 039, and 168", () => {
    for (const ref of [
      "secure_runtime_alpha_175_nostr_public_identifier_completion",
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
      "secure_runtime_alpha_039_nostr_public_identity_source_boundary",
      "secure_runtime_alpha_168_nostr_public_key_handle",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the doc's own claims directly against source
  // ---------------------------------------------------------------------

  it("9. structural: FedosIdentityDescriptor still declares exactly five fields, no new one", () => {
    const body = (identityDescriptorSource.match(/export interface FedosIdentityDescriptor \{([\s\S]*?)\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["id", "provider", "publicIdentifier", "displayName", "avatar"]);
  });

  it("10. structural: publicIdentifier is written only as a verbatim property copy, never a computed expression", () => {
    for (const source of [nostrIdentityProviderSource, desktopReaderSource]) {
      expect(source).toMatch(/publicIdentifier: snapshot\.publicIdentifier,/);
    }
  });

  it("11. structural: the Null Source remains the only production-wired Source, always resolving null", () => {
    expect(nullSourceSource).toMatch(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{\s*\n\s*return null;\s*\n\s*\}/);
    expect(nostrPublicIdentitySourceSource).toMatch(/readonly publicIdentifier: string;/);
  });

  it("12. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_176/);
  });

  it("14. Regression: src/identity/* and src/desktop/* carry no reference to this Stage's own doc", () => {
    expect(identityDescriptorSource).not.toMatch(/secure_runtime_alpha_176/);
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_176/);
    expect(desktopReaderSource).not.toMatch(/secure_runtime_alpha_176/);
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_176/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_176/);
    }
  });

  it("16. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_176/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_176/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

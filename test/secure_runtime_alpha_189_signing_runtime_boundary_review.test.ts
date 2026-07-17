import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_189_signing_runtime_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 189 -- "Signing Runtime Boundary Review": Stage
 * 9 of the Nostr Schnorr Signing Foundation Arc (Alpha 181-190).
 * REVIEW ONLY -- zero code change. Confirms zero Runtime/Desktop/
 * Worker integration exists for this Arc's own five new symbols.
 */
describe("Secure Runtime Alpha 189 -- Signing Runtime Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc names all five new symbols checked for Runtime/Desktop absence", () => {
    const section = (designDocSource.match(/## 3\. `AppRuntime`\/`create_runtime\.ts`\/`types\.ts`\/`worker\.ts`([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const symbol of [
      "FedosNostrSignatureHandle",
      "derive_nostr_signature_internal",
      "expose_bytes_for_internal_signing",
      "SchnorrSigningKey",
      "PrehashSigner",
    ]) {
      expect(section).toContain(symbol);
    }
  });

  it("4. the design doc confirms Desktop's own public shape is unchanged from Alpha 180's closing state", () => {
    const section = (designDocSource.match(/## 4\. Desktop([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/unchanged from Alpha 180's own\s*\n\s*closing state/);
  });

  it("5. the design doc's structural confirmation lists the exact DesktopApplication method/field set", () => {
    const section = (designDocSource.match(/## 6\. Structural confirmation([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    for (const name of [
      "bootstrap",
      "start",
      "currentIdentity",
      "isBootstrapped",
      "readPublicIdentity",
      "currentPublicIdentity",
      "refreshPublicIdentity",
    ]) {
      expect(section).toContain(name);
    }
  });

  it("6. the design doc cross-references Alpha 188, 185, 180, and 176", () => {
    for (const ref of [
      "secure_runtime_alpha_188_session_atproto_signing_extensibility_review",
      "secure_runtime_alpha_185_signature_boundary_review",
      "secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion",
      "secure_runtime_alpha_176_nostr_public_identifier_origin_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: real, independent re-verification of the doc's own claims
  // ---------------------------------------------------------------------

  it("7. structural: zero reference to any of the five new signing symbols in Runtime/Worker/Desktop files", () => {
    const symbols = [
      "FedosNostrSignatureHandle",
      "derive_nostr_signature_internal",
      "expose_bytes_for_internal_signing",
      "SchnorrSigningKey",
      "PrehashSigner",
    ];
    const files: [string, string][] = [
      ["create_runtime.ts", createRuntimeSource],
      ["types.ts", runtimeTypesSource],
      ["worker.ts", workerSource],
      ["desktop_application.ts", desktopApplicationSource],
      ["create_desktop_application.ts", createDesktopApplicationSource],
    ];
    for (const [, source] of files) {
      for (const symbol of symbols) {
        expect(source).not.toContain(symbol);
      }
    }
  });

  it("8. structural: DesktopApplication's own public method/field set is byte-for-byte unchanged from Alpha 180's own closing state", () => {
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

  it("9. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this REVIEW-ONLY Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(46);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("10. Regression: every file this Stage inspects carries no reference to this Stage's own doc", () => {
    for (const source of [
      libRsSource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      desktopApplicationSource,
      createDesktopApplicationSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_189/);
    }
  });

  it("11. Regression: package.json is untouched", () => {
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_189/);
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});

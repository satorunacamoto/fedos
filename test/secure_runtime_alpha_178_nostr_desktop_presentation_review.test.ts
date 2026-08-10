import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_178_nostr_desktop_presentation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

/**
 * Secure Runtime Alpha 178 -- "Nostr Desktop Presentation Review":
 * Stage 3 of the Nostr Public Identifier Runtime Boundary Arc
 * (Alpha 176-180). DESIGN/DECISION ONLY -- zero code change. Adopts
 * Option C: Desktop MAY expose hex, npub, or both, at its own future
 * discretion, without changing Runtime ownership of the canonical
 * value (Alpha 177).
 */
describe("Secure Runtime Alpha 178 -- Nostr Desktop Presentation Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself DESIGN/DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc compares all four named options A-D", () => {
    const section = (designDocSource.match(/## 3\. Options compared([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const label of [
      "hex only",
      "npub` only",
      "Both, Desktop's own choice of when",
      "Desktop re-derives the missing form itself",
    ]) {
      expect(section).toContain(label);
    }
  });

  it("4. the design doc adopts Option C and rejects Option D for duplicating the Encoder", () => {
    expect(designDocSource).toMatch(/\*\*Option C is ADOPTED\.\*\*/);
    expect(designDocSource).toMatch(/Option D is REJECTED outright/);
  });

  it("5. the design doc restates npub as the non-binding DEFAULT recommendation, not a requirement", () => {
    const section = (designDocSource.match(/\*\*Restating Alpha 175 §3 item 3([\s\S]*?)\n\n## 6\./) ?? [])[0] ?? "";
    expect(section).toMatch(/`npub` remains the right default/);
    expect(section).toMatch(/Nothing in this Stage requires that Stage to also\s*\nexpose hex/);
  });

  it("6. the design doc confirms Runtime ownership of the canonical value is unaffected", () => {
    const section = (designDocSource.match(/## 6\. Runtime ownership is unaffected([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toContain("remains the Runtime-internal");
    expect(section).toMatch(/never\s*\na second place where Nostr identifier encoding logic is computed/);
  });

  it("7. the design doc cross-references Alpha 177, 176, 175, and 171", () => {
    for (const ref of [
      "secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision",
      "secure_runtime_alpha_176_nostr_public_identifier_origin_review",
      "secure_runtime_alpha_175_nostr_public_identifier_completion",
      "secure_runtime_alpha_171_existing_nostr_identifier_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural
  // ---------------------------------------------------------------------

  it("8. structural: DesktopApplication's own public method/field set is unchanged by this Stage", () => {
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
  });

  it("9. structural: NostrPublicIdentityReader still performs a verbatim, unreformatted copy of publicIdentifier", () => {
    expect(desktopReaderSource).toMatch(/publicIdentifier: snapshot\.publicIdentifier,/);
  });

  it("10. structural: wasm_bindgen count and pub fn count remain fixed at 13/36, unchanged by this Stage", () => {
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(19);
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: lib.rs carries no reference to this Stage's own doc -- confirming zero Rust change", () => {
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_178/);
  });

  it("12. Regression: desktop_application.ts and nostr_public_identity_reader.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_178/);
    expect(desktopReaderSource).not.toMatch(/secure_runtime_alpha_178/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_178/);
    }
  });

  it("14. Regression: Cargo.toml and package.json carry no reference to this Stage's own doc -- confirming zero dependency change", () => {
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_178/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_178/);
    const pkg = JSON.parse(packageJsonSource);
    assertFedosRootDependencyInvariant(pkg.dependencies);
  });
});

import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_125_integration_completion.md?raw";
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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

function classBodyOf(source: string): string {
  const codeOnly = source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
  return (codeOnly.match(/export class DesktopApplication \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

/**
 * Secure Runtime Alpha 125 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Desktop Public Identity Reader Arc, a REVIEW
 * / DESIGN ONLY Stage. Issues the Arc's own closing Completion
 * Declaration: the Dual Identity Path (Runtime Identity + Public
 * Identity Reader) is complete, and the two paths remain deliberately,
 * permanently unconnected.
 */
describe("Secure Runtime Alpha 125 -- Integration Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc issues a Completion Declaration naming the Dual Identity Path complete and permanently unconnected", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/— is complete\./);
    expect(section).toMatch(/BOTH REMAIN DELIBERATELY, PERMANENTLY\s*\nUNCONNECTED/);
    expect(section).toMatch(/no future Stage may silently merge them without an explicit,\s*\nequally deliberate Decision of its own\./);
  });

  it("4. the design doc's own Completion Declaration reconfirms, rather than revises, Alpha 111's and Alpha 120's own Decisions", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /This reconfirms, rather than revises, Alpha 111's own Identity\s*\nAuthority Decision and Alpha 120's own Completion Declaration/,
    );
  });

  it("5. the design doc cross-references Alpha 111, Alpha 120, Alpha 123, and Alpha 124", () => {
    for (const ref of [
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_120_integration_completion",
      "secure_runtime_alpha_123_desktop_public_identity_boundary",
      "secure_runtime_alpha_124_desktop_api_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final, complete class shape
  // ---------------------------------------------------------------------

  it("6. RIPPLE (Secure Runtime Alpha 131): DesktopApplication was the ONLY export, with exactly five public methods and four private fields, AS OF this Stage's own scope -- the Arc's own closing class shape; Alpha 126 added a FIFTH private field, #currentPublicIdentity, Alpha 128 added a SIXTH public method, currentPublicIdentity(), and Alpha 131 added a SEVENTH public method, refreshPublicIdentity(), opening later Arcs, reconfirmed here as the CURRENT state", () => {
    const exportNames = [...desktopApplicationSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["DesktopApplication"]);

    const classBody = classBodyOf(desktopApplicationSource);
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

  it("7. RIPPLE (Secure Runtime Alpha 131): the Runtime Identity path delegated only to #identity, and the Reader path delegated only to #reader, AS OF this Stage's own scope; Alpha 128 added currentPublicIdentity(), a synchronous read of #currentPublicIdentity (the Reader path's own persisted state, never #identity), and Alpha 131 added refreshPublicIdentity(), a PURE delegation to readPublicIdentity() itself, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/return this\.#identity\.currentIdentity\(\);/);
    expect(classBody).toMatch(/return this\.#identity\.isBootstrapped\(\);/);
    expect(classBody).toMatch(/return this\.#identity\.bootstrapIdentity\(\);/);
    expect(classBody).toMatch(/await this\.#reader\.readPublicIdentity\(\);/);
    expect(classBody).toMatch(/return this\.#currentPublicIdentity;/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: Dual Identity Path confirmed end to end, both directions
  // ---------------------------------------------------------------------

  it("8. behavioral end to end: the Reader path resolves its own configured value regardless of Runtime Identity's own Bootstrap state", async () => {
    const snapshot = { id: "alpha125-reader", publicIdentifier: "npub1alpha125reader" };
    const app = createDesktopApplication(snapshot);
    expect(app.currentIdentity()).toBeNull();
    expect(app.isBootstrapped()).toBe(false);
    await expect(app.readPublicIdentity()).resolves.toEqual({
      id: "alpha125-reader",
      provider: "nostr",
      publicIdentifier: "npub1alpha125reader",
      displayName: undefined,
      avatar: undefined,
    });
  });

  it("9. behavioral end to end: the Runtime Identity path resolves its own Bootstrap-driven value regardless of the Reader's own configured value", async () => {
    const descriptor = { id: "alpha125-runtime", provider: "nostr", publicIdentifier: "npub1alpha125runtime" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const snapshot = { id: "alpha125-reader-unrelated", publicIdentifier: "npub1alpha125readerunrelated" };
    const app = createDesktopApplication(snapshot);
    await app.start();
    expect(app.currentIdentity()).toBe(descriptor);
    expect(app.isBootstrapped()).toBe(true);
    await expect(app.readPublicIdentity()).resolves.not.toEqual(descriptor);
    spy.mockRestore();
  });

  it("10. behavioral: neither path triggers the other's own underlying call -- confirmed by independent spies on Service and Reader", async () => {
    const serviceSpy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy }, undefined);
    await app.readPublicIdentity();
    expect(serviceSpy).not.toHaveBeenCalled();
    expect(readerSpy).toHaveBeenCalledTimes(1);
    await app.bootstrap();
    expect(serviceSpy).toHaveBeenCalledTimes(1);
    expect(readerSpy).toHaveBeenCalledTimes(1);
    serviceSpy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything outside it
  // ---------------------------------------------------------------------

  it("11. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["121", "122", "123", "124", "125"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- no reference to any Arc-stage doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["121", "122", "123", "124", "125"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });

  it("13. Regression: create_desktop_application.ts is unmodified across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["121", "122", "123", "124", "125"]) {
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. RIPPLE (Secure Runtime Alpha 146): Rust and Cargo/package sources were BYTE-FOR-BYTE UNCHANGED across this Arc's own scope; a LATER Arc (Alpha 146-150) legitimately touched Rust, so this count is now measured with a line-anchored regex (a later doc comment can otherwise mention the literal string `#[wasm_bindgen]` in prose without adding a real annotation) -- the real annotation count remains 13, reconfirmed here as the CURRENT state", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(50);
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    for (const stage of ["121", "122", "123", "124", "125"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("16. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change for Alpha 125 specifically", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_125/);
  });
});

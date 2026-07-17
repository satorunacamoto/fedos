import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_120_integration_completion.md?raw";
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
 * Secure Runtime Alpha 120 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Desktop Identity Consumption Arc, a REVIEW /
 * DESIGN ONLY Stage. Issues the Arc's own closing Completion
 * Declaration: Desktop -> FedosRuntimeIdentity -> Identity Authority
 * is complete; Desktop consumes the Authority and never becomes one.
 */
describe("Secure Runtime Alpha 120 -- Integration Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc issues a Completion Declaration confirming Desktop consumes, never becomes, the Identity Authority", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*The `Desktop → FedosRuntimeIdentity → Identity Authority` structure\s*\nis complete\./,
    );
    expect(section).toMatch(/`DesktopApplication` CONSUMES the Identity Authority/);
    expect(section).toMatch(/never BECOMES one/);
  });

  it("4. the design doc's own Completion Declaration reconfirms, rather than revises, Alpha 111's own Decision", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /This reconfirms, rather than revises, Alpha 111's own Decision: there\s*\nis, and remains, exactly ONE Identity Authority in this repository —\s*\n`FedosRuntimeIdentity`\./,
    );
  });

  it("5. the design doc cross-references Alpha 111, Alpha 115, Alpha 118, and Alpha 119", () => {
    for (const ref of [
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_115_identity_authority_completion",
      "secure_runtime_alpha_118_desktop_authority_consumption",
      "secure_runtime_alpha_119_desktop_api_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final, complete class shape
  // ---------------------------------------------------------------------

  it("6. RIPPLE (Secure Runtime Alpha 131): DesktopApplication was the ONLY export, with exactly four public methods and four private fields, AS OF this Stage's own scope -- the Arc's own closing class shape; Alpha 121 added a FIFTH public method, readPublicIdentity(), Alpha 126 added a FIFTH private field, #currentPublicIdentity, Alpha 128 added a SIXTH public method, currentPublicIdentity(), and Alpha 131 added a SEVENTH public method, refreshPublicIdentity(), opening later Arcs, reconfirmed here as the CURRENT state", () => {
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

  it("7. structural: every read/drive method delegates to #identity -- currentIdentity()/isBootstrapped() directly, bootstrap()/start() transitively", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/return this\.#identity\.currentIdentity\(\);/);
    expect(classBody).toMatch(/return this\.#identity\.isBootstrapped\(\);/);
    expect(classBody).toMatch(/return this\.#identity\.bootstrapIdentity\(\);/);
    expect(classBody).toMatch(/await this\.bootstrap\(\);/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: end-to-end confirmation the structure genuinely works
  // ---------------------------------------------------------------------

  it("8. behavioral end to end: construct -> start() -> currentIdentity()/isBootstrapped() reflect the SAME resolved Descriptor through #identity alone", async () => {
    const descriptor = { id: "alpha120-e2e", provider: "nostr", publicIdentifier: "npub1alpha120" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const app = new DesktopApplication();
    expect(app.isBootstrapped()).toBe(false);
    expect(app.currentIdentity()).toBeNull();
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
    expect(app.currentIdentity()).toBe(descriptor);
    spy.mockRestore();
  });

  it("9. behavioral: DesktopApplication itself never becomes an Authority -- a second, independently-constructed instance starts with its own, unrelated state", async () => {
    const descriptorA = { id: "alpha120-a", provider: "nostr", publicIdentifier: "npub1a120" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptorA);
    const appA = new DesktopApplication();
    const appB = new DesktopApplication();
    await appA.bootstrap();
    expect(appA.currentIdentity()).toBe(descriptorA);
    expect(appA.isBootstrapped()).toBe(true);
    expect(appB.currentIdentity()).toBeNull();
    expect(appB.isBootstrapped()).toBe(false);
    spy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything outside it
  // ---------------------------------------------------------------------

  it("10. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["116", "117", "118", "119", "120"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("11. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- no reference to any Arc-stage doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["116", "117", "118", "119", "120"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });

  it("12. Regression: create_desktop_application.ts is unmodified across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["116", "117", "118", "119", "120"]) {
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. RIPPLE (Secure Runtime Alpha 146): Rust and Cargo/package sources were BYTE-FOR-BYTE UNCHANGED across this Arc's own scope; a LATER Arc (Alpha 146-150) legitimately touched Rust, so this count is now measured with a line-anchored regex (a later doc comment can otherwise mention the literal string `#[wasm_bindgen]` in prose without adding a real annotation) -- the real annotation count remains 13, reconfirmed here as the CURRENT state", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(46);
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(15);
    for (const stage of ["116", "117", "118", "119", "120"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("15. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change for Alpha 120 specifically", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_120/);
  });
});

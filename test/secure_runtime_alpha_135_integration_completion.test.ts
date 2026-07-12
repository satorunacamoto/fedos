import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_135_integration_completion.md?raw";
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
 * Secure Runtime Alpha 135 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Desktop Public Identity Refresh Arc, a REVIEW
 * / DESIGN ONLY Stage. Issues the Arc's own closing Completion
 * Declaration: the four-layer structure (Runtime Identity / Public
 * Identity Reader / Public Identity State / Public Identity Refresh)
 * is complete, with Refresh permanently independent of Runtime
 * Identity.
 */
describe("Secure Runtime Alpha 135 -- Integration Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc issues a Completion Declaration naming the four-layer structure complete and Refresh permanently independent", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/— is complete\./);
    expect(section).toMatch(/It is, and\s*\nremains, PERMANENTLY INDEPENDENT of Runtime Identity/);
  });

  it("4. the design doc's own Completion Declaration reconfirms, rather than revises, Alpha 111's and Alpha 130's own Decisions", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /This reconfirms, rather than revises, Alpha 111's own Identity\s*\nAuthority Decision and Alpha 130's own Completion Declaration/,
    );
  });

  it("5. the design doc cross-references Alpha 111, Alpha 130, Alpha 133, and Alpha 134", () => {
    for (const ref of [
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_130_integration_completion",
      "secure_runtime_alpha_133_refresh_state_verification",
      "secure_runtime_alpha_134_desktop_refresh_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final, complete class shape
  // ---------------------------------------------------------------------

  it("6. structural: DesktopApplication is the ONLY export, with exactly seven public methods and five private fields", () => {
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

  it("7. structural: refreshPublicIdentity() introduces no new field -- the class still has exactly five private fields, none named for Refresh", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1] ?? "");
    expect(fieldNames.length).toBe(5);
    expect(fieldNames.some((name: string) => name.toLowerCase().includes("refresh"))).toBe(false);
  });

  it("8. structural: all four layers' own delegation points are present and correctly wired", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/return this\.#identity\.currentIdentity\(\);/);
    expect(classBody).toMatch(/return this\.#identity\.isBootstrapped\(\);/);
    expect(classBody).toMatch(/await this\.#reader\.readPublicIdentity\(\);/);
    expect(classBody).toMatch(/return this\.#currentPublicIdentity;/);
    expect(classBody).toMatch(/return this\.readPublicIdentity\(\);/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: four-layer structure confirmed end to end
  // ---------------------------------------------------------------------

  it("9. behavioral end to end: refreshPublicIdentity() drives both the Reader layer and the State layer, leaving Runtime Identity and Bootstrap untouched", async () => {
    const snapshot = { id: "alpha135-refresh", publicIdentifier: "npub1alpha135refresh" };
    const app = createDesktopApplication(snapshot);
    expect(app.currentPublicIdentity()).toBeNull();
    const resolved = await app.refreshPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(resolved);
    expect(app.currentIdentity()).toBeNull();
    expect(app.isBootstrapped()).toBe(false);
  });

  it("10. behavioral end to end: all four layers coexist independently on one instance -- Runtime Identity via start(), Public Identity via refreshPublicIdentity()", async () => {
    const descriptor = { id: "alpha135-coexist-runtime", provider: "nostr", publicIdentifier: "npub1alpha135coexistruntime" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const snapshot = { id: "alpha135-coexist-public", publicIdentifier: "npub1alpha135coexistpublic" };
    const app = new DesktopApplication({ readPublicIdentity: vi.fn().mockResolvedValue(snapshot) }, undefined);
    await app.start();
    await app.refreshPublicIdentity();
    expect(app.currentIdentity()).toBe(descriptor);
    expect(app.isBootstrapped()).toBe(true);
    expect(app.currentPublicIdentity()).toEqual(snapshot);
    expect(app.currentIdentity()).not.toEqual(app.currentPublicIdentity());
    spy.mockRestore();
  });

  it("11. behavioral: refreshPublicIdentity() and readPublicIdentity() are behaviorally interchangeable -- both drive the same State update", async () => {
    const descriptor = { id: "alpha135-interchangeable", provider: "nostr", publicIdentifier: "npub1alpha135interchangeable" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const appA = new DesktopApplication(customReader);
    const appB = new DesktopApplication(customReader);
    await appA.readPublicIdentity();
    await appB.refreshPublicIdentity();
    expect(appA.currentPublicIdentity()).toEqual(appB.currentPublicIdentity());
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything outside it
  // ---------------------------------------------------------------------

  it("12. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["131", "132", "133", "134", "135"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- no reference to any Arc-stage doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["131", "132", "133", "134", "135"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });

  it("14. Regression: create_desktop_application.ts is unmodified across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["131", "132", "133", "134", "135"]) {
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    const wasmBindgenCount = [...libRsSource.matchAll(/#\[wasm_bindgen\]/g)].length;
    expect(wasmBindgenCount).toBe(13);
    for (const stage of ["131", "132", "133", "134", "135"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("16. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("17. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change for Alpha 135 specifically", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_135/);
  });
});

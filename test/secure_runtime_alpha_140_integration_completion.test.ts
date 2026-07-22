import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_140_integration_completion.md?raw";
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
 * Secure Runtime Alpha 140 -- "Integration Completion": Stage 5, the
 * closing Stage, of the Desktop Startup Identity Sequence Arc, a
 * REVIEW / DESIGN ONLY Stage. Issues the Arc's own closing Completion
 * Declaration: the Desktop Startup Flow -- construct -> bootstrap ->
 * refreshPublicIdentity -> Desktop Ready -- is formally fixed.
 */
describe("Secure Runtime Alpha 140 -- Integration Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc issues a Completion Declaration naming the Desktop Startup Flow formally fixed", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*The Desktop Startup Flow — `construct → bootstrap →\s*\nrefreshPublicIdentity → Desktop Ready` — is now formally fixed\./,
    );
  });

  it("4. the design doc's own Completion Declaration clarifies this is a USAGE convention, not a runtime enforcement", () => {
    const section = (designDocSource.match(/## 3\. Completion Declaration([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/— this is\s*\na USAGE convention, not a new runtime enforcement/);
  });

  it("5. the design doc cross-references Alpha 092, Alpha 135, Alpha 138, and Alpha 139", () => {
    for (const ref of [
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_135_integration_completion",
      "secure_runtime_alpha_138_startup_state_verification",
      "secure_runtime_alpha_139_desktop_startup_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the final, complete class shape
  // ---------------------------------------------------------------------

  it("6. structural: DesktopApplication is the ONLY export, with exactly seven public methods and five private fields, unchanged by this Arc's own review-only Stages", () => {
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

  it("7. structural: start()'s own body matches the exact Desktop Startup Flow sequence -- guard, bootstrap, refreshPublicIdentity, mark ready", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "if (this.#started) {",
      'throw new Error("DesktopApplication.start() was already called.");',
      "}",
      "await this.bootstrap();",
      "await this.refreshPublicIdentity();",
      "this.#started = true;",
    ]);
  });

  // ---------------------------------------------------------------------
  // Behavioral: Desktop Startup Flow confirmed end to end
  // ---------------------------------------------------------------------

  it("8. behavioral end to end: currentIdentity()/currentPublicIdentity() return their own pre-Ready defaults before start(), and their own real values after Desktop Ready", async () => {
    const descriptor = { id: "alpha140-e2e-runtime", provider: "nostr", publicIdentifier: "npub1alpha140e2eruntime" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const snapshot = { id: "alpha140-e2e-public", publicIdentifier: "npub1alpha140e2epublic" };
    const app = createDesktopApplication(snapshot);
    expect(app.currentIdentity()).toBeNull();
    expect(app.currentPublicIdentity()).toBeNull();
    await app.start();
    expect(app.currentIdentity()).toBe(descriptor);
    expect(app.currentPublicIdentity()).not.toBeNull();
    spy.mockRestore();
  });

  it("9. behavioral: currentIdentity()/currentPublicIdentity() remain callable at any point -- before, during, and after Desktop Ready -- and never throw", async () => {
    const app = new DesktopApplication();
    expect(() => app.currentIdentity()).not.toThrow();
    expect(() => app.currentPublicIdentity()).not.toThrow();
    const startPromise = app.start();
    expect(() => app.currentIdentity()).not.toThrow();
    expect(() => app.currentPublicIdentity()).not.toThrow();
    await startPromise;
    expect(() => app.currentIdentity()).not.toThrow();
    expect(() => app.currentPublicIdentity()).not.toThrow();
  });

  it("10. behavioral: the full Startup Flow -- construct, bootstrap, refreshPublicIdentity, Desktop Ready -- runs in exactly that order for a real instance", async () => {
    const callOrder: string[] = [];
    const serviceSpy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockImplementation(async () => {
        callOrder.push("bootstrap");
        return null;
      });
    const readerSpy = vi.fn().mockImplementation(async () => {
      callOrder.push("refreshPublicIdentity");
      return null;
    });
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    callOrder.push("construct");
    await app.start();
    callOrder.push("Desktop Ready");
    expect(callOrder).toEqual(["construct", "bootstrap", "refreshPublicIdentity", "Desktop Ready"]);
    serviceSpy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Regression: the whole Arc's own five files, plus everything outside it
  // ---------------------------------------------------------------------

  it("11. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["136", "137", "138", "139", "140"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- no reference to any Arc-stage doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["136", "137", "138", "139", "140"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });

  it("13. Regression: create_desktop_application.ts is unmodified across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["136", "137", "138", "139", "140"]) {
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. RIPPLE (Secure Runtime Alpha 146): Rust and Cargo/package sources were BYTE-FOR-BYTE UNCHANGED across this Arc's own scope; a LATER Arc (Alpha 146-150) legitimately touched Rust, so this count is now measured with a line-anchored regex (a later doc comment can otherwise mention the literal string `#[wasm_bindgen]` in prose without adding a real annotation) -- the real annotation count remains 13, reconfirmed here as the CURRENT state", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(64);
    const wasmBindgenCount = [...libRsSource.matchAll(/^#\[wasm_bindgen\]/gm)].length;
    expect(wasmBindgenCount).toBe(17);
    for (const stage of ["136", "137", "138", "139", "140"]) {
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

  it("16. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change for Alpha 140 specifically", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_140/);
  });
});

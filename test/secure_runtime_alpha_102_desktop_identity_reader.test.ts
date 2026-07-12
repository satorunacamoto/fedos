import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_102_desktop_identity_reader.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha101DocSource from "../docs/secure_runtime_alpha_101_public_identity_reader_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerInterfaceSource from "../src/desktop/fedos_public_identity_reader.ts?raw";
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
 * Secure Runtime Alpha 102 -- "Desktop Identity Reader": Stage 2 of
 * the Public Identity Source Foundation Arc, a REVIEW / DESIGN ONLY
 * Stage. Fixes that a future FedosPublicIdentityReader is permanently
 * owned by DesktopApplication, never by FedosRuntimeIdentity. Adds a
 * single header-comment paragraph to desktop_application.ts -- no
 * field, no method, no constructor change.
 */
describe("Secure Runtime Alpha 102 -- Desktop Identity Reader", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- DesktopApplication permanently owns the Reader, never FedosRuntimeIdentity", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*A future `FedosPublicIdentityReader` instance is PERMANENTLY owned\s*\nby `DesktopApplication` alone\. `FedosRuntimeIdentity` must NEVER hold\s*\none, in any future implementation, for any purpose\.\*\*/,
    );
  });

  it("4. the design doc's own rationale section cites Alpha 093's Ownership Decision and the argument-free constructor", () => {
    const section = (designDocSource.match(/## 4\. Why NOT `FedosRuntimeIdentity`([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Alpha 093's own Ownership Decision\*\*/);
    expect(section).toMatch(/\*\*`FedosRuntimeIdentity`'s own constructor is deliberately\s*\n\s*argument-free\*\*/);
    expect(section).toMatch(/\*\*Desktop already owns everything a Reader would need\.\*\*/);
  });

  it("5. the design doc's own 'does NOT do' list confirms no #reader field or constructor change is added yet", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a `#reader` field, constructor parameter, or any\s*\n\s*other structural change to `DesktopApplication`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement `FedosPublicIdentityReader` in any way/);
  });

  it("6. the design doc cross-references Alpha 093, Alpha 096, and Alpha 101", () => {
    for (const ref of [
      "secure_runtime_alpha_093_ownership_review",
      "secure_runtime_alpha_096_desktop_shell_skeleton",
      "secure_runtime_alpha_101_public_identity_reader_interface",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha101DocSource.length).toBeGreaterThan(0);
  });

  it("7. RIPPLE (Secure Runtime Alpha 103): the header comment recorded the Alpha 102 Decision AS OF this Stage's own scope; Alpha 103 rewrapped the 'PERMANENTLY owned' phrase into its own guardrail bullet, reconfirmed here as the CURRENT state", () => {
    expect(desktopApplicationSource).toMatch(/Secure Runtime Alpha 102 \("Desktop Identity Reader", review\/design/);
    expect(desktopApplicationSource).toMatch(/PERMANENTLY owned by `DesktopApplication`\s*\n\s*\*\s*alone/);
  });

  it("8. RIPPLE (Secure Runtime Alpha 107): DesktopApplication's own class shape was BYTE-FOR-BYTE unchanged from Alpha 098 AS OF this Stage's own scope -- exactly two fields, two public methods, and a one-statement constructor; Alpha 103 added #reader and Alpha 107 added #publicIdentity, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started"]);

    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(new Set(["bootstrap", "start"]));

    const ctorBody = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const ctorLines = ctorBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(ctorLines).toEqual([
      "this.#identity = new FedosRuntimeIdentity();",
      "this.#reader = reader;",
      "this.#publicIdentity = publicIdentity;",
    ]);
  });

  it("9. RIPPLE (Secure Runtime Alpha 103): DesktopApplication's own code contained no reference to FedosPublicIdentityReader outside the header comment AS OF this Stage's own scope; Alpha 103 legitimately added #reader and a real reference, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/FedosPublicIdentityReader/);
    expect(classBody).toMatch(/#reader/);
  });

  it("10. Regression: fedos_public_identity_reader.ts and create_desktop_application.ts are unmodified -- no reference to this Stage's own doc", () => {
    expect(readerInterfaceSource).not.toMatch(/secure_runtime_alpha_102/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_102/);
    expect(createDesktopApplicationSource).not.toMatch(/FedosPublicIdentityReader/);
  });

  it("11. Regression: fedos_runtime_identity.ts is unmodified -- no reference to this Stage's own doc or to any Reader concept", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_102/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/FedosPublicIdentityReader|PublicIdentityReader/);
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to any Reader concept", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_102/);
      expect(source).not.toMatch(/FedosPublicIdentityReader/);
    }
  });
});

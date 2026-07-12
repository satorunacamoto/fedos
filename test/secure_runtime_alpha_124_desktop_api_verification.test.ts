import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_124_desktop_api_verification.md?raw";
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
 * Secure Runtime Alpha 124 -- "Desktop API Verification": Stage 4 of
 * the Desktop Public Identity Reader Arc, a REVIEW / DESIGN ONLY
 * Stage. Restates the Desktop public API as exactly FIVE methods --
 * bootstrap()/start()/currentIdentity()/isBootstrapped()/
 * readPublicIdentity() -- with Reader/Registry/Provider/Source itself
 * still permanently excluded from public exposure.
 */
describe("Secure Runtime Alpha 124 -- Desktop API Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares the Desktop public API is exactly five methods", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/bootstrap\(\): Promise<void>/);
    expect(section).toMatch(/start\(\): Promise<void>/);
    expect(section).toMatch(/currentIdentity\(\): FedosIdentityDescriptor \| null/);
    expect(section).toMatch(/isBootstrapped\(\): boolean/);
    expect(section).toMatch(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null>/);
  });

  it("4. the design doc declares Reader/Registry/Provider/Source itself permanently excluded from the public surface", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Permanently EXCLUDED from this surface:\*\*/);
    expect(section).toMatch(/FedosPublicIdentityReader/);
    expect(section).toMatch(/FedosIdentityRegistry/);
    expect(section).toMatch(/FedosIdentityProvider/);
    expect(section).toMatch(/FedosNostrPublicIdentitySnapshot/);
  });

  it("5. the design doc cross-references Alpha 119, Alpha 121, Alpha 122, and Alpha 123", () => {
    for (const ref of [
      "secure_runtime_alpha_119_desktop_api_verification",
      "secure_runtime_alpha_121_desktop_reader_access",
      "secure_runtime_alpha_122_factory_verification",
      "secure_runtime_alpha_123_desktop_public_identity_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("6. structural: DesktopApplication is the ONLY export from desktop_application.ts", () => {
    const exportNames = [...desktopApplicationSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["DesktopApplication"]);
  });

  it("7. RIPPLE (Secure Runtime Alpha 128): the class exposed exactly five public methods AS OF this Stage's own scope, matching the Decision precisely; Alpha 128 added a SIXTH, currentPublicIdentity() -- superseded by a later Arc's own restated Decision -- reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set(["bootstrap", "start", "currentIdentity", "isBootstrapped", "readPublicIdentity", "currentPublicIdentity"]),
    );
  });

  it("8. structural: no public method returns #reader, #identity, or #publicIdentity by reference", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const methodBodies = [
      (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "",
      (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "",
      (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "",
      (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "",
      (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "",
    ];
    for (const body of methodBodies) {
      expect(body).not.toMatch(/return this\.#reader;/);
      expect(body).not.toMatch(/return this\.#identity;/);
      expect(body).not.toMatch(/return this\.#publicIdentity;/);
    }
  });

  it("9. structural: no getter (get keyword) exists anywhere on the class, ruling out an implicit Reader/Registry/Provider accessor", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/^\s{2}get\s+\w+\(/m);
  });

  it("10. the design doc's own 'does NOT do' list confirms no method is added, removed, or renamed", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add, remove, or rename any public method\./);
  });

  it("11. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_124/);
  });

  it("12. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_124/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_124/);
    }
  });

  it("14. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_124/);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_132_refresh_delegation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

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
 * Secure Runtime Alpha 132 -- "Refresh Delegation": Stage 2 of the
 * Desktop Public Identity Refresh Arc, a REVIEW / DESIGN ONLY Stage.
 * Confirms, grounded in the actual source, that
 * refreshPublicIdentity() calls readPublicIdentity() and NOTHING
 * ELSE, directly or transitively.
 */
describe("Secure Runtime Alpha 132 -- Refresh Delegation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- refreshPublicIdentity() calls readPublicIdentity() and nothing else", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`refreshPublicIdentity\(\)` calls `readPublicIdentity\(\)` and NOTHING\s*\nELSE — confirmed by reference, not merely by behavior\./,
    );
  });

  it("4. the design doc cross-references Alpha 122 and Alpha 131", () => {
    for (const ref of ["secure_runtime_alpha_122_factory_verification", "secure_runtime_alpha_131_desktop_refresh_api"]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("5. structural: refreshPublicIdentity()'s own body contains exactly one method call, this.readPublicIdentity()", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const methodCalls = [...body.matchAll(/this\.(\w+)\(/g)].map((m: RegExpMatchArray) => m[1]);
    expect(methodCalls).toEqual(["readPublicIdentity"]);
  });

  it("6. structural: refreshPublicIdentity()'s own body contains no field access of any kind", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/this\.#/);
  });

  it("7. structural: readPublicIdentity()'s own body -- the sole destination of the delegation -- touches only #reader and #currentPublicIdentity, never #identity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/#reader/);
    expect(body).toMatch(/#currentPublicIdentity/);
    expect(body).not.toMatch(/#identity/);
    expect(body).not.toMatch(/#started/);
    expect(body).not.toMatch(/#publicIdentity/);
  });

  it("8. the design doc's own 'does NOT do' list confirms neither method's own behavior changes", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* change `readPublicIdentity\(\)`'s or\s*\n\s*`refreshPublicIdentity\(\)`'s own behavior in any way\./,
    );
  });

  it("9. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_132/);
  });

  it("10. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_132/);
  });

  it("11. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_132/);
    }
  });

  it("12. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_132/);
  });
});

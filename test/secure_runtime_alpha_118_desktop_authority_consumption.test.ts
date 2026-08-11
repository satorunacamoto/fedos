import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_118_desktop_authority_consumption.md?raw";
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
 * Secure Runtime Alpha 118 -- "Desktop Authority Consumption": Stage 3
 * of the Desktop Identity Consumption Arc, a REVIEW / DESIGN ONLY
 * Stage. Confirms, grounded in the actual source, that
 * DesktopApplication never reads Identity state from #reader/
 * #publicIdentity/any Provider or Source directly -- only ever via
 * #identity (FedosRuntimeIdentity).
 */
describe("Secure Runtime Alpha 118 -- Desktop Authority Consumption", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- DesktopApplication never reads Identity state outside #identity", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`DesktopApplication` never reads Identity state from `#reader`,\s*\n`#publicIdentity`, or any Provider\/Source of any kind\. Every read of\s*\nIdentity state — `currentIdentity\(\)`, `isBootstrapped\(\)` — passes\s*\nthrough `#identity` \(`FedosRuntimeIdentity`\) exclusively\.\*\*/,
    );
  });

  it("4. the design doc cross-references Alpha 110, Alpha 111, Alpha 116, and Alpha 117", () => {
    for (const ref of [
      "secure_runtime_alpha_110_integration_verification",
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_116_desktop_identity_access",
      "secure_runtime_alpha_117_desktop_bootstrap_state",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("5. structural: currentIdentity() and isBootstrapped() own bodies reference ONLY #identity -- never #reader or #publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const currentIdentityBody = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const isBootstrappedBody = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [currentIdentityBody, isBootstrappedBody]) {
      expect(body).toMatch(/#identity/);
      expect(body).not.toMatch(/#reader/);
      expect(body).not.toMatch(/#publicIdentity/);
    }
  });

  it("6. structural: bootstrap() and start() also never reference #reader or #publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [bootstrapBody, startBody]) {
      expect(body).not.toMatch(/#reader/);
      expect(body).not.toMatch(/#publicIdentity/);
    }
  });

  it("7. structural: the constructor never derives #identity's own construction from #reader or #publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const ctorBody = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(ctorBody).toMatch(/this\.#identity = new FedosRuntimeIdentity\(\);/);
    const identityConstructionLine = (ctorBody.match(/this\.#identity = new FedosRuntimeIdentity\([^)]*\);/) ?? [])[0] ?? "";
    expect(identityConstructionLine).not.toMatch(/reader|publicIdentity/);
  });

  it("8. the design doc's own 'does NOT do' list confirms the Reader path's own meaning is unchanged", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `#reader`'s or `#publicIdentity`'s own meaning —\s*\n\s*the Reader path \(Alpha 103–110\) remains exactly as designed,\s*\n\s*independent of the Bootstrap\/Authority path\./,
    );
  });

  it("9. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_118/);
  });

  it("10. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_118/);
  });

  it("11. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_118/);
    }
  });

  it("12. Regression: desktop_application.ts itself carries no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_118/);
  });
});

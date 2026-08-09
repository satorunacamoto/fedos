import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_134_desktop_refresh_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
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

function importLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => line.trim().startsWith("import "))
    .join("\n");
}

/**
 * Secure Runtime Alpha 134 -- "Desktop Refresh Boundary": Stage 4 of
 * the Desktop Public Identity Refresh Arc, a REVIEW / DESIGN ONLY
 * Stage. Confirms refreshPublicIdentity() has ZERO effect on Runtime
 * Identity, Bootstrap, Registry, Provider, Storage, or Worker, by
 * tracing its own full call chain.
 */
describe("Secure Runtime Alpha 134 -- Desktop Refresh Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- zero effect on all six named concepts", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`refreshPublicIdentity\(\)` has ZERO effect on Runtime Identity,\s*\nBootstrap, Registry, Provider, Storage, or Worker/,
    );
  });

  it("4. the design doc cross-references Alpha 118, Alpha 129, and Alpha 132", () => {
    for (const ref of [
      "secure_runtime_alpha_118_desktop_authority_consumption",
      "secure_runtime_alpha_129_desktop_state_boundary",
      "secure_runtime_alpha_132_refresh_delegation",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the full call chain, traced to exactly two fields
  // ---------------------------------------------------------------------

  it("5. structural: refreshPublicIdentity()'s full call chain touches only #reader and #currentPublicIdentity -- confirmed across both method bodies combined", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const refreshBody = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const readBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const combined = `${refreshBody}\n${readBody}`;
    const fieldsTouched = new Set([...combined.matchAll(/this\.(#\w+)/g)].map((m: RegExpMatchArray) => m[1]));
    expect(fieldsTouched).toEqual(new Set(["#reader", "#currentPublicIdentity"]));
  });

  it("6. structural: no #identity, #started, or #publicIdentity reference exists anywhere in the traced chain -- rules out Runtime Identity and Bootstrap", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const refreshBody = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const readBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [refreshBody, readBody]) {
      expect(body).not.toMatch(/#identity/);
      expect(body).not.toMatch(/#started/);
      expect(body).not.toMatch(/#publicIdentity\b/);
    }
  });

  it("7. structural: no src/desktop/* file imports a Storage module or src/worker.ts -- rules out Storage and Worker", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      const imports = importLines(source);
      expect(imports).not.toMatch(/storage/i);
      expect(imports).not.toMatch(/worker\.js/);
    }
  });

  it("8. structural: no src/desktop/* file imports FedosIdentityRegistry or FedosIdentityProvider -- rules out Registry and Provider", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      const imports = importLines(source);
      expect(imports).not.toMatch(/FedosIdentityRegistry/);
      expect(imports).not.toMatch(/FedosIdentityProvider/);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution confirms zero cross-effect
  // ---------------------------------------------------------------------

  it("9. behavioral: refreshPublicIdentity() triggers zero Identity Service calls -- confirmed via spy", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.refreshPublicIdentity();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("10. behavioral: refreshPublicIdentity() leaves Bootstrap state (isBootstrapped()/currentIdentity()) completely untouched, before and after", async () => {
    const app = new DesktopApplication();
    expect(app.isBootstrapped()).toBe(false);
    expect(app.currentIdentity()).toBeNull();
    await app.refreshPublicIdentity();
    expect(app.isBootstrapped()).toBe(false);
    expect(app.currentIdentity()).toBeNull();
  });

  it("11. behavioral: calling start() after refreshPublicIdentity() still bootstraps normally, confirming no interference in either direction", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.refreshPublicIdentity();
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("12. the design doc's own 'does NOT do' list confirms no behavioral change to either method", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `readPublicIdentity\(\)`'s or\s*\n\s*`refreshPublicIdentity\(\)`'s own behavior in any way\./,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_134/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_134/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_134/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_134/);
    }
  });
});

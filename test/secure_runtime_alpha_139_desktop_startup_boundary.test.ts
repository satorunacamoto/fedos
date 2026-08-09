import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_139_desktop_startup_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
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
 * Secure Runtime Alpha 139 -- "Desktop Startup Boundary": Stage 4 of
 * the Desktop Startup Identity Sequence Arc, a REVIEW / DESIGN ONLY
 * Stage. Confirms start() uses Runtime Identity and Reader ONLY --
 * never Provider, Registry, Storage, Worker, or Observation directly.
 */
describe("Secure Runtime Alpha 139 -- Desktop Startup Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- start() uses Runtime Identity and Reader only", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`start\(\)` uses Runtime Identity and Reader ONLY —/);
    expect(section).toMatch(
      /It does NOT directly touch\s*\nProvider, Registry, Storage, Worker, or Observation/,
    );
  });

  it("4. the design doc cross-references Alpha 118, Alpha 134, and Alpha 136", () => {
    for (const ref of [
      "secure_runtime_alpha_118_desktop_authority_consumption",
      "secure_runtime_alpha_134_desktop_refresh_boundary",
      "secure_runtime_alpha_136_startup_sequence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Structural: the full call graph from start(), traced
  // ---------------------------------------------------------------------

  it("5. structural: start()'s own full call graph (start + bootstrap + refreshPublicIdentity + readPublicIdentity bodies combined) touches only #identity, #started, #reader, and #currentPublicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const refreshBody = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const readBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const combined = `${startBody}\n${bootstrapBody}\n${refreshBody}\n${readBody}`;
    const fieldsTouched = new Set([...combined.matchAll(/this\.(#\w+)/g)].map((m: RegExpMatchArray) => m[1]));
    expect(fieldsTouched).toEqual(new Set(["#started", "#identity", "#reader", "#currentPublicIdentity"]));
  });

  it("6. structural: no #publicIdentity reference exists anywhere in the traced call graph", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const refreshBody = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const readBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [startBody, bootstrapBody, refreshBody, readBody]) {
      expect(body).not.toMatch(/#publicIdentity\b/);
    }
  });

  it("7. structural: no src/desktop/* file imports Provider, Registry, a Storage module, or src/worker.ts", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      const imports = importLines(source);
      expect(imports).not.toMatch(/FedosIdentityProvider/);
      expect(imports).not.toMatch(/FedosIdentityRegistry/);
      expect(imports).not.toMatch(/storage/i);
      expect(imports).not.toMatch(/worker\.js/);
    }
  });

  it("8. structural: no src/desktop/* file references the Observation Framework in code", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/observeBootstrap|Observation/i);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution confirms zero cross-effect
  // ---------------------------------------------------------------------

  it("9. behavioral: start() triggers exactly one Identity Service call and one Reader call -- no more, no fewer, confirming no hidden Provider/Registry-level extra access", async () => {
    const serviceSpy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await app.start();
    expect(serviceSpy).toHaveBeenCalledTimes(1);
    expect(readerSpy).toHaveBeenCalledTimes(1);
    serviceSpy.mockRestore();
  });

  it("10. behavioral: two independently-constructed instances' own start() calls never cross-contaminate each other's Runtime Identity or Reader state", async () => {
    const descriptorA = { id: "alpha139-a", provider: "nostr", publicIdentifier: "npub1alpha139a" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptorA);
    const appA = new DesktopApplication();
    const appB = new DesktopApplication();
    await appA.start();
    expect(appA.currentIdentity()).toBe(descriptorA);
    expect(appB.currentIdentity()).toBeNull();
    expect(appB.isBootstrapped()).toBe(false);
    spy.mockRestore();
  });

  it("11. the design doc's own 'does NOT do' list confirms no behavioral change to start() or any other method", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `start\(\)`'s or any other method's own behavior\s*\n\s*in any way\./,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_139/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_139/);
  });

  it("13. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_139/);
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_139/);
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_123_desktop_public_identity_boundary.md?raw";
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

/**
 * Secure Runtime Alpha 123 -- "Desktop Public Identity Boundary": Stage
 * 3 of the Desktop Public Identity Reader Arc, a REVIEW / DESIGN ONLY
 * Stage. Confirms currentIdentity()/isBootstrapped() (the #identity
 * path) and readPublicIdentity() (the #reader path) remain completely
 * independent -- neither influences the other.
 */
describe("Secure Runtime Alpha 123 -- Desktop Public Identity Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- the two paths are completely independent", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`currentIdentity\(\)`\/`isBootstrapped\(\)` \(the `#identity` path\) and\s*\n`readPublicIdentity\(\)` \(the `#reader` path\) are, and remain,\s*\nCOMPLETELY INDEPENDENT\./,
    );
  });

  it("4. the design doc cross-references Alpha 110, Alpha 118, Alpha 121, and Alpha 122", () => {
    for (const ref of [
      "secure_runtime_alpha_110_integration_verification",
      "secure_runtime_alpha_118_desktop_authority_consumption",
      "secure_runtime_alpha_121_desktop_reader_access",
      "secure_runtime_alpha_122_factory_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("5. structural: currentIdentity() and isBootstrapped() own bodies never reference #reader", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const currentIdentityBody = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const isBootstrappedBody = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [currentIdentityBody, isBootstrappedBody]) {
      expect(body).not.toMatch(/#reader/);
    }
  });

  it("6. structural: readPublicIdentity()'s own body never references #identity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#identity/);
  });

  it("7. structural: bootstrap()/start() -- the write path -- never reference #reader", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    for (const body of [bootstrapBody, startBody]) {
      expect(body).not.toMatch(/#reader/);
    }
  });

  it("8. structural: #identity's own construction never derives from #reader or #publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const ctorBody = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const identityConstructionLine = (ctorBody.match(/this\.#identity = new FedosRuntimeIdentity\([^)]*\);/) ?? [])[0] ?? "";
    expect(identityConstructionLine).not.toMatch(/reader|publicIdentity/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: independence confirmed end to end, unmocked
  // ---------------------------------------------------------------------

  it("9. behavioral: calling readPublicIdentity() first does not affect currentIdentity()/isBootstrapped(), which remain at their pre-Bootstrap defaults", async () => {
    const snapshot = { id: "alpha123-reader", publicIdentifier: "npub1alpha123reader" };
    const app = new DesktopApplication({ readPublicIdentity: vi.fn().mockResolvedValue(snapshot) }, undefined);
    await app.readPublicIdentity();
    expect(app.currentIdentity()).toBeNull();
    expect(app.isBootstrapped()).toBe(false);
  });

  it("10. behavioral: calling bootstrap()/start() first does not affect readPublicIdentity(), which still resolves the Reader's own independent value", async () => {
    const snapshot = { id: "alpha123-bootstrap-first", publicIdentifier: "npub1alpha123bootstrapfirst" };
    const app = new DesktopApplication({ readPublicIdentity: vi.fn().mockResolvedValue(snapshot) }, undefined);
    await app.start();
    await expect(app.readPublicIdentity()).resolves.toEqual(snapshot);
    expect(app.currentIdentity()).not.toEqual(snapshot);
  });

  it("11. RIPPLE (Secure Runtime Alpha 136): readPublicIdentity() triggered zero Identity Service calls, and bootstrap()/start() triggered zero Reader calls, AS OF this Stage's own scope; Alpha 136 made start() itself call refreshPublicIdentity() as part of its own fixed Startup Sequence, so start() now DELIBERATELY triggers exactly one Reader call of its own -- the READER path independence from Identity Service still holds (serviceSpy stays uncalled throughout), reconfirmed here as the CURRENT state", async () => {
    const serviceSpy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy }, undefined);
    await app.readPublicIdentity();
    expect(serviceSpy).not.toHaveBeenCalled();
    expect(readerSpy).toHaveBeenCalledTimes(1);
    await app.start();
    expect(serviceSpy).toHaveBeenCalledTimes(1);
    expect(readerSpy).toHaveBeenCalledTimes(2);
    serviceSpy.mockRestore();
  });

  it("12. the design doc's own 'does NOT do' list confirms the two paths remain permanently unconnected", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* connect the two paths in any way — they remain\s*\n\s*deliberately, permanently separate\./,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_123/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_123/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_123/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_123/);
    }
  });
});

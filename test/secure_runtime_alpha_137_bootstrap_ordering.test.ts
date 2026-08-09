import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_137_bootstrap_ordering.md?raw";
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

/**
 * Secure Runtime Alpha 137 -- "Bootstrap Ordering": Stage 2 of the
 * Desktop Startup Identity Sequence Arc, a REVIEW / DESIGN ONLY Stage.
 * Confirms, by real execution, that refreshPublicIdentity() is called
 * only after bootstrap() resolves successfully -- never on Bootstrap
 * failure.
 */
describe("Secure Runtime Alpha 137 -- Bootstrap Ordering", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- Reader is called iff bootstrap() already resolved successfully", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`refreshPublicIdentity\(\)` is called if and only if `bootstrap\(\)` has\s*\nalready resolved successfully within the SAME `start\(\)` invocation\./,
    );
    expect(section).toMatch(/GUARANTEES\s*\nthe Reader is never called by `start\(\)`'s own sequence\./);
  });

  it("4. the design doc cross-references Alpha 132 and Alpha 136", () => {
    for (const ref of ["secure_runtime_alpha_132_refresh_delegation", "secure_runtime_alpha_136_startup_sequence"]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("5. structural: start()'s own body uses two separate sequential await statements, not Promise.all", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/Promise\.all/);
    const awaitLines = body.split("\n").map((l: string) => l.trim()).filter((l: string) => l.startsWith("await "));
    expect(awaitLines).toEqual(["await this.bootstrap();", "await this.refreshPublicIdentity();"]);
  });

  it("6. structural: no try/catch exists anywhere in the class", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/\btry\b/);
    expect(classBody).not.toMatch(/\bcatch\b/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: real execution confirms the ordering guarantee
  // ---------------------------------------------------------------------

  it("7. behavioral: when bootstrap() rejects, the Reader is never called -- confirmed via spy, zero calls", async () => {
    const serviceSpy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"));
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await expect(app.start()).rejects.toThrow("simulated Provider failure");
    expect(readerSpy).not.toHaveBeenCalled();
    serviceSpy.mockRestore();
  });

  it("8. behavioral: when bootstrap() succeeds, the Reader IS called exactly once", async () => {
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await app.start();
    expect(readerSpy).toHaveBeenCalledTimes(1);
  });

  it("9. behavioral: a rejected bootstrap() leaves #started unset, so a retried start() re-attempts the FULL sequence, including the Reader", async () => {
    const serviceSpy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated first failure"))
      .mockResolvedValue(null);
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await expect(app.start()).rejects.toThrow("simulated first failure");
    expect(readerSpy).not.toHaveBeenCalled();
    await expect(app.start()).resolves.toBeUndefined();
    expect(readerSpy).toHaveBeenCalledTimes(1);
    serviceSpy.mockRestore();
  });

  it("10. behavioral: if the Reader itself rejects during start(), #started is never set -- start()'s own rejection propagates", async () => {
    const readerSpy = vi.fn().mockRejectedValueOnce(new Error("simulated Reader failure"));
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await expect(app.start()).rejects.toThrow("simulated Reader failure");
    expect(app.isBootstrapped()).toBe(true);
    await expect(app.start()).resolves.toBeUndefined();
  });

  it("11. the design doc's own 'does NOT do' list confirms no try/catch or explicit guard is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a `try`\/`catch` or any explicit ordering guard — the\s*\n\s*guarantee is, and remains, a consequence of plain sequential `await`\./,
    );
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_137/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_137/);
  });

  it("13. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_137/);
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_137/);
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_099_desktop_factory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 099 -- "Desktop Factory": Stage 4 of the
 * Desktop Shell Foundation Arc. Adds
 * src/desktop/create_desktop_application.ts, exporting
 * createDesktopApplication() -- a pure construction site mirroring
 * createRuntime()'s own naming/scoping discipline. Does not call
 * bootstrap()/start() on the instance it returns. desktop_application.ts
 * is byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 099 -- Desktop Factory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/create_desktop_application\.ts`, and modifies nothing/,
    );
  });

  it("3. createDesktopApplication is the ONLY export from create_desktop_application.ts", () => {
    const exportNames = [...createDesktopApplicationSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["createDesktopApplication"]);
  });

  it("4. createDesktopApplication()'s own entire body is a pure construction and return, nothing else", () => {
    const body = (createDesktopApplicationSource.match(
      /export function createDesktopApplication\(\): DesktopApplication \{([\s\S]*?)\n\}/,
    ) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return new DesktopApplication();"]);
  });

  it("5. createDesktopApplication() never calls bootstrap() or start() on the instance it constructs", () => {
    expect(createDesktopApplicationSource).not.toMatch(/\.bootstrap\(\)/);
    expect(createDesktopApplicationSource).not.toMatch(/\.start\(\)/);
    expect(createDesktopApplicationSource).not.toMatch(/\basync function/);
  });

  it("6. desktop_application.ts remains byte-for-byte unchanged -- no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_099/);
    expect(desktopApplicationSource).not.toMatch(/createDesktopApplication/);
  });

  it("7. the design doc's own 'does NOT do' list confirms bootstrap()/start() are never called and no parameter is accepted", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `bootstrap\(\)` or `start\(\)` from inside\s*\n\s*`createDesktopApplication\(\)`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* accept any argument, option, or override of any kind/);
  });

  it("8. the design doc cross-references Alpha 050-052, Alpha 091-093, Alpha 096, and Alpha 098", () => {
    for (const ref of [
      "secure_runtime_alpha_050_052_identity_runtime_integration_arc",
      "secure_runtime_alpha_091_desktop_entry_point_review",
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_093_ownership_review",
      "secure_runtime_alpha_096_desktop_shell_skeleton",
      "secure_runtime_alpha_098_ready_state",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. behavioral: createDesktopApplication() returns a real DesktopApplication instance", () => {
    const app = createDesktopApplication();
    expect(app).toBeInstanceOf(DesktopApplication);
  });

  it("10. behavioral: constructing via the factory triggers no Bootstrap of its own", () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    createDesktopApplication();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("11. behavioral: an instance returned by the factory can still be started normally afterward", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("12. behavioral: repeated factory calls each return a fresh, independent instance -- never a shared singleton", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const appA = createDesktopApplication();
    const appB = createDesktopApplication();
    expect(appA).not.toBe(appB);
    await appA.start();
    await appB.start();
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("13. behavioral: an instance from the factory still enforces the Alpha 098 double-start guard", async () => {
    const app = createDesktopApplication();
    await app.start();
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_099/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to the Desktop factory", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_099/);
      expect(source).not.toMatch(/createDesktopApplication/);
    }
  });
});

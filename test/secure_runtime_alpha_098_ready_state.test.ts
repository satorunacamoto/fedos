import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_098_ready_state.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
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
 * Secure Runtime Alpha 098 -- "Ready State": Stage 3 of the Desktop
 * Shell Foundation Arc. Adds a private #started: boolean field and
 * rewrites DesktopApplication.start()'s own body to guard against a
 * second call -- THROWING, not silently no-oping, a deliberate
 * departure from FedosRuntimeIdentity's own bootstrapIdentity()
 * idempotency. bootstrap() itself remains ungated by #started.
 */
describe("Secure Runtime Alpha 098 -- Ready State", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/desktop_application\.ts`, and nothing else/,
    );
  });

  it("3. the design doc explains why start() throws rather than silently no-ops on a repeat call", () => {
    const section = (designDocSource.match(/## 3\. Why THROW, not silently no-op([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/DELIBERATELY idempotent/);
    expect(section).toMatch(/A second `start\(\)` call signals a caller-side bug/);
    expect(section).toMatch(/`bootstrap\(\)` itself remains completely ungated by `#started`/);
  });

  it("4. #started is declared as a private boolean field, initial false", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(/#started: boolean = false;/);
  });

  it("5. RIPPLE (Secure Runtime Alpha 136): start()'s own entire body was the guard, then bootstrap(), then mark #started true -- exactly four statements -- AS OF this Stage's own scope; Alpha 136 inserted refreshPublicIdentity() between bootstrap() and marking #started true, reconfirmed here as the CURRENT state", () => {
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

  it("6. bootstrap()'s own body remains ungated by #started -- no reference to #started anywhere inside it", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#started/);
  });

  it("7. RIPPLE (Secure Runtime Alpha 107): the constructor remained byte-for-byte unchanged from Alpha 096 AS OF this Stage's own scope; Alpha 103 gave it a Reader parameter/statement and Alpha 107 added a publicIdentity parameter/statement, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
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

  it("8. #started is written in exactly ONE place -- inside start()'s own guarded body", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const assignments = [...classBody.matchAll(/#started\s*=\s*(?!false)/g)];
    expect(assignments.length).toBe(1);
  });

  it("9. the design doc's own 'does NOT do' list confirms no public #started reader and no factory function is added", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a public reader for `#started`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add `createDesktopApplication\(\)` or any other factory/);
  });

  it("10. the design doc cross-references Alpha 061, Alpha 092, Alpha 094, Alpha 096, and Alpha 097", () => {
    for (const ref of [
      "secure_runtime_alpha_061_identity_bootstrap_idempotency",
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_094_lifetime_review",
      "secure_runtime_alpha_096_desktop_shell_skeleton",
      "secure_runtime_alpha_097_bootstrap_wiring",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("11. behavioral: a fresh instance's first start() call succeeds and drives Bootstrap to completion", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await expect(app.start()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("12. behavioral: a second start() call on the SAME instance THROWS, and does not re-invoke the Service", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.start();
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("13. behavioral: a THIRD start() call also throws -- the guard remains permanently tripped, not just for one extra call", async () => {
    const app = new DesktopApplication();
    await app.start();
    await expect(app.start()).rejects.toThrow();
    await expect(app.start()).rejects.toThrow();
  });

  it("14. behavioral: bootstrap() may still be called directly and repeatedly, even after start() has already run, relying entirely on FedosRuntimeIdentity's own idempotency", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.start();
    await app.bootstrap();
    await app.bootstrap();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("15. behavioral: if start()'s own Bootstrap rejects, #started is NEVER set -- the assignment sits after the await, so a failed attempt leaves the guard untripped and a retry via start() is possible", async () => {
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"))
      .mockResolvedValue(null);
    const app = new DesktopApplication();
    await expect(app.start()).rejects.toThrow("simulated Provider failure");
    await expect(app.start()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("16. behavioral: two independently-constructed DesktopApplication instances each have their own independent #started guard", async () => {
    const appA = new DesktopApplication();
    const appB = new DesktopApplication();
    await appA.start();
    await expect(appA.start()).rejects.toThrow();
    await expect(appB.start()).resolves.toBeUndefined();
  });

  it("17. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc, and bootstrapIdentity()'s own idempotency (Alpha 061) is unaffected", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_098/);
    expect(fedosRuntimeIdentitySource).toMatch(
      /async #bootstrapIdentity\(\): Promise<void> \{\s*\n\s*if \(this\.#isBootstrapped\(\)\) \{\s*\n\s*return;\s*\n\s*\}/,
    );
  });

  it("18. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_098/);
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });
});

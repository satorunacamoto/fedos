import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_097_bootstrap_wiring.md?raw";
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
 * Secure Runtime Alpha 097 -- "Bootstrap Wiring": Stage 2 of the
 * Desktop Shell Foundation Arc. Wires DesktopApplication.start()'s
 * own entire body to `return this.bootstrap();`, matching the Alpha
 * 092 Bootstrap Sequence Decision (construct -> bootstrapIdentity()
 * -> ready). The constructor and bootstrap() remain byte-for-byte
 * unchanged from Alpha 096.
 */
describe("Secure Runtime Alpha 097 -- Bootstrap Wiring", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/desktop_application\.ts`, and nothing else/,
    );
  });

  it("3. RIPPLE (Secure Runtime Alpha 098): start()'s own entire body was a pure delegation to bootstrap() AS OF this Stage's own scope; Alpha 098 rewrote it to a guarded sequence, reconfirmed here as the CURRENT state", () => {
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
      "this.#started = true;",
    ]);
  });

  it("4. RIPPLE (Secure Runtime Alpha 103): the constructor and bootstrap() remained byte-for-byte unchanged from Alpha 096 AS OF this Stage's own scope; Alpha 103 gave the constructor a Reader parameter and a second statement, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const ctorBody = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const ctorLines = ctorBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(ctorLines).toEqual(["this.#identity = new FedosRuntimeIdentity();", "this.#reader = reader;"]);

    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const bootstrapLines = bootstrapBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(bootstrapLines).toEqual(["return this.#identity.bootstrapIdentity();"]);
  });

  it("5. RIPPLE (Secure Runtime Alpha 103): the class exposed exactly two public methods and one private field AS OF this Stage's own scope; Alpha 098 added #started and Alpha 103 added #reader, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(new Set(["bootstrap", "start"]));
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "started"]);
  });

  it("6. the design doc's own 'does NOT do' list confirms no #started guard or factory function is added", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a `#started` field or any double-start guard/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add `createDesktopApplication\(\)` or any other factory/);
  });

  it("7. the design doc cross-references Alpha 061, Alpha 092, and Alpha 096", () => {
    for (const ref of [
      "secure_runtime_alpha_061_identity_bootstrap_idempotency",
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_096_desktop_shell_skeleton",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. behavioral: start() drives Bootstrap to completion via bootstrap(), confirmed by exactly one Service call", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("9. RIPPLE (Secure Runtime Alpha 098): repeated start() calls on the same instance remained idempotent (silent no-op) AS OF this Stage's own scope, since start() had no guard of its own yet; Alpha 098 made a second start() call THROW instead, reconfirmed here as the CURRENT state", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.start();
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("10. behavioral: calling bootstrap() directly and then start() on the same instance still only bootstraps once total", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.bootstrap();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("11. behavioral: a rejected Bootstrap propagates out of start(), unmodified, matching FedosRuntimeIdentity's own Fail-Closed contract", async () => {
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"));
    const app = new DesktopApplication();
    await expect(app.start()).rejects.toThrow("simulated Provider failure");
    spy.mockRestore();
  });

  it("12. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_097/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_097/);
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });
});

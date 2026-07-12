import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_096_desktop_shell_skeleton.md?raw";
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
 * Secure Runtime Alpha 096 -- "Desktop Shell Skeleton": the first real
 * implementation Stage of the Desktop Shell Foundation Arc. Adds
 * src/desktop/desktop_application.ts, exporting DesktopApplication --
 * a thin holder of exactly one FedosRuntimeIdentity instance,
 * constructed directly in its own constructor, exposing bootstrap()
 * (a real delegation) and start() (intentionally empty, wired at
 * Alpha 097). No other src/ file is touched.
 */
describe("Secure Runtime Alpha 096 -- Desktop Shell Skeleton", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(/It adds exactly one new file, `src\/desktop\/desktop_application\.ts`,\s*\nand nothing else/);
  });

  it("3. DesktopApplication is the ONLY export from desktop_application.ts", () => {
    const exportNames = [...desktopApplicationSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["DesktopApplication"]);
  });

  it("4. RIPPLE (Secure Runtime Alpha 107): the class held exactly one readonly #identity field and no other AS OF Alpha 096's own scope; Alpha 098 added #started, Alpha 103 added #reader, and Alpha 107 added #publicIdentity, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started"]);
    expect(classBody).toMatch(/readonly #identity: FedosRuntimeIdentity;/);
  });

  it("5. RIPPLE (Secure Runtime Alpha 107): the constructor's own entire body was the single synchronous FedosRuntimeIdentity construction AS OF Alpha 096's own scope; Alpha 103 added a Reader parameter/statement and Alpha 107 added a publicIdentity parameter/statement, reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "this.#identity = new FedosRuntimeIdentity();",
      "this.#reader = reader;",
      "this.#publicIdentity = publicIdentity;",
    ]);
    expect(body).not.toMatch(/await/);
  });

  it("6. bootstrap()'s own entire body is a pure delegation to #identity.bootstrapIdentity()", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.#identity.bootstrapIdentity();"]);
  });

  it("7. RIPPLE (Secure Runtime Alpha 098): start()'s own body contained NO statement of any kind AS OF Alpha 096's own scope, then became a pure delegation AS OF Alpha 097's own scope; Alpha 098 rewrote it to a guarded, bootstrap-then-mark-started sequence, reconfirmed here as the CURRENT state", () => {
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

  it("8. the class exposes exactly two public methods -- bootstrap and start -- and no other", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(new Set(["bootstrap", "start"]));
  });

  it("9. RIPPLE (Secure Runtime Alpha 103): no GUI, Relay/WebSocket, or Observation reference exists in the CODE; Alpha 103 legitimately introduced NostrPublicIdentityReader/resolveNostrPublicIdentitySource (the Public Identity Source Foundation this Arc exists to build), reconfirmed here as the CURRENT, still-forbidden set", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/window|document|DOM|React|Electron|Tauri/i);
    expect(classBody).not.toMatch(/Relay|WebSocket/i);
    expect(classBody).not.toMatch(/observeBootstrap|Observation/i);
    expect(classBody).toMatch(/NostrPublicIdentityReader/);
  });

  it("10. no CODE reference to create_runtime.ts, types.ts, AppRuntime, or worker.ts exists (comments legitimately name these as forbidden guardrails)", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/createRuntime|AppRuntime|create_runtime|worker\.js/);
  });

  it("11. behavioral: constructing DesktopApplication does not itself call bootstrapIdentity() -- confirming the constructor performs no async work", () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    new DesktopApplication();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("12. behavioral: bootstrap() successfully drives the held FedosRuntimeIdentity's own Bootstrap to completion", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.bootstrap();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("13. RIPPLE (Secure Runtime Alpha 097): start() performed no Bootstrap of its own AS OF Alpha 096's own scope, since it was then unwired; Alpha 097 wired it to drive Bootstrap to completion, reconfirmed here as the CURRENT state", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await expect(app.start()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("14. behavioral: two separately-constructed DesktopApplication instances each hold their own independent FedosRuntimeIdentity -- both bootstrap independently, confirmed by TWO separate Service calls rather than one shared idempotent call", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const appA = new DesktopApplication();
    const appB = new DesktopApplication();
    await appA.bootstrap();
    await appB.bootstrap();
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("15. behavioral: repeated bootstrap() calls on the same DesktopApplication remain idempotent, inherited from FedosRuntimeIdentity's own Alpha 061 guarantee", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.bootstrap();
    await app.bootstrap();
    await app.bootstrap();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("16. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc or to DesktopApplication", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_096/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/DesktopApplication/);
  });

  it("17. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to DesktopApplication", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_096/);
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });

  it("18. Regression: AppRuntime still has no identity/desktop field among its thirty fields", () => {
    const body = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).not.toContain("identity");
    expect(fieldNames).not.toContain("desktop");
  });
});

import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_117_desktop_bootstrap_state.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
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
 * Secure Runtime Alpha 117 -- "Desktop Bootstrap State": Stage 2 of
 * the Desktop Identity Consumption Arc. Adds
 * DesktopApplication.isBootstrapped(), a PURE delegation to
 * this.#identity.isBootstrapped() -- the sole Identity Authority
 * (Alpha 111). No Desktop-independent state, no derivation from
 * #started.
 */
describe("Secure Runtime Alpha 117 -- Desktop Bootstrap State", () => {
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

  it("3. structural: isBootstrapped()'s own entire body is a single delegation to #identity.isBootstrapped()", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.#identity.isBootstrapped();"]);
  });

  it("4. structural: isBootstrapped()'s own body never references #started, #reader, or #publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#started/);
    expect(body).not.toMatch(/#reader/);
    expect(body).not.toMatch(/#publicIdentity/);
  });

  it("5. structural: the class still has exactly four public methods and four private fields -- no #bootstrapped field was added", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(new Set(["bootstrap", "start", "currentIdentity", "isBootstrapped"]));
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started"]);
    expect(fieldNames).not.toContain("bootstrapped");
  });

  it("6. the design doc's own purity section confirms no processing, no caching, no derivation from #started, and no #reader/#publicIdentity access", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No processing:\*\*/);
    expect(section).toMatch(/\*\*No caching:\*\*/);
    expect(section).toMatch(/\*\*No derivation from `#started`:\*\*/);
    expect(section).toMatch(/\*\*No access to `#reader` or `#publicIdentity`:\*\*/);
  });

  it("7. the design doc's own 'does NOT do' list confirms no #bootstrapped field is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add a `#bootstrapped` field to `DesktopApplication` —\s*\n\s*the value is read fresh from `#identity` on every call\./,
    );
  });

  it("8. the design doc cross-references Alpha 072, Alpha 098, and Alpha 116", () => {
    for (const ref of [
      "secure_runtime_alpha_072_identity_bootstrap_state_reader_consolidation",
      "secure_runtime_alpha_098_ready_state",
      "secure_runtime_alpha_116_desktop_identity_access",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("9. behavioral: a fresh instance's isBootstrapped() resolves false before Bootstrap", () => {
    const app = new DesktopApplication();
    expect(app.isBootstrapped()).toBe(false);
  });

  it("10. behavioral: after a successful bootstrap(), isBootstrapped() resolves true", async () => {
    const app = new DesktopApplication();
    await app.bootstrap();
    expect(app.isBootstrapped()).toBe(true);
  });

  it("11. behavioral: after a successful start(), isBootstrapped() resolves true, independent of #started", async () => {
    const app = new DesktopApplication();
    await app.start();
    expect(app.isBootstrapped()).toBe(true);
  });

  it("12. behavioral: repeated isBootstrapped() calls always return the same value, with no additional Service call triggered by reads", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.bootstrap();
    expect(spy).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i += 1) {
      app.isBootstrapped();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("13. behavioral: two independent DesktopApplication instances each report their own independent isBootstrapped()", async () => {
    const appA = new DesktopApplication();
    const appB = new DesktopApplication();
    await appA.bootstrap();
    expect(appA.isBootstrapped()).toBe(true);
    expect(appB.isBootstrapped()).toBe(false);
  });

  it("14. behavioral: a rejected Bootstrap leaves isBootstrapped() false, matching FedosRuntimeIdentity's own Fail-Closed contract", async () => {
    const spy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"));
    const app = new DesktopApplication();
    await expect(app.bootstrap()).rejects.toThrow("simulated Provider failure");
    expect(app.isBootstrapped()).toBe(false);
    spy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("15. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc or to isBootstrapped", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_117/);
    expect(createDesktopApplicationSource).not.toMatch(/isBootstrapped/);
  });

  it("16. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_117/);
  });

  it("17. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_117/);
    }
  });
});

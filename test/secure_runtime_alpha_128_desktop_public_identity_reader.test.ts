import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_128_desktop_public_identity_reader.md?raw";
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
 * Secure Runtime Alpha 128 -- "Desktop Public Identity Reader": Stage
 * 3 of the Desktop Public Identity State Arc. Adds
 * DesktopApplication.currentPublicIdentity(), a synchronous, never-
 * throwing read of #currentPublicIdentity.
 */
describe("Secure Runtime Alpha 128 -- Desktop Public Identity Reader", () => {
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

  it("3. structural: currentPublicIdentity() is NOT async and its own entire body is a single field read", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).not.toMatch(/async currentPublicIdentity/);
    const body = (classBody.match(/currentPublicIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.#currentPublicIdentity;"]);
  });

  it("4. structural: currentPublicIdentity()'s own body never references #identity, #reader, #publicIdentity, or #started", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/currentPublicIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#identity/);
    expect(body).not.toMatch(/#reader\b/);
    expect(body).not.toMatch(/#publicIdentity/);
    expect(body).not.toMatch(/#started/);
  });

  it("5. structural: currentPublicIdentity()'s own body contains no throw statement", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/currentPublicIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/\bthrow\b/);
  });

  it("6. RIPPLE (Secure Runtime Alpha 131): the class had exactly six public methods and five private fields AS OF this Stage's own scope; Alpha 131 added a SEVENTH public method, refreshPublicIdentity(), reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set([
        "bootstrap",
        "start",
        "currentIdentity",
        "isBootstrapped",
        "readPublicIdentity",
        "currentPublicIdentity",
        "refreshPublicIdentity",
      ]),
    );
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });

  it("7. structural: readPublicIdentity()'s own body remains byte-for-byte unchanged from Alpha 127", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "const result = await this.#reader.readPublicIdentity();",
      "this.#currentPublicIdentity = result;",
      "return result;",
    ]);
  });

  it("8. the design doc's own purity section confirms synchronous, never-throws, and no cross-field access", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Synchronous:\*\*/);
    expect(section).toMatch(/\*\*Never throws:\*\*/);
    expect(section).toMatch(/\*\*No access to `#identity`, `#reader`, `#publicIdentity`, or\s*\n\s*`#started`:\*\*/);
  });

  it("9. the design doc cross-references Alpha 116, Alpha 126, and Alpha 127", () => {
    for (const ref of [
      "secure_runtime_alpha_116_desktop_identity_access",
      "secure_runtime_alpha_126_desktop_public_identity_state",
      "secure_runtime_alpha_127_reader_result_persistence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("10. behavioral: a fresh instance's currentPublicIdentity() resolves null before any readPublicIdentity() call", () => {
    const app = new DesktopApplication();
    expect(app.currentPublicIdentity()).toBeNull();
  });

  it("11. behavioral: after a successful readPublicIdentity() call, currentPublicIdentity() reflects that exact value by reference", async () => {
    const descriptor = { id: "alpha128-e2e", provider: "nostr", publicIdentifier: "npub1alpha128" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    const resolved = await app.readPublicIdentity();
    expect(app.currentPublicIdentity()).toBe(resolved);
    expect(app.currentPublicIdentity()).toBe(descriptor);
  });

  it("12. behavioral: currentPublicIdentity() is unaffected by Bootstrap state -- unchanged by bootstrap()/start()", async () => {
    const descriptor = { id: "alpha128-unaffected", provider: "nostr", publicIdentifier: "npub1alpha128unaffected" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await app.readPublicIdentity();
    await app.start();
    expect(app.currentPublicIdentity()).toBe(descriptor);
  });

  it("13. behavioral: repeated currentPublicIdentity() calls never trigger a Reader or Service call of their own", async () => {
    const readerSpy = vi.fn().mockResolvedValue(null);
    const serviceSpy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await app.readPublicIdentity();
    for (let i = 0; i < 5; i += 1) {
      app.currentPublicIdentity();
    }
    expect(readerSpy).toHaveBeenCalledTimes(1);
    expect(serviceSpy).not.toHaveBeenCalled();
    serviceSpy.mockRestore();
  });

  it("14. behavioral: currentPublicIdentity() never throws, even called on a completely fresh, never-bootstrapped instance", () => {
    const app = new DesktopApplication();
    expect(() => app.currentPublicIdentity()).not.toThrow();
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("15. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_128/);
  });

  it("16. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_128/);
  });

  it("17. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_128/);
    }
  });
});

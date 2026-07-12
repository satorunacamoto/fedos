import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_121_desktop_reader_access.md?raw";
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
 * Secure Runtime Alpha 121 -- "Desktop Reader Access": Stage 1 of the
 * Desktop Public Identity Reader Arc. Adds
 * DesktopApplication.readPublicIdentity(), a PURE delegation to
 * this.#reader.readPublicIdentity() -- the FIRST method to read
 * #reader, held unread since Alpha 103. No processing, no caching,
 * no connection to Identity Runtime.
 */
describe("Secure Runtime Alpha 121 -- Desktop Reader Access", () => {
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

  it("3. RIPPLE (Secure Runtime Alpha 127): readPublicIdentity()'s own entire body was a single delegation to #reader.readPublicIdentity() AS OF this Stage's own scope; Alpha 127 rewrote it to also persist the resolved value into #currentPublicIdentity, still calling through to #reader.readPublicIdentity() as its own first and only Reader access, reconfirmed here as the CURRENT state", () => {
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

  it("4. structural: readPublicIdentity()'s own body never references #identity, #publicIdentity, or #started", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#identity/);
    expect(body).not.toMatch(/#publicIdentity/);
    expect(body).not.toMatch(/#started/);
  });

  it("5. RIPPLE (Secure Runtime Alpha 128): the class had exactly five public methods and four private fields AS OF this Stage's own scope; Alpha 126 added a FIFTH private field, #currentPublicIdentity, and Alpha 128 added a SIXTH public method, currentPublicIdentity(), reconfirmed here as the CURRENT state", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set(["bootstrap", "start", "currentIdentity", "isBootstrapped", "readPublicIdentity", "currentPublicIdentity"]),
    );
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });

  it("6. the design doc's own purity section confirms no processing, no caching, no Identity Runtime access", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No processing:\*\*/);
    expect(section).toMatch(/\*\*No caching:\*\*/);
    expect(section).toMatch(/\*\*No Identity Runtime access:\*\*/);
  });

  it("7. the design doc cross-references Alpha 101, Alpha 103, and Alpha 116", () => {
    for (const ref of [
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_116_desktop_identity_access",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("8. behavioral: a fresh, default-constructed instance's readPublicIdentity() resolves null (NullNostrPublicIdentitySource)", async () => {
    const app = new DesktopApplication();
    await expect(app.readPublicIdentity()).resolves.toBeNull();
  });

  it("9. behavioral: an instance constructed with an explicit custom Reader resolves EXACTLY what that Reader resolves, by reference", async () => {
    const descriptor = { id: "alpha121-e2e", provider: "nostr", publicIdentifier: "npub1alpha121" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await expect(app.readPublicIdentity()).resolves.toBe(descriptor);
  });

  it("10. behavioral: readPublicIdentity() never triggers a call to the Identity Service -- confirmed via spy, zero calls", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.readPublicIdentity();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("11. behavioral: readPublicIdentity() is unaffected by Bootstrap state -- resolves the same way before and after bootstrap()", async () => {
    const descriptor = { id: "alpha121-unaffected", provider: "nostr", publicIdentifier: "npub1alpha121unaffected" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await expect(app.readPublicIdentity()).resolves.toBe(descriptor);
    await app.bootstrap();
    await expect(app.readPublicIdentity()).resolves.toBe(descriptor);
  });

  it("12. behavioral: repeated readPublicIdentity() calls each re-invoke the Reader -- no caching, confirmed by call count", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(null) };
    const app = new DesktopApplication(customReader);
    await app.readPublicIdentity();
    await app.readPublicIdentity();
    await app.readPublicIdentity();
    expect(customReader.readPublicIdentity).toHaveBeenCalledTimes(3);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_121/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_121/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_121/);
    }
  });
});

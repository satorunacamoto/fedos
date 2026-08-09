import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_131_desktop_refresh_api.md?raw";
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
 * Secure Runtime Alpha 131 -- "Desktop Refresh API": Stage 1 of the
 * Desktop Public Identity Refresh Arc. Adds
 * DesktopApplication.refreshPublicIdentity(), a PURE delegation to
 * this.readPublicIdentity() (NOT #reader directly). No new behavior,
 * no Identity Runtime access.
 */
describe("Secure Runtime Alpha 131 -- Desktop Refresh API", () => {
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

  it("3. structural: refreshPublicIdentity()'s own entire body is a single delegation to this.readPublicIdentity()", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.readPublicIdentity();"]);
  });

  it("4. structural: refreshPublicIdentity()'s own body never references #reader, #identity, #publicIdentity, or #started directly", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#reader/);
    expect(body).not.toMatch(/#identity/);
    expect(body).not.toMatch(/#publicIdentity/);
    expect(body).not.toMatch(/#started/);
  });

  it("5. structural: the class now has exactly seven public methods and five private fields", () => {
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

  it("6. structural: readPublicIdentity()'s own body remains byte-for-byte unchanged from Alpha 127", () => {
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

  it("7. the design doc's own purity section confirms no processing, calls only readPublicIdentity(), and no Identity Runtime access", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No processing:\*\*/);
    expect(section).toMatch(/\*\*Calls `readPublicIdentity\(\)` and nothing else:\*\*/);
    expect(section).toMatch(/\*\*No Identity Runtime access:\*\*/);
  });

  it("8. the design doc's own 'does NOT do' list confirms no direct #reader access is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `this\.#reader\.readPublicIdentity\(\)` directly —\s*\n\s*ALL Reader access continues to happen exclusively inside\s*\n\s*`readPublicIdentity\(\)`'s own body\./,
    );
  });

  it("9. the design doc cross-references Alpha 121 and Alpha 127", () => {
    for (const ref of [
      "secure_runtime_alpha_121_desktop_reader_access",
      "secure_runtime_alpha_127_reader_result_persistence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("10. behavioral: refreshPublicIdentity() resolves exactly what readPublicIdentity() itself would resolve, by reference", async () => {
    const descriptor = { id: "alpha131-e2e", provider: "nostr", publicIdentifier: "npub1alpha131" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await expect(app.refreshPublicIdentity()).resolves.toBe(descriptor);
  });

  it("11. behavioral: refreshPublicIdentity() invokes the Reader exactly once per call, same as readPublicIdentity()", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(null) };
    const app = new DesktopApplication(customReader);
    await app.refreshPublicIdentity();
    expect(customReader.readPublicIdentity).toHaveBeenCalledTimes(1);
    await app.refreshPublicIdentity();
    expect(customReader.readPublicIdentity).toHaveBeenCalledTimes(2);
  });

  it("12. behavioral: refreshPublicIdentity() never triggers the Identity Service -- confirmed via spy, zero calls", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.refreshPublicIdentity();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("13. behavioral: a rejected Reader promise propagates unchanged through refreshPublicIdentity()", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockRejectedValue(new Error("simulated Reader failure")) };
    const app = new DesktopApplication(customReader);
    await expect(app.refreshPublicIdentity()).rejects.toThrow("simulated Reader failure");
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("14. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc or to refreshPublicIdentity", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_131/);
    expect(createDesktopApplicationSource).not.toMatch(/refreshPublicIdentity/);
  });

  it("15. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_131/);
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_131/);
    }
  });
});

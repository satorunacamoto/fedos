import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_136_startup_sequence.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
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
 * Secure Runtime Alpha 136 -- "Startup Sequence": Stage 1 of the
 * Desktop Startup Identity Sequence Arc. Rewrites start() to run
 * bootstrap() then refreshPublicIdentity(), sequentially, in that
 * fixed order, before marking #started true. No processing in
 * between.
 */
describe("Secure Runtime Alpha 136 -- Startup Sequence", () => {
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

  it("3. structural: start()'s own entire body matches the exact five-statement sequence, in fixed order", () => {
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

  it("4. structural: bootstrap() precedes refreshPublicIdentity() in start()'s own body -- confirmed by line index order", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const bootstrapIndex = body.indexOf("await this.bootstrap();");
    const refreshIndex = body.indexOf("await this.refreshPublicIdentity();");
    expect(bootstrapIndex).toBeGreaterThan(-1);
    expect(refreshIndex).toBeGreaterThan(-1);
    expect(bootstrapIndex).toBeLessThan(refreshIndex);
  });

  it("5. structural: bootstrap(), refreshPublicIdentity(), readPublicIdentity(), currentIdentity(), isBootstrapped(), and currentPublicIdentity() remain byte-for-byte unchanged", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(bootstrapBody.split("\n").map((l: string) => l.trim()).filter(Boolean)).toEqual([
      "return this.#identity.bootstrapIdentity();",
    ]);
    const refreshBody = (classBody.match(/refreshPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(refreshBody.split("\n").map((l: string) => l.trim()).filter(Boolean)).toEqual([
      "return this.readPublicIdentity();",
    ]);
    const readBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(readBody.split("\n").map((l: string) => l.trim()).filter(Boolean)).toEqual([
      "const result = await this.#reader.readPublicIdentity();",
      "this.#currentPublicIdentity = result;",
      "return result;",
    ]);
    const currentIdentityBody = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(currentIdentityBody.split("\n").map((l: string) => l.trim()).filter(Boolean)).toEqual([
      "return this.#identity.currentIdentity();",
    ]);
    const isBootstrappedBody = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(isBootstrappedBody.split("\n").map((l: string) => l.trim()).filter(Boolean)).toEqual([
      "return this.#identity.isBootstrapped();",
    ]);
    const currentPublicIdentityBody = (classBody.match(/currentPublicIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(currentPublicIdentityBody.split("\n").map((l: string) => l.trim()).filter(Boolean)).toEqual([
      "return this.#currentPublicIdentity;",
    ]);
  });

  it("6. structural: the class still has exactly seven public methods and five private fields", () => {
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

  it("7. the design doc's own purity section confirms no processing in between, fixed order, and no new field/method", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No processing in between:\*\*/);
    expect(section).toMatch(/\*\*Fixed order:\*\*/);
    expect(section).toMatch(/\*\*No new field, no new method:\*\*/);
  });

  it("8. the design doc cross-references Alpha 092, Alpha 098, and Alpha 131", () => {
    for (const ref of [
      "secure_runtime_alpha_092_bootstrap_sequence_review",
      "secure_runtime_alpha_098_ready_state",
      "secure_runtime_alpha_131_desktop_refresh_api",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("9. behavioral: start() drives both bootstrap and Public Identity Refresh -- exactly one Service call and one Reader call", async () => {
    const serviceSpy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await app.start();
    expect(serviceSpy).toHaveBeenCalledTimes(1);
    expect(readerSpy).toHaveBeenCalledTimes(1);
    serviceSpy.mockRestore();
  });

  it("10. behavioral: after start() resolves, currentPublicIdentity() reflects the Reader's own resolved value", async () => {
    const descriptor = { id: "alpha136-e2e", provider: "nostr", publicIdentifier: "npub1alpha136" };
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(descriptor) };
    const app = new DesktopApplication(customReader);
    await app.start();
    expect(app.currentPublicIdentity()).toBe(descriptor);
  });

  it("11. behavioral: if bootstrap() rejects, refreshPublicIdentity() is never called -- the Reader is untouched", async () => {
    const serviceSpy = vi
      .spyOn(FedosIdentityService.prototype, "describeIdentity")
      .mockRejectedValueOnce(new Error("simulated Provider failure"));
    const readerSpy = vi.fn().mockResolvedValue(null);
    const app = new DesktopApplication({ readPublicIdentity: readerSpy });
    await expect(app.start()).rejects.toThrow("simulated Provider failure");
    expect(readerSpy).not.toHaveBeenCalled();
    serviceSpy.mockRestore();
  });

  it("12. behavioral: a second start() call still throws, exactly as before this Stage", async () => {
    const app = new DesktopApplication();
    await app.start();
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_136/);
  });

  it("14. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_136/);
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_136/);
    }
  });
});

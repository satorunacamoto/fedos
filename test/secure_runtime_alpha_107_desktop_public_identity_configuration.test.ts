import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_107_desktop_public_identity_configuration.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerInterfaceSource from "../src/os/messenger/desktop/fedos_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
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
 * Secure Runtime Alpha 107 -- "Desktop Public Identity Configuration":
 * Stage 2 of the Nostr Public Identity Implementation Arc. Adds a
 * second, optional, trailing constructor parameter,
 * publicIdentity: FedosNostrPublicIdentitySnapshot | undefined =
 * undefined, and a new #publicIdentity field. Purely additive -- the
 * pre-existing reader parameter stays first, unchanged, so every
 * existing no-argument or reader-only call site keeps working.
 * #publicIdentity is held but read by nothing yet.
 */
describe("Secure Runtime Alpha 107 -- Desktop Public Identity Configuration", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/desktop_application\.ts`, and nothing else/,
    );
  });

  it("3. structural: #publicIdentity is declared as a readonly optional field with the exact type", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(
      /readonly #publicIdentity: FedosNostrPublicIdentitySnapshot \| undefined;/,
    );
  });

  it("4. structural: the constructor has reader FIRST (unchanged default) and publicIdentity SECOND, defaulting to undefined", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    expect(classBody).toMatch(
      /constructor\(\s*\n\s*reader: FedosPublicIdentityReader = new NostrPublicIdentityReader\(resolveNostrPublicIdentitySource\(\)\),\s*\n\s*publicIdentity: FedosNostrPublicIdentitySnapshot \| undefined = undefined,\s*\n\s*\) \{/,
    );
  });

  it("5. structural: the constructor's own entire body is exactly three statements, in order", () => {
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
  });

  it("6. structural: no method on DesktopApplication ever reads #publicIdentity outside the constructor", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const bootstrapBody = (classBody.match(/async bootstrap\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const startBody = (classBody.match(/async start\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(bootstrapBody).not.toMatch(/#publicIdentity/);
    expect(startBody).not.toMatch(/#publicIdentity/);
  });

  it("7. the design doc's own rationale section explains why publicIdentity is SECOND, not first, citing default-parameter evaluation order", () => {
    const section = (designDocSource.match(/## 3\. Why purely additive, and why SECOND, not FIRST([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/default-parameter expressions may reference only EARLIER parameters/);
    expect(section).toMatch(/every call site across Alpha 096–105's own test suites — continue to/);
  });

  it("8. the design doc's own 'does NOT do' list confirms reader's default is not computed from publicIdentity, and no public reader method is added", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* compute `reader`'s own default value from\s*\n\s*`publicIdentity`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any public method that reads `#publicIdentity`/);
  });

  it("9. the design doc cross-references Alpha 044, Alpha 049, Alpha 103, and Alpha 106", () => {
    for (const ref of [
      "secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion",
      "secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_106_public_identity_source_interface_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: purely additive, every existing call site still works
  // ---------------------------------------------------------------------

  it("10. behavioral: new DesktopApplication() with NO arguments still works end to end, unaffected by this Stage", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("11. behavioral: new DesktopApplication(customReader) with only a Reader still works, publicIdentity defaults to undefined internally", () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(null) };
    expect(() => new DesktopApplication(customReader)).not.toThrow();
  });

  it("12. behavioral: new DesktopApplication(customReader, snapshot) accepts both arguments without error", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(null) };
    const snapshot = { id: "alpha107-config", publicIdentifier: "npub1alpha107" };
    const app = new DesktopApplication(customReader, snapshot);
    await expect(app.bootstrap()).resolves.toBeUndefined();
  });

  it("13. behavioral: supplying publicIdentity has NO effect on Bootstrap or start() -- confirmed unaffected, since nothing reads it yet", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const snapshot = { id: "alpha107-noeffect", publicIdentifier: "npub1alpha107noeffect" };
    const app = new DesktopApplication(undefined, snapshot);
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
    spy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("14. Regression: create_desktop_application.ts, fedos_public_identity_reader.ts, and nostr_public_identity_reader.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createDesktopApplicationSource, readerInterfaceSource, nostrPublicIdentityReaderSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_107/);
    }
  });

  it("15. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_107/);
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to publicIdentity", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_107/);
      expect(source).not.toMatch(/publicIdentity/);
    }
  });
});

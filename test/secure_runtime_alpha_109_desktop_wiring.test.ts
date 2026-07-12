import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_109_desktop_wiring.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import staticSourceSource from "../src/desktop/static_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 109 -- "Desktop Wiring": Stage 4 of the Nostr
 * Public Identity Implementation Arc. Rewrites createDesktopApplication()
 * to accept an optional publicIdentity parameter -- when supplied,
 * wraps it in a StaticNostrPublicIdentitySource; when omitted,
 * resolves through resolveNostrPublicIdentitySource() exactly as
 * before. Either way, wraps the Source in a NostrPublicIdentityReader
 * and passes both reader and publicIdentity into DesktopApplication.
 */
describe("Secure Runtime Alpha 109 -- Desktop Wiring", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage modifying exactly one file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies exactly one file,\s*\n`src\/desktop\/create_desktop_application\.ts`, and nothing else/,
    );
  });

  it("3. structural: createDesktopApplication() has the exact conditional-Source signature and body", () => {
    expect(createDesktopApplicationSource).toMatch(
      /export function createDesktopApplication\(\s*\n\s*publicIdentity\?: FedosNostrPublicIdentitySnapshot,\s*\n\s*\): DesktopApplication \{\s*\n\s*const source = publicIdentity\s*\n\s*\? new StaticNostrPublicIdentitySource\(publicIdentity\)\s*\n\s*: resolveNostrPublicIdentitySource\(\);\s*\n\s*const reader = new NostrPublicIdentityReader\(source\);\s*\n\s*return new DesktopApplication\(reader, publicIdentity\);\s*\n\}/,
    );
  });

  it("4. the design doc's own default-behavior section confirms zero behavior change for existing no-argument call sites", () => {
    const section = (designDocSource.match(/## 3\. Default configuration behavior confirmed unchanged([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/every existing\s*\ncall site across Alpha 096–108's own test suites/);
    expect(section).toMatch(/completely unaffected by this Stage/);
  });

  it("5. the design doc's own 'does NOT do' list confirms no validation of publicIdentity and no reader-reading call", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* validate, normalize, or transform `publicIdentity` in\s*\n\s*any way/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* call `bootstrap\(\)`, `start\(\)`, or `readPublicIdentity\(\)`\s*\n\s*on anything it constructs/,
    );
  });

  it("6. the design doc cross-references Alpha 048, Alpha 103, Alpha 107, and Alpha 108", () => {
    for (const ref of [
      "secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_107_desktop_public_identity_configuration",
      "secure_runtime_alpha_108_static_public_identity_source",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: default path unchanged, Static path actually delivers
  // ---------------------------------------------------------------------

  it("7. behavioral: createDesktopApplication() with NO argument still bootstraps and behaves exactly as before -- zero behavior change", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication();
    expect(app).toBeInstanceOf(DesktopApplication);
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("8. behavioral: createDesktopApplication(publicIdentity) constructs successfully and still bootstraps independently -- Bootstrap remains unaffected by the Reader configuration", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const snapshot = { id: "alpha109-e2e", publicIdentifier: "npub1alpha109" };
    const app = createDesktopApplication(snapshot);
    expect(app).toBeInstanceOf(DesktopApplication);
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("9. behavioral: createDesktopApplication(publicIdentity) never throws, even repeated many times with different snapshots", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(() => createDesktopApplication({ id: `id-${i}`, publicIdentifier: `npub1${i}` })).not.toThrow();
    }
  });

  it("10. behavioral: createDesktopApplication() and createDesktopApplication(publicIdentity) each return a fresh, independent instance", () => {
    const defaultApp = createDesktopApplication();
    const staticApp = createDesktopApplication({ id: "alpha109-independent", publicIdentifier: "npub1alpha109independent" });
    expect(defaultApp).not.toBe(staticApp);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts, nostr_public_identity_reader.ts, and static_nostr_public_identity_source.ts are completely unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [desktopApplicationSource, nostrPublicIdentityReaderSource, staticSourceSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_109/);
    }
  });

  it("12. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_109/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to publicIdentity/StaticNostrPublicIdentitySource", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_109/);
      expect(source).not.toMatch(/publicIdentity|StaticNostrPublicIdentitySource/);
    }
  });
});

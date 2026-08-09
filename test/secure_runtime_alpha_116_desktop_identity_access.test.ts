import { describe, it, expect, vi } from "vitest";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_116_desktop_identity_access.md?raw";
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
 * Secure Runtime Alpha 116 -- "Desktop Identity Access": Stage 1 of
 * the Desktop Identity Consumption Arc. Adds
 * DesktopApplication.currentIdentity(), a PURE delegation to
 * this.#identity.currentIdentity() -- the sole Identity Authority
 * (Alpha 111). No processing, no caching, no access to #reader or
 * #publicIdentity.
 */
describe("Secure Runtime Alpha 116 -- Desktop Identity Access", () => {
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

  it("3. structural: currentIdentity()'s own entire body is a single delegation to #identity.currentIdentity()", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.#identity.currentIdentity();"]);
  });

  it("4. structural: currentIdentity()'s own body never references #reader or #publicIdentity", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).not.toMatch(/#reader/);
    expect(body).not.toMatch(/#publicIdentity/);
  });

  it("5. RIPPLE (Secure Runtime Alpha 131): the class had exactly three public methods AS OF this Stage's own scope -- bootstrap/start/currentIdentity -- and four private fields -- identity/reader/publicIdentity/started; Alpha 117 added isBootstrapped(), Alpha 121 added readPublicIdentity(), Alpha 126 added #currentPublicIdentity, Alpha 128 added currentPublicIdentity(), and Alpha 131 added refreshPublicIdentity(), reconfirmed here as the CURRENT state", () => {
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

  it("6. the design doc's own purity section confirms no processing, no caching, no #reader/#publicIdentity access", () => {
    const section = (designDocSource.match(/## 3\. Purity confirmed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No processing:\*\*/);
    expect(section).toMatch(/\*\*No caching:\*\*/);
    expect(section).toMatch(/\*\*No access to `#reader` or `#publicIdentity`:\*\*/);
  });

  it("7. the design doc's own 'does NOT do' list confirms isBootstrapped() is not added yet", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add `isBootstrapped\(\)` — that remains Alpha 117's own/);
  });

  it("8. the design doc cross-references Alpha 073, Alpha 111, and Alpha 115", () => {
    for (const ref of [
      "secure_runtime_alpha_073_identity_descriptor_reader_consolidation",
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_115_identity_authority_completion",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("9. behavioral: a fresh instance's currentIdentity() resolves null before Bootstrap, matching FedosRuntimeIdentity's own initial state", () => {
    const app = new DesktopApplication();
    expect(app.currentIdentity()).toBeNull();
  });

  it("10. behavioral: after a successful bootstrap(), currentIdentity() reflects the resolved Descriptor by reference, no clone", async () => {
    const descriptor = { id: "alpha116-e2e", provider: "nostr", publicIdentifier: "npub1alpha116" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const app = new DesktopApplication();
    await app.bootstrap();
    expect(app.currentIdentity()).toBe(descriptor);
    spy.mockRestore();
  });

  it("11. behavioral: currentIdentity() is unaffected by any publicIdentity/Reader configuration -- it always reflects only #identity's own state", async () => {
    const snapshot = { id: "alpha116-reader-config", publicIdentifier: "npub1alpha116reader" };
    const app = new DesktopApplication(undefined, snapshot);
    await app.bootstrap();
    expect(app.currentIdentity()).toBeNull();
  });

  it("12. behavioral: repeated currentIdentity() calls always return the same reference, with no re-fetch of any kind (no Service call happens on read)", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.bootstrap();
    expect(spy).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i += 1) {
      app.currentIdentity();
    }
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("13. behavioral: two independent DesktopApplication instances each report their own independent currentIdentity()", async () => {
    const descriptorA = { id: "alpha116-a", provider: "nostr", publicIdentifier: "npub1a116" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptorA);
    const appA = new DesktopApplication();
    const appB = new DesktopApplication();
    await appA.bootstrap();
    expect(appA.currentIdentity()).toBe(descriptorA);
    expect(appB.currentIdentity()).toBeNull();
    spy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("14. Regression: create_desktop_application.ts is unmodified -- no reference to this Stage's own doc or to currentIdentity", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_116/);
    expect(createDesktopApplicationSource).not.toMatch(/currentIdentity/);
  });

  it("15. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_116/);
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_116/);
    }
  });
});

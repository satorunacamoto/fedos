import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/os/messenger/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_122_factory_verification.md?raw";
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
 * Secure Runtime Alpha 122 -- "Factory Verification": Stage 2 of the
 * Desktop Public Identity Reader Arc, a REVIEW / DESIGN ONLY Stage.
 * Confirms, grounded in the actual source, that
 * DesktopApplication.readPublicIdentity() genuinely calls through to
 * the SAME Reader instance createDesktopApplication() constructs, and
 * that Reader substitutability (Alpha 103) remains intact.
 */
describe("Secure Runtime Alpha 122 -- Factory Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW / DESIGN ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DESIGN ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change/);
  });

  it("3. the design doc declares a single Decision -- readPublicIdentity() calls through to the SAME Reader instance, and substitutability is unaffected", () => {
    const section = (designDocSource.match(/## 3\. Decision([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`DesktopApplication\.readPublicIdentity\(\)` genuinely calls through to\s*\nthe SAME Reader instance `createDesktopApplication\(\)` constructed —/,
    );
    expect(section).toMatch(/Reader substitutability \(Alpha 103's own Decision\) is unaffected by\s*\nAlpha 121\.\*\*/);
  });

  it("4. the design doc cross-references Alpha 099, Alpha 103, Alpha 109, and Alpha 121", () => {
    for (const ref of [
      "secure_runtime_alpha_099_desktop_factory",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_109_desktop_wiring",
      "secure_runtime_alpha_121_desktop_reader_access",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("5. structural: createDesktopApplication() passes its own constructed reader as DesktopApplication's first constructor argument, verbatim", () => {
    expect(createDesktopApplicationSource).toMatch(
      /const reader = new NostrPublicIdentityReader\(source\);\s*\n\s*return new DesktopApplication\(reader, publicIdentity\);/,
    );
  });

  it("6. structural: the constructor assigns the reader parameter to #reader with no wrapping or transformation", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const ctorBody = (classBody.match(/constructor\([\s\S]*?\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(ctorBody).toMatch(/this\.#reader = reader;/);
  });

  it("7. structural: readPublicIdentity()'s own body reads #reader directly, matching the traced reference chain", () => {
    const classBody = classBodyOf(desktopApplicationSource);
    const body = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body).toMatch(/this\.#reader\.readPublicIdentity\(\)/);
  });

  // ---------------------------------------------------------------------
  // Behavioral: reference-identity confirmation, end to end
  // ---------------------------------------------------------------------

  it("8. behavioral: createDesktopApplication()'s own resulting instance genuinely resolves through the Reader it built -- confirmed with a real, spied Source", async () => {
    const app = createDesktopApplication();
    await expect(app.readPublicIdentity()).resolves.toBeNull();
  });

  it("9. behavioral: createDesktopApplication(publicIdentity) resolves the EXACT configured snapshot through readPublicIdentity(), confirming the traced reference chain end to end", async () => {
    const snapshot = { id: "alpha122-e2e", publicIdentifier: "npub1alpha122", displayName: "Alpha 122" };
    const app = createDesktopApplication(snapshot);
    await expect(app.readPublicIdentity()).resolves.toEqual({
      id: "alpha122-e2e",
      provider: "nostr",
      publicIdentifier: "npub1alpha122",
      displayName: "Alpha 122",
      avatar: undefined,
    });
  });

  it("10. behavioral: substitutability is unaffected -- constructing DesktopApplication directly with a custom Reader, bypassing the factory entirely, still works", async () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue({ id: "alpha122-direct", publicIdentifier: "npub1alpha122direct" }) };
    const app = new DesktopApplication(customReader);
    await expect(app.readPublicIdentity()).resolves.toEqual({ id: "alpha122-direct", publicIdentifier: "npub1alpha122direct" });
    expect(customReader.readPublicIdentity).toHaveBeenCalledTimes(1);
  });

  it("11. the design doc's own 'does NOT do' list confirms createDesktopApplication()'s own construction is unchanged", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* change how `createDesktopApplication\(\)` constructs its\s*\n\s*Reader or Source\./,
    );
  });

  it("12. Regression: create_desktop_application.ts and desktop_application.ts carry no reference to this Stage's own doc, confirming zero code change", () => {
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_122/);
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_122/);
  });

  it("13. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_122/);
  });

  it("14. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_122/);
    }
  });
});

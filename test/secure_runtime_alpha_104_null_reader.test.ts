import { describe, it, expect } from "vitest";
import { NullPublicIdentityReader } from "../src/os/messenger/desktop/null_public_identity_reader.js";
import { createDesktopApplication } from "../src/os/messenger/desktop/create_desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_104_null_reader.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullPublicIdentityReaderSource from "../src/os/messenger/desktop/null_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopIdentityProviderSource from "../src/os/core/identity/fedos_noop_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 104 -- "Null Reader": Stage 4 of the Public
 * Identity Source Foundation Arc. Adds
 * src/desktop/null_public_identity_reader.ts (NullPublicIdentityReader),
 * a dependency-free, always-null FedosPublicIdentityReader
 * implementation mirroring NoopFedosIdentityProvider's own
 * relationship to NostrIdentityProvider. NOT wired into
 * createDesktopApplication() or DesktopApplication's own default --
 * existing behavior maintained 100%.
 */
describe("Secure Runtime Alpha 104 -- Null Reader", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new, unwired file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/null_public_identity_reader\.ts`, and nothing else — no\s*\nexisting file is modified, and this new file is wired into nothing/,
    );
  });

  it("3. NullPublicIdentityReader is the ONLY export from null_public_identity_reader.ts", () => {
    const exportNames = [...nullPublicIdentityReaderSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["NullPublicIdentityReader"]);
  });

  it("4. NullPublicIdentityReader's own class body has NO constructor, NO field, and readPublicIdentity()'s own entire body is a single return null statement", () => {
    const codeOnly = nullPublicIdentityReaderSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const classBody = (codeOnly.match(/export class NullPublicIdentityReader[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/constructor/);
    expect(classBody).not.toMatch(/#\w+/);
    const body = (classBody.match(/async readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return null;"]);
  });

  it("5. the design doc's own 'existing behavior maintained' section confirms zero wiring change", () => {
    const section = (designDocSource.match(/## 3\. Existing behavior maintained 100%([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/wires it into NOTHING/);
    expect(section).toMatch(/continues constructing\s*\n`NostrPublicIdentityReader` exactly as Alpha 103 left it/);
  });

  it("6. the design doc's own 'does NOT do' list confirms NullPublicIdentityReader is not wired into the factory or the class default", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `NullPublicIdentityReader` into\s*\n\s*`createDesktopApplication\(\)`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `DesktopApplication`'s own constructor default/);
  });

  it("7. the design doc cross-references Alpha 033, Alpha 101, and Alpha 103", () => {
    for (const ref of [
      "secure_runtime_alpha_033_fedos_noop_identity_provider",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_103_source_injection",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. structural: desktop_application.ts and create_desktop_application.ts are completely unmodified -- no reference to this Stage's own doc or to NullPublicIdentityReader", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_104/);
      expect(source).not.toMatch(/NullPublicIdentityReader/);
    }
  });

  it("9. structural: nostr_public_identity_reader.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(nostrPublicIdentityReaderSource).not.toMatch(/secure_runtime_alpha_104/);
    expect(nostrPublicIdentityReaderSource).not.toMatch(/NullPublicIdentityReader/);
  });

  it("10. structural: NoopFedosIdentityProvider (the mirrored precedent) is confirmed unaffected by this Stage", () => {
    expect(noopIdentityProviderSource).not.toMatch(/secure_runtime_alpha_104/);
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("11. behavioral: NullPublicIdentityReader.readPublicIdentity() always resolves null, confirmed by direct construction and call", async () => {
    const reader = new NullPublicIdentityReader();
    await expect(reader.readPublicIdentity()).resolves.toBeNull();
  });

  it("12. behavioral: repeated calls on the same instance always resolve null, confirming no hidden state", async () => {
    const reader = new NullPublicIdentityReader();
    for (let i = 0; i < 5; i += 1) {
      await expect(reader.readPublicIdentity()).resolves.toBeNull();
    }
  });

  it("13. behavioral: constructing NullPublicIdentityReader accepts no argument and throws nothing", () => {
    expect(() => new NullPublicIdentityReader()).not.toThrow();
  });

  it("14. RIPPLE (Secure Runtime Alpha 109): createDesktopApplication() still constructs a NostrPublicIdentityReader-backed instance by default, NOT a NullPublicIdentityReader -- confirming zero wiring change of the DEFAULT path even after Alpha 109 added an optional publicIdentity parameter", () => {
    const body = (createDesktopApplicationSource.match(
      /export function createDesktopApplication\([\s\S]*?\): DesktopApplication \{([\s\S]*?)\n\}/,
    ) ?? [])[1] ?? "";
    expect(body).toMatch(/NostrPublicIdentityReader/);
    expect(body).not.toMatch(/NullPublicIdentityReader/);
    expect(() => createDesktopApplication()).not.toThrow();
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("15. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc or to NullPublicIdentityReader", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_104/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/NullPublicIdentityReader/);
  });

  it("16. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to NullPublicIdentityReader", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_104/);
      expect(source).not.toMatch(/NullPublicIdentityReader/);
    }
  });
});

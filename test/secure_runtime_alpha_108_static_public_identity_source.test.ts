import { describe, it, expect } from "vitest";
import { StaticNostrPublicIdentitySource } from "../src/desktop/static_nostr_public_identity_source.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_108_static_public_identity_source.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import staticSourceSource from "../src/desktop/static_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullSourceSource from "../src/identity/fedos_null_nostr_public_identity_source.ts?raw";
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
  return (codeOnly.match(/export class StaticNostrPublicIdentitySource[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

/**
 * Secure Runtime Alpha 108 -- "Static Public Identity Source": Stage 3
 * of the Nostr Public Identity Implementation Arc. Adds
 * src/desktop/static_nostr_public_identity_source.ts
 * (StaticNostrPublicIdentitySource), the FIRST real (non-Null)
 * FedosNostrPublicIdentitySource implementation. Wraps exactly one
 * constructor-supplied snapshot and returns it verbatim on every
 * call, with zero I/O. NOT wired into anything by this Stage.
 */
describe("Secure Runtime Alpha 108 -- Static Public Identity Source", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new, unwired file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/static_nostr_public_identity_source\.ts`, and nothing\s*\nelse — no existing file is modified, and this new file is wired into\s*\nnothing/,
    );
  });

  it("3. StaticNostrPublicIdentitySource is the ONLY export from static_nostr_public_identity_source.ts", () => {
    const exportNames = [...staticSourceSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["StaticNostrPublicIdentitySource"]);
  });

  it("4. the constructor takes exactly one parameter and stores it verbatim, with no validation", () => {
    const classBody = classBodyOf(staticSourceSource);
    expect(classBody).toMatch(/readonly #snapshot: FedosNostrPublicIdentitySnapshot;/);
    const ctorBody = (classBody.match(/constructor\(snapshot: FedosNostrPublicIdentitySnapshot\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = ctorBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["this.#snapshot = snapshot;"]);
  });

  it("5. readPublicIdentity()'s own entire body is a single return of the held snapshot, nothing else", () => {
    const classBody = classBodyOf(staticSourceSource);
    const body = (classBody.match(/async readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["return this.#snapshot;"]);
  });

  it("6. no Relay, WebSocket, NIP, event, signing, or secret-key reference exists IN CODE (the header comment legitimately names these as forbidden guardrails)", () => {
    const classBody = classBodyOf(staticSourceSource);
    expect(classBody).not.toMatch(/Relay|WebSocket|nsec|seed|mnemonic|secretKey|privateKey/i);
    expect(classBody).not.toMatch(/\bsign\b|signature|verify/i);
    expect(classBody).not.toMatch(/\bNIP-?\d+/i);
  });

  it("7. the design doc's own relationship section confirms this is the counterpart to NullNostrPublicIdentitySource", () => {
    const section = (designDocSource.match(/## 3\. Relationship to `NullNostrPublicIdentitySource`([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/the "one fixed identity" counterpart to/);
    expect(section).toMatch(/Neither performs any I\/O/);
  });

  it("8. the design doc's own 'does NOT do' list confirms no wiring occurs at this Stage", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* wire `StaticNostrPublicIdentitySource` into\s*\n\s*`createDesktopApplication\(\)`, `DesktopApplication`, or any other/,
    );
  });

  it("9. the design doc cross-references Alpha 039, Alpha 044, Alpha 106, and Alpha 107", () => {
    for (const ref of [
      "secure_runtime_alpha_039_nostr_public_identity_source_boundary",
      "secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion",
      "secure_runtime_alpha_106_public_identity_source_interface_review",
      "secure_runtime_alpha_107_desktop_public_identity_configuration",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("10. behavioral: StaticNostrPublicIdentitySource.readPublicIdentity() returns the exact snapshot supplied at construction", async () => {
    const snapshot = { id: "alpha108-static", publicIdentifier: "npub1alpha108" };
    const source = new StaticNostrPublicIdentitySource(snapshot);
    await expect(source.readPublicIdentity()).resolves.toBe(snapshot);
  });

  it("11. behavioral: repeated calls always return the SAME snapshot reference, unchanged", async () => {
    const snapshot = { id: "alpha108-repeat", publicIdentifier: "npub1alpha108repeat" };
    const source = new StaticNostrPublicIdentitySource(snapshot);
    const first = await source.readPublicIdentity();
    const second = await source.readPublicIdentity();
    expect(first).toBe(snapshot);
    expect(second).toBe(snapshot);
  });

  it("12. behavioral: displayName/avatar, when supplied, are preserved verbatim; when omitted, remain undefined", async () => {
    const withOptional = new StaticNostrPublicIdentitySource({
      id: "alpha108-optional",
      publicIdentifier: "npub1alpha108optional",
      displayName: "Alpha 108 Display Name",
      avatar: "https://example.com/avatar.png",
    });
    const withoutOptional = new StaticNostrPublicIdentitySource({
      id: "alpha108-bare",
      publicIdentifier: "npub1alpha108bare",
    });
    const resultWith = await withOptional.readPublicIdentity();
    const resultWithout = await withoutOptional.readPublicIdentity();
    expect(resultWith?.displayName).toBe("Alpha 108 Display Name");
    expect(resultWith?.avatar).toBe("https://example.com/avatar.png");
    expect(resultWithout?.displayName).toBeUndefined();
    expect(resultWithout?.avatar).toBeUndefined();
  });

  it("13. behavioral: two independently-constructed StaticNostrPublicIdentitySource instances never share state", async () => {
    const sourceA = new StaticNostrPublicIdentitySource({ id: "a", publicIdentifier: "npub1a" });
    const sourceB = new StaticNostrPublicIdentitySource({ id: "b", publicIdentifier: "npub1b" });
    const resultA = await sourceA.readPublicIdentity();
    const resultB = await sourceB.readPublicIdentity();
    expect(resultA?.id).toBe("a");
    expect(resultB?.id).toBe("b");
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("14. RIPPLE (Secure Runtime Alpha 109): desktop_application.ts, create_desktop_application.ts, and nostr_public_identity_reader.ts never referenced StaticNostrPublicIdentitySource AS OF this Stage's own scope; Alpha 109 legitimately wired it into create_desktop_application.ts, reconfirmed here as the CURRENT state -- this Stage's own doc reference is still absent everywhere", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource, nostrPublicIdentityReaderSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_108/);
    }
    expect(desktopApplicationSource).not.toMatch(/StaticNostrPublicIdentitySource/);
    expect(nostrPublicIdentityReaderSource).not.toMatch(/StaticNostrPublicIdentitySource/);
    expect(createDesktopApplicationSource).toMatch(/StaticNostrPublicIdentitySource/);
  });

  it("15. structural: fedos_null_nostr_public_identity_source.ts (the mirrored precedent) is confirmed unaffected by this Stage", () => {
    expect(nullSourceSource).not.toMatch(/secure_runtime_alpha_108/);
  });

  it("16. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc or to StaticNostrPublicIdentitySource", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_108/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/StaticNostrPublicIdentitySource/);
  });

  it("17. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to StaticNostrPublicIdentitySource", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_108/);
      expect(source).not.toMatch(/StaticNostrPublicIdentitySource/);
    }
  });
});

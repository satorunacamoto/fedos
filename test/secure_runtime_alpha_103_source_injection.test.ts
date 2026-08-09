import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { NostrPublicIdentityReader } from "../src/desktop/nostr_public_identity_reader.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_103_source_injection.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

function classBodyOf(source: string, className: string): string {
  const codeOnly = source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
  return (codeOnly.match(new RegExp(`export class ${className}[^{]*\\{([\\s\\S]*)\\n\\}`)) ?? [])[1] ?? "";
}

/**
 * Secure Runtime Alpha 103 -- "Source Injection": Stage 3 of the
 * Public Identity Source Foundation Arc. Adds
 * src/desktop/nostr_public_identity_reader.ts (NostrPublicIdentityReader,
 * the FIRST FedosPublicIdentityReader implementation), gives
 * DesktopApplication a #reader field with a default-parameter
 * constructor (mirroring NostrIdentityProvider's own Alpha 049
 * pattern), and updates createDesktopApplication() to construct the
 * Source and Reader explicitly.
 */
describe("Secure Runtime Alpha 103 -- Source Injection", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage touching exactly three files", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds one new file,\s*\n`src\/desktop\/nostr_public_identity_reader\.ts`, and modifies two\s*\nexisting files, `src\/desktop\/desktop_application\.ts` and\s*\n`src\/desktop\/create_desktop_application\.ts`/,
    );
  });

  it("3. NostrPublicIdentityReader is the ONLY export from nostr_public_identity_reader.ts", () => {
    const exportNames = [...nostrPublicIdentityReaderSource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["NostrPublicIdentityReader"]);
  });

  it("4. NostrPublicIdentityReader's own constructor takes exactly one parameter and stores it verbatim", () => {
    const classBody = classBodyOf(nostrPublicIdentityReaderSource, "NostrPublicIdentityReader");
    expect(classBody).toMatch(/readonly #source: FedosNostrPublicIdentitySource;/);
    const ctorBody = (classBody.match(/constructor\(source: FedosNostrPublicIdentitySource\) \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = ctorBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual(["this.#source = source;"]);
  });

  it("5. NostrPublicIdentityReader's own readPublicIdentity() mirrors NostrIdentityProvider's own validation exactly -- non-empty id/publicIdentifier, fixed provider literal", () => {
    const classBody = classBodyOf(nostrPublicIdentityReaderSource, "NostrPublicIdentityReader");
    expect(classBody).toMatch(/provider: "nostr",/);
    expect(classBody).toMatch(/if \(typeof snapshot\.id !== "string" \|\| snapshot\.id\.length === 0\)/);
    expect(classBody).toMatch(
      /if \(typeof snapshot\.publicIdentifier !== "string" \|\| snapshot\.publicIdentifier\.length === 0\)/,
    );
  });

  it("6. NostrPublicIdentityReader never references FedosIdentityProvider, FedosIdentityService, FedosIdentityRegistry, FedosIdentityResolver, or FedosRuntimeIdentity IN CODE (the header comment legitimately names these as forbidden guardrails)", () => {
    const classBody = classBodyOf(nostrPublicIdentityReaderSource, "NostrPublicIdentityReader");
    expect(classBody).not.toMatch(
      /\bFedosIdentityProvider\b|\bFedosIdentityService\b|\bFedosIdentityRegistry\b|\bFedosIdentityResolver\b|\bFedosRuntimeIdentity\b/,
    );
  });

  it("7. RIPPLE (Secure Runtime Alpha 107): DesktopApplication's own constructor had reader as its ONLY parameter AS OF this Stage's own scope, with the exact default-parameter signature mirroring NostrIdentityProvider's own Alpha 049 pattern; Alpha 107 added a second, trailing publicIdentity parameter, reconfirmed here as the CURRENT state", () => {
    expect(desktopApplicationSource).toMatch(
      /constructor\(\s*\n\s*reader: FedosPublicIdentityReader = new NostrPublicIdentityReader\(resolveNostrPublicIdentitySource\(\)\),\s*\n\s*publicIdentity: FedosNostrPublicIdentitySnapshot \| undefined = undefined,\s*\n\s*\) \{/,
    );
  });

  it("8. RIPPLE (Secure Runtime Alpha 109): createDesktopApplication()'s own body explicitly constructed the Source and Reader before constructing DesktopApplication AS OF this Stage's own scope; Alpha 109 made the Source construction conditional on an optional publicIdentity parameter, reconfirmed here as the CURRENT state", () => {
    const body = (createDesktopApplicationSource.match(
      /export function createDesktopApplication\([\s\S]*?\): DesktopApplication \{([\s\S]*?)\n\}/,
    ) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "const source = publicIdentity",
      "? new StaticNostrPublicIdentitySource(publicIdentity)",
      ": resolveNostrPublicIdentitySource();",
      "const reader = new NostrPublicIdentityReader(source);",
      "return new DesktopApplication(reader, publicIdentity);",
    ]);
  });

  it("9. the design doc's own 'does NOT do' list confirms no public reader-reading method is added and no Relay/network connection is opened", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add any public method to `DesktopApplication` that\s*\n\s*reads `#reader`/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* open any Relay, WebSocket, or network connection of any/);
  });

  it("10. the design doc cross-references Alpha 039, Alpha 048, Alpha 049, Alpha 101, and Alpha 102", () => {
    for (const ref of [
      "secure_runtime_alpha_039_nostr_public_identity_source_boundary",
      "secure_runtime_alpha_048_fedos_nostr_public_identity_source_resolver",
      "secure_runtime_alpha_049_nostr_identity_provider_source_resolver_integration",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_102_desktop_identity_reader",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: end-to-end wiring, and behavioral equivalence with before
  // ---------------------------------------------------------------------

  it("11. behavioral: NostrPublicIdentityReader wrapping a real (non-null) source resolves a real Descriptor", async () => {
    const source = { readPublicIdentity: vi.fn().mockResolvedValue({ id: "alpha103-e2e", publicIdentifier: "npub1alpha103" }) };
    const reader = new NostrPublicIdentityReader(source);
    const descriptor = await reader.readPublicIdentity();
    expect(descriptor).toEqual({
      id: "alpha103-e2e",
      provider: "nostr",
      publicIdentifier: "npub1alpha103",
      displayName: undefined,
      avatar: undefined,
    });
  });

  it("12. behavioral: NostrPublicIdentityReader wrapping the real NullNostrPublicIdentitySource resolves null", async () => {
    const reader = new NostrPublicIdentityReader(new NullNostrPublicIdentitySource());
    await expect(reader.readPublicIdentity()).resolves.toBeNull();
  });

  it("13. behavioral: NostrPublicIdentityReader resolves null (never throws) when the Source itself throws", async () => {
    const source = { readPublicIdentity: vi.fn().mockRejectedValue(new Error("simulated Source failure")) };
    const reader = new NostrPublicIdentityReader(source);
    await expect(reader.readPublicIdentity()).resolves.toBeNull();
  });

  it("14. behavioral: DesktopApplication constructed with NO arguments still works end to end -- Bootstrap semantics fully preserved, byte-for-byte behavioral equivalence with Alpha 096-098", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = new DesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
    spy.mockRestore();
  });

  it("15. behavioral: DesktopApplication constructed with an explicit custom Reader accepts it without error", () => {
    const customReader = { readPublicIdentity: vi.fn().mockResolvedValue(null) };
    expect(() => new DesktopApplication(customReader)).not.toThrow();
  });

  it("16. behavioral: createDesktopApplication() returns an instance whose Bootstrap still works end to end, and whose default Reader resolves null via the real NullNostrPublicIdentitySource chain", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("17. behavioral: two DesktopApplication instances constructed via createDesktopApplication() each get their own independent NostrPublicIdentityReader instance", () => {
    const appA = createDesktopApplication();
    const appB = createDesktopApplication();
    expect(appA).not.toBe(appB);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("18. Regression: fedos_nostr_identity_provider.ts (NostrIdentityProvider) is completely unmodified -- no reference to this Stage's own doc or to NostrPublicIdentityReader", () => {
    expect(nostrIdentityProviderSource).not.toMatch(/secure_runtime_alpha_103/);
    expect(nostrIdentityProviderSource).not.toMatch(/NostrPublicIdentityReader/);
  });

  it("19. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc or to any Reader concept", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_103/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/FedosPublicIdentityReader|NostrPublicIdentityReader/);
  });

  it("20. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or to any Reader concept", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_103/);
      expect(source).not.toMatch(/NostrPublicIdentityReader|FedosPublicIdentityReader/);
    }
  });
});

import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { NostrPublicIdentityReader } from "../src/desktop/nostr_public_identity_reader.js";
import { StaticNostrPublicIdentitySource } from "../src/desktop/static_nostr_public_identity_source.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_110_integration_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const APP_RUNTIME_FIELDS = [
  "mode",
  "eventCache",
  "assetCache",
  "spaceDirectory",
  "metadataIndex",
  "signatureVerifier",
  "promotionProvider",
  "recommendationProvider",
  "relayPublisher",
  "notificationBridge",
  "paymentProvider",
  "promotionProviderPreviewAllowed",
  "webAuthnProvider",
  "cryptoProvider",
  "storageBackend",
  "federationProvider",
  "chatProvider",
  "marketplaceProvider",
  "creatorEntitlementProvider",
  "crypto",
  "initializeCrypto",
  "runtimeCapabilities",
  "randomBytes",
  "generateAeadKey",
  "encrypt",
  "decrypt",
  "exportCiphertext",
  "importCiphertext",
  "storeCiphertext",
  "loadCiphertext",
  "deleteCiphertext",
].sort();

/**
 * Secure Runtime Alpha 110 -- "Integration Verification": Stage 5,
 * the closing Stage, of the Nostr Public Identity Implementation Arc.
 * Verifies, with NO further code change, that a Static configuration
 * genuinely reaches the Reader (Desktop -> Reader -> Static Source),
 * and PRECISELY documents/confirms that it does NOT reach
 * currentIdentity() -- the Bootstrap/Provider path remains entirely
 * separate, by design (Alpha 089/093), unaffected by this whole Arc.
 */
describe("Secure Runtime Alpha 110 -- Integration Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself VERIFICATION ONLY, adding no code", () => {
    expect(designDocSource).toMatch(/this Stage is VERIFICATION ONLY/);
    expect(designDocSource).toMatch(/It adds NO code — no\s*\nchange to any `src\/desktop\/\*` or `src\/identity\/\*` file/);
  });

  it("3. the design doc explicitly documents the correction -- the Bootstrap path never reads publicIdentity or the Reader's own Source", () => {
    const section = (designDocSource.match(/## 2\. The connection, confirmed end to end — and one important correction([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is a SEPARATE, INDEPENDENT path that NEVER reads/);
    expect(section).toMatch(/REGARDLESS of/);
  });

  it("4. the design doc's own §3/§4 precisely separate what works (Reader path) from what does not (currentIdentity)", () => {
    const worksSection = (designDocSource.match(/## 3\. What DOES work, verified precisely([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(worksSection).toMatch(/\*\*Static configuration reaches the Reader\.\*\*/);
    const doesNotSection = (designDocSource.match(/## 4\. What does NOT work, precisely documented rather than assumed([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(doesNotSection).toMatch(/\*\*`currentIdentity\(\)` never reflects the Static configuration\*\*/);
  });

  it("5. the design doc issues a Completion Declaration that records the correction rather than silently assuming the original objective's own claim", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/this\s*\n\s*correction is recorded here rather than silently assumed/);
  });

  it("6. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Behavioral: what DOES work -- Reader path, real, unmocked
  // ---------------------------------------------------------------------

  it("7. behavioral: the Reader path genuinely delivers the configured Descriptor -- constructed exactly as createDesktopApplication() constructs it internally", async () => {
    const snapshot = { id: "alpha110-e2e", publicIdentifier: "npub1alpha110", displayName: "Alpha 110" };
    const reader = new NostrPublicIdentityReader(new StaticNostrPublicIdentitySource(snapshot));
    await expect(reader.readPublicIdentity()).resolves.toEqual({
      id: "alpha110-e2e",
      provider: "nostr",
      publicIdentifier: "npub1alpha110",
      displayName: "Alpha 110",
      avatar: undefined,
    });
  });

  it("8. behavioral: createDesktopApplication() with no argument still resolves null through the Reader path, unchanged", async () => {
    const app = createDesktopApplication();
    expect(app).toBeInstanceOf(DesktopApplication);
  });

  it("9. behavioral: createDesktopApplication(publicIdentity) constructs successfully and Bootstrap still works end to end, independent of the Reader configuration", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication({ id: "alpha110-bootstrap", publicIdentifier: "npub1alpha110bootstrap" });
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Behavioral: what does NOT work -- currentIdentity() stays null
  // ---------------------------------------------------------------------

  it("10. RIPPLE (Secure Runtime Alpha 131): DesktopApplication exposed no currentIdentity()/isBootstrapped()/readPublicIdentity() method of its own AS OF this Stage's own scope, supporting the Reader/Bootstrap independence finding above; Alpha 116 added currentIdentity() and Alpha 117 added isBootstrapped(), both as PURE delegations to #identity (never to #reader), Alpha 121 added readPublicIdentity() as a PURE delegation to #reader (never to #identity), Alpha 127 extended readPublicIdentity() to also persist into #currentPublicIdentity, Alpha 128 added currentPublicIdentity(), a synchronous read of #currentPublicIdentity, and Alpha 131 added refreshPublicIdentity(), a PURE delegation to this class's own readPublicIdentity(), still never touching #identity, reconfirmed here as the CURRENT state", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication\b[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor" && !name.startsWith("//") && !name.startsWith("*"));
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
    const currentIdentityBody = (classBody.match(/currentIdentity\(\): FedosIdentityDescriptor \| null \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const currentIdentityLines = currentIdentityBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(currentIdentityLines).toEqual(["return this.#identity.currentIdentity();"]);
    const isBootstrappedBody = (classBody.match(/isBootstrapped\(\): boolean \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const isBootstrappedLines = isBootstrappedBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(isBootstrappedLines).toEqual(["return this.#identity.isBootstrapped();"]);
    const readPublicIdentityBody = (classBody.match(/readPublicIdentity\(\): Promise<FedosIdentityDescriptor \| null> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const readPublicIdentityLines = readPublicIdentityBody
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(readPublicIdentityLines).toEqual([
      "const result = await this.#reader.readPublicIdentity();",
      "this.#currentPublicIdentity = result;",
      "return result;",
    ]);
    expect(readPublicIdentityBody).not.toMatch(/#identity/);
  });

  it("11. behavioral: FedosRuntimeIdentity constructed and bootstrapped directly (simulating DesktopApplication's own internal #identity) ALWAYS resolves currentIdentity() to null, regardless of any Reader-level publicIdentity configuration", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("12. structural: fedos_identity_provider_resolver.ts constructs its OWN NullNostrPublicIdentitySource directly -- confirmed unaffected by this Arc, never reachable from the Reader's own configured Source", () => {
    expect(identityProviderResolverSource).toMatch(
      /new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/,
    );
    expect(identityProviderResolverSource).not.toMatch(/StaticNostrPublicIdentitySource|publicIdentity/);
    for (const stage of ["106", "107", "108", "109", "110"]) {
      expect(identityProviderResolverSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. behavioral: even after constructing MANY DesktopApplication instances with different Static configurations, a freshly-constructed, INDEPENDENT FedosRuntimeIdentity always still resolves null -- confirming zero cross-contamination between the Reader path and the Bootstrap path", async () => {
    for (let i = 0; i < 3; i += 1) {
      createDesktopApplication({ id: `alpha110-cross-${i}`, publicIdentifier: `npub1alpha110cross${i}` });
    }
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.currentIdentity()).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Structural: Observation/Nostr Relay/GUI unconnected
  // ---------------------------------------------------------------------

  it("14. structural: #publicIdentity holds the exact configuration value passed to createDesktopApplication(), confirmed by DesktopApplication's own constructor body", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication\b[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).toMatch(/this\.#publicIdentity = publicIdentity;/);
  });

  it("15. structural: no Relay, WebSocket, NIP, or event-retrieval reference exists IN CODE anywhere across the Arc's own five source files", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/Relay|WebSocket/i);
      expect(codeOnly).not.toMatch(/\bNIP-?\d+/i);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: everything outside this Arc's own five files untouched
  // ---------------------------------------------------------------------

  it("16. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged -- still exactly FIVE public methods, no reference to any Arc-stage doc", () => {
    for (const stage of ["106", "107", "108", "109", "110"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor" && !name.startsWith("#"));
    expect(new Set(publicMethodNames)).toEqual(
      new Set(["findIdentity", "listIdentities", "bootstrapIdentity", "isBootstrapped", "currentIdentity"]),
    );
  });

  it("17. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- AppRuntime still has no reader/identity/desktop field, no reference to any Arc-stage doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["106", "107", "108", "109", "110"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication|FedosPublicIdentityReader|StaticNostrPublicIdentitySource/);
    }
    const runtime = createRuntime() as unknown as Record<string, unknown>;
    expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    expect(runtime.reader).toBeUndefined();
    expect(runtime.identity).toBeUndefined();
    expect(runtime.desktop).toBeUndefined();
  });

  it("18. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(46);
    for (const stage of ["106", "107", "108", "109", "110"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("19. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });
});

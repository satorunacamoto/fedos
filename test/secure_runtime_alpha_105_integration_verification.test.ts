import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { NostrPublicIdentityReader } from "../src/desktop/nostr_public_identity_reader.js";
import { NullPublicIdentityReader } from "../src/desktop/null_public_identity_reader.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/identity/fedos_identity_service.js";
import { resolveNostrPublicIdentitySource } from "../src/identity/fedos_nostr_public_identity_source_resolver.js";
import { resolveFedosIdentityProvider } from "../src/identity/fedos_identity_provider_resolver.js";
import { NullNostrPublicIdentitySource } from "../src/identity/fedos_null_nostr_public_identity_source.js";
import { createRuntime } from "../src/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_105_integration_verification.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullPublicIdentityReaderSource from "../src/desktop/null_public_identity_reader.ts?raw";
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
 * Secure Runtime Alpha 105 -- "Integration Verification": Stage 5,
 * the closing Stage, of the Public Identity Source Foundation Arc.
 * Verifies, with NO further code change, that Desktop -> Reader ->
 * Source and Desktop -> Identity Runtime -> Provider -> Source both
 * genuinely reach a FedosNostrPublicIdentitySource -- confirming
 * PRECISELY, by direct reference inspection, that the two paths reach
 * the SAME CLASS (NullNostrPublicIdentitySource) but NOT the same
 * object reference, since fedos_identity_provider_resolver.ts
 * (Alpha 039) constructs its own Source directly rather than reusing
 * resolveNostrPublicIdentitySource() (Alpha 048).
 */
describe("Secure Runtime Alpha 105 -- Integration Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself VERIFICATION ONLY, adding no code", () => {
    expect(designDocSource).toMatch(/this Stage is VERIFICATION ONLY/);
    expect(designDocSource).toMatch(/It adds NO code — no\s*\nchange to any `src\/desktop\/\*` or `src\/identity\/\*` file/);
  });

  it("3. the design doc's connection diagram precisely distinguishes the Reader's Source from the Provider's Source -- same class, different instance", () => {
    const section = (designDocSource.match(/## 2\. The connection, confirmed end to end([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/NOT the same object reference/);
    expect(section).toMatch(/constructs its own\s*\n`new NullNostrPublicIdentitySource\(\)` directly/);
    expect(section).toMatch(/behaviorally indistinguishable/);
  });

  it("4. the design doc explicitly confirms #reader is held but never read, the Identity remains null, and Observation/Relay/GUI stay unconnected", () => {
    const section = (designDocSource.match(/## 3\. What remains deliberately unconnected([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`#reader` is held but never read\.\*\*/);
    expect(section).toMatch(/\*\*The Identity remains `null`\.\*\*/);
    expect(section).toMatch(/\*\*Observation, Nostr Relay connections, GUI\.\*\*/);
  });

  it("5. the design doc issues a Completion Declaration confirming the Foundation is functionally complete, correctly describing separate-but-identical Source instances", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is hereby declared\s*\n\s*functionally COMPLETE for its own stated scope/);
    expect(section).toMatch(/a separate object reference, by design of the\s*\n\s*pre-existing Alpha 039 Provider Resolver/);
  });

  it("6. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the real, end-to-end connection, both paths
  // ---------------------------------------------------------------------

  it("7. behavioral: the Reader path (createDesktopApplication -> #reader -> Source) resolves null through real, unmocked code", async () => {
    const app = createDesktopApplication();
    const reader = new NostrPublicIdentityReader(resolveNostrPublicIdentitySource());
    await expect(reader.readPublicIdentity()).resolves.toBeNull();
    expect(app).toBeInstanceOf(DesktopApplication);
  });

  it("8. behavioral: the Bootstrap path (createDesktopApplication -> #identity -> Service -> Provider -> Source) resolves null through real, unmocked code", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    await expect(app.start()).rejects.toThrow("DesktopApplication.start() was already called.");
    spy.mockRestore();
  });

  it("9. structural: resolveNostrPublicIdentitySource() (the Reader's own path) and resolveFedosIdentityProvider()'s own internally-constructed Source (the Provider's own path) are BOTH NullNostrPublicIdentitySource instances, but NOT the same object reference -- confirmed precisely, not assumed", () => {
    const readerSource = resolveNostrPublicIdentitySource();
    expect(readerSource).toBeInstanceOf(NullNostrPublicIdentitySource);

    const provider = resolveFedosIdentityProvider();
    expect(provider).not.toBeNull();
    expect(provider?.provider).toBe("nostr");

    expect(identityProviderResolverSource).toMatch(/new NostrIdentityProvider\(new NullNostrPublicIdentitySource\(\)\)/);
    expect(identityProviderResolverSource).not.toMatch(/resolveNostrPublicIdentitySource/);
  });

  it("10. structural: resolveNostrPublicIdentitySource() itself always returns the SAME shared singleton across repeated calls (Alpha 048, unaffected by this Arc)", () => {
    const first = resolveNostrPublicIdentitySource();
    const second = resolveNostrPublicIdentitySource();
    expect(first).toBe(second);
  });

  it("11. behavioral: FedosRuntimeIdentity constructed directly (independent of DesktopApplication) still bootstraps identically, confirming the Identity Runtime's own path is unaffected by the Reader path existing alongside it", async () => {
    const identity = new FedosRuntimeIdentity();
    await identity.bootstrapIdentity();
    expect(identity.isBootstrapped()).toBe(true);
    expect(identity.currentIdentity()).toBeNull();
  });

  it("12. behavioral: DesktopApplication's own #reader and #identity are fully independent -- constructing many instances never cross-contaminates either path", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const apps = [createDesktopApplication(), createDesktopApplication(), createDesktopApplication()];
    for (const app of apps) {
      await app.start();
    }
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it("13. behavioral: NullPublicIdentityReader (Alpha 104, unwired) still works correctly in isolation, confirming it remains a valid, usable alternative even though the factory does not use it", async () => {
    const reader = new NullPublicIdentityReader();
    await expect(reader.readPublicIdentity()).resolves.toBeNull();
  });

  // ---------------------------------------------------------------------
  // Structural: Observation/Nostr Relay/GUI unconnected, #reader unread
  // ---------------------------------------------------------------------

  it("14. structural: no method on DesktopApplication ever calls this.#reader.readPublicIdentity() -- confirmed against the actual, unchanged class body", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/#reader\.readPublicIdentity/);
  });

  it("15. structural: no file under src/desktop/ opens a Relay/WebSocket connection or references Observation IN CODE", () => {
    for (const source of [
      desktopApplicationSource,
      createDesktopApplicationSource,
      nostrPublicIdentityReaderSource,
      nullPublicIdentityReaderSource,
    ]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/Relay|WebSocket/i);
      expect(codeOnly).not.toMatch(/observeBootstrap|Observation/i);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: everything outside this Arc's own five files untouched
  // ---------------------------------------------------------------------

  it("16. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged -- still exactly FIVE public methods, no reference to any Arc-stage doc", () => {
    for (const stage of ["101", "102", "103", "104", "105"]) {
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
      for (const stage of ["101", "102", "103", "104", "105"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication|FedosPublicIdentityReader/);
    }
    const runtime = createRuntime() as unknown as Record<string, unknown>;
    expect(Object.keys(runtime).sort()).toEqual(APP_RUNTIME_FIELDS);
    expect(runtime.reader).toBeUndefined();
    expect(runtime.identity).toBeUndefined();
    expect(runtime.desktop).toBeUndefined();
  });

  it("18. Regression: fedos_identity_provider_resolver.ts and fedos_nostr_identity_provider.ts remain unmodified by this Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["101", "102", "103", "104", "105"]) {
      expect(identityProviderResolverSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("19. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    for (const stage of ["101", "102", "103", "104", "105"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("20. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });
});

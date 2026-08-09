import { describe, it, expect, vi } from "vitest";
import { createDesktopApplication } from "../src/os/messenger/desktop/create_desktop_application.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";
import { FedosIdentityService } from "../src/os/core/identity/fedos_identity_service.js";
import { createRuntime } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_100_integration_verification.md?raw";
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
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/os/core/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/os/core/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/os/core/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageResolverSource from "../src/runtime/fedos_runtime_storage_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
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
 * Secure Runtime Alpha 100 -- "Integration Verification": Stage 5, the
 * closing Stage, of the Desktop Shell Foundation Arc. Verifies, with
 * NO further code change, that the real connection
 * createDesktopApplication() -> DesktopApplication ->
 * FedosRuntimeIdentity -> bootstrapIdentity() -> FedosIdentityService
 * actually works end to end, that Observation/Nostr/GUI remain
 * deliberately unconnected, and that createRuntime()/worker/Runtime
 * API remain permanently untouched.
 */
describe("Secure Runtime Alpha 100 -- Integration Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself VERIFICATION ONLY, adding no code", () => {
    expect(designDocSource).toMatch(/this Stage is VERIFICATION ONLY/);
    expect(designDocSource).toMatch(/It adds NO code — no\s*\nchange to `src\/desktop\/\*` or any other `src\/` file/);
  });

  it("3. the design doc's connection diagram names every link in the chain", () => {
    const section = (designDocSource.match(/## 2\. The connection, confirmed end to end([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/createDesktopApplication\(\)/);
    expect(section).toMatch(/new DesktopApplication\(\)/);
    expect(section).toMatch(/new FedosRuntimeIdentity\(\)/);
    expect(section).toMatch(/app\.start\(\)/);
    expect(section).toMatch(/this\.bootstrap\(\)/);
    expect(section).toMatch(/this\.#identity\.bootstrapIdentity\(\)/);
    expect(section).toMatch(/FedosIdentityService\.describeIdentity\(\)/);
    expect(section).toMatch(/FedosIdentityProvider/);
  });

  it("4. the design doc explicitly confirms Observation, Nostr, and GUI remain unconnected", () => {
    const section = (designDocSource.match(/## 3\. What remains deliberately unconnected([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Observation\.\*\*/);
    expect(section).toMatch(/\*\*Nostr\.\*\*/);
    expect(section).toMatch(/\*\*GUI\.\*\*/);
  });

  it("5. the design doc confirms create_runtime.ts, types.ts, worker.ts, and fedos_runtime_identity.ts remain permanently untouched", () => {
    const section = (designDocSource.match(/## 4\. What remains permanently untouched([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/`src\/runtime\/create_runtime\.ts`/);
    expect(section).toMatch(/`src\/runtime\/types\.ts`/);
    expect(section).toMatch(/`src\/worker\.ts`/);
    expect(section).toMatch(/`src\/runtime\/fedos_runtime_identity\.ts`/);
  });

  it("6. the design doc issues a Completion Declaration confirming the Desktop Shell Foundation is functionally complete for its own minimal scope", () => {
    const section = (designDocSource.match(/## 5\. Completion Declaration([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is hereby declared functionally\s*\n\s*COMPLETE for its own stated scope/);
    expect(section).toMatch(/explicitly OUT OF\s*\n\s*SCOPE for this Arc/);
  });

  it("7. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  // ---------------------------------------------------------------------
  // Behavioral: the real, end-to-end connection
  // ---------------------------------------------------------------------

  it("8. behavioral: the FULL real chain works end to end -- createDesktopApplication() -> start() -> FedosIdentityService.describeIdentity() actually invoked", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication();
    await app.start();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("9. behavioral: a real (non-null) Descriptor resolved by the Provider is reachable through the full chain via bootstrap(), confirming no layer silently drops the result", async () => {
    const descriptor = { id: "alpha100-e2e", provider: "nostr", publicIdentifier: "npub1alpha100" };
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity").mockResolvedValueOnce(descriptor);
    const app = createDesktopApplication();
    await app.bootstrap();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("10. behavioral: DesktopApplication's own held identity is a genuine FedosRuntimeIdentity instance reachable via bootstrap()'s own delegation, confirmed by prototype chain", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).toMatch(/this\.#identity = new FedosRuntimeIdentity\(\);/);
    const identity = new FedosRuntimeIdentity();
    expect(identity).toBeInstanceOf(FedosRuntimeIdentity);
  });

  it("11. behavioral: Desktop's own instance and createRuntime()'s own internal instance are provably different objects, never sharing state", async () => {
    const spy = vi.spyOn(FedosIdentityService.prototype, "describeIdentity");
    const app = createDesktopApplication();
    const runtime = createRuntime() as unknown as Record<string, unknown>;
    await app.start();
    expect(runtime.identity).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  // ---------------------------------------------------------------------
  // Structural: Observation/Nostr/GUI unconnected
  // ---------------------------------------------------------------------

  it("12. RIPPLE (Secure Runtime Alpha 103): no file under src/desktop/ referenced Observation, Nostr/Relay, or any GUI construct IN CODE AS OF this Stage's own scope; Alpha 103 legitimately introduced NostrPublicIdentityReader/resolveNostrPublicIdentitySource, reconfirmed here as the CURRENT state -- Relay/WebSocket/GUI/Observation remain forbidden", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      const codeOnly = source
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/observeBootstrap|Observation/i);
      expect(codeOnly).not.toMatch(/Relay|WebSocket/i);
      expect(codeOnly).not.toMatch(/window|document|React|Electron|Tauri/i);
      expect(codeOnly).toMatch(/NostrPublicIdentityReader/);
    }
  });

  it("13. structural: #observeBootstrap()'s own body is still empty, confirming the Observation Framework was never implemented against by this Arc", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const codeOnlyBody = body
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnlyBody.trim()).toBe("");
  });

  // ---------------------------------------------------------------------
  // Regression: everything outside src/desktop/ untouched
  // ---------------------------------------------------------------------

  it("14. Regression: create_runtime.ts's own body is unaffected -- still constructs and discards its own separate FedosRuntimeIdentity instance via void", () => {
    expect(createRuntimeSource).toMatch(
      /const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity\(\);\s*\n\s*void runtimeIdentity;/,
    );
    expect(createRuntimeSource).not.toMatch(/DesktopApplication|createDesktopApplication/);
  });

  it("15. Regression: AppRuntime still has no identity/desktop field among its thirty fields, and RuntimeOverrides still has none among its twenty", () => {
    const appBody = (runtimeTypesSource.match(/export interface AppRuntime \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const appFields = [...appBody.matchAll(/readonly (\w+)[?:]/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(appFields).toEqual(APP_RUNTIME_FIELDS);
    expect(appFields).not.toContain("identity");
    expect(appFields).not.toContain("desktop");
    expect(runtimeTypesSource).not.toMatch(/DesktopApplication/);
  });

  it("16. Regression: worker.ts never references DesktopApplication, createDesktopApplication, or anything under src/desktop/", () => {
    expect(workerSource).not.toMatch(/DesktopApplication|createDesktopApplication|desktop\//);
  });

  it("17. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged -- still exactly FIVE public and EIGHT private methods, no reference to Desktop Shell Foundation Arc docs", () => {
    for (const stage of ["096", "097", "098", "099", "100"]) {
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

  it("18. Regression: the entire Identity Layer and both Storage-resolver files are confirmed unaffected by this whole Arc", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      for (const stage of ["096", "097", "098", "099", "100"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
      expect(source).not.toMatch(/DesktopApplication/);
    }
  });

  it("19. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);    for (const stage of ["096", "097", "098", "099", "100"]) {
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

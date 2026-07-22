import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha088DocSource from "../docs/secure_runtime_alpha_088_desktop_lifetime_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identityProviderResolverSource from "../src/identity/fedos_identity_provider_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
import { createRuntime } from "../src/runtime/create_runtime.js";
import { FedosRuntimeIdentity } from "../src/runtime/fedos_runtime_identity.js";

const RUNTIME_OVERRIDES_FIELDS = [
  "mode",
  "eventCache",
  "assetCache",
  "notificationBridge",
  "meshKVClient",
  "meshKVApi",
  "spaceDirectory",
  "metadataIndex",
  "signatureVerifier",
  "promotionProvider",
  "recommendationProvider",
  "relayPublisher",
  "paymentProvider",
  "webAuthnProvider",
  "cryptoProvider",
  "storageBackend",
  "federationProvider",
  "chatProvider",
  "marketplaceProvider",
  "creatorEntitlementProvider",
  "runtimeCryptoProvider",
].sort();

/**
 * Secure Runtime Alpha 089 -- "Desktop Runtime Separation Review": a
 * REVIEW / DECISION ONLY Stage (Stage 3 of the Alpha 087-090 Desktop
 * Integration Review Arc) permanently forbidding createRuntime(),
 * RuntimeOverrides, and AppRuntime from ever accepting, exposing, or
 * becoming aware of Desktop's own bootstrapped FedosRuntimeIdentity
 * instance -- closing the RuntimeOverrides back-door explicitly, on
 * top of Alpha 086's own general AppRuntime.identity field rejection.
 * This Stage makes ZERO implementation change -- src/ is entirely
 * untouched.
 */
describe("Secure Runtime Alpha 089 -- Desktop Runtime Separation Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched, as Stage 3 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is Stage 3 of the Alpha 087–090 Desktop Integration\s*\nReview Arc/);
  });

  it("3. the design doc's grounding section enumerates all twenty RuntimeOverrides fields and confirms none is identity-shaped", () => {
    const section = (designDocSource.match(/## 3\. Grounding in the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const field of RUNTIME_OVERRIDES_FIELDS) {
      expect(section).toContain(field);
    }
    expect(section).toMatch(/NONE of\s*\n\s*them is `identity`, `runtimeIdentity`, or any other\s*\n\s*Identity-shaped field/);
  });

  it("4. the design doc declares a single Decision -- permanently forbidding Identity from ever reaching createRuntime()/RuntimeOverrides/AppRuntime", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`createRuntime\(\)`, `RuntimeOverrides`, and `AppRuntime` are\s*\nPERMANENTLY forbidden from ever accepting, exposing, or otherwise\s*\nbecoming aware of a Desktop-owned `FedosRuntimeIdentity` instance, in\s*\nany form, through any mechanism — override, field, or otherwise\./,
    );
    expect(section).toMatch(/Desktop's own bootstrapped Identity is NEVER handed back to\s*\n`createRuntime\(\)`\.\*\*/);
  });

  it("5. the design doc's comparison section covers all nine Arc-wide criteria", () => {
    const section = (designDocSource.match(/## 5\. Comparison([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    for (const criterion of [
      "責務",
      "Lifetime",
      "Bootstrap Authority",
      "Runtime純粋性",
      "Workerとの差",
      "Protocol非依存性",
      "Public API",
      "YAGNI",
      "テスト容易性",
    ]) {
      expect(section).toContain(criterion);
    }
  });

  it("6. the design doc's own 'does NOT do' list confirms no RuntimeOverrides/AppRuntime field is added or removed", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add or remove any `RuntimeOverrides`\/`AppRuntime`\s*\n\s*field/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* reopen Alpha 086's own Option C rejection/);
  });

  it("7. the design doc cross-references Alpha 056, Alpha 057, Alpha 086, Alpha 087, and Alpha 088", () => {
    for (const ref of [
      "secure_runtime_alpha_056_identity_bootstrap_semantics_review",
      "secure_runtime_alpha_057_identity_bootstrap_removal",
      "secure_runtime_alpha_086_desktop_integration_boundary_review",
      "secure_runtime_alpha_087_desktop_bootstrap_ownership_review",
      "secure_runtime_alpha_088_desktop_lifetime_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha088DocSource.length).toBeGreaterThan(0);
  });

  it("8. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  it("9. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_089/);
  });

  it("10. structural: RuntimeOverrides (types.ts) has exactly the twenty confirmed fields and no identity-shaped field of any kind", () => {
    const body = (runtimeTypesSource.match(/export interface RuntimeOverrides \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldNames = [...body.matchAll(/readonly (\w+)\?:/g)].map((m: RegExpMatchArray) => m[1]).sort();
    expect(fieldNames).toEqual(RUNTIME_OVERRIDES_FIELDS);
    for (const forbidden of ["identity", "runtimeIdentity", "fedosRuntimeIdentity"]) {
      expect(fieldNames).not.toContain(forbidden);
    }
  });

  it("11. structural: create_runtime.ts's own body never reads an identity-shaped field off overrides", () => {
    expect(createRuntimeSource).not.toMatch(/overrides\.identity/);
    expect(createRuntimeSource).not.toMatch(/overrides\.runtimeIdentity/);
    expect(createRuntimeSource).not.toMatch(/overrides\.fedosRuntimeIdentity/);
  });

  it("12. behavioral: passing an unrecognized identity-shaped key inside overrides has NO effect on the returned AppRuntime object -- it never becomes reachable", () => {
    const bogusOverrides = { identity: new FedosRuntimeIdentity() } as unknown as Parameters<typeof createRuntime>[1];
    const runtime = createRuntime(undefined, bogusOverrides) as unknown as Record<string, unknown>;
    expect(runtime.identity).toBeUndefined();
  });

  it("13. behavioral: createRuntime()'s own returned object never contains any FedosRuntimeIdentity instance among its values, confirmed across every RuntimeMode", () => {
    for (const mode of ["test", "local", "cloudflare"] as const) {
      const runtime = createRuntime(undefined, { mode }) as unknown as Record<string, unknown>;
      for (const value of Object.values(runtime)) {
        expect(value instanceof FedosRuntimeIdentity).toBe(false);
      }
    }
  });

  it("14. Regression: create_runtime.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_089/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_089/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_089/);
  });

  it("15. Regression: the entire Identity Layer is confirmed unaffected by this Stage", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_089/);
    }
  });

  it("16. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(48);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_089/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_089/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_089/);
  });

  it("17. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
    for (const source of [
      fedosRuntimeIdentitySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_089/);
    }
  });
});

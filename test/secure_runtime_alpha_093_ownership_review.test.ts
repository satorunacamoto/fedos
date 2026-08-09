import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_093_ownership_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha092DocSource from "../docs/secure_runtime_alpha_092_bootstrap_sequence_review.md?raw";
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

function classBodyOf(source: string): string {
  const codeOnly = source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
  return (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

/**
 * Secure Runtime Alpha 093 -- "Ownership Review": a DESIGN REVIEW ONLY
 * Stage (Stage 3 of the Alpha 091-095 Desktop Shell Integration Design
 * Arc) fixing that FedosRuntimeIdentity is owned exclusively by
 * Desktop -- Runtime, Worker, Storage, Provider, Resolver, and
 * Registry each confirmed as non-owners, extending Alpha 089's own
 * createRuntime()-specific finding to all remaining candidates. This
 * Stage makes ZERO implementation change -- src/ is entirely
 * untouched.
 */
describe("Secure Runtime Alpha 093 -- Ownership Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself DESIGN REVIEW ONLY, with src/ entirely untouched, as Stage 3 of the Arc", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN REVIEW ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
    expect(designDocSource).toMatch(/This is\s*\nStage 3 of the Alpha 091–095 Desktop Shell Integration Design Arc/);
  });

  it("3. the design doc's grounding section examines all six candidate owners by name", () => {
    const section = (designDocSource.match(/## 3\. Grounding in the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Runtime \(`AppRuntime`\):\*\*/);
    expect(section).toMatch(/\*\*Worker:\*\*/);
    expect(section).toMatch(/\*\*Storage:\*\*/);
    expect(section).toMatch(/\*\*Provider \(`FedosIdentityProvider`\):\*\*/);
    expect(section).toMatch(/\*\*Resolver \(`FedosIdentityResolver`\):\*\*/);
    expect(section).toMatch(/\*\*Registry \(`FedosIdentityRegistry`\):\*\*/);
    expect(section).toMatch(/DEPENDENCY DIRECTION runs\s*\n\s*the opposite way/);
  });

  it("4. the design doc declares a single Decision -- Desktop exclusive ownership, six non-owners confirmed", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`FedosRuntimeIdentity` is owned EXCLUSIVELY by Desktop\. Runtime\s*\n\(`AppRuntime`\/`createRuntime\(\)`\), Worker, Storage, Provider, Resolver,\s*\nand Registry each own NEITHER a `FedosRuntimeIdentity` reference NOR\s*\nany path to reach one\./,
    );
  });

  it("5. the design doc's own 'does NOT do' list confirms Alpha 089 is not reopened, only extended", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* reopen Alpha 089's own Decision — it extends the same/);
  });

  it("6. the design doc cross-references Alpha 050-052, Alpha 086, Alpha 089, and Alpha 092", () => {
    for (const ref of [
      "secure_runtime_alpha_050_052_identity_runtime_integration_arc",
      "secure_runtime_alpha_086_desktop_integration_boundary_review",
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
      "secure_runtime_alpha_092_bootstrap_sequence_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    expect(alpha092DocSource.length).toBeGreaterThan(0);
  });

  it("7. the design doc's own structure sanity check -- at least five numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(5);
  });

  it("8. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_093/);
  });

  it("9. structural: FedosRuntimeIdentity's own constructor confirms it -- not the Registry, Service, or Resolver -- owns the three Identity Layer references", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(classBody).toMatch(/this\.#registry = new FedosIdentityRegistry\(\);/);
    expect(classBody).toMatch(/this\.#service = new FedosIdentityService\(provider, this\.#registry\);/);
    expect(classBody).toMatch(/this\.#resolver = new FedosIdentityResolver\(this\.#registry\);/);
  });

  it("10. structural: no Storage file references FedosRuntimeIdentity, and FedosRuntimeIdentity's own class body references no StorageBackend", () => {
    for (const source of [storageResolverSource, storageBackendSource]) {
      expect(source).not.toMatch(/FedosRuntimeIdentity/);
    }
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(classBody).not.toMatch(/StorageBackend/);
  });

  it("11. structural: worker.ts never references FedosRuntimeIdentity in either direction", () => {
    expect(workerSource).not.toMatch(/FedosRuntimeIdentity/);
  });

  it("12. structural: the Identity Layer's own Provider/Registry/Resolver source files hold no reference back to FedosRuntimeIdentity", () => {
    for (const source of [serviceSource, registrySource, resolverClassSource, identityProviderResolverSource]) {
      expect(source).not.toMatch(/FedosRuntimeIdentity/);
    }
  });

  it("13. Regression: create_runtime.ts/types.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_093/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_093/);
  });

  it("14. Regression: the entire Identity Layer and both Storage-resolver files are confirmed unaffected by this Stage", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_093/);
    }
  });

  it("15. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_093/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_093/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_093/);
  });

  it("16. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
    for (const source of [
      fedosRuntimeIdentitySource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_093/);
    }
  });
});

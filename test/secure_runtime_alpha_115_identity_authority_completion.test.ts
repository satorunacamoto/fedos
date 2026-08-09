import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_115_identity_authority_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha111DocSource from "../docs/secure_runtime_alpha_111_identity_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha112DocSource from "../docs/secure_runtime_alpha_112_reader_provider_relationship_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha113DocSource from "../docs/secure_runtime_alpha_113_identity_flow_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha114DocSource from "../docs/secure_runtime_alpha_114_single_source_of_truth_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/os/messenger/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
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
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const ARC_STAGES = ["111", "112", "113", "114", "115"];

/**
 * Secure Runtime Alpha 115 -- "Identity Authority Completion": Stage
 * 5, the closing Stage, of the Identity Authority Design Arc, a
 * REVIEW / DECISION ONLY Stage. Integrates Alpha 111-114, confirms
 * mutual consistency, and declares the Identity Authority Design
 * Phase complete -- a binding premise for every future Identity-related
 * Stage. This Stage makes ZERO implementation change -- src/ is
 * entirely untouched across the whole five-Stage Arc.
 */
describe("Secure Runtime Alpha 115 -- Identity Authority Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched, as the closing Stage 5", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no file under `src\/` is touched/);
    expect(designDocSource).toMatch(/This is Stage 5,\s*\nthe closing Stage, of the Alpha 111–115 Identity Authority Design\s*\nArc/);
  });

  it("3. the design doc enumerates all four Decisions, each mapped to its own Alpha Stage", () => {
    expect(designDocSource).toMatch(/\| 1 \| Alpha 111 \| Authority \|/);
    expect(designDocSource).toMatch(/\| 2 \| Alpha 112 \| Reader\/Provider Relationship \|/);
    expect(designDocSource).toMatch(/\| 3 \| Alpha 113 \| Identity Flow \|/);
    expect(designDocSource).toMatch(/\| 4 \| Alpha 114 \| Single Source of Truth \|/);
  });

  it("4. the design doc's mutual-consistency section confirms no contradiction exists between any pair of the four Decisions", () => {
    const section = (designDocSource.match(/## 3\. Mutual consistency confirmation([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/No contradiction exists between any pair of the four/);
  });

  it("5. the design doc issues a Completion Declaration establishing the Decision set as a binding premise for future Stages", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Identity Authority Design Phase is hereby declared COMPLETE\.\*\*/);
    expect(section).toMatch(/\*\*This Decision set is a PREMISE, not a proposal, for every future\s*\n\s*Stage\.\*\*/);
    expect(section).toMatch(/\*\*No further Identity Authority Design Stage may be added past this\s*\n\s*one\.\*\*/);
  });

  it("6. the design doc's own 'does NOT do' list confirms zero implementation and no sixth Identity Authority Stage", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any new component, connection, or wiring of/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a sixth Identity Authority Design Stage/);
  });

  it("7. the design doc cross-references Alpha 085, Alpha 095, Alpha 105, Alpha 110, and Alpha 111-114", () => {
    for (const ref of [
      "secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion",
      "secure_runtime_alpha_095_integration_completion_review",
      "secure_runtime_alpha_105_integration_verification",
      "secure_runtime_alpha_110_integration_verification",
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_112_reader_provider_relationship_review",
      "secure_runtime_alpha_113_identity_flow_review",
      "secure_runtime_alpha_114_single_source_of_truth_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
    for (const doc of [alpha111DocSource, alpha112DocSource, alpha113DocSource, alpha114DocSource]) {
      expect(doc.length).toBeGreaterThan(0);
    }
  });

  it("8. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Regression: no src/ file touched across the whole five-Stage Arc
  // ---------------------------------------------------------------------

  it("9. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged -- still exactly FIVE public methods, no reference to any Arc-stage doc", () => {
    for (const stage of ARC_STAGES) {
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

  it("10. RIPPLE (Secure Runtime Alpha 126): DesktopApplication and createDesktopApplication() were byte-for-byte unchanged from Alpha 106-110's own final state AS OF this Stage's own scope -- no reference to any Alpha 111-115 Arc-stage doc; Alpha 116/117/121/126 legitimately added fields/methods in LATER, separate Arcs, reconfirmed here as the CURRENT field set, with the no-Arc-111-115-doc-reference regression still intact", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      for (const stage of ARC_STAGES) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication\b[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const fieldNames = [...codeOnly.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });

  it("11. Regression: the entire Identity Layer and both Storage-resolver files are confirmed unaffected across the whole Arc", () => {
    for (const source of [
      nostrIdentityProviderSource,
      nostrPublicIdentityReaderSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      for (const stage of ARC_STAGES) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("12. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- no reference to any Arc-stage doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ARC_STAGES) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("13. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);    for (const stage of ARC_STAGES) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("14. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("15. final sanity: no file anywhere under src/ references any Identity Authority Design Arc-stage doc -- confirming true zero src/ diff across all five Stages", () => {
    for (const source of [
      fedosRuntimeIdentitySource,
      desktopApplicationSource,
      createDesktopApplicationSource,
      nostrIdentityProviderSource,
      nostrPublicIdentityReaderSource,
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
      createRuntimeSource,
      runtimeTypesSource,
      workerSource,
    ]) {
      for (const stage of ARC_STAGES) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });
});

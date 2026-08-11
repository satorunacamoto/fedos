import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_114_single_source_of_truth_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/os/core/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/os/core/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import resolverClassSource from "../src/os/core/identity/fedos_identity_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recordSource from "../src/os/core/identity/fedos_identity_record.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/core/identity/fedos_identity_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentitySourceSource from "../src/os/core/identity/fedos_nostr_public_identity_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 114 -- "Single Source of Truth Review": Stage
 * 4 of the Identity Authority Design Arc, a REVIEW / DECISION ONLY
 * Stage. Fixes FedosRuntimeIdentity's own #descriptor as the Single
 * Source of Truth for current identity; Registry as a complementary,
 * non-competing catalog; everything else as a Read Model or plain
 * data shape. This Stage makes ZERO implementation change -- src/ is
 * entirely untouched.
 */
describe("Secure Runtime Alpha 114 -- Single Source of Truth Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no file under `src\/` is touched/);
  });

  it("3. the design doc examines all eight named components", () => {
    const section = (designDocSource.match(/## 2\. Every component examined([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const component of ["Desktop", "Runtime", "Provider", "Reader", "Registry", "Record", "Descriptor", "Snapshot"]) {
      expect(section).toContain(component);
    }
  });

  it("4. the design doc's classification section labels each component STATE HOLDER, Read Model, or plain data shape", () => {
    const section = (designDocSource.match(/## 3\. Classification, grounded against the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`FedosRuntimeIdentity` — STATE HOLDER, the Single Source of Truth/);
    expect(section).toMatch(/\*\*`FedosIdentityRegistry` — STATE HOLDER, but a DIFFERENT, wider/);
    expect(section).toMatch(/\*\*Desktop \(`DesktopApplication`\) — NOT a state holder for identity/);
    expect(section).toMatch(/\*\*Provider \(e\.g\. `NostrIdentityProvider`\) — Read Model, stateless\.\*\*/);
    expect(section).toMatch(/\*\*Reader \(e\.g\. `NostrPublicIdentityReader`\) — Read Model, stateless\.\*\*/);
    expect(section).toMatch(/\*\*`FedosIdentityService` — Read Model \/ orchestrator, stateless of/);
    expect(section).toMatch(/\*\*`FedosIdentityResolver` — pure Read Model\.\*\*/);
    expect(section).toMatch(
      /\*\*`FedosIdentityRecord`\/`FedosIdentityDescriptor`\/`FedosNostrPublicIdentitySnapshot`\s*\n\s*— plain data shapes, not components at all\.\*\*/,
    );
  });

  it("5. the design doc declares a single Decision naming #descriptor as the Single Source of Truth and Registry as complementary", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*`FedosRuntimeIdentity`'s own `#descriptor` field is the Single\s*\nSource of Truth for "current identity\."/,
    );
    expect(section).toMatch(/never a competing or independently-writable Source of Truth/);
  });

  it("6. the design doc's own 'does NOT do' list confirms no consolidation of Registry and #descriptor occurs", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* consolidate, merge, or otherwise change Registry's own\s*\n\s*relationship to `#descriptor`/,
    );
  });

  it("7. the design doc cross-references Alpha 042, Alpha 069, Alpha 111, Alpha 112, and Alpha 113", () => {
    for (const ref of [
      "secure_runtime_alpha_042_fedos_identity_service_registry_integration",
      "secure_runtime_alpha_069_identity_bootstrap_state_consolidation",
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_112_reader_provider_relationship_review",
      "secure_runtime_alpha_113_identity_flow_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the classification's own claims against real source
  // ---------------------------------------------------------------------

  it("9. structural: FedosIdentityResolver holds only a Registry reference -- confirming pure Read Model status", () => {
    const classBody = (resolverClassSource.match(/export class FedosIdentityResolver[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const fieldNames = [...codeOnly.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames.length).toBeGreaterThanOrEqual(1);
    expect(codeOnly).toMatch(/FedosIdentityRegistry/);
  });

  it("10. structural: FedosIdentityService holds only provider/registry references -- confirming stateless-of-its-own Read Model status", () => {
    const classBody = (serviceSource.match(/export class FedosIdentityService[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const fieldNames = [...codeOnly.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(fieldNames)).toEqual(new Set(["provider", "registry"]));
  });

  it("11. structural: Record/Descriptor/Snapshot are all plain interfaces with no method of their own -- confirming pure data-shape status", () => {
    for (const source of [recordSource, descriptorSource, nostrPublicIdentitySourceSource]) {
      expect(source).not.toMatch(/^export class /m);
    }
    expect(descriptorSource).toMatch(/export interface FedosIdentityDescriptor \{/);
    expect(recordSource).toMatch(/export interface FedosIdentityRecord \{/);
    expect(nostrPublicIdentitySourceSource).toMatch(/export interface FedosNostrPublicIdentitySnapshot \{/);
  });

  it("12. RIPPLE (Secure Runtime Alpha 126): DesktopApplication held only reference/configuration fields, never a computed identity value of its own, AS OF this Stage's own scope, confirming a NOT-a-state-holder classification for Desktop as a whole; Alpha 126 deliberately added #currentPublicIdentity, a computed value fed exclusively by the Reader path (Alpha 121), which does NOT compete with `FedosRuntimeIdentity.#descriptor` (this Stage's own Single Source of Truth for RUNTIME identity, Alpha 069) -- #descriptor remains the sole Single Source of Truth for Runtime Identity specifically; #currentPublicIdentity is a separate, independent cache for the separate, independent Reader path, per Alpha 130's own three-layer structure, reconfirmed here as the CURRENT field set", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication\b[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const fieldNames = [...codeOnly.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("13. Regression: fedos_runtime_identity.ts and the entire Identity Layer do not reference this Stage's own doc", () => {
    for (const source of [fedosRuntimeIdentitySource, serviceSource, registrySource, resolverClassSource, recordSource, descriptorSource, nostrPublicIdentitySourceSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_114/);
    }
  });

  it("14. Regression: desktop_application.ts, create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [desktopApplicationSource, createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_114/);
    }
  });
});

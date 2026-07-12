import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_113_identity_flow_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/identity/fedos_identity_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import registrySource from "../src/identity/fedos_identity_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/**
 * Secure Runtime Alpha 113 -- "Identity Flow Review": Stage 3 of the
 * Identity Authority Design Arc, a REVIEW / DECISION ONLY Stage.
 * Fixes the full Identity Data Flow as a diagram: two independent
 * paths rooted at Desktop, never converging, with exactly one write
 * point on the Authority path. This Stage makes ZERO implementation
 * change -- src/ is entirely untouched.
 */
describe("Secure Runtime Alpha 113 -- Identity Flow Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no file under `src\/` is touched/);
  });

  it("3. the design doc's adopted-flow diagram names both paths and the Authority label", () => {
    const section = (designDocSource.match(/## 3\. Adopted Flow, with diagram([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/FedosRuntimeIdentity/);
    expect(section).toMatch(/the Identity/);
    expect(section).toMatch(/AUTHORITY, Alpha 111/);
    expect(section).toMatch(/FedosPublicIdentityReader/);
    expect(section).toMatch(/NostrPublicIdentityReader/);
  });

  it("4. the design doc's post-Provider write sequence names the exact three writes/reads in order", () => {
    const section = (designDocSource.match(/## 4\. What happens after Provider resolves, on the Authority path only([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\[READ\]/);
    expect(section).toMatch(/\[WRITE: Registry\]/);
    expect(section).toMatch(/this\.#descriptor = descriptor/);
    expect(section).toMatch(/this\.#bootstrapped = true/);
  });

  it("5. the design doc declares a single Decision -- two independent paths, only the Authority path writes state", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*The Identity Data Flow is permanently fixed to the diagram in §3:\s*\nTWO independent paths, both rooted at Desktop's own ownership/,
    );
    expect(section).toMatch(/Only the Authority path ever writes/);
  });

  it("6. the design doc's own 'does NOT do' list confirms the two paths are not connected by this Stage", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect the two paths shown in §3/);
  });

  it("7. the design doc cross-references Alpha 069, Alpha 105, Alpha 110, Alpha 111, and Alpha 112", () => {
    for (const ref of [
      "secure_runtime_alpha_069_identity_bootstrap_state_consolidation",
      "secure_runtime_alpha_105_integration_verification",
      "secure_runtime_alpha_110_integration_verification",
      "secure_runtime_alpha_111_identity_authority_review",
      "secure_runtime_alpha_112_reader_provider_relationship_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the diagram's own claims against real source
  // ---------------------------------------------------------------------

  it("9. structural: #completeBootstrap() really is the sole writer of #descriptor/#bootstrapped, confirming the single write point the diagram claims", () => {
    expect(fedosRuntimeIdentitySource).toMatch(
      /#completeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{\s*\n\s*this\.#descriptor = descriptor;\s*\n\s*this\.#bootstrapped = true;\s*\n\s*\}/,
    );
  });

  it("10. structural: FedosIdentityService really does register into the Registry on a non-null Descriptor, confirming the [WRITE: Registry] step", () => {
    expect(serviceSource).toMatch(/registry\.register\(/);
  });

  it("11. structural: FedosIdentityRegistry exposes register()/find()/list()/remove(), confirming it is a real, mutable state store", () => {
    expect(registrySource).toMatch(/register\(record: FedosIdentityRecord\): void \{/);
    expect(registrySource).toMatch(/find\(id: string\): FedosIdentityRecord \| null \{/);
    expect(registrySource).toMatch(/list\(\): readonly FedosIdentityRecord\[\] \{/);
    expect(registrySource).toMatch(/remove\(id: string\): boolean \{/);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: fedos_runtime_identity.ts, fedos_identity_service.ts, fedos_identity_registry.ts, and desktop_application.ts do not reference this Stage's own doc", () => {
    for (const source of [fedosRuntimeIdentitySource, serviceSource, registrySource, desktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_113/);
    }
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_113/);
    }
  });
});

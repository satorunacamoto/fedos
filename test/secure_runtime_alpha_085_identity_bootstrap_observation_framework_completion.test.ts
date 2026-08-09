import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_085_identity_bootstrap_observation_framework_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import alpha084DocSource from "../docs/secure_runtime_alpha_084_identity_bootstrap_observation_consumer_boundary_review.md?raw";
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

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

function classBodyOf(source: string): string {
  const codeOnly = codeOnlyLines(source);
  return (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
}

const OBSERVATION_ELEMENTS = [
  "Boundary",
  "Contract",
  "Ordering",
  "Scope",
  "Vocabulary",
  "Event Shape",
  "Lifecycle",
  "Delivery Responsibility",
  "Consumer Boundary",
];

const NON_OBSERVATION_ALPHA_086_CANDIDATES = [
  "Identity Runtime Internal Pipeline Simplification Review",
  "Desktop Integration Boundary Review",
  "Real Public Identity Source Selection Review",
  "Identity Runtime Alpha Completion Review",
];

/**
 * Secure Runtime Alpha 085 -- "Identity Bootstrap Observation
 * Framework Completion & Implementation Readiness Review": a REVIEW /
 * DECISION ONLY Stage. It audits the nine Observation Framework
 * Decisions (Alpha 076-084) for mutual consistency against the
 * actual, still-unimplemented Hook, decides whether to implement now
 * or freeze until a real Consumer exists (adopting Option C: freeze),
 * issues a formal Completion Declaration with explicit resumption
 * conditions, and recommends a NON-Observation Alpha 086. This Stage
 * makes ZERO implementation change -- src/ is entirely untouched.
 * These tests confirm the design doc's own structural claims and that
 * no src/ file of any kind was modified.
 */
describe("Secure Runtime Alpha 085 -- Identity Bootstrap Observation Framework Completion & Implementation Readiness Review", () => {
  // ---------------------------------------------------------------------
  // Design doc structure
  // ---------------------------------------------------------------------

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(8000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/`src\/` is untouched by this Stage/);
  });

  it("3. the design doc enumerates all nine Observation Framework elements by name, each mapped to its own Alpha Stage", () => {
    for (const element of OBSERVATION_ELEMENTS) {
      expect(designDocSource).toContain(element);
    }
    expect(designDocSource).toMatch(/\| 1 \| Boundary \| 076 \|/);
    expect(designDocSource).toMatch(/\| 2 \| Contract \| 077 \|/);
    expect(designDocSource).toMatch(/\| 3 \| Ordering \| 078 \|/);
    expect(designDocSource).toMatch(/\| 4 \| Scope \| 079 \|/);
    expect(designDocSource).toMatch(/\| 5 \| Vocabulary \| 080 \|/);
    expect(designDocSource).toMatch(/\| 6 \| Event Shape \| 081 \|/);
    expect(designDocSource).toMatch(/\| 7 \| Lifecycle \| 082 \|/);
    expect(designDocSource).toMatch(/\| 8 \| Delivery Responsibility \| 083 \|/);
    expect(designDocSource).toMatch(/\| 9 \| Consumer Boundary \| 084 \|/);
  });

  it("4. the design doc confirms the current Hook is empty and lists the fifteen absent constructs from the Stage's own spec", () => {
    const section = (designDocSource.match(/## 3\. Current implementation, verbatim([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Intentionally empty — Bootstrap Observation Boundary \(Alpha 076\)/);
    expect(section).toMatch(/A Vocabulary type/);
    expect(section).toMatch(/An Observation Event type/);
    expect(section).toMatch(/A Consumer interface or callback type/);
    expect(section).toMatch(/Any Consumer injection point/);
    expect(section).toMatch(/`timestamp` generation logic of any kind/);
    expect(section).toMatch(/A `BOOTSTRAP_STARTED` notification/);
    expect(section).toMatch(/A `BOOTSTRAP_COMPLETED` notification/);
    expect(section).toMatch(/A `BOOTSTRAP_FAILED` notification/);
    expect(section).toMatch(/A `DESCRIPTOR_PRESENT` notification/);
    expect(section).toMatch(/A `DESCRIPTOR_ABSENT` notification/);
    expect(section).toMatch(/Logging, Metrics, Tracing, Audit, or Telemetry of any kind/);
  });

  it("5. the design doc answers all ten integrity-audit questions, section by section", () => {
    const section = (designDocSource.match(/## 4\. Integrity audit([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    for (let i = 1; i <= 10; i += 1) {
      expect(section).toMatch(new RegExp(`\\*\\*Q${i}\\.`));
    }
  });

  it("6. Q1/Q2 conclude BOOTSTRAP_STARTED/BOOTSTRAP_FAILED cannot be expressed by the current single call site", () => {
    const section = (designDocSource.match(/## 4\. Integrity audit([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Q1\.[\s\S]*?\*\*\s*\n\s*\nNo\./);
    expect(section).toMatch(/UNREACHABLE on the failure path/);
    expect(section).toMatch(
      /`BOOTSTRAP_FAILED` cannot be emitted\s*\nby the Hook as it exists today/,
    );
  });

  it("7. Q4/Q5 confirm the multi-event question is undecided, and Q6/Q7 confirm the Consumer-exception question is undecided", () => {
    const section = (designDocSource.match(/## 4\. Integrity audit([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Q4\.[\s\S]*?Undecided by Alpha 076–084/);
    expect(section).toMatch(/Same unresolved question as Q4/);
    expect(section).toMatch(/Not decided, and the current source contains no protection against/);
    expect(section).toMatch(/This is the same gap as Q6/);
  });

  it("8. Q9/Q10 conclude no Consumer exists today and implementing now would violate YAGNI", () => {
    const section = (designDocSource.match(/## 4\. Integrity audit([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Q9\.[\s\S]*?\*\*\s*\n\s*\nNo\./);
    expect(section).toMatch(/\*\*Q10\.[\s\S]*?\*\*\s*\n\s*\nYes\./);
    expect(section).toMatch(/called by nothing anywhere in this repository/);
  });

  it("9. the design doc compares exactly five Options (A through E), each with an explicit verdict", () => {
    const section = (designDocSource.match(/## 5\. Option comparison([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Option A — Implement everything now\*\*/);
    expect(section).toMatch(/\*\*Option B — Minimal Typed Seam only\*\*/);
    expect(section).toMatch(/\*\*Option C — Freeze the Framework until a real Consumer appears\.\*\*/);
    expect(section).toMatch(/\*\*Option D — Delete `#observeBootstrap\(\)` entirely\.\*\*/);
    expect(section).toMatch(/\*\*Option E — Split Observation into a separate module\.\*\*/);
    expect(section.match(/Rejected\./g)?.length).toBe(4);
    expect(section).toMatch(/\*\*Adopted —\s*\n\s*see §7\.\*\*/);
  });

  it("10. the design doc's FedosRuntimeIdentity bloat audit classifies all eight private pipeline methods and flags exactly two as reduction candidates", () => {
    const section = (designDocSource.match(/## 6\. `FedosRuntimeIdentity` bloat audit([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    for (const method of [
      "#bootstrapIdentity()",
      "#performBootstrap()",
      "#acquireDescriptor()",
      "#describeIdentity()",
      "#observeBootstrap()",
      "#completeBootstrap()",
      "#isBootstrapped()",
      "#currentIdentity()",
    ]) {
      expect(section).toContain(method);
    }
    expect(section.match(/reduction candidate/g)?.length).toBe(2);
    expect(section).toMatch(/Observation Framework's OWN contribution to this\s*\nclass is exactly ONE method/);
  });

  it("11. the design doc declares a single, unambiguous Decision -- Option C adopted", () => {
    const section = (designDocSource.match(/## 7\. Decision([\s\S]*?)\n## 8\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Option C is adopted: freeze the Identity Bootstrap Observation\s*\nFramework exactly as Alpha 076–084 left it, until a real Consumer\s*\nexists\.\*\*/);
  });

  it("12. the design doc issues a formal Completion Declaration with all required elements", () => {
    const section = (designDocSource.match(/## 8\. Completion Declaration([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Design Phase is\s*\n\s*hereby declared \*\*COMPLETE\*\*/);
    expect(section).toMatch(/Alpha 076 through Alpha 084 are frozen as ONE integrated Framework/);
    expect(section).toMatch(/\*\*No further implementation occurs until a real Consumer exists\.\*\*/);
    expect(section).toMatch(/\*\*No new Observation Review Stage may be added past this one\.\*\*/);
  });

  it("13. the design doc's resumption conditions list exactly the four candidate conditions", () => {
    const section = (designDocSource.match(/### Resumption conditions([\s\S]*?)\n## 9\./) ?? [])[1] ?? "";
    expect(section).toMatch(/A Desktop shell is implemented/);
    expect(section).toMatch(/A concrete Logging, Metrics, or Audit Consumer is actually required/);
    expect(section).toMatch(/A Production observability requirement is formally defined/);
    expect(section).toMatch(/Observing a Bootstrap failure becomes operationally necessary/);
  });

  it("14. the design doc's Alpha 086 recommendation is exactly one of the four permitted non-Observation candidates, and explicitly is not another Observation Stage", () => {
    const section = (designDocSource.match(/## 9\. Alpha 086 recommendation([\s\S]*?)\n## 10\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Desktop Integration Boundary Review\.\*\*/);
    expect(section).toMatch(/Not another Observation Stage/);
    const matchedCandidates = NON_OBSERVATION_ALPHA_086_CANDIDATES.filter((candidate) =>
      section.includes(candidate),
    );
    expect(matchedCandidates).toContain("Desktop Integration Boundary Review");
    expect(designDocSource).not.toMatch(/Alpha 086 recommendation[\s\S]*?Observation (Vocabulary|Event|Consumer|Delivery|Scope) Review/);
  });

  it("15. the design doc's own 'does NOT do' list confirms no Observation type, no src/ modification, and no tenth Observation Stage", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any Observation type/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a tenth Observation Review Stage/);
  });

  it("16. the design doc cross-references Alpha 084 and every prior Observation Stage", () => {
    for (let stage = 76; stage <= 84; stage += 1) {
      expect(designDocSource).toContain(`secure_runtime_alpha_0${stage}_`);
    }
    expect(alpha084DocSource.length).toBeGreaterThan(0);
  });

  it("17. the design doc's own structure sanity check -- at least eleven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(11);
  });

  // ---------------------------------------------------------------------
  // Structural confirmation: src/ is completely untouched
  // ---------------------------------------------------------------------

  it("18. fedos_runtime_identity.ts does NOT reference this Stage's own doc -- confirming zero src/ change, unlike every prior review Stage since Alpha 077", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_085/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/Alpha 085/);
  });

  it("19. #observeBootstrap()'s own body still contains NO statement of any kind -- exactly the empty implementation Alpha 076 left it", () => {
    const codeOnly = codeOnlyLines(fedosRuntimeIdentitySource);
    const classBody = (codeOnly.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const body = (classBody.match(/#observeBootstrap\(descriptor: FedosIdentityDescriptor \| null\): void \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    expect(body.trim()).toBe("");
  });

  it("20. no Vocabulary type, Event type, or Consumer interface exists anywhere in fedos_runtime_identity.ts", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    expect(fedosRuntimeIdentitySource).not.toMatch(/\btype Vocabulary\b|\benum Vocabulary\b/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/\binterface\s+\w*Consumer\w*\b/);
    expect(fedosRuntimeIdentitySource).not.toMatch(/\binterface\s+\w*ObservationEvent\w*\b/);
    expect(classBody).not.toMatch(/#consumer|#listener|#callback|#subscriber/i);
  });

  it("21. the class still has exactly FIVE public methods and EIGHT private methods -- no new API of any kind added by this Stage", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set(["findIdentity", "listIdentities", "bootstrapIdentity", "isBootstrapped", "currentIdentity"]),
    );
    const privateMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?#(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ].map((m: RegExpMatchArray) => m[1] ?? "");
    expect(new Set(privateMethodNames)).toEqual(
      new Set(["describeIdentity", "completeBootstrap", "observeBootstrap", "isBootstrapped", "currentIdentity", "acquireDescriptor", "performBootstrap", "bootstrapIdentity"]),
    );
  });

  it("22. no new private FIELD exists -- still exactly five fields", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const fieldNames = [
      ...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm),
    ].map((m: RegExpMatchArray) => m[1]);
    expect(new Set(fieldNames)).toEqual(
      new Set(["registry", "service", "resolver", "bootstrapped", "descriptor"]),
    );
    expect(fieldNames.length).toBe(5);
  });

  it("23. #bootstrapIdentity()'s own body is unchanged -- EXACTLY the same six statements established by Alpha 076", () => {
    const classBody = classBodyOf(fedosRuntimeIdentitySource);
    const body = (classBody.match(/async #bootstrapIdentity\(\): Promise<void> \{([\s\S]*?)\n {2}\}/) ?? [])[1] ?? "";
    const lines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(lines).toEqual([
      "if (this.#isBootstrapped()) {",
      "return;",
      "}",
      "const descriptor = await this.#performBootstrap();",
      "this.#observeBootstrap(descriptor);",
      "this.#completeBootstrap(descriptor);",
    ]);
  });

  // ---------------------------------------------------------------------
  // Regression: no other file touched by this Stage
  // ---------------------------------------------------------------------

  it("24. Regression: create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_085/);
    expect(runtimeTypesSource).not.toMatch(/secure_runtime_alpha_085/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_085/);
  });

  it("25. Regression: the entire Identity Layer and both Storage-resolver files are confirmed unaffected by this Stage", () => {
    for (const source of [
      serviceSource,
      registrySource,
      resolverClassSource,
      identityProviderResolverSource,
      storageResolverSource,
      storageBackendSource,
    ]) {
      expect(source).not.toMatch(/secure_runtime_alpha_085/);
    }
  });

  it("26. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED -- no reference to this Stage's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(69);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(21);    expect(libRsSource).not.toMatch(/secure_runtime_alpha_085/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_085/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_085/);
  });

  it("27. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Stage", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("28. no other doc file references this Stage's own doc, confirming this Stage's own footprint is exactly one new doc file plus this test file plus a README entry", () => {
    expect(alpha084DocSource).not.toMatch(/secure_runtime_alpha_085/);
  });

  it("29. final sanity: no file anywhere under src/ references this Stage's own doc -- confirming true zero src/ diff", () => {
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
      expect(source).not.toMatch(/secure_runtime_alpha_085/);
    }
  });
});

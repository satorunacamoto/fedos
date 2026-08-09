import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_112_reader_provider_relationship_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 112 -- "Reader / Provider Relationship
 * Review": Stage 2 of the Identity Authority Design Arc, a REVIEW /
 * DECISION ONLY Stage. Fixes that Reader and Provider are permanently
 * independent -- neither is the other's input, substitute, or
 * adapter to the other. This Stage makes ZERO implementation change
 * -- src/ is entirely untouched.
 */
describe("Secure Runtime Alpha 112 -- Reader / Provider Relationship Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no file under `src\/` is touched/);
  });

  it("3. the design doc names all four candidates", () => {
    const section = (designDocSource.match(/## 2\. Candidates compared([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*1\. Reader is Provider's input\.\*\*/);
    expect(section).toMatch(/\*\*2\. Reader is Provider's alternative\/substitute\.\*\*/);
    expect(section).toMatch(/\*\*3\. Reader and Provider are independent\.\*\*/);
    expect(section).toMatch(/\*\*4\. Reader is an Adapter\.\*\*/);
  });

  it("4. the design doc's grounding section confirms neither class imports or references the other, at any Stage", () => {
    const section = (designDocSource.match(/## 3\. Grounding against the actual source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/Provider has never read from, imported,\s*\n\s*or referenced Reader in any way, at any Stage/);
    expect(section).toMatch(/Reader has never read from, imported, or\s*\n\s*referenced Provider in any way, at any Stage/);
  });

  it("5. the design doc's evaluation section rejects options 1 and 2 and reframes option 4, adopting option 3", () => {
    const section = (designDocSource.match(/## 4\. Evaluation of each candidate([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*1 \(Reader is Provider's input\) — rejected\.\*\*/);
    expect(section).toMatch(/\*\*2 \(Reader is Provider's substitute\) — rejected\.\*\*/);
    expect(section).toMatch(/\*\*4 \(Reader is an Adapter\) — reframed, not adopted as the answer\.\*\*/);
    expect(section).toMatch(/\*\*3 \(Reader and Provider are independent\) — adopted\.\*\*/);
  });

  it("6. the design doc declares a single Decision -- permanently independent", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Reader and Provider are PERMANENTLY INDEPENDENT\. Reader serves\s*\nDesktop's own read-only convenience use case; Provider serves\s*\nRuntime's own Bootstrap\/Authority pipeline \(Alpha 111\)\./,
    );
  });

  it("7. the design doc's own 'does NOT do' list confirms Reader and Provider are not connected by this Stage", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Reader and Provider in any way/);
  });

  it("8. the design doc cross-references Alpha 101, Alpha 102, Alpha 103, Alpha 105, Alpha 110, and Alpha 111", () => {
    for (const ref of [
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_102_desktop_identity_reader",
      "secure_runtime_alpha_103_source_injection",
      "secure_runtime_alpha_105_integration_verification",
      "secure_runtime_alpha_110_integration_verification",
      "secure_runtime_alpha_111_identity_authority_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the grounding claims against real source
  // ---------------------------------------------------------------------

  it("10. structural: NostrIdentityProvider's own constructor takes a Source, never a Reader", () => {
    expect(nostrIdentityProviderSource).toMatch(
      /constructor\(source: FedosNostrPublicIdentitySource = resolveNostrPublicIdentitySource\(\)\) \{/,
    );
    expect(nostrIdentityProviderSource).not.toMatch(/FedosPublicIdentityReader/);
  });

  it("11. structural: NostrPublicIdentityReader's own constructor takes a Source, never a Provider IN CODE (the header comment legitimately names FedosIdentityProvider as a forbidden guardrail)", () => {
    expect(nostrPublicIdentityReaderSource).toMatch(/constructor\(source: FedosNostrPublicIdentitySource\) \{/);
    const codeOnly = nostrPublicIdentityReaderSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/FedosIdentityProvider/);
  });

  // ---------------------------------------------------------------------
  // Regression
  // ---------------------------------------------------------------------

  it("12. Regression: fedos_nostr_identity_provider.ts, nostr_public_identity_reader.ts, fedos_runtime_identity.ts, and desktop_application.ts do not reference this Stage's own doc", () => {
    for (const source of [nostrIdentityProviderSource, nostrPublicIdentityReaderSource, fedosRuntimeIdentitySource, desktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_112/);
    }
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_112/);
    }
  });
});

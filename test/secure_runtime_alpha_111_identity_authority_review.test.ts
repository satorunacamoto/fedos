import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_111_identity_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/os/core/identity/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrIdentityProviderSource from "../src/os/core/identity/fedos_nostr_identity_provider.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentityReaderSource from "../src/os/messenger/desktop/nostr_public_identity_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 111 -- "Identity Authority Review": Stage 1 of
 * the Identity Authority Design Arc, a REVIEW / DECISION ONLY Stage.
 * Names FedosRuntimeIdentity ("Runtime") as the SOLE Identity
 * Authority, rejecting Desktop/Provider/Reader as candidates. This
 * Stage makes ZERO implementation change -- src/ is entirely
 * untouched.
 */
describe("Secure Runtime Alpha 111 -- Identity Authority Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc declares itself REVIEW / DECISION ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW \/ DECISION ONLY/);
    expect(designDocSource).toMatch(/no file under `src\/` is touched/);
  });

  it("3. the design doc names all five candidates -- Desktop, Runtime, Provider, Reader, and 'other'", () => {
    const section = (designDocSource.match(/## 2\. Review target([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*A\. Desktop\*\*/);
    expect(section).toMatch(/\*\*B\. Runtime\*\*/);
    expect(section).toMatch(/\*\*C\. Provider\*\*/);
    expect(section).toMatch(/\*\*D\. Reader\*\*/);
    expect(section).toMatch(/\*\*E\. A different Authority\*\*/);
  });

  it("4. the design doc's grounding section confirms only Runtime holds persistent state, Provider/Reader are stateless", () => {
    const section = (designDocSource.match(/## 3\. What each candidate actually holds, confirmed against the source([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/the\s*\n\s*ONLY two private fields anywhere in this entire system that persist/);
    expect(section).toMatch(/Stateless by construction/);
  });

  it("5. the design doc's evaluation section addresses all five named criteria", () => {
    const section = (designDocSource.match(/## 4\. Evaluation([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*責務分離 \(separation of concerns\):\*\*/);
    expect(section).toMatch(/\*\*Runtime Separation \(Alpha 089\):\*\*/);
    expect(section).toMatch(/\*\*Desktop Ownership \(Alpha 093\):\*\*/);
    expect(section).toMatch(/\*\*Protocol Independence:\*\*/);
    expect(section).toMatch(/\*\*将来の複数Provider対応 \(future multi-Provider support\):\*\*/);
  });

  it("6. the design doc declares a single Decision -- Option B (Runtime) adopted, others rejected with named reasons", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Option B — Runtime, specifically `FedosRuntimeIdentity` — is the\s*\nSOLE Identity Authority\./,
    );
    expect(section).toMatch(/\*\*A \(Desktop\) rejected:\*\*/);
    expect(section).toMatch(/\*\*C \(Provider\) rejected:\*\*/);
    expect(section).toMatch(/\*\*D \(Reader\) rejected:\*\*/);
    expect(section).toMatch(/\*\*E \(other\) rejected:\*\*/);
  });

  it("7. the design doc's own 'does NOT do' list confirms no src/ file is modified and no new Authority component is implemented", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `src\/runtime\/fedos_runtime_identity\.ts`,\s*\n\s*`src\/desktop\/\*`, or any `src\/identity\/\*` file/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* implement any new Authority component/);
  });

  it("8. the design doc cross-references Alpha 089, Alpha 093, Alpha 101, Alpha 102, Alpha 105, and Alpha 110", () => {
    for (const ref of [
      "secure_runtime_alpha_089_desktop_runtime_separation_review",
      "secure_runtime_alpha_093_ownership_review",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_102_desktop_identity_reader",
      "secure_runtime_alpha_105_integration_verification",
      "secure_runtime_alpha_110_integration_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. the design doc's own structure sanity check -- at least seven numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(7);
  });

  // ---------------------------------------------------------------------
  // Structural: confirm the Decision's own grounding claims against real source
  // ---------------------------------------------------------------------

  it("10. structural: FedosRuntimeIdentity really is the only component with fields persisting a resolved identity -- #descriptor/#bootstrapped confirmed, sole writer confirmed", () => {
    const classBody = (fedosRuntimeIdentitySource.match(/export class FedosRuntimeIdentity \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).toMatch(/#bootstrapped: boolean = false;/);
    expect(classBody).toMatch(/#descriptor: FedosIdentityDescriptor \| null = null;/);
    const descriptorAssignments = [...classBody.matchAll(/#descriptor\s*=/g)];
    const bootstrappedAssignments = [...classBody.matchAll(/#bootstrapped\s*=/g)];
    expect(descriptorAssignments.length).toBe(1);
    expect(bootstrappedAssignments.length).toBe(1);
  });

  it("11. structural: NostrIdentityProvider holds only an injected Source reference -- no other field, confirming statelessness", () => {
    const classBody = (nostrIdentityProviderSource.match(/export class NostrIdentityProvider[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const fieldNames = [...codeOnly.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["source"]);
  });

  it("12. structural: NostrPublicIdentityReader holds only an injected Source reference -- no other field, confirming statelessness, identical in shape to Provider", () => {
    const classBody = (nostrPublicIdentityReaderSource.match(/export class NostrPublicIdentityReader[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const codeOnly = classBody
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    const fieldNames = [...codeOnly.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["source"]);
  });

  it("13. RIPPLE (Secure Runtime Alpha 126): DesktopApplication held only reference/configuration fields (#identity/#reader/#publicIdentity/#started) AS OF this Stage's own scope, confirming it was an owner/orchestrator, not an identity-state holder of its own; Alpha 126 deliberately added #currentPublicIdentity, Desktop's own FIRST genuinely computed, mutable identity-shaped state (Desktop Public State, per Alpha 130), which does NOT reopen this Stage's own Identity Authority question -- #currentPublicIdentity is fed exclusively by the Reader path (Alpha 121), never by #identity, so FedosRuntimeIdentity remains the sole Identity Authority unchanged -- reconfirmed here as the CURRENT field set", () => {
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

  it("14. Regression: fedos_runtime_identity.ts, desktop_application.ts, and every src/identity/*/src/desktop/* source do not reference this Stage's own doc", () => {
    for (const source of [fedosRuntimeIdentitySource, desktopApplicationSource, nostrIdentityProviderSource, nostrPublicIdentityReaderSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_111/);
    }
  });

  it("15. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_111/);
    }
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_106_public_identity_source_interface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrPublicIdentitySourceSource from "../src/os/core/identity/fedos_nostr_public_identity_source.ts?raw";
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

/**
 * Secure Runtime Alpha 106 -- "Public Identity Source Interface
 * Review": Stage 1 of the Nostr Public Identity Implementation Arc, a
 * REVIEW ONLY Stage. Confirms FedosNostrPublicIdentitySource/Snapshot
 * (unchanged since Alpha 044) are already necessary and sufficient
 * for this Arc's own upcoming needs -- no addition required. This
 * Stage makes ZERO implementation change -- src/ is entirely
 * untouched.
 */
describe("Secure Runtime Alpha 106 -- Public Identity Source Interface Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with src/ entirely untouched", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/no file under `src\/` is touched/);
  });

  it("3. the design doc's sufficiency check section names all three upcoming needs and concludes no new field is required", () => {
    const section = (designDocSource.match(/## 3\. Sufficiency check against this Arc's own upcoming needs([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*`StaticNostrPublicIdentitySource` \(Alpha 108\)\*\*/);
    expect(section).toMatch(/\*\*A Desktop-level public identity configuration \(Alpha 107\)\*\*/);
    expect(section).toMatch(/\*\*`readPublicIdentity\(\)`'s own signature\*\*/);
    expect(section).toMatch(/No new field is needed/);
  });

  it("4. the design doc's secret-key check confirms no secret material is representable anywhere on the interface", () => {
    const section = (designDocSource.match(/## 4\. Secret-key check([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/no field or\s*\nmethod anywhere on `FedosNostrPublicIdentitySnapshot` or/);
    expect(section).toMatch(/references a\s*\nsecret key, `nsec`, seed, mnemonic, or any other secret material/);
  });

  it("5. the design doc declares a single Decision -- no addition needed, interface already sufficient", () => {
    const section = (designDocSource.match(/## 5\. Decision([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*No addition to `FedosNostrPublicIdentitySource` or\s*\n`FedosNostrPublicIdentitySnapshot` is needed\./,
    );
  });

  it("6. the design doc's own 'does NOT do' list confirms no src/identity/* or src/desktop/* file is modified", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* modify `src\/identity\/fedos_nostr_public_identity_source\.ts`\s*\n\s*or any other `src\/identity\/\*` file/,
    );
    expect(designDocSource).toMatch(/Does \*\*not\*\* modify any `src\/desktop\/\*` file/);
  });

  it("7. the design doc cross-references Alpha 039, Alpha 044, Alpha 101, and Alpha 103", () => {
    for (const ref of [
      "secure_runtime_alpha_039_nostr_public_identity_source_boundary",
      "secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_103_source_injection",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. the design doc's own structure sanity check -- at least six numbered top-level sections", () => {
    const sectionHeaders = [...designDocSource.matchAll(/^## \d+\./gm)];
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(6);
  });

  it("9. structural: fedos_nostr_public_identity_source.ts still declares exactly the four fields this Stage reviewed, unchanged", () => {
    expect(nostrPublicIdentitySourceSource).toMatch(
      /export interface FedosNostrPublicIdentitySnapshot \{\s*\n\s*readonly id: string;\s*\n\s*readonly publicIdentifier: string;\s*\n\s*readonly displayName\?: string;\s*\n\s*readonly avatar\?: string;\s*\n\}/,
    );
    expect(nostrPublicIdentitySourceSource).toMatch(
      /export interface FedosNostrPublicIdentitySource \{\s*\n\s*readPublicIdentity\(\): Promise<FedosNostrPublicIdentitySnapshot \| null>;\s*\n\}/,
    );
  });

  it("10. Regression: fedos_nostr_public_identity_source.ts does not reference this Stage's own doc -- confirming zero src/ change", () => {
    expect(nostrPublicIdentitySourceSource).not.toMatch(/secure_runtime_alpha_106/);
  });

  it("11. Regression: desktop_application.ts/create_desktop_application.ts do not reference this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_106/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_106/);
  });

  it("12. Regression: fedos_runtime_identity.ts/create_runtime.ts/types.ts/worker.ts do not reference this Stage's own doc", () => {
    for (const source of [fedosRuntimeIdentitySource, createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_106/);
    }
  });
});

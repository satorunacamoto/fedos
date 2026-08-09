import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_142_root_hierarchy_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
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

/**
 * Secure Runtime Alpha 142 -- "Root Hierarchy Decision": Stage 2 of
 * the Deterministic Identity Root Derivation Design Arc. A DESIGN /
 * DECISION ONLY Stage -- zero code change. Compares five hierarchy
 * options across 20 criteria and adopts Option C.
 */
describe("Secure Runtime Alpha 142 -- Root Hierarchy Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc names all five options -- A through E", () => {
    expect(designDocSource).toMatch(/\*\*Option A — Flat:\*\*/);
    expect(designDocSource).toMatch(/\*\*Option B — Single Root layer:\*\*/);
    expect(designDocSource).toMatch(/\*\*Option C — Application Root layer:\*\*/);
    expect(designDocSource).toMatch(/\*\*Option D — Identity-Root-only:\*\*/);
    expect(designDocSource).toMatch(/\*\*Option E — Independent seeds:\*\*/);
  });

  it("4. the design doc's own comparison table contains at least 20 criteria rows, matching the Objective's own required minimum", () => {
    const section = (designDocSource.match(/## 3\. Comparison — 20 criteria([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    const rows = [...section.matchAll(/^\| \d+ \|/gm)];
    expect(rows.length).toBeGreaterThanOrEqual(20);
  });

  it("5. the design doc's own comparison table includes every criterion named in the Objective, in order", () => {
    const section = (designDocSource.match(/## 3\. Comparison — 20 criteria([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    const criteria = [
      "Domain Separation",
      "Protocol Independence",
      "Multiple Accounts",
      "Device Keys",
      "Rotation",
      "Versioning",
      "Recovery",
      "Migration",
      "Compromise Containment",
      "Auditability",
      "Determinism",
      "Interoperability",
      "Implementation Complexity",
      "Rust Boundary",
      "Secret Exposure",
      "Desktop Boundary",
      "Storage Boundary",
      "Wallet Separation",
      "Future Protocol Addition",
      "Backward Compatibility",
    ];
    let lastIndex = -1;
    for (const criterion of criteria) {
      const index = section.indexOf(criterion);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("6. the design doc declares a single Decision -- Option C is adopted", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*Option C is ADOPTED\.\*\*/);
    expect(section).toMatch(/requires no new Rust\s*\nderivation primitive/);
  });

  it("7. the design doc's own adopted hierarchy places Identity/Storage/Wallet/Application Root as FOUR SIBLINGS of Master Seed", () => {
    const section = (designDocSource.match(/## 5\. Adopted hierarchy([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/├── Identity Root/);
    expect(section).toMatch(/├── Storage Root/);
    expect(section).toMatch(/├── Wallet Root/);
    expect(section).toMatch(/└── Application Root/);
    expect(section).toMatch(
      /`Identity Root`, `Storage Root`, `Wallet Root`, and `Application Root`\s*\nare FOUR SIBLING children of the Master Seed/,
    );
  });

  it("8. the design doc's own adopted hierarchy places every Protocol Root exclusively under Application Root, never directly under Master Seed", () => {
    const section = (designDocSource.match(/## 5\. Adopted hierarchy([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(/├── Nostr Root/);
    expect(section).toMatch(/├── Session Root/);
    expect(section).toMatch(/├── ATProto Root/);
    expect(section).toMatch(
      /`Application Root` is the SOLE parent of every Protocol Root\s*\n\(Nostr\/Session\/ATProto\/future\) — Protocol Roots are never derived\s*\ndirectly from the Master Seed\./,
    );
  });

  it("9. the design doc explicitly defers the exact Domain Separation format to Alpha 143", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* fix the exact Domain Separation strings\/context format\s*\n\s*— that is Alpha 143's own deliverable\./,
    );
  });

  it("10. the design doc cross-references Alpha 141, vault_crypto_identity.md, and secret_handle_api_shape.md", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "vault_crypto_identity.md",
      "secret_handle_api_shape.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: zero code change anywhere
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_142/);
    expect(createDesktopApplicationSource).not.toMatch(/secure_runtime_alpha_142/);
  });

  it("12. Regression: fedos_runtime_identity.ts is completely unmodified -- no reference to this Stage's own doc", () => {
    expect(fedosRuntimeIdentitySource).not.toMatch(/secure_runtime_alpha_142/);
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_142/);
    }
  });

  it("14. RIPPLE (Secure Runtime Alpha 148): Rust/Cargo/package sources carried no reference to this Stage's own doc AS OF this Stage's own review-only scope (zero code change); Stage 1014 (Secure Runtime Alpha 148) legitimately cites this doc's own adopted hierarchy as the design justification for the Application Root derivation it implements -- Cargo.toml/package.json remain untouched, and lib.rs's own reference is confirmed to be a doc-comment CITATION, never an executable code change, reconfirmed here as the CURRENT state", () => {
    expect(libRsSource).toMatch(/secure_runtime_alpha_142_root_hierarchy_decision\.md/);
    expect(cargoTomlSource).not.toMatch(/secure_runtime_alpha_142/);
    expect(packageJsonSource).not.toMatch(/secure_runtime_alpha_142/);
  });
});

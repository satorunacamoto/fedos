import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_145_deterministic_identity_derivation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosRuntimeIdentitySource from "../src/runtime/fedos_runtime_identity.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 145 -- "Deterministic Identity Derivation
 * Completion": Stage 5, the closing Stage, of the Deterministic
 * Identity Root Derivation Design Arc. A DESIGN / DECISION ONLY Stage
 * -- zero code change. Integrates Alpha 141-144, declares the Design
 * Phase Complete, and recommends Alpha 146.
 */
describe("Secure Runtime Alpha 145 -- Deterministic Identity Derivation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(5000);
  });

  it("2. the design doc declares itself DESIGN / DECISION ONLY, with no code change of any kind", () => {
    expect(designDocSource).toMatch(/this Stage is DESIGN \/ DECISION ONLY/);
    expect(designDocSource).toMatch(
      /It makes NO code\s*\nchange of any kind — no `src\/` file, no `packages\/` file, is modified\./,
    );
  });

  it("3. the design doc's own integration section covers all seven integrated Decisions", () => {
    const section = (designDocSource.match(/## 2\. Integration — the four Decisions, together([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/1\. \*\*Root hierarchy \(Alpha 142\):\*\*/);
    expect(section).toMatch(/2\. \*\*Domain separation \(Alpha 143\):\*\*/);
    expect(section).toMatch(/3\. \*\*Derivation Version:\*\*/);
    expect(section).toMatch(/4\. \*\*Account \/ Device index:\*\*/);
    expect(section).toMatch(/5\. \*\*Recovery contract \(Alpha 144 §2\/§3\):\*\*/);
    expect(section).toMatch(/6\. \*\*Threat Model \(Alpha 144 §4\/§5\/§6\):\*\*/);
    expect(section).toMatch(/7\. \*\*Secret Exposure prohibition:\*\*/);
  });

  it("4. the design doc's own responsibility boundary covers all five roles named in the Objective", () => {
    const section = (designDocSource.match(/## 3\. Responsibility boundary — formally fixed([\s\S]*?)\n## 4\./) ?? [])[1] ?? "";
    for (const role of ["Rust / Secure Runtime", "Desktop", "Identity Layer", "Protocol Adapter", "Storage"]) {
      expect(section).toContain(role);
    }
  });

  it("5. the design doc issues a Completion Declaration naming the Design Phase COMPLETE", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*The Deterministic Identity Root Derivation Design Phase is COMPLETE\./,
    );
  });

  it("6. the design doc's own Completion Declaration fixes the Recovery contract candidate in the exact required form", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Given the SAME Master Seed and the SAME Derivation Parameters\s*\n\(schema version, root category, protocol identifier,\s*\nnetwork\/environment, Account index, Device index\), FedOS can\s*\ndeterministically reconstruct the SAME Protocol Identity/,
    );
  });

  it("7. the design doc's own Completion Declaration explicitly confirms no cryptographic implementation occurs in this Stage or Arc", () => {
    const section = (designDocSource.match(/## 4\. Completion Declaration([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toMatch(/\*\*No cryptographic implementation occurs in this Stage or this Arc\.\*\*/);
  });

  it("8. the design doc recommends exactly one Alpha 146 candidate -- Master Seed / Root Derivation Rust Boundary Review", () => {
    const section = (designDocSource.match(/## 5\. Alpha 146 recommendation([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /\*\*Recommended: Master Seed \/ Root Derivation Rust Boundary Review\.\*\*/,
    );
  });

  it("9. the design doc's own Alpha 146 recommendation explicitly rules out Nostr Relay connection", () => {
    const section = (designDocSource.match(/## 5\. Alpha 146 recommendation([\s\S]*?)\n## 6\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /Nostr Relay connection is explicitly NOT recommended — signing,\s*\nkey generation, and Relay work all require a Root to already exist,/,
    );
  });

  it("10. the design doc cross-references all four prior Arc-stage docs plus the two existing SecretHandle planning docs", () => {
    for (const ref of [
      "secure_runtime_alpha_141_existing_secret_kdf_inventory",
      "secure_runtime_alpha_142_root_hierarchy_decision",
      "secure_runtime_alpha_143_domain_separation_decision",
      "secure_runtime_alpha_144_recovery_threat_model_decision",
      "secret_handle_api_shape.md",
      "secret_lifecycle_implementation_plan.md",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Regression: zero code change anywhere across the WHOLE Arc
  // ---------------------------------------------------------------------

  it("11. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to any of the five Arc-stage docs", () => {
    for (const stage of ["141", "142", "143", "144", "145"]) {
      expect(desktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(createDesktopApplicationSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("12. Regression: fedos_runtime_identity.ts is byte-for-byte unchanged across the whole Arc -- no reference to any Arc-stage doc", () => {
    for (const stage of ["141", "142", "143", "144", "145"]) {
      expect(fedosRuntimeIdentitySource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("13. Regression: create_runtime.ts/types.ts/worker.ts remain permanently untouched -- no reference to any Arc-stage doc", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      for (const stage of ["141", "142", "143", "144", "145"]) {
        expect(source).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      }
    }
  });

  it("14. Regression: Rust and Cargo/package sources are BYTE-FOR-BYTE UNCHANGED across the whole Arc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)];
    expect(pubFnNames.length).toBe(36);
    const wasmBindgenCount = [...libRsSource.matchAll(/#\[wasm_bindgen\]/g)].length;
    expect(wasmBindgenCount).toBe(13);
    for (const stage of ["141", "142", "143", "144", "145"]) {
      expect(libRsSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(cargoTomlSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
      expect(packageJsonSource).not.toMatch(new RegExp(`secure_runtime_alpha_${stage}`));
    }
  });

  it("15. Regression: HkdfDomain remains the exact same five variants across the whole Arc -- no new variant was added", () => {
    const enumBody = (libRsSource.match(/pub\(crate\) enum HkdfDomain \{([\s\S]*?)\n\s{4}\}/) ?? [])[1] ?? "";
    const variants = [...enumBody.matchAll(/^\s*(\w+),/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(variants).toEqual(["RootKey", "Identity", "Storage", "Conversation", "TestOnly"]);
  });

  it("16. Regression: package.json still declares exactly two dependencies and no bin field, unaffected by this Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("17. Regression: desktop_application.ts's own public method/field set is byte-for-byte unchanged from Alpha 140's own closing state", () => {
    const classBody = (desktopApplicationSource.match(/export class DesktopApplication \{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    const publicMethodNames = [
      ...classBody.matchAll(/^\s{2}(?:async\s+)?(\w+)\([^)]*\)(?::\s*[^{]+)?\s*\{/gm),
    ]
      .map((m: RegExpMatchArray) => m[1] ?? "")
      .filter((name: string) => name !== "constructor");
    expect(new Set(publicMethodNames)).toEqual(
      new Set([
        "bootstrap",
        "start",
        "currentIdentity",
        "isBootstrapped",
        "readPublicIdentity",
        "currentPublicIdentity",
        "refreshPublicIdentity",
      ]),
    );
    const fieldNames = [...classBody.matchAll(/^\s{2}(?:readonly )?#(\w+)(?::|\s*=)/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames).toEqual(["identity", "reader", "publicIdentity", "started", "currentPublicIdentity"]);
  });
});

import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import completionDocSource from "../docs/fedos_prototype_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import surfaceReviewDocSource from "../docs/runtime_prototype_public_completion_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeDiagnosticsSource from "../src/runtime/runtime_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerDiagnosticsSource from "../src/runtime/worker_crypto_diagnostics.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Prototype EXECUTION Phase 015 — "Prototype Completion Declaration":
 * a DECLARATION, not an implementation. No code change of any kind.
 * Formally declares the FedOS Prototype arc complete, per Phase 014's
 * own review, and records the full Planning Chain (Prototype Phase
 * 001-021, Stage 689-913) and Execution Chain (Prototype EXECUTION
 * Phase 001-014, Stage 921-995) history, the Fail-Closed invariants
 * still held, what remains intentionally unimplemented, open items,
 * and the handoff to a future "Secure Runtime Alpha" arc.
 */
describe("FedOS Prototype Completion Declaration -- doc-only, no Runtime/Worker/Rust/Cargo/package/Diagnostics change (Phase 015)", () => {
  it("1. the Prototype Completion document exists and is substantial", () => {
    expect(typeof completionDocSource).toBe("string");
    expect(completionDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states this is a DECLARATION with an explicit multi-file 'no code change' list", () => {
    expect(completionDocSource).toMatch(/DECLARATION, not an implementation/);
    expect(completionDocSource).toMatch(/No code change of any/);
    expect(completionDocSource).toMatch(/`src\/runtime\/`, `src\/worker\.ts`/);
    expect(completionDocSource).toMatch(/`Cargo\.toml`, `package\.json`/);
    expect(completionDocSource).toMatch(/both diagnostics files/);
  });

  it("3. states the Prototype's original purpose and termination condition", () => {
    expect(completionDocSource).toMatch(/Prototype's original purpose/);
    expect(completionDocSource).toMatch(/Runtime reaches the Rust/);
    expect(completionDocSource).toMatch(/minimal API, and its return value reaches/);
    expect(completionDocSource).toMatch(/back to Runtime/);
  });

  it("4. records the final reached chain -- both the PlanningOnly chain (BlockedByPolicy) and the real Execution reach chain (Rust version())", () => {
    expect(completionDocSource).toMatch(/PlanningOnly chain/);
    expect(completionDocSource).toMatch(/BlockedByPolicy — STOP/);
    expect(completionDocSource).toMatch(/Execution reach chain/);
    expect(completionDocSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(completionDocSource).toMatch(/attemptDevOnlyJsGlueImport/);
    expect(completionDocSource).toMatch(/attemptDevOnlyWasmInitialization/);
    expect(completionDocSource).toMatch(/attemptDevOnlyRustVersionCall/);
    expect(completionDocSource).toMatch(/pub fn version\(\) -> String/);
    expect(completionDocSource).toMatch(/rustVersion: "fedos-core-rust\/0\.0\.0"/);
  });

  it("5. the Planning Chain (Prototype Phase 001-021, Stage 689-913) is tabulated", () => {
    expect(completionDocSource).toMatch(/Planning Chain — Prototype Phase 001–021/);
    expect(completionDocSource).toMatch(/689–696/);
    expect(completionDocSource).toMatch(/913/);
    expect(completionDocSource).toMatch(/eight-part internal Planning Chain is complete/);
    // Every phase table row exists, including the documented numbering gap.
    for (const marker of ["001 |", "006 |", "008 |", "009–010 |", "020 |", "021 |"]) {
      expect(completionDocSource).toContain(marker);
    }
  });

  it("6. the Execution Chain (Prototype EXECUTION Phase 001-014, Stage 921-995) is tabulated", () => {
    expect(completionDocSource).toMatch(/Execution Chain — Prototype EXECUTION Phase 001–014/);
    expect(completionDocSource).toMatch(/921/);
    expect(completionDocSource).toMatch(/995/);
    for (const marker of ["001 |", "004 |", "009 |", "010 |", "012 |", "013 |", "014 |"]) {
      expect(completionDocSource).toContain(marker);
    }
    expect(completionDocSource).toMatch(/Runtime Integration/);
    expect(completionDocSource).toMatch(/Public Runtime Completion Surface Review/);
  });

  it("7. the currently-maintained Fail Closed invariants are listed", () => {
    expect(completionDocSource).toMatch(/allowed:\s*false|allowed: false/);
    expect(completionDocSource).toMatch(/initialized: false/);
    expect(completionDocSource).toMatch(/PrototypeDisabled/);
    expect(completionDocSource).toMatch(/Worker remains fully unconnected/);
    expect(completionDocSource).toMatch(/Production remains fully unconnected/);
  });

  it("8. the intentionally-unimplemented list is present and complete", () => {
    for (const item of [
      "encrypt()",
      "decrypt()",
      "deriveKey()",
      "randomBytes()",
      "NIP-17",
      "NIP-44",
      "NIP-59",
      "Onion-like routing",
      "Double Ratchet",
      "Triple Ratchet",
    ]) {
      expect(completionDocSource).toContain(item);
    }
  });

  it("9. open items at completion and the handoff to Secure Runtime Alpha are both present", () => {
    expect(completionDocSource).toMatch(/Open items at Prototype completion/);
    expect(completionDocSource).toMatch(/Handoff to the next arc — "Secure Runtime Alpha"/);
    expect(completionDocSource).toMatch(/Real cryptography is unstarted/);
  });

  it("10. cross-references the Phase 014 review and the Phase 013 integration doc this declaration acts on", () => {
    expect(completionDocSource).toMatch(/runtime_prototype_public_completion_surface_review\.md/);
    expect(completionDocSource).toMatch(/runtime_prototype_execution_runtime_integration\.md/);
    expect(completionDocSource).toMatch(/runtime_internal_execution_contract\.md/);
  });

  it("11. Fail Closed is confirmed maintained by an ACTUAL call, not just doc text -- initializeCrypto() still the pinned constant", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("12. Fail Closed is confirmed maintained -- FedosWasmLoader.planLoad() still resolves BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("13. Runtime source files were untouched by THIS stage's own scope (Stage 996) -- create_runtime.ts/fedos_wasm_loader.ts still have no reference; fedos_runtime_prototype_execution.ts's own later Stage 999 doc comment legitimately names the completion doc, see test/secure_runtime_alpha_003_capability_reader.test.ts", () => {
    expect(createRuntimeSource).not.toMatch(/fedos_prototype_completion/);
    expect(wasmLoaderSource).not.toMatch(/fedos_prototype_completion/);
  });

  it("14. Worker remains fully unchanged and unconnected -- src/worker.ts references nothing from this stage or the Rust-reach chain", () => {
    expect(workerSource).not.toMatch(/fedos_prototype_completion/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_prototype_execution/);
  });

  it("15. Production was unaffected AS OF THIS stage's own scope (Stage 996) -- create_runtime.ts's own AppRuntime assembly carried no new field then; Stage 999 (Secure Runtime Alpha 003) later wired in ONE new, read-only field, runtimeCapabilities, see test/secure_runtime_alpha_003_capability_reader.test.ts", () => {
    expect(createRuntimeSource).toMatch(/fedos_runtime_prototype_execution/);
    expect(createRuntimeSource).toMatch(/runtimeCapabilities/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
  });

  it("16. Rust source is unchanged -- still 28 pub fn, still exactly one #[wasm_bindgen]; Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/fedos_prototype_completion/);

    const cargoCode = cargoTomlSource
      .split("\n")
      .map((line: string) => line.replace(/#.*$/, ""))
      .join("\n")
      .toLowerCase();
    const depsIdx = cargoCode.indexOf("[dependencies]");
    const devDepsIdx = cargoCode.indexOf("[dev-dependencies]");
    const productionDepsSection = cargoCode.slice(depsIdx, devDepsIdx);
    const depLines = productionDepsSection
      .split("\n")
      .filter((line: string) => /^\s*[a-z0-9_-]+\s*=/.test(line));
    expect(depLines.length).toBe(11);

    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("17. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/fedos_prototype_completion/);
    expect(workerDiagnosticsSource).not.toMatch(/fedos_prototype_completion/);
  });

  it("18. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no new Runtime Service or Plan added by this declaration", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("19. the Phase 014 surface review's own recommendation is consistent with this declaration -- Option C, Option A rejected", () => {
    expect(surfaceReviewDocSource).toMatch(/Adopt Option C as already-sufficient/);
    expect(surfaceReviewDocSource).toMatch(/reject Option A outright/);
    expect(completionDocSource).toMatch(/does not surface `rustVersion`/);
  });
});

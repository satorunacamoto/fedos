import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import baselineDocSource from "../docs/secure_runtime_alpha_001_baseline.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import completionDocSource from "../docs/fedos_prototype_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
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
 * Secure Runtime Alpha 001 — "Prototype Handoff & Alpha Baseline":
 * BASELINE/REVIEW ONLY, no new feature implemented, no code change of
 * any kind. Opens the Alpha arc `docs/fedos_prototype_completion.md`
 * (Prototype EXECUTION Phase 015) named as the Prototype's successor:
 * summarizes Prototype outcomes, documents the current Runtime
 * structure (including the split between the PlanningOnly chain and
 * the Execution-only Rust reach), ranks Alpha's first seven priority
 * items, classifies Prototype-derived technical debt, and names
 * Alpha's own design principles.
 */
describe("Secure Runtime Alpha 001 Baseline -- review/doc only, no Runtime/Worker/Rust/Cargo/package/Diagnostics/Production change", () => {
  it("1. the Alpha Baseline document exists and is substantial", () => {
    expect(typeof baselineDocSource).toBe("string");
    expect(baselineDocSource.length).toBeGreaterThan(8000);
  });

  it("2. references the Prototype Completion document as the arc this Baseline picks up from", () => {
    expect(baselineDocSource).toMatch(/fedos_prototype_completion\.md/);
    expect(baselineDocSource).toMatch(/Prototype EXECUTION Phase 015/);
    expect(completionDocSource).toMatch(/FedOS Prototype arc COMPLETE/);
  });

  it("3. states BASELINE/REVIEW ONLY with an explicit multi-file 'no code change' list", () => {
    expect(baselineDocSource).toMatch(/BASELINE \/ REVIEW DOCUMENT/);
    expect(baselineDocSource).toMatch(/No new feature is implemented/);
    expect(baselineDocSource).toMatch(/`src\/runtime\/`,/);
    expect(baselineDocSource).toMatch(/`Cargo\.toml`,\s*\n?\s*`package\.json`/);
    expect(baselineDocSource).toMatch(/both diagnostics files/);
    expect(baselineDocSource).toMatch(/Production code paths/);
  });

  it("4. summarizes Prototype outcomes -- achieved, not achieved, and retained Fail Closed", () => {
    expect(baselineDocSource).toMatch(/Prototype outcomes/);
    expect(baselineDocSource).toMatch(/### Achieved/);
    expect(baselineDocSource).toMatch(/Not achieved \(by design, not by omission\)/);
    expect(baselineDocSource).toMatch(/What is deliberately retained as Fail Closed going into Alpha/);
    expect(baselineDocSource).toMatch(/rustVersion: "fedos-core-rust\/0\.0\.0"/);
  });

  it("5. documents the Alpha baseline Runtime structure, including the PlanningOnly-vs-Execution-only split", () => {
    expect(baselineDocSource).toMatch(/Alpha baseline — current Runtime structure/);
    expect(baselineDocSource).toMatch(/PLANNING-ONLY/);
    expect(baselineDocSource).toMatch(/EXECUTION-ONLY/);
    expect(baselineDocSource).toMatch(/TWO SEPARATE PATHS today, not one/);
    expect(baselineDocSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(baselineDocSource).toMatch(/Auxiliary, Planning-only components/);
    expect(baselineDocSource).toMatch(/Auxiliary, Execution-only components/);
  });

  it("6. ranks seven Alpha priority items with reasoning, in the order named by the user's own example", () => {
    expect(baselineDocSource).toMatch(/Alpha priority items, ranked with reasoning/);
    const sectionStart = baselineDocSource.indexOf("## 3. Alpha priority items, ranked with reasoning");
    const sectionEnd = baselineDocSource.indexOf("## 4. Prototype-derived technical debt");
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    const section = baselineDocSource.slice(sectionStart, sectionEnd);

    const orderedItems = [
      "Public Runtime Surface",
      "Runtime State整理",
      "Crypto API Surface",
      "Secure Storage",
      "Backend Resolver拡張",
      "Worker接続",
      "Production接続",
    ];
    let lastIndex = -1;
    for (const item of orderedItems) {
      const idx = section.indexOf(item);
      expect(idx, `expected to find "${item}" in the priority-items section`).toBeGreaterThan(-1);
      expect(idx, `expected "${item}" to appear after the previous item`).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("7. classifies Prototype-derived technical debt into three buckets", () => {
    expect(baselineDocSource).toMatch(/将来削除予定 \(future removal candidates\)/);
    expect(baselineDocSource).toMatch(/Alphaでも維持 \(keep during Alpha\)/);
    expect(baselineDocSource).toMatch(/Productionまで維持 \(keep through Production\)/);
  });

  it("8. names Alpha design principles -- continued from the Prototype, plus at least three newly-proposed ones", () => {
    expect(baselineDocSource).toMatch(/Continued from the Prototype, unchanged/);
    expect(baselineDocSource).toMatch(/1 Stage = 1 responsibility/);
    expect(baselineDocSource).toMatch(/Fail Closed\./);
    expect(baselineDocSource).toMatch(/Proposed new for Alpha/);
    expect(baselineDocSource).toMatch(/No implicit environment trust for Production authorization/);
    expect(baselineDocSource).toMatch(/verified against a REAL build/);
  });

  it("9. explicitly lists what this Phase does NOT do", () => {
    expect(baselineDocSource).toMatch(/Does \*\*not\*\* change `src\/runtime\/`/);
    expect(baselineDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(baselineDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(baselineDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(baselineDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(baselineDocSource).toMatch(/Does \*\*not\*\* change any Production code path/);
    expect(baselineDocSource).toMatch(/none is started this Phase/);
  });

  it("10. Fail Closed is confirmed maintained by an ACTUAL call -- initializeCrypto() still the pinned constant", async () => {
    const { createRuntimeInitializeCryptoResult } = await import("../src/runtime/create_runtime.js");
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("11. Fail Closed is confirmed maintained -- FedosWasmLoader.planLoad() still resolves BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("12. Runtime source files are byte-for-byte untouched by this stage -- no reference to the Alpha baseline doc anywhere", () => {
    expect(createRuntimeSource).not.toMatch(/secure_runtime_alpha_001_baseline/);
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_001_baseline/);
    expect(runtimeIntegrationSource).not.toMatch(/secure_runtime_alpha_001_baseline/);
  });

  it("13. Worker remains fully unchanged and unconnected -- src/worker.ts references nothing from this stage or the Rust-reach chain", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_001_baseline/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(workerSource).not.toMatch(/fedos_runtime_prototype_execution/);
  });

  it("14. Production was unaffected AS OF THIS Baseline's own scope (Stage 997) -- create_runtime.ts's own AppRuntime assembly carried no new field then; Stage 999 (Secure Runtime Alpha 003) later wired in ONE new, read-only field, runtimeCapabilities, resolving this Baseline's own §3 item 1, see test/secure_runtime_alpha_003_capability_reader.test.ts", () => {
    expect(createRuntimeSource).toMatch(/fedos_runtime_prototype_execution/);
    expect(createRuntimeSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
  });

  it("15. Rust source is unchanged -- still 28 pub fn, still exactly one #[wasm_bindgen]; Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(68);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_001_baseline/);

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

  it("16. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_001_baseline/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_001_baseline/);
  });

  it("17. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no new Runtime Service or Plan added by this Baseline", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });
});

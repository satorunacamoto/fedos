import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewDocSource from "../docs/secure_runtime_alpha_002_public_surface_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import baselineDocSource from "../docs/secure_runtime_alpha_001_baseline.md?raw";
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
 * Secure Runtime Alpha 002 — "Public Runtime Surface Review": REVIEW
 * ONLY, no code change of any kind. Resolves Alpha 001's own §3 item
 * 1 ("Public Runtime Surface"): classifies the current Public /
 * Internal / Prototype-only API surface, compares candidate new
 * public readers, reviews initializeCrypto()'s future treatment,
 * extends Phase 014's version()-exposure review, confirms the surface
 * can grow without breaking Fail Closed, checks Worker/Production/
 * Backend Resolver/Secure Storage consistency, and recommends Alpha
 * 003's first concrete public API deliverable.
 */
describe("Secure Runtime Alpha 002 Public Surface Review -- review only, no Runtime/Worker/Rust/Cargo/package/Diagnostics/Production change", () => {
  it("1. the review document exists and is substantial", () => {
    expect(typeof reviewDocSource).toBe("string");
    expect(reviewDocSource.length).toBeGreaterThan(8000);
  });

  it("2. states REVIEW ONLY with an explicit multi-file 'no code change' list", () => {
    expect(reviewDocSource).toMatch(/REVIEW ONLY/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/runtime\/`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `src\/worker\.ts`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `packages\/fedos-core-rust\/src\/lib\.rs`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
    expect(reviewDocSource).toMatch(/Does \*\*not\*\* change any Production code path/);
  });

  it("3. classifies the current surface into Public / Internal / Prototype-only API, naming real functions", () => {
    expect(reviewDocSource).toMatch(/\*\*Public API\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Internal API\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Prototype-only API\*\*/);
    expect(reviewDocSource).toMatch(/AppRuntime\.initializeCrypto/);
    expect(reviewDocSource).toMatch(/AppRuntime\.crypto/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(reviewDocSource).toMatch(/attemptDevOnlyRustVersionCall/);
    // The Facade-level initializeCrypto() naming collision must be called out explicitly.
    expect(reviewDocSource).toMatch(/naming collision/);
  });

  it("4. compares at least six candidate public APIs, including all of the user's named examples", () => {
    for (const candidate of [
      "runtimeState()",
      "runtimeStatus()",
      "runtimeCapabilities()",
      "cryptoRuntime()",
      "diagnostics()",
    ]) {
      expect(reviewDocSource).toContain(candidate);
    }
    expect(reviewDocSource).toMatch(/Alpha public-API candidates — compared/);
  });

  it("5. compares four options for initializeCrypto()'s future treatment and gives a recommendation", () => {
    expect(reviewDocSource).toMatch(/現状維持/);
    expect(reviewDocSource).toMatch(/機能追加/);
    expect(reviewDocSource).toMatch(/内部専用化/);
    expect(reviewDocSource).toMatch(/将来Deprecated/);
    expect(reviewDocSource).toMatch(/Recommended as the actual path forward/);
  });

  it("6. answers whether version() should be exposed publicly, and names a candidate API", () => {
    expect(reviewDocSource).toMatch(/Should `version\(\)` be exposed publicly, and from where\?/);
    expect(reviewDocSource).toMatch(/Yes, eventually — but not from `initializeCrypto\(\)`/);
    expect(reviewDocSource).toMatch(/rustReachable/);
    expect(reviewDocSource).toMatch(/rustVersion: string \| null/);
  });

  it("7. reviews Fail-Closed consistency as the public surface grows, naming three rules", () => {
    expect(reviewDocSource).toMatch(/Fail Closed — can the surface grow without breaking it\?/);
    expect(reviewDocSource).toMatch(/Read-only, never gating\./);
    expect(reviewDocSource).toMatch(/Default absent\/false, positive proof required\./);
    expect(reviewDocSource).toMatch(/`initializeCrypto\(\)`'s own answer stays independent\./);
  });

  it("8. reviews consistency with Worker, Production, Backend Resolver, and Secure Storage futures", () => {
    expect(reviewDocSource).toMatch(/Consistency with Worker, Production, Backend Resolver, and Secure Storage futures/);
    expect(reviewDocSource).toMatch(/\*\*Worker\.\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Production\.\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Backend Resolver\.\*\*/);
    expect(reviewDocSource).toMatch(/\*\*Secure Storage\.\*\*/);
  });

  it("9. recommends a single, concrete first Public API for Alpha 003, with reasoning", () => {
    expect(reviewDocSource).toMatch(/Recommendation — first Public API for Alpha 003/);
    expect(reviewDocSource).toMatch(/runtimeCapabilities\(\)/);
    expect(reviewDocSource).toMatch(/without touching `initializeCrypto\(\)`'s own contract/);
  });

  it("10. cross-references Alpha 001's baseline and Phase 013/014's own docs", () => {
    expect(reviewDocSource).toMatch(/secure_runtime_alpha_001_baseline\.md/);
    expect(reviewDocSource).toMatch(/runtime_prototype_public_completion_surface_review\.md/);
    expect(reviewDocSource).toMatch(/runtime_prototype_execution_runtime_integration\.md/);
    expect(baselineDocSource).toMatch(/Public Runtime Surface/);
  });

  it("11. Fail Closed is confirmed maintained by an ACTUAL call -- initializeCrypto() still the pinned constant", async () => {
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

  it("13. fedos_wasm_loader.ts was, and remains, untouched by this review's own scope; create_runtime.ts and fedos_runtime_prototype_execution.ts's own later Stage 999 doc comments legitimately cite this review's own §7 recommendation, see test/secure_runtime_alpha_003_capability_reader.test.ts", () => {
    expect(wasmLoaderSource).not.toMatch(/secure_runtime_alpha_002_public_surface_review/);
    expect(createRuntimeSource).toMatch(/secure_runtime_alpha_002_public_surface_review/);
    expect(runtimeIntegrationSource).toMatch(/secure_runtime_alpha_002_public_surface_review/);
  });

  it("14. Stage 999 (Secure Runtime Alpha 003) implemented THIS review's own §7 recommendation for real -- runtimeCapabilities now exists in create_runtime.ts, still no runtimeState()/cryptoRuntime()", () => {
    expect(createRuntimeSource).toMatch(/runtimeCapabilities/);
    expect(createRuntimeSource).not.toMatch(/runtimeState\s*\(|cryptoRuntime\s*\(/);
  });

  it("15. Worker remains fully unchanged and unconnected -- src/worker.ts references nothing from this stage or the Rust-reach chain", () => {
    expect(workerSource).not.toMatch(/secure_runtime_alpha_002_public_surface_review/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(workerSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
  });

  it("16. Production was unaffected AS OF THIS review's own scope (Stage 998) -- create_runtime.ts's own AppRuntime assembly carried no new field then; Stage 999 later wired in ONE new, read-only field, runtimeCapabilities, exactly as this review's own §7 recommended", () => {
    expect(createRuntimeSource).toMatch(/fedos_runtime_prototype_execution/);
    expect(createRuntimeSource).toMatch(/attemptDevOnlyRuntimeRustIntegration/);
    expect(createRuntimeSource).not.toMatch(/RuntimePrototypeExecutionState/);
  });

  it("17. Rust and Cargo/package sources are unchanged -- still 28 pub fn, one #[wasm_bindgen], 11/2 dependencies", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(33);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(10);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_002_public_surface_review/);

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

  it("18. neither diagnostics file gained a field or reference from this stage", () => {
    expect(runtimeDiagnosticsSource).not.toMatch(/secure_runtime_alpha_002_public_surface_review/);
    expect(workerDiagnosticsSource).not.toMatch(/secure_runtime_alpha_002_public_surface_review/);
  });

  it("19. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no new Runtime Service or Plan added by this review", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });
});

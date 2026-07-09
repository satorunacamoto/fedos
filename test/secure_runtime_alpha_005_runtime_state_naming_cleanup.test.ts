import { describe, it, expect } from "vitest";
// This project's tsconfig.json carries no `@types/node`; declared
// ambient here the same way `fedos_runtime_prototype_execution.ts` itself does.
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_005_runtime_state_naming_cleanup.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import stateModelReviewDocSource from "../docs/secure_runtime_alpha_004_state_model_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 005 — "Runtime State Naming Cleanup": renames
 * `RuntimeCapabilities.runtimeState` to `runtimeMode`, and its
 * `"Prototype" | "Development" | "Production"` union to the exported
 * `FedosRuntimeMode = "Development" | "Production" | "Unknown"`
 * (Stage 1001) -- resolving Alpha 004's own finding that "Prototype"
 * was overloaded three separate ways. Naming cleanup ONLY:
 * `initializeCrypto()`'s own `"PrototypeDisabled"` reason is
 * untouched, and no new feature/gate/behavior is introduced.
 */
describe("Secure Runtime Alpha 005 -- runtimeMode naming cleanup, initializeCrypto() unchanged, Fail Closed everywhere else (Stage 1001)", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  async function withNodeEnv<T>(value: string | undefined, fn: () => T | Promise<T>): Promise<T> {
    if (value === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = value;
    }
    try {
      return await fn();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  }

  it("1. runtimeCapabilities() returns the NEW field name, runtimeMode -- runtimeState no longer exists", async () => {
    const caps = await runtimeCapabilities();
    expect(caps).toHaveProperty("runtimeMode");
    expect(caps).not.toHaveProperty("runtimeState");
    expect(Object.keys(caps).sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
  });

  it("2. NODE_ENV=development maps to runtimeMode: Development", async () => {
    const caps = await withNodeEnv("development", () => runtimeCapabilities());
    expect(caps.runtimeMode).toBe("Development");
  });

  it("3. NODE_ENV=production maps to runtimeMode: Production", async () => {
    const caps = await withNodeEnv("production", () => runtimeCapabilities());
    expect(caps.runtimeMode).toBe("Production");
  });

  it("4. unset/other NODE_ENV maps to runtimeMode: Unknown -- 'Prototype' has been removed entirely from this classification", async () => {
    const unsetCaps = await withNodeEnv(undefined, () => runtimeCapabilities());
    expect(unsetCaps.runtimeMode).toBe("Unknown");

    const testCaps = await withNodeEnv("test", () => runtimeCapabilities());
    expect(testCaps.runtimeMode).toBe("Unknown");

    const garbageCaps = await withNodeEnv("staging", () => runtimeCapabilities());
    expect(garbageCaps.runtimeMode).toBe("Unknown");
  });

  it("5. 'Prototype' does not appear as a possible runtimeMode value anywhere in real source code", () => {
    const typeMatch = runtimeIntegrationSource.match(
      /export type FedosRuntimeMode = [^;]+;/,
    );
    expect(typeMatch).not.toBeNull();
    const typeDecl = (typeMatch as RegExpMatchArray)[0] ?? "";
    expect(typeDecl).not.toMatch(/"Prototype"/);
    expect(typeDecl).toMatch(/"Development"/);
    expect(typeDecl).toMatch(/"Production"/);
    expect(typeDecl).toMatch(/"Unknown"/);
  });

  it("6. FedosRuntimeMode is exported with exactly three values", () => {
    const typeMatch = runtimeIntegrationSource.match(
      /export type FedosRuntimeMode = ([^;]+);/,
    );
    expect(typeMatch).not.toBeNull();
    const union = (typeMatch as RegExpMatchArray)[1] ?? "";
    const values = [...union.matchAll(/"([^"]+)"/g)].map((m: RegExpMatchArray) => m[1]);
    expect(values.sort()).toEqual(["Development", "Production", "Unknown"].sort());
  });

  it("7. PrototypeDisabled is retained, unchanged, as the initializeCrypto() Fail-Closed reason", () => {
    expect(runtimeTypesSource).toMatch(/RuntimeInitializeCryptoReason = "PrototypeDisabled"/);
  });

  it("8. initializeCrypto()'s own return value is byte-for-byte unchanged by an ACTUAL call", async () => {
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("9. initializeCrypto()'s own return value is unaffected by calling runtimeCapabilities() first, after the rename", async () => {
    await runtimeCapabilities();
    const decision = createRuntimeInitializeCryptoResult();
    expect(decision).toEqual({ allowed: false, initialized: false, reason: "PrototypeDisabled" });
  });

  it("10. createRuntime()'s own assembled AppRuntime still exposes runtimeCapabilities and the SAME initializeCrypto function reference", () => {
    const runtime = createRuntime();
    expect(typeof runtime.runtimeCapabilities).toBe("function");
    expect(runtime.initializeCrypto).toBe(createRuntimeInitializeCryptoResult);
  });

  it("11. calling runtime.runtimeCapabilities() via the real AppRuntime object returns runtimeMode, not runtimeState", async () => {
    const runtime = createRuntime();
    const caps = await withNodeEnv("development", () => runtime.runtimeCapabilities());
    expect(caps.runtimeMode).toBe("Development");
    expect((caps as unknown as Record<string, unknown>).runtimeState).toBeUndefined();
  });

  it("12. this is a naming cleanup ONLY -- no new field, function, gate, or Fail-Closed reason was added", () => {
    const interfaceMatch = runtimeIntegrationSource.match(
      /export interface RuntimeCapabilities \{[\s\S]*?\n\}/,
    );
    expect(interfaceMatch).not.toBeNull();
    const interfaceBody = (interfaceMatch as RegExpMatchArray)[0] ?? "";
    const fieldNames = [...interfaceBody.matchAll(/readonly (\w+):/g)].map((m: RegExpMatchArray) => m[1]);
    expect(fieldNames.sort()).toEqual(
      ["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort(),
    );
    const exportedFns = [...runtimeIntegrationSource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["attemptDevOnlyRuntimeRustIntegration", "runtimeCapabilities"]));
  });

  it("13. NODE_ENV classification was NOT consolidated into one shared function -- fedos_wasm_loader.ts and fedos_runtime_prototype_execution.ts still import nothing from each other for this purpose", () => {
    expect(runtimeIntegrationSource).toMatch(/import \{ createFedosWasmLoader, type FedosWasmLoaderSkeleton \} from "\.\/fedos_wasm_loader\.js";/);
    expect(wasmLoaderSource).not.toMatch(/fedos_runtime_prototype_execution/);
    expect(runtimeIntegrationSource).toMatch(/determineRuntimeMode/);
    expect(wasmLoaderSource).toMatch(/#evaluateDevOnlyGate/);
  });

  it("14. FedosWasmLoader.planLoad() is confirmed byte-for-byte unchanged -- still resolves BlockedByPolicy", async () => {
    const { createFedosWasmLoader } = await import("../src/runtime/fedos_wasm_loader.js");
    const loader = createFedosWasmLoader();
    const decision = loader.planLoad();
    expect(decision.state).toBe("BlockedByPolicy");
    expect(decision.policy).toBe("FailClosed");
  });

  it("15. still exactly seven Plan interfaces in fedos_wasm_loader.ts -- no Plan change by this stage", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("16. Worker remains fully unchanged and unconnected", () => {
    expect(workerSource).not.toMatch(/runtimeCapabilities/);
    expect(workerSource).not.toMatch(/runtimeMode/);
    expect(workerSource).not.toMatch(/FedosRuntimeMode/);
    expect(workerSource).not.toMatch(/secure_runtime_alpha_005/);
  });

  it("17. Production is unaffected beyond the rename -- create_runtime.ts references nothing new besides runtimeCapabilities", () => {
    expect(createRuntimeSource).toMatch(/runtimeCapabilities/);
    expect(createRuntimeSource).not.toMatch(/attemptDevOnlyRustVersionCall/);
    expect(createRuntimeSource).not.toMatch(/FedosRuntimeMode/);
  });

  it("18. Rust and Cargo/package sources are unchanged -- still 28 pub fn, one #[wasm_bindgen], 11/2 dependencies", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(28);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(1);
    expect(libRsSource).not.toMatch(/runtimeMode|FedosRuntimeMode/);

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

  it("19. the design doc exists, is substantial, and states this is naming cleanup only", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
    expect(designDocSource).toMatch(/NAMING CLEANUP ONLY/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add any new Runtime feature/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `initializeCrypto\(\)`'s own return value/);
  });

  it("20. cross-references Alpha 004's own finding and the Stage 999 field this Phase renames", () => {
    expect(designDocSource).toMatch(/secure_runtime_alpha_004_state_model_review\.md/);
    expect(designDocSource).toMatch(/secure_runtime_alpha_003_capability_reader\.md/);
    expect(stateModelReviewDocSource).toMatch(/overloaded THREE separate ways/);
  });
});

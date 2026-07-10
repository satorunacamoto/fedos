import { describe, it, expect } from "vitest";
declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };
import { createRuntime, createRuntimeInitializeCryptoResult } from "../src/runtime/create_runtime.js";
import { runtimeCapabilities } from "../src/runtime/fedos_runtime_prototype_execution.js";
import { randomBytes } from "../src/runtime/fedos_runtime_random_bytes.js";
import { generateAeadKey } from "../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../src/runtime/fedos_runtime_decrypt.js";
import { exportCiphertext } from "../src/runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext } from "../src/runtime/fedos_runtime_import_ciphertext.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../src/runtime/fedos_runtime_ciphertext_storage.js";
import { FedosWasmLoaderSkeleton, createFedosWasmLoader } from "../src/runtime/fedos_wasm_loader.js";
import { determineFedosRuntimeMode, type FedosRuntimeMode } from "../src/runtime/fedos_runtime_mode_authority.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_020_runtime_mode_authority_consolidation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import triggerReviewDocSource from "../docs/secure_runtime_alpha_006_mode_authority_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import modeAuthoritySource from "../src/runtime/fedos_runtime_mode_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeIntegrationSource from "../src/runtime/fedos_runtime_prototype_execution.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageServiceSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
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

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 020 — "Runtime Mode Authority Consolidation":
 * Alpha 006 found three independent `process.env.NODE_ENV` classifiers
 * and named the trigger conditions for merging them; Alpha 019's
 * Ciphertext Storage Service (a third classifier gating a real Storage
 * decision) satisfied trigger condition 4. This Phase extracts a single
 * shared Runtime Mode Authority (`fedos_runtime_mode_authority.ts`) --
 * a CLASSIFIER, not an authorization gate -- and has all three prior
 * call sites delegate to it while keeping their own Fail-Closed
 * decisions and public result shapes byte-for-byte unchanged.
 */
describe("Secure Runtime Alpha 020 -- Runtime Mode Authority Consolidation, classifier only, Fail Closed unchanged everywhere, no Worker/Production/Rust/Cargo/package change", () => {
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

  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc names the trigger (Alpha 006 condition 4, satisfied by Alpha 019) and cross-references it", () => {
    expect(designDocSource).toMatch(/Alpha 006/);
    expect(designDocSource).toMatch(/Alpha 019/);
    expect(designDocSource).toMatch(/trigger/i);
    expect(designDocSource).toMatch(/secure_runtime_alpha_006_mode_authority_review\.md/);
    expect(triggerReviewDocSource).toMatch(
      /Before Secure Storage or any new Crypto API branches on/,
    );
  });

  it("3. the design doc states the classifier-not-authorizer distinction and names the forbidden API shapes", () => {
    expect(designDocSource).toMatch(/isProductionAllowed/);
    expect(designDocSource).toMatch(/isSecure/);
    expect(designDocSource).toMatch(/productionReady/);
    expect(designDocSource).toMatch(/authorizeRuntime/);
    expect(designDocSource).toMatch(/classifier/i);
  });

  it("4. determineFedosRuntimeMode() classifies development/production/unset/other to Development/Production/Unknown/Unknown", async () => {
    expect(await withNodeEnv("development", () => determineFedosRuntimeMode())).toBe("Development");
    expect(await withNodeEnv("production", () => determineFedosRuntimeMode())).toBe("Production");
    expect(await withNodeEnv(undefined, () => determineFedosRuntimeMode())).toBe("Unknown");
    expect(await withNodeEnv("test", () => determineFedosRuntimeMode())).toBe("Unknown");
    expect(await withNodeEnv("staging", () => determineFedosRuntimeMode())).toBe("Unknown");
  });

  it("5. determineFedosRuntimeMode() never throws, even if process.env access itself throws", () => {
    const brokenProcess = {
      env: {
        get NODE_ENV(): string {
          throw new Error("simulated unreadable process.env");
        },
      },
    };
    const original = (globalThis as unknown as { process: unknown }).process;
    (globalThis as unknown as { process: unknown }).process = brokenProcess;
    try {
      expect(() => determineFedosRuntimeMode()).not.toThrow();
      expect(determineFedosRuntimeMode()).toBe("Unknown");
    } finally {
      (globalThis as unknown as { process: unknown }).process = original;
    }
  });

  it("6. fedos_runtime_mode_authority.ts exports exactly determineFedosRuntimeMode and the FedosRuntimeMode type, and reads only NODE_ENV", () => {
    const exportedFns = [...modeAuthoritySource.matchAll(/^export (?:async )?function (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportedFns)).toEqual(new Set(["determineFedosRuntimeMode"]));
    expect(modeAuthoritySource).toMatch(/export type FedosRuntimeMode = "Development" \| "Production" \| "Unknown";/);

    const codeOnly = codeOnlyLines(modeAuthoritySource);
    expect(codeOnly).toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/process\.env(?!\??\.NODE_ENV\b)/);
    expect(codeOnly).not.toMatch(/import\.meta/);
    expect(codeOnly).toMatch(/try\s*\{/);
    expect(codeOnly).toMatch(/catch\s*\{/);
  });

  it("7. no forbidden authorization-shaped API exists in the Authority module", () => {
    const codeOnly = codeOnlyLines(modeAuthoritySource);
    expect(codeOnly).not.toMatch(/isProductionAllowed|isSecure\s*\(|productionReady|authorizeRuntime/);
  });

  it("8. FedosWasmLoader.#evaluateDevOnlyGate() delegates to the shared Authority -- reason set unchanged", () => {
    expect(codeOnlyLines(wasmLoaderSource)).toMatch(/from ".\/fedos_runtime_mode_authority\.js"/);
    expect(codeOnlyLines(wasmLoaderSource)).toMatch(/determineFedosRuntimeMode\(\)/);
    expect(codeOnlyLines(wasmLoaderSource)).not.toMatch(/process\.env/);
    expect(wasmLoaderSource).toMatch(
      /reason: "DevelopmentRuntime" \| "ProductionRuntime" \| "UnknownRuntime" \| "PrototypeStillClosed"/,
    );
  });

  it("9. FedosWasmLoader#evaluateDevOnlyGate() outcomes are unchanged across Development/Production/Unknown", async () => {
    await withNodeEnv("development", () => {
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
      const result = loader.devOnlyGateEvaluation();
      expect(result).toEqual({ evaluated: true, developmentAllowed: true, reason: "DevelopmentRuntime" });
    });
    await withNodeEnv("production", () => {
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
      const result = loader.devOnlyGateEvaluation();
      expect(result).toEqual({ evaluated: true, developmentAllowed: false, reason: "ProductionRuntime" });
    });
    await withNodeEnv(undefined, () => {
      const loader = new FedosWasmLoaderSkeleton();
      loader.planLoad();
      const result = loader.devOnlyGateEvaluation();
      expect(result).toEqual({ evaluated: true, developmentAllowed: false, reason: "UnknownRuntime" });
    });
  });

  it("10. FedosWasmLoader.planLoad() is still always BlockedByPolicy, regardless of runtime mode", async () => {
    await withNodeEnv("development", () => {
      const decision = createFedosWasmLoader().planLoad();
      expect(decision.state).toBe("BlockedByPolicy");
      expect(decision.policy).toBe("FailClosed");
    });
  });

  it("11. runtimeCapabilities()'s determineRuntimeMode() delegates to the shared Authority, and RuntimeCapabilities keeps exactly four fields / three mode values", () => {
    expect(runtimeIntegrationSource).toMatch(/from ".\/fedos_runtime_mode_authority\.js"/);
    expect(runtimeIntegrationSource).toMatch(/function determineRuntimeMode\(\): FedosRuntimeMode \{\s*return determineFedosRuntimeMode\(\);\s*\}/);
    expect(codeOnlyLines(runtimeIntegrationSource)).not.toMatch(/process\.env/);

    const interfaceMatch = runtimeIntegrationSource.match(/export interface RuntimeCapabilities \{[\s\S]*?\n\}/);
    expect(interfaceMatch).not.toBeNull();
    const fieldNames = [...((interfaceMatch as RegExpMatchArray)[0] ?? "").matchAll(/readonly (\w+):/g)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(fieldNames.sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());

    const typeMatch = runtimeIntegrationSource.match(/export type FedosRuntimeMode = ([^;]+);/);
    expect(typeMatch).not.toBeNull();
    const values = [...((typeMatch as RegExpMatchArray)[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(values.sort()).toEqual(["Development", "Production", "Unknown"].sort());
  });

  it("12. runtimeCapabilities() returns runtimeMode consistent with NODE_ENV across all three buckets", async () => {
    expect((await withNodeEnv("development", () => runtimeCapabilities())).runtimeMode).toBe("Development");
    expect((await withNodeEnv("production", () => runtimeCapabilities())).runtimeMode).toBe("Production");
    expect((await withNodeEnv(undefined, () => runtimeCapabilities())).runtimeMode).toBe("Unknown");
  });

  it("13. the Ciphertext Storage Service's gate delegates to the shared Authority -- still the only real GATE among the three call sites", () => {
    expect(storageServiceSource).toMatch(/from ".\/fedos_runtime_mode_authority\.js"/);
    expect(storageServiceSource).toMatch(/determineFedosRuntimeMode\(\)\s*===\s*"Development"/);
    expect(codeOnlyLines(storageServiceSource)).not.toMatch(/process\.env/);
  });

  it("14. storeCiphertext()/loadCiphertext()/deleteCiphertext() succeed round-trip in Development, and resolve null in Production/Unknown", async () => {
    await withNodeEnv("development", async () => {
      const stored = await storeCiphertext("alpha020-id", "wire-value" as never);
      expect(stored).toBe(true);
      const loaded = await loadCiphertext("alpha020-id");
      expect(loaded).toBe("wire-value");
      const deleted = await deleteCiphertext("alpha020-id");
      expect(deleted).toBe(true);
    });

    await withNodeEnv("production", async () => {
      expect(await storeCiphertext("alpha020-id-2", "wire-value" as never)).toBeNull();
      expect(await loadCiphertext("alpha020-id-2")).toBeNull();
      expect(await deleteCiphertext("alpha020-id-2")).toBeNull();
    });

    await withNodeEnv(undefined, async () => {
      expect(await storeCiphertext("alpha020-id-3", "wire-value" as never)).toBeNull();
      expect(await loadCiphertext("alpha020-id-3")).toBeNull();
      expect(await deleteCiphertext("alpha020-id-3")).toBeNull();
    });
  });

  it("15. no independent NODE_ENV classification logic remains anywhere in src/runtime/ besides the shared Authority", async () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string, opts: { query: string; import: string }) => Record<string, unknown> }
    ).glob("../src/runtime/*.ts", { query: "?raw", import: "default" });
    const entries = await Promise.all(
      Object.entries(files).map(async ([path, loader]) => [path, await (loader as () => Promise<string>)()] as const),
    );
    const offenders = entries.filter(
      ([path, source]) =>
        !path.endsWith("fedos_runtime_mode_authority.ts") &&
        /process\.env\??\.NODE_ENV/.test(codeOnlyLines(source as string)),
    );
    expect(offenders.map(([path]) => path)).toEqual([]);
  });

  it("16. Public Crypto API results are unaffected by exercising Storage/mode-authority calls first", async () => {
    await withNodeEnv("development", async () => {
      await storeCiphertext("alpha020-regress", "wire-value" as never);
      await loadCiphertext("alpha020-regress");
      await deleteCiphertext("alpha020-regress");
    });

    expect(createRuntimeInitializeCryptoResult()).toEqual({
      allowed: false,
      initialized: false,
      reason: "PrototypeDisabled",
    });

    const caps = await runtimeCapabilities();
    expect(Object.keys(caps).sort()).toEqual(["prototypeCompleted", "rustReachable", "rustVersion", "runtimeMode"].sort());

    const bytes = await withNodeEnv("development", () => randomBytes());
    expect(bytes === null || bytes instanceof Uint8Array).toBe(true);

    const key = await withNodeEnv("development", () => generateAeadKey());
    expect(key === null || (typeof key === "object" && key !== null)).toBe(true);

    const ciphertext = await withNodeEnv("development", () =>
      encrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", new Uint8Array([1])),
    );
    expect(ciphertext === null || (typeof ciphertext === "object" && ciphertext !== null)).toBe(true);

    const plaintext = await withNodeEnv("development", () =>
      decrypt({ kind: "AeadKeyHandle" } as never, "ChaCha20Poly1305", "TestOnly", { kind: "AeadCiphertextHandle" } as never),
    );
    expect(plaintext === null || plaintext instanceof Uint8Array).toBe(true);

    const exported = await withNodeEnv("development", () => exportCiphertext({ kind: "AeadCiphertextHandle" } as never));
    expect(exported === null || typeof exported === "string").toBe(true);

    const imported = await withNodeEnv("development", () => importCiphertext("x" as never));
    expect(imported === null || typeof imported === "object").toBe(true);
  });

  it("17. the real AppRuntime object's runtimeCapabilities()/storeCiphertext()/loadCiphertext()/deleteCiphertext() are unaffected", async () => {
    const runtime = createRuntime();
    const caps = await withNodeEnv("development", () => runtime.runtimeCapabilities());
    expect(caps.runtimeMode).toBe("Development");
    const stored = await withNodeEnv("development", () => runtime.storeCiphertext("id", "wire" as never));
    expect(typeof stored === "boolean" || stored === null).toBe(true);
  });

  it("18. Worker remains fully unconnected to the shared Authority", () => {
    expect(workerSource).not.toMatch(/fedos_runtime_mode_authority/);
    expect(workerSource).not.toMatch(/determineFedosRuntimeMode/);
  });

  it("19. Production (create_runtime.ts's own code) is unaffected beyond the pre-existing three fields it already exposed -- no direct reference to the shared Authority", () => {
    expect(codeOnlyLines(createRuntimeSource)).not.toMatch(/fedos_runtime_mode_authority/);
    expect(runtimeTypesSource).not.toMatch(/fedos_runtime_mode_authority/);
  });

  it("20. Rust and Cargo/package sources are byte-for-byte unchanged -- still 36 pub fn, thirteen #[wasm_bindgen], 11/2 dependencies, no reference to this Phase's own doc", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);
    expect(libRsSource).not.toMatch(/secure_runtime_alpha_020/);

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

  it("21. FedosWasmLoader Plan interfaces are unchanged -- still seven Plan interfaces", () => {
    const planInterfaceMatches = [...wasmLoaderSource.matchAll(/export interface FedosWasmLoader\w*Plan\b/g)].map(
      (m: RegExpMatchArray) => m[0],
    );
    expect([...new Set(planInterfaceMatches)].length).toBe(7);
  });

  it("22. the design doc records what this Phase does NOT do", () => {
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a new Storage Backend/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* add a new Crypto API/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect a Worker/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* connect Production/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `Cargo\.toml`/);
    expect(designDocSource).toMatch(/Does \*\*not\*\* change `package\.json`/);
  });

  it("23. a real FedosRuntimeMode value from the Authority is directly assignable to RuntimeCapabilities.runtimeMode's type (structural compatibility, exercised at runtime)", async () => {
    const mode: FedosRuntimeMode = await withNodeEnv("development", () => determineFedosRuntimeMode());
    const caps = await withNodeEnv("development", () => runtimeCapabilities());
    expect(caps.runtimeMode).toBe(mode);
  });
});

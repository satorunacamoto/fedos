import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  reviewStaticImport,
  staticImportReviewApproved,
  staticImportReviewReason,
  staticImportReviewState,
} from "../src/runtime/fedos_wasm_static_import_review.js";
import {
  FedosWasmStaticImportPlanSkeleton,
  createFedosWasmStaticImportPlan,
  planStaticImport,
} from "../src/runtime/fedos_wasm_static_import_plan.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import safetyReviewDocSource from "../docs/runtime_wasm_static_import_safety_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reviewSource from "../src/runtime/fedos_wasm_static_import_review.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import staticImportPlanSource from "../src/runtime/fedos_wasm_static_import_plan.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoGitignoreSource from "../packages/fedos-core-rust/.gitignore?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 525–530 — "FedOS WASM Static Import Safety Review: reviewing
 * the static import named by Stage 517, never performing it".
 * `docs/runtime_wasm_static_import_safety_review.md` (Stage 525)
 * reviews what would break if the static import were ever written.
 * `src/runtime/fedos_wasm_static_import_review.ts` (Stage 526) fixes
 * `reviewStaticImport()` to `{ approved: false, reason:
 * "GeneratedArtifactNotCommitted" }`. Stage 527 wires
 * `FedosWasmStaticImportPlanSkeleton.planStaticImport()` to call it,
 * discarding the result. Neither this test file nor any file it
 * exercises imports, `import()`s, or executes the generated JS glue,
 * calls `WebAssembly.instantiate`/`compile`/`initSync`, or connects
 * Runtime/Worker to any of it.
 */
describe("FedOS WASM Static Import Safety Review, always blocked, fail-closed everywhere (Stage 525-530)", () => {
  it("1. reviewStaticImport is always approved:false, reason GeneratedArtifactNotCommitted -- never a live probe", () => {
    const decision = reviewStaticImport();
    expect(decision.approved).toBe(false);
    expect(decision.reason).toBe("GeneratedArtifactNotCommitted");
    // Pure and idempotent across repeated calls.
    expect(reviewStaticImport()).toEqual(decision);

    expect(staticImportReviewApproved()).toBe(false);
    expect(staticImportReviewReason()).toBe("GeneratedArtifactNotCommitted");
    expect(staticImportReviewState()).toBe("ReviewedAndBlocked");
  });

  it("2. the review's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.staticImportReviewState).toBe("ReviewedAndBlocked");
    expect(status.staticImportReviewApproved).toBe(false);
    expect(status.staticImportReviewReason).toBe("GeneratedArtifactNotCommitted");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.staticImportReviewState).toBe("ReviewedAndBlocked");
    expect(workerStatus.staticImportReviewApproved).toBe(false);
    expect(workerStatus.staticImportReviewReason).toBe("GeneratedArtifactNotCommitted");
  });

  it("3. the review source never imports the generated JS glue, dynamic-imports, require, or touches WebAssembly/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(reviewSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/\bfs\./);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    // Import statements in this file, if any, only ever reference nothing above/below in the chain.
    expect(codeOnly).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
    expect(codeOnly).not.toMatch(/require\s*\(\s*["'].*fedos_core_rust/);
  });

  it("4. the static import plan legitimately reaches the review but never the generated JS glue or WebAssembly", () => {
    expect(staticImportPlanSource).toMatch(/fedos_wasm_static_import_review/);
    const codeOnly = codeOnlyLines(staticImportPlanSource);
    // The plan file legitimately holds the target string constant itself
    // (FEDOS_WASM_STATIC_IMPORT_TARGET) -- but never inside an import()/require() call.
    expect(codeOnly).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
    expect(codeOnly).not.toMatch(/require\s*\(\s*["'].*fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);

    const decision = planStaticImport();
    expect(decision.state).toBe("BlockedByPolicy");

    const plan = createFedosWasmStaticImportPlan();
    expect(plan.planStaticImport().state).toBe("BlockedByPolicy");

    const skeleton = new FedosWasmStaticImportPlanSkeleton();
    expect(skeleton.planStaticImport().state).toBe("BlockedByPolicy");
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      const plan = createFedosWasmStaticImportPlan();
      plan.planStaticImport();
      planStaticImport();
      reviewStaticImport();
      staticImportReviewApproved();
      staticImportReviewReason();
      staticImportReviewState();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("6. no fetch call happens when exercising the full surface", async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true } as Response));
    const original = globalThis.fetch;
    (globalThis as { fetch?: unknown }).fetch = spy;
    try {
      evaluateWasmLoaderImportPolicy();
      const plan = createFedosWasmStaticImportPlan();
      plan.planStaticImport();
      reviewStaticImport();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the static import review", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the static import review", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_loader_import_policy/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("9. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("10. Allowed/Approved are still unreachable anywhere in the chain", () => {
    const runtimeDecision = evaluateRuntimeCryptoActivation(
      { runtimeCryptoEnabled: true, runtimeCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(runtimeDecision.reason).toBe("ProviderUnavailable");
    expect(runtimeDecision.allowed).toBe(false);

    const workerDecision = evaluateWorkerCryptoActivation(
      { workerCryptoEnabled: true, workerCryptoProvider: "fedos" },
      { FEDOS_CRYPTO_PROVIDER: "fedos", FEDOS_CRYPTO_ENABLED: "explicit-dev-only" },
    );
    expect(workerDecision.reason).toBe("ProviderUnavailable");
    expect(workerDecision.allowed).toBe(false);

    expect(evaluateWasmLoaderImportPolicy().allowed).toBe(false);
    expect(planStaticImport().state).not.toBe("Allowed");
    expect(reviewStaticImport().approved).not.toBe(true);
    expect(reviewStaticImport().reason).not.toBe("Approved");
  });

  it("11. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(36);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(13);

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

  it("12. the safety review doc and execution contract doc record the required facts", () => {
    expect(safetyReviewDocSource).toMatch(/GeneratedArtifactNotCommitted/);
    expect(safetyReviewDocSource).toMatch(/pkg\/fedos_core_rust\.js/);
    expect(safetyReviewDocSource).toMatch(/never committed/i);

    expect(executionContractDocSource).toMatch(/Static Import Review/);
    expect(executionContractDocSource).toMatch(/GeneratedArtifactNotCommitted/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });

  it("13. the generated artifact remains gitignored and, if present locally, is never git-tracked", () => {
    expect(cargoGitignoreSource).toMatch(/(^|\n)\/pkg\/(\n|$)/);

    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const generated = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    const generatedGlue = /_bg\.(js|ts|wasm)$/i;
    const generatedPkgDir = /\/pkg\//i;
    const candidates = paths.filter(
      (path) => generated.test(path) || generatedGlue.test(path) || generatedPkgDir.test(path),
    );
    if (candidates.length === 0) {
      return;
    }
    const tracked = execFileSync("git", ["ls-files", "--", "packages/fedos-core-rust"], {
      encoding: "utf-8",
    });
    const trackedPaths = new Set(tracked.split("\n").filter(Boolean));
    for (const candidate of candidates) {
      const repoRelative = candidate.replace(/^\.\.\//, "");
      expect(trackedPaths.has(repoRelative), `generated artifact must never be git-tracked: ${repoRelative}`).toBe(
        false,
      );
    }
  });
});

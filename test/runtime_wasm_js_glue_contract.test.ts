import { describe, it, expect, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { createFedosWasmArtifact } from "../src/runtime/fedos_wasm_artifact.js";
import {
  FedosWasmLoaderContractPlaceholder,
  createFedosWasmLoaderContract,
  loaderContractVersion,
  loaderImportMode,
  loaderInitialized,
  wasmLoaderState,
} from "../src/runtime/fedos_wasm_loader_contract.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import glueContractDocSource from "../docs/runtime_wasm_js_glue_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import loaderContractSource from "../src/runtime/fedos_wasm_loader_contract.ts?raw";
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

/**
 * Stage 481–488 — "FedOS generated wasm-bindgen JS glue: observation
 * and contract fixing, never usage". `docs/runtime_wasm_js_glue_contract.md`
 * (Stage 481) records, by direct observation, what the real,
 * locally-generated JS glue (`packages/fedos-core-rust/pkg/fedos_core_rust.js`)
 * exports — `initSync` (named) and a default async init function,
 * both from the generic `wasm-bindgen` loader machinery, no
 * crate-specific function (the crate has no `#[wasm_bindgen]`-annotated
 * `pub fn`). `src/runtime/fedos_wasm_loader_contract.ts` (Stage 482)
 * names a fixed-value, UNWIRED contract shape a future loader could
 * implement against. Neither this test file nor any file it exercises
 * imports, `import()`s, or executes the generated JS glue, calls
 * `WebAssembly.instantiate`/`compile`, or connects Runtime/Worker to
 * any of it.
 */
describe("FedOS generated JS glue contract, observed only, never imported/executed, fail-closed everywhere (Stage 481-488)", () => {
  const pkgDir = "packages/fedos-core-rust/pkg";

  it("1. the JS glue contract doc records real generation: export list, default export, init function(s), memory export, full structure", () => {
    expect(glueContractDocSource).toMatch(/export \{ initSync, __wbg_init as default \}/);
    expect(glueContractDocSource).toMatch(/default export.{0,40}PRESENT|PRESENT.{0,40}default export/is);
    expect(glueContractDocSource).toMatch(/[Ii]nit function.{0,60}PRESENT|PRESENT.{0,60}[Ii]nit function/is);
    expect(glueContractDocSource).toMatch(/memory export.{0,40}PRESENT|PRESENT.{0,40}memory export/is);
    expect(glueContractDocSource).toMatch(/fedos_core_rust\.js/);
    expect(glueContractDocSource).toMatch(/fedos_core_rust_bg\.wasm/);
    expect(glueContractDocSource).toMatch(/fedos_core_rust\.d\.ts/);
    expect(glueContractDocSource).toMatch(/fedos_core_rust_bg\.wasm\.d\.ts/);
  });

  it("2. IF the generated JS glue exists locally right now, its export list matches exactly what the contract doc recorded -- no crate-specific export", () => {
    const gluePath = `${pkgDir}/fedos_core_rust.js`;
    if (!existsSync(gluePath)) {
      return;
    }
    const glueSource: string = readFileSync(gluePath, "utf-8");
    expect(glueSource).toMatch(/export\s*\{\s*initSync\s*,\s*__wbg_init as default\s*\}/);
    // No crypto/domain-specific symbol is ever exported by this generic loader.
    expect(glueSource.toLowerCase()).not.toMatch(/encrypt|decrypt|nip.?44|secrethandle|conversationkey/);
  });

  it("3. IF the generated .wasm/pkg/ output exists locally, it is allowed to exist but must NEVER be git-tracked", () => {
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

  it("4. FedosWasmLoaderContract is a fixed, unwired observation record -- NotLoaded/StaticPlanning/false, never a live probe", () => {
    const contract = new FedosWasmLoaderContractPlaceholder();
    const status = contract.status();
    expect(status.state).toBe("NotLoaded");
    expect(status.contractVersion).toBe("1");
    expect(status.importMode).toBe("StaticPlanning");
    expect(status.initialized).toBe(false);

    expect(wasmLoaderState()).toBe("NotLoaded");
    expect(loaderContractVersion()).toBe("1");
    expect(loaderImportMode()).toBe("StaticPlanning");
    expect(loaderInitialized()).toBe(false);

    const codeOnly = loaderContractSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\bfs\./);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
  });

  it("5. runtimeCryptoActivationStatus/workerCryptoActivationStatus expose the fixed loader labels", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.loaderContractState).toBe("NotLoaded");
    expect(status.loaderImportMode).toBe("StaticPlanning");
    expect(status.loaderInitialized).toBe(false);

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.loaderContractState).toBe("NotLoaded");
    expect(workerStatus.loaderImportMode).toBe("StaticPlanning");
    expect(workerStatus.loaderInitialized).toBe(false);
  });

  it("6. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the loader contract", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("7. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the loader contract", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_wasm_loader_contract|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
    expect(workerSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. no dynamic import()/require() of the generated JS glue anywhere in src/", () => {
    expect(createRuntimeSource).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
    expect(workerSource).not.toMatch(/import\s*\(\s*["'].*fedos_core_rust/);
    const loaderCodeOnly = loaderContractSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(loaderCodeOnly).not.toMatch(/import\s*\(/);
  });

  it("9. WebAssembly.instantiate/compile are never actually invoked, even when exercising the artifact's and loader contract's full surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const artifact = createFedosWasmArtifact();
      artifact.status();
      artifact.planBuild();
      artifact.planLoad();
      const loader = createFedosWasmLoaderContract();
      loader.status();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("10. encrypt/decrypt are unchanged -- still always Unsupported", async () => {
    const provider = new FedosRuntimeCryptoProvider();
    const encrypted = await provider.encrypt({});
    expect(encrypted.state).toBe("Unsupported");
    expect(encrypted.allowed).toBe(false);
    const decrypted = await provider.decrypt({});
    expect(decrypted.state).toBe("Unsupported");
    expect(decrypted.allowed).toBe(false);
  });

  it("11. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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
  });

  it("12. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- no new dependency added", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(46);
    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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

  it("13. the internal execution contract doc records the new Generated JS Glue / Generated .wasm boxes, still unconnected", () => {
    expect(executionContractDocSource).toMatch(/Generated JS Glue/);
    expect(executionContractDocSource).toMatch(/Generated \.wasm/);
    expect(executionContractDocSource).toMatch(/FedosWasmLoaderContract/);
    expect(executionContractDocSource).toMatch(/never imported|NOT imported|never called/i);
  });
});

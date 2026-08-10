import { describe, it, expect, vi } from "vitest";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import {
  artifactPresenceReason,
  artifactPresenceState,
  artifactPresent,
  createGeneratedArtifactPresence,
} from "../src/runtime/fedos_generated_artifact_presence.js";
import { createStaticImportReadiness } from "../src/runtime/fedos_wasm_static_import_readiness.js";
import { reviewStaticImport } from "../src/runtime/fedos_wasm_static_import_review.js";
import { planStaticImport } from "../src/runtime/fedos_wasm_static_import_plan.js";
import { evaluateWasmLoaderImportPolicy } from "../src/runtime/fedos_wasm_loader_import_policy.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
import { runtimeCryptoActivationStatus } from "../src/runtime/runtime_crypto_diagnostics.js";
import { workerCryptoActivationStatus } from "../src/runtime/worker_crypto_diagnostics.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import presencePolicyDocSource from "../docs/runtime_generated_artifact_presence_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionContractDocSource from "../docs/runtime_internal_execution_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import presenceSource from "../src/os/core/vault/wasm/fedos_generated_artifact_presence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readinessSource from "../src/os/core/vault/wasm/fedos_wasm_static_import_readiness.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Stage 537–542 — "FedOS Generated Artifact Presence Policy: the last
 * safety layer before a static import, never a live filesystem check".
 * `docs/runtime_generated_artifact_presence_policy.md` (Stage 537)
 * fixes what "present" and "usable" would need to mean, and why they
 * differ. `src/runtime/fedos_generated_artifact_presence.ts` (Stage
 * 538) fixes `createGeneratedArtifactPresence()` to `{ state:
 * "PlanningOnly", present: false, reason:
 * "ArtifactNotGeneratedForRuntime" }`. Stage 539 wires
 * `createStaticImportReadiness()` to call it, discarding the result.
 * Neither this test file nor any file it exercises imports,
 * `import()`s, or executes the generated JS glue, reads the
 * filesystem via `fs`/`path`/`existsSync`/glob, calls
 * `WebAssembly.instantiate`/`compile`/`initSync`/the default init
 * export, or connects Runtime/Worker to any of it.
 */
describe("FedOS Generated Artifact Presence Policy, always blocked, fail-closed everywhere (Stage 537-542)", () => {
  it("1. createGeneratedArtifactPresence is always present:false, reason ArtifactNotGeneratedForRuntime -- never a live probe", () => {
    const presence = createGeneratedArtifactPresence();
    expect(presence.state).toBe("PlanningOnly");
    expect(presence.present).toBe(false);
    expect(presence.reason).toBe("ArtifactNotGeneratedForRuntime");
    // Pure and idempotent across repeated calls.
    expect(createGeneratedArtifactPresence()).toEqual(presence);

    expect(artifactPresenceState()).toBe("PlanningOnly");
    expect(artifactPresent()).toBe(false);
    expect(artifactPresenceReason()).toBe("ArtifactNotGeneratedForRuntime");
  });

  it("2. the presence policy's fixed answers match across diagnostics", () => {
    const status = runtimeCryptoActivationStatus();
    expect(status.artifactPresenceState).toBe("PlanningOnly");
    expect(status.artifactPresent).toBe(false);
    expect(status.artifactPresenceReason).toBe("ArtifactNotGeneratedForRuntime");

    const workerStatus = workerCryptoActivationStatus();
    expect(workerStatus.artifactPresenceState).toBe("PlanningOnly");
    expect(workerStatus.artifactPresent).toBe(false);
    expect(workerStatus.artifactPresenceReason).toBe("ArtifactNotGeneratedForRuntime");
  });

  it("3. the presence policy source never imports the generated JS glue, uses no filesystem/glob API, and never touches WebAssembly/initSync/default init/fetch/Runtime/Worker", () => {
    const codeOnly = codeOnlyLines(presenceSource);
    expect(codeOnly).not.toMatch(/import\s*\(/);
    expect(codeOnly).not.toMatch(/require\s*\(/);
    expect(codeOnly).not.toMatch(/\bfs\b/);
    expect(codeOnly).not.toMatch(/node:fs/);
    expect(codeOnly).not.toMatch(/\bpath\b/);
    expect(codeOnly).not.toMatch(/node:path/);
    expect(codeOnly).not.toMatch(/existsSync/);
    expect(codeOnly).not.toMatch(/statSync/);
    expect(codeOnly).not.toMatch(/\bglob\b/i);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/\bfetch\s*\(/);
    expect(codeOnly).not.toMatch(/instantiateStreaming/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/__wbg_init/);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/process\.env/);
    expect(codeOnly).not.toMatch(/create_runtime|AppRuntime/);
    expect(codeOnly).not.toMatch(/worker\.ts|src\/worker/);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
  });

  it("4. the static import readiness record legitimately reaches the presence policy but never the generated JS glue, WebAssembly, or filesystem", () => {
    expect(readinessSource).toMatch(/fedos_generated_artifact_presence/);
    const codeOnly = codeOnlyLines(readinessSource);
    expect(codeOnly).not.toMatch(/fedos_core_rust/);
    expect(codeOnly).not.toMatch(/WebAssembly/);
    expect(codeOnly).not.toMatch(/initSync/);
    expect(codeOnly).not.toMatch(/existsSync|statSync/);

    const readiness = createStaticImportReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toBe("RuntimeNotReady");

    const decision = reviewStaticImport();
    expect(decision.approved).toBe(false);
    expect(planStaticImport().state).toBe("BlockedByPolicy");
  });

  it("5. WebAssembly.instantiate/compile are never actually invoked, even when exercising the full plan/review/readiness/presence surface", () => {
    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      evaluateWasmLoaderImportPolicy();
      planStaticImport();
      reviewStaticImport();
      createStaticImportReadiness();
      createGeneratedArtifactPresence();
      artifactPresenceState();
      artifactPresent();
      artifactPresenceReason();
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
      createStaticImportReadiness();
      createGeneratedArtifactPresence();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("7. Runtime remains unconnected -- create_runtime.ts imports none of the WASM chain, including the presence policy", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_wasm_loader_import_policy/,
    );
    expect(createRuntimeSource).not.toMatch(/fedos_core_rust\.js|fedos_core_rust_bg\.wasm/);
  });

  it("8. Worker remains unconnected -- src/worker.ts imports none of the WASM chain, including the presence policy", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_static_import_plan|fedos_wasm_static_import_review|fedos_wasm_static_import_readiness|fedos_generated_artifact_presence|fedos_wasm_loader_import_policy/,
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

  it("10. Allowed/Approved/Ready/Present are all still unreachable anywhere in the chain", () => {
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
    expect(createStaticImportReadiness().ready).toBe(false);
    expect(createGeneratedArtifactPresence().present).toBe(false);
    expect(createGeneratedArtifactPresence().state).not.toBe("Checked");
    expect(createGeneratedArtifactPresence().reason).not.toBe("Present");
  });

  it("11. Rust public API is unchanged (28 pub fn, one #[wasm_bindgen]-annotated (version(), Stage 986)) -- Cargo/package dependencies unchanged", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(69);    expect((libRsSource.match(/#\[wasm_bindgen\]/g) ?? []).length).toBe(17);

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

  it("12. the presence policy doc and execution contract doc record the required facts", () => {
    expect(presencePolicyDocSource).toMatch(/ArtifactNotGeneratedForRuntime/);
    expect(presencePolicyDocSource).toMatch(/pkg\/fedos_core_rust\.js/);
    expect(presencePolicyDocSource).toMatch(/pkg\/fedos_core_rust_bg\.wasm/);

    expect(executionContractDocSource).toMatch(/Generated Artifact Presence/);
    expect(executionContractDocSource).toMatch(/ArtifactNotGeneratedForRuntime/);
    expect(executionContractDocSource).toMatch(/\bSTOP\b/);
  });
});

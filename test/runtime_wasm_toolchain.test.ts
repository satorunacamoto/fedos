import { describe, it, expect, vi } from "vitest";
import {
  FedosWasmToolchainPlaceholder,
  createFedosWasmToolchain,
  fedosGetrandomBackendCfgRequired,
  fedosGetrandomWasmPolicy,
  fedosWasmBindgenExpected,
  fedosWasmBuildObserved,
  fedosWasmBuildReady,
  fedosWasmPackExpected,
  fedosWasmTargetCheckObserved,
  fedosWasmTargetCheckStatus,
  fedosWasmTargetExpected,
  fedosWasmToolchainInstalled,
  fedosWasmToolchainPlanStatus,
  fedosWasmToolchainVerified,
} from "../src/runtime/fedos_wasm_toolchain.js";
import { FedosRuntimeCryptoProvider } from "../src/runtime/fedos_runtime_crypto_provider.js";
import { evaluateRuntimeCryptoActivation } from "../src/runtime/runtime_crypto_activation_policy.js";
import { evaluateWorkerCryptoActivation } from "../src/runtime/worker_crypto_activation_policy.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import toolchainSource from "../src/runtime/fedos_wasm_toolchain.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import buildContractSource from "../docs/runtime_wasm_build_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import buildObservationSource from "../docs/runtime_wasm_build_observation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import getrandomPolicySource from "../docs/runtime_wasm_getrandom_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import libRsSource from "../packages/fedos-core-rust/src/lib.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cargoTomlSource from "../packages/fedos-core-rust/Cargo.toml?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Stage 417–424 introduced a standalone, unwired `FedosWasmToolchain`
 * planning model. Stage 425–432 performs a REAL, minimal toolchain
 * PREFLIGHT on the authoring machine (`wasm32-unknown-unknown` target
 * + `wasm-bindgen-cli` installed as environment capabilities,
 * `wasm-pack` deliberately NOT installed) and adds fixed, non-detecting
 * PLAN labels (`toolchainPlanStatus`/`wasmTargetExpected`/
 * `bindgenExpected`/`wasmPackExpected`, Stage 428) to
 * `fedos_wasm_toolchain.ts`. This means the file's source code now
 * legitimately CONTAINS the literal strings `"wasm32-unknown-unknown"`
 * and (in comments) `wasm-bindgen` as PLAN facts — this suite updates
 * the old "zero wasm32/wasm-bindgen reference" assertions accordingly,
 * while keeping every guarantee that still must hold: `wasm-pack` is
 * never adopted, no build script or dependency is added, no artifact
 * is ever generated or committed, and no Runtime/Worker/crypto
 * behavior changes.
 *
 * Stage 433–437 ran a REAL, unmodified (`crate-type = ["rlib"]`,
 * no `Cargo.toml` edit) `cargo check`/`cargo build --target
 * wasm32-unknown-unknown` against `packages/fedos-core-rust` and
 * recorded the result in `docs/runtime_wasm_build_observation.md`:
 * both FAILED compiling the `getrandom` dependency (WASM support
 * requires an opt-in `getrandom` doesn't have here) — a `getrandom`
 * classification, not a fix. Stage 438 adds two more fixed,
 * non-detecting labels (`wasmTargetCheckObserved`/`wasmBuildObserved`,
 * both `"Failed"`) recording that ALREADY-COMPLETED observation; no
 * code fix, no `Cargo.toml` change, no re-run of `cargo` by this file.
 *
 * Stage 441–444 RESOLVES that `getrandom` blocker: Stage 441 fixes the
 * policy (`docs/runtime_wasm_getrandom_policy.md`) — `getrandom` 0.3.x
 * needs BOTH its own `wasm_js` Cargo feature AND a `--cfg
 * getrandom_backend="wasm_js"` compiler flag; fallback/insecure PRNGs
 * are permanently forbidden and CSPRNG failure still fails closed.
 * Stage 442 makes the ONE minimal `Cargo.toml` change this requires —
 * `getrandom`'s entry gains `features = ["wasm_js"]`, version
 * unchanged, dependency COUNT unchanged (still 10 production
 * dependencies), no `wasm-bindgen` direct dependency added. Stage
 * 443–444 re-ran `cargo check`/`cargo build --target
 * wasm32-unknown-unknown` with `RUSTFLAGS='--cfg
 * getrandom_backend="wasm_js"'` — both SUCCEED
 * (`docs/runtime_wasm_build_observation.md` §7). Stage 446 updates
 * `wasmTargetCheckObserved`/`wasmBuildObserved` from `"Failed"` to
 * `"Succeeded"` to match, and adds three new fixed labels:
 * `getrandomWasmPolicy` (`"wasm_js"`), `getrandomBackendCfgRequired`
 * (`true`), `wasmTargetCheckStatus` (`"ObservedGreen"`). Still true:
 * no `cdylib` added, `wasm-bindgen` (the CLI) never invoked,
 * `wasm-pack` never adopted, no `package.json` script, no `.wasm`/
 * generated-glue artifact, no Runtime/Worker activation, no
 * `encrypt`/`decrypt` execution, `"Allowed"` unreachable.
 */
describe("FedOS WASM toolchain readiness, minimal real preflight, fail-closed (Stage 425-448)", () => {
  function codeOnlyOf(source: string): string {
    return source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
  }

  it("1. toolchain model only -- status() reports not installed/verified, plan*() always resolve Planning", () => {
    const toolchain = new FedosWasmToolchainPlaceholder();
    const status = toolchain.status();
    expect(status.installed).toBe(false);
    expect(status.verified).toBe(false);

    for (const decision of [
      toolchain.planInstall(),
      toolchain.planBuild(),
      toolchain.planBindgen(),
      toolchain.planVerify(),
    ]) {
      expect(decision.state).toBe("Planning");
    }
  });

  it("2. status() and the standalone functions expose the fixed Stage 428 plan labels", () => {
    const status = new FedosWasmToolchainPlaceholder().status();
    expect(status.toolchainPlanStatus).toBe("Planned");
    expect(status.wasmTargetExpected).toBe("wasm32-unknown-unknown");
    expect(status.bindgenExpected).toBe(true);
    expect(status.wasmPackExpected).toBe(false);

    expect(fedosWasmToolchainPlanStatus()).toBe("Planned");
    expect(fedosWasmTargetExpected()).toBe("wasm32-unknown-unknown");
    expect(fedosWasmBindgenExpected()).toBe(true);
    expect(fedosWasmPackExpected()).toBe(false);
  });

  it("3. wasmToolchainInstalled/wasmToolchainVerified/wasmBuildReady remain fixed false, unaffected by the Stage 425 preflight", () => {
    expect(fedosWasmToolchainInstalled()).toBe(false);
    expect(fedosWasmToolchainVerified()).toBe(false);
    expect(fedosWasmBuildReady()).toBe(false);
  });

  it("4. wasm-pack is not adopted -- no hyphenated 'wasm-pack' reference anywhere in the toolchain file's code, and the plan expects it false", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/wasm-pack/i);
    expect(fedosWasmPackExpected()).toBe(false);
  });

  it("5. wasm-bindgen is a planned label only, never a package/Cargo dependency", () => {
    expect(fedosWasmBindgenExpected()).toBe(true);

    const cargoCode = cargoTomlSource.toLowerCase();
    expect(cargoCode).not.toMatch(/^\s*wasm-bindgen\s*=/m);

    const pkg = JSON.parse(packageJsonSource);
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(allDeps)).not.toContain("wasm-bindgen");
  });

  it("6. no child_process reference anywhere in the toolchain file", () => {
    const codeOnly = codeOnlyOf(toolchainSource);
    expect(codeOnly).not.toMatch(/child_process/i);
    expect(codeOnly).not.toMatch(/\bspawn\s*\(/);
    expect(codeOnly).not.toMatch(/\bexec(File)?\s*\(/);
    expect(codeOnly).not.toMatch(/\bfork\s*\(/);
  });

  it("7. no WebAssembly API reference in the toolchain file, and it is never actually invoked at runtime", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/WebAssembly/);

    const instantiate = vi.spyOn(WebAssembly, "instantiate");
    const compile = vi.spyOn(WebAssembly, "compile");
    try {
      const toolchain = createFedosWasmToolchain();
      toolchain.status();
      toolchain.planInstall();
      toolchain.planBuild();
      toolchain.planBindgen();
      toolchain.planVerify();
    } finally {
      instantiate.mockRestore();
      compile.mockRestore();
    }
    expect(instantiate).not.toHaveBeenCalled();
    expect(compile).not.toHaveBeenCalled();
  });

  it("8. no wasm build script exists OUTSIDE the single, never-auto-run build:wasm entry (Stage 450) -- no wasm-pack/rustup anywhere, and no OTHER script references wasm-bindgen/wasm32/cargo build", () => {
    const pkg = JSON.parse(packageJsonSource);
    const scripts = pkg.scripts ?? {};
    for (const [name, script] of Object.entries(scripts) as [string, string][]) {
      expect(script).not.toMatch(/wasm-pack/i);
      expect(script).not.toMatch(/rustup/i);
      if (name !== "build:wasm") {
        expect(script).not.toMatch(/wasm-bindgen/i);
        expect(script).not.toMatch(/wasm32/i);
        expect(script).not.toMatch(/cargo\s+build/i);
      }
    }
    // no npm lifecycle hook auto-invokes build:wasm
    for (const hook of ["pretest", "posttest", "prepare", "preinstall", "postinstall", "prebuild", "postbuild", "pretypecheck"]) {
      expect(Object.keys(scripts)).not.toContain(hook);
    }
  });

  it("9. no .wasm file, no generated JS bindings/glue, no compiled/native artifact exists anywhere in packages/fedos-core-rust", () => {
    const files = (
      import.meta as unknown as { glob: (pattern: string) => Record<string, unknown> }
    ).glob("../packages/fedos-core-rust/**/*");
    const paths = Object.keys(files);
    const forbidden = /\.(wasm|rlib|so|dll|dylib|node|a|o)$/i;
    const forbiddenGlue = /_bg\.(js|ts|wasm)$/i;
    for (const path of paths) {
      expect(forbidden.test(path), `unexpected compiled/native artifact: ${path}`).toBe(false);
      expect(forbiddenGlue.test(path), `unexpected generated bindgen glue: ${path}`).toBe(false);
    }
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

  it("11. Runtime remains unconnected -- create_runtime.ts does not import the toolchain or any earlier chain link", () => {
    expect(createRuntimeSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api/,
    );
  });

  it("12. Worker remains unconnected -- src/worker.ts does not import the toolchain or any earlier chain link", () => {
    expect(workerSource).not.toMatch(
      /fedos_wasm_toolchain|fedos_execution_backend|fedos_wasm_artifact|fedos_wasm_boundary|fedos_rust_invocation_adapter|fedos_internal_rust_call|fedos_rust_execution_review|fedos_rust_api|fedos_rust_boundary|fedos_opaque_api|fedos_runtime_crypto_provider/,
    );
  });

  it("13. Cargo.toml is unchanged -- production dependency count (10), no wasm-bindgen/wasm-pack dependency line", () => {
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
    expect(depLines.length).toBe(10);
    expect(cargoCode).not.toMatch(/^\s*wasm-bindgen\s*=/m);
    expect(cargoCode).not.toMatch(/^\s*wasm-pack\s*=/m);
  });

  it("14. package.json dependencies are unchanged (2), no wasm-bindgen/wasm-pack dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    expect(Object.keys(allDeps)).not.toContain("wasm-pack");
    expect(Object.keys(allDeps)).not.toContain("wasm-bindgen");
  });

  it("15. Rust public API (pub fn count) is unchanged (27)", () => {
    const pubFnNames = [...libRsSource.matchAll(/^\s*pub\s+fn\s+([a-zA-Z0-9_]+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(pubFnNames.length).toBe(27);
  });

  it("16. Allowed is still unreachable from either activation policy, even with both locks open", () => {
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

  it("17. no process.env reference in the toolchain file", () => {
    expect(codeOnlyOf(toolchainSource)).not.toMatch(/process\.env/);
  });

  it("18. no cargo build invocation, and no rustup/cargo-install invocation, anywhere in the toolchain file's code", () => {
    const codeOnly = codeOnlyOf(toolchainSource);
    expect(codeOnly).not.toMatch(/cargo\s+build/i);
    expect(codeOnly).not.toMatch(/cargo\s+install/i);
    expect(codeOnly).not.toMatch(/rustup\s+target/i);
  });

  it("19. status() and the standalone functions expose the Stage 446-updated observation labels, matching the documented Succeeded result", () => {
    const status = new FedosWasmToolchainPlaceholder().status();
    expect(status.wasmTargetCheckObserved).toBe("Succeeded");
    expect(status.wasmBuildObserved).toBe("Succeeded");

    expect(fedosWasmTargetCheckObserved()).toBe("Succeeded");
    expect(fedosWasmBuildObserved()).toBe("Succeeded");
  });

  it("20. the cargo build/check commands are documented (build contract + build observation); cargo check is never scripted anywhere, and cargo build/wasm32 appear ONLY in the never-auto-run build:wasm script", () => {
    expect(buildContractSource).toMatch(/cargo build --target wasm32-unknown-unknown/);
    expect(buildContractSource).toMatch(/cargo check --target wasm32-unknown-unknown/);
    expect(buildObservationSource).toMatch(/cargo check --target wasm32-unknown-unknown/);
    expect(buildObservationSource).toMatch(/cargo build --target wasm32-unknown-unknown/);
    expect(buildObservationSource).toMatch(/getrandom/);

    const pkg = JSON.parse(packageJsonSource);
    const scripts = pkg.scripts ?? {};
    for (const [name, script] of Object.entries(scripts) as [string, string][]) {
      expect(script).not.toMatch(/cargo\s+check/i);
      if (name !== "build:wasm") {
        expect(script).not.toMatch(/cargo\s+build/i);
        expect(script).not.toMatch(/wasm32/i);
      }
    }
  });

  it("21. Stage 435-436's original failing run is still documented, and the Stage 443-444 re-observation records wasm-bindgen (the CLI) was still never invoked", () => {
    expect(buildObservationSource).toMatch(/wasm-bindgen.{0,80}NOT run|NOT run.{0,80}wasm-bindgen/is);
    expect(buildObservationSource).toMatch(/wasm-bindgen.{0,120}NOT invoked|NOT invoked.{0,120}wasm-bindgen/is);
    expect(buildObservationSource).toMatch(/RESOLVED/);
  });

  it("22. Stage 446 getrandom wasm_js policy labels are fixed and match the documented policy/result", () => {
    const status = new FedosWasmToolchainPlaceholder().status();
    expect(status.getrandomWasmPolicy).toBe("wasm_js");
    expect(status.getrandomBackendCfgRequired).toBe(true);
    expect(status.wasmTargetCheckStatus).toBe("ObservedGreen");

    expect(fedosGetrandomWasmPolicy()).toBe("wasm_js");
    expect(fedosGetrandomBackendCfgRequired()).toBe(true);
    expect(fedosWasmTargetCheckStatus()).toBe("ObservedGreen");
  });

  it("23. Cargo.toml enables getrandom's wasm_js feature, version and dependency count unchanged, no wasm-bindgen dependency", () => {
    expect(cargoTomlSource).toMatch(/getrandom\s*=\s*\{[^}]*features\s*=\s*\[[^\]]*"wasm_js"[^\]]*\][^}]*\}/);
    expect(cargoTomlSource).toMatch(/getrandom\s*=\s*\{[^}]*version\s*=\s*"0\.3"/);

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
    expect(depLines.length).toBe(10);
    expect(cargoCode).not.toMatch(/^\s*wasm-bindgen\s*=/m);
  });

  it("24. the getrandom wasm_js policy doc names the required RUSTFLAGS cfg flag and forbids fallback PRNGs", () => {
    expect(getrandomPolicySource).toMatch(/--cfg getrandom_backend="wasm_js"/);
    expect(getrandomPolicySource).toMatch(/wasm_js/);
    expect(getrandomPolicySource).toMatch(/fallback/i);
    expect(getrandomPolicySource).toMatch(/fail[s]? closed|fails closed/i);
  });
});
